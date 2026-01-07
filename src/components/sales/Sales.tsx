import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus,
  Search,
  UserPlus,
  X,
  Save,
  Calendar,
  DollarSign,
  Percent,
  Hash,
  Clock,
  CreditCard,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { exportToExcel, exportToPDF, formatDate, formatCurrency } from '../../lib/exportUtils';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

interface InterestVariable {
  id: string;
  name: string;
  interest_rate: number;
  calculation_type: string;
}

interface Sale {
  id: string;
  client_id: string;
  client: Client;
  payment_frequency: string;
  principal_amount: number;
  interest_rate: number;
  number_of_payments: number;
  total_amount: number;
  payment_amount: number;
  sale_date: string;
  status: string;
  interest_variable: InterestVariable;
}

interface PaymentSchedule {
  id: string;
  payment_number: number;
  due_date: string;
  amount: number;
  status: string;
  updated_at?: string;
  paid_date?: string;
}

interface ClientFormData {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  contact_principal: string;
  tipo_cliente: string;
  document_number: string;
  notes: string;
}

export default function Sales() {
  const { user, userData } = useAuth();
  const [organizationId, setOrganizationId] = useState<string>('');
  const [clients, setClients] = useState<Client[]>([]);
  const [interestVariables, setInterestVariables] = useState<InterestVariable[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentSchedule[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const [filterDateFrom, setFilterDateFrom] = useState<string>(todayStr);
  const [filterDateTo, setFilterDateTo] = useState<string>(todayStr);
  const [renewalSourceId, setRenewalSourceId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    client_id: '',
    payment_frequency: 'weekly',
    principal_amount: '',
    interest_variable_id: '',
    number_of_payments: '',
    sale_date: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0],
  });

  const [clientFormData, setClientFormData] = useState<ClientFormData>({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    contact_principal: '',
    tipo_cliente: 'menudeo',
    document_number: '',
    notes: '',
  });

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();
        if (data?.organization_id) {
          setOrganizationId(data.organization_id);
        }
      }
    };
    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (organizationId) {
      loadClients();
      loadInterestVariables();
      loadSales();
    }
  }, [organizationId]);

  useEffect(() => {
    if (clients.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const clientId = params.get('client_id');
      const amount = params.get('principal_amount');
      const sourceId = params.get('renewal_from_sale_id');

      if (clientId) {
        const client = clients.find(c => c.id === clientId);
        if (client) {
          setSelectedClient(client);
          setFormData(prev => ({ 
            ...prev, 
            client_id: clientId,
            principal_amount: amount || prev.principal_amount
          }));
          setShowForm(true);
          
          // Clear URL params to prevent reopening on refresh
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
  }, [clients]);

  const loadClients = async () => {
    let query = supabase
      .from('clients')
      .select('id, name, email, phone, address')
      .eq('organization_id', organizationId)
      .order('name');

    if (userData?.role !== 'superadmin' && !userData?.permissions?.includes('*:*')) {
      if (userData?.assigned_routes && userData.assigned_routes.length > 0) {
        query = query.in('route_id', userData.assigned_routes);
      } else {
        setClients([]);
        return;
      }
    }

    const { data } = await query;
    if (data) setClients(data);
  };

  const loadInterestVariables = async () => {
    const { data } = await supabase
      .from('interest_variables')
      .select('id, name, interest_rate, calculation_type')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name');
    if (data) setInterestVariables(data);
  };

  const loadSales = async () => {
    setLoading(true);
    let query = supabase
      .from('sales')
      .select(`
        *,
        client:clients!inner(id, name, email, phone, address, route_id),
        interest_variable:interest_variables(id, name, interest_rate, calculation_type)
      `)
      .eq('organization_id', organizationId)
      .order('sale_date', { ascending: false });

    if (userData?.role !== 'superadmin' && !userData?.permissions?.includes('*:*')) {
      if (userData?.assigned_routes && userData.assigned_routes.length > 0) {
        query = query.in('client.route_id', userData.assigned_routes);
      } else {
        setSales([]);
        setLoading(false);
        return;
      }
    }

    const { data } = await query;
    if (data) setSales(data as unknown as Sale[]);
    setLoading(false);
  };

  const loadPaymentSchedule = async (saleId: string) => {
    const { data } = await supabase
      .from('payment_schedule')
      .select('*')
      .eq('sale_id', saleId)
      .order('payment_number');
    if (data) setPaymentSchedule(data);
  };

  const calculatePayments = () => {
    if (!formData.principal_amount || !formData.interest_variable_id || !formData.number_of_payments) {
      return { totalAmount: 0, paymentAmount: 0, interestRate: 0 };
    }

    const principal = parseFloat(formData.principal_amount);
    const numPayments = parseInt(formData.number_of_payments);
    const variable = interestVariables.find(v => v.id === formData.interest_variable_id);

    if (!variable) return { totalAmount: 0, paymentAmount: 0, interestRate: 0 };

    let interestRate = variable.interest_rate;

    if (variable.calculation_type === 'libre') {
      const totalAmount = principal + (principal * (interestRate / 100));
      const paymentAmount = totalAmount / numPayments;
      return { totalAmount, paymentAmount, interestRate };
    }

    let totalInterest = 0;
    if (variable.calculation_type === 'daily') {
      const daysPerPayment = formData.payment_frequency === 'daily' ? 1 :
                             formData.payment_frequency === 'weekly' ? 7 :
                             formData.payment_frequency === 'biweekly' ? 14 : 30;
      totalInterest = principal * (interestRate / 100) * numPayments * daysPerPayment;
    } else if (variable.calculation_type === 'monthly') {
      const monthsTotal = formData.payment_frequency === 'daily' ? numPayments / 30 :
                         formData.payment_frequency === 'weekly' ? numPayments / 4 :
                         formData.payment_frequency === 'biweekly' ? numPayments / 2 : numPayments;
      totalInterest = principal * (interestRate / 100) * monthsTotal;
    } else if (variable.calculation_type === 'annual') {
      const yearsTotal = formData.payment_frequency === 'daily' ? numPayments / 365 :
                        formData.payment_frequency === 'weekly' ? numPayments / 52 :
                        formData.payment_frequency === 'biweekly' ? numPayments / 26 : numPayments / 12;
      totalInterest = principal * (interestRate / 100) * yearsTotal;
    }

    const totalAmount = principal + totalInterest;
    const paymentAmount = totalAmount / numPayments;

    return { totalAmount, paymentAmount, interestRate };
  };

  const generatePaymentSchedule = (saleId: string, saleDate: string, frequency: string, numPayments: number, paymentAmount: number, userId: string) => {
    const schedule = [];
    let currentDate = new Date(saleDate);

    for (let i = 1; i <= numPayments; i++) {
      if (frequency === 'daily') {
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (frequency === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (frequency === 'biweekly') {
        currentDate.setDate(currentDate.getDate() + 14);
      } else if (frequency === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      schedule.push({
        sale_id: saleId,
        payment_number: i,
        due_date: currentDate.toISOString().split('T')[0],
        amount: paymentAmount,
        status: 'pending',
        created_by: userId
      });
    }

    return schedule;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !user) return;

    // Validar que exista una caja abierta
    const { data: cashRegister } = await supabase
      .from('cash_registers')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'open')
      .maybeSingle();

    if (!cashRegister) {
      alert('Debe abrir caja antes de realizar cualquier movimiento.');
      return;
    }

    const { totalAmount, paymentAmount, interestRate } = calculatePayments();

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
      .insert({
        organization_id: organizationId,
        client_id: formData.client_id,
        payment_frequency: formData.payment_frequency,
        principal_amount: parseFloat(formData.principal_amount),
        interest_variable_id: formData.interest_variable_id,
        interest_rate: interestRate,
        number_of_payments: parseInt(formData.number_of_payments),
        total_amount: totalAmount,
        payment_amount: paymentAmount,
        sale_date: formData.sale_date,
        created_by: user.id,
      })
      .select()
      .single();

    if (saleError) {
      console.error('Error creating sale:', saleError);
      return;
    }

    const schedule = generatePaymentSchedule(
      saleData.id,
      formData.sale_date,
      formData.payment_frequency,
      parseInt(formData.number_of_payments),
      paymentAmount,
      user.id
    );

    await supabase.from('payment_schedule').insert(schedule);

    // Registrar salida de dinero en caja si está abierta (Préstamo)
    // La caja ya fue validada al inicio de la función
    if (cashRegister) {
      const { error: movementError } = await supabase.from('cash_register_movements').insert({
        cash_register_id: cashRegister.id,
        organization_id: organizationId,
        type: 'expense', // Salida de dinero
        amount: parseFloat(formData.principal_amount),
        payment_method: 'cash', // Asumimos efectivo por defecto al no haber selector
        reference_id: saleData.id,
        client_id: formData.client_id,
        concept: `Préstamo a cliente - ${selectedClient?.name || 'Cliente'}`,
        movement_date: new Date().toISOString(),
        created_by: user.id
      });

      if (movementError) {
        console.error('Error creating cash register movement:', movementError);
        alert('Venta creada pero hubo un error al registrar el movimiento en caja. Por favor contacte soporte.');
      }
    }

    setFormData({
      client_id: '',
      payment_frequency: 'weekly',
      principal_amount: '',
      interest_variable_id: '',
      number_of_payments: '',
      sale_date: new Date().toISOString().split('T')[0],
    });
    setSelectedClient(null);
    setShowForm(false);
    loadSales();
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !user) return;

    const { data, error } = await supabase
      .from('clients')
      .insert({
        organization_id: organizationId,
        ...clientFormData,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating client:', error);
      return;
    }

    setClientFormData({
      name: '',
      email: '',
      phone: '',
      whatsapp: '',
      address: '',
      contact_principal: '',
      tipo_cliente: 'individual',
      document_number: '',
      notes: '',
    });
    setShowClientModal(false);
    await loadClients();

    if (data) {
      setSelectedClient(data);
      setFormData({ ...formData, client_id: data.id });
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm)
  );

  const filteredSales = sales.filter(sale => {
    const matchesSearch = sale.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.client.phone.includes(searchTerm);

    const matchesStatus = filterStatus === 'all' || sale.status === filterStatus;

    const saleDate = new Date(sale.sale_date);
    const matchesDateFrom = !filterDateFrom || saleDate >= new Date(filterDateFrom);
    const matchesDateTo = !filterDateTo || saleDate <= new Date(filterDateTo + 'T23:59:59');

    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  const { totalAmount, paymentAmount } = calculatePayments();

  const frequencyLabels: Record<string, string> = {
    daily: 'Diaria',
    weekly: 'Semanal',
    biweekly: 'Quincenal',
    monthly: 'Mensual',
  };

  const statusLabels: Record<string, string> = {
    active: 'Activa',
    pending: 'Pendiente',
    completed: 'Completada',
    renewed: 'Renovada',
    cancelled: 'Cancelada',
  };

  const handleExportExcel = () => {
    const exportData = filteredSales.map(sale => ({
      fecha: formatDate(sale.sale_date),
      cliente: sale.client.name,
      telefono: sale.client.phone,
      monto_prestado: sale.principal_amount,
      interes: sale.total_amount - sale.principal_amount,
      total: sale.total_amount,
      cuota: sale.payment_amount,
      pagos: sale.number_of_payments,
      frecuencia: frequencyLabels[sale.payment_frequency],
      estado: statusLabels[sale.status],
    }));

    exportToExcel(
      exportData,
      [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Cliente', key: 'cliente', width: 25 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'Monto Prestado', key: 'monto_prestado', width: 15 },
        { header: 'Interés', key: 'interes', width: 12 },
        { header: 'Total', key: 'total', width: 12 },
        { header: 'Cuota', key: 'cuota', width: 12 },
        { header: 'No. Pagos', key: 'pagos', width: 10 },
        { header: 'Frecuencia', key: 'frecuencia', width: 12 },
        { header: 'Estado', key: 'estado', width: 12 },
      ],
      {
        filename: `Ventas_${new Date().toISOString().split('T')[0]}`,
        sheetName: 'Ventas',
      }
    );
  };

  const handleExportPDF = () => {
    const exportData = filteredSales.map(sale => ({
      fecha: formatDate(sale.sale_date),
      cliente: sale.client.name,
      monto: formatCurrency(sale.principal_amount),
      total: formatCurrency(sale.total_amount),
      cuota: formatCurrency(sale.payment_amount),
      pagos: sale.number_of_payments,
      estado: statusLabels[sale.status],
    }));

    exportToPDF(
      exportData,
      [
        { header: 'Fecha', key: 'fecha' },
        { header: 'Cliente', key: 'cliente' },
        { header: 'Prestado', key: 'monto' },
        { header: 'Total', key: 'total' },
        { header: 'Cuota', key: 'cuota' },
        { header: 'Pagos', key: 'pagos' },
        { header: 'Estado', key: 'estado' },
      ],
      {
        filename: `Ventas_${new Date().toISOString().split('T')[0]}`,
        title: 'Listado de Ventas',
      }
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Cargando ventas...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Ventas</h1>
              <p className="text-gray-400 mt-1 hidden sm:block">Gestiona las ventas y préstamos</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportExcel}
                className="btn-base btn-icon btn-success sm:btn-mobile"
                title="Exportar a Excel"
              >
                <FileSpreadsheet className="w-5 h-5" />
                <span className="hidden sm:inline">Excel</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="btn-base btn-icon btn-danger sm:btn-mobile"
                title="Exportar a PDF"
              >
                <Download className="w-5 h-5" />
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="btn-base btn-primary btn-mobile gap-2"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Nueva Venta</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            <input
              type="text"
              placeholder="Buscar por cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-base input-mobile bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-base input-mobile bg-gray-700 border-gray-600 text-white focus:border-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activa</option>
              <option value="completed">Completada</option>
              <option value="cancelled">Cancelada</option>
            </select>
            <input
              type="date"
              placeholder="Desde"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="input-base input-mobile bg-gray-700 border-gray-600 text-white focus:border-blue-500"
            />
            <input
              type="date"
              placeholder="Hasta"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="input-base input-mobile bg-gray-700 border-gray-600 text-white focus:border-blue-500"
            />
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Nueva Venta</h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setSelectedClient(null);
                    setFormData({
                      client_id: '',
                      payment_frequency: 'weekly',
                      principal_amount: '',
                      interest_variable_id: '',
                      number_of_payments: '',
                      sale_date: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0],
                    });
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Cliente *
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      {selectedClient ? (
                        <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{selectedClient.name}</p>
                            <p className="text-sm text-gray-400">{selectedClient.phone}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClient(null);
                              setFormData({ ...formData, client_id: '' });
                            }}
                            className="text-gray-400 hover:text-white"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                              type="text"
                              placeholder="Buscar cliente..."
                              value={searchTerm}
                              onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setShowClientSearch(true);
                              }}
                              onFocus={() => setShowClientSearch(true)}
                              className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          {showClientSearch && searchTerm && (
                            <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {filteredClients.length > 0 ? (
                                filteredClients.map((client) => (
                                  <button
                                    key={client.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedClient(client);
                                      setFormData({ ...formData, client_id: client.id });
                                      setSearchTerm('');
                                      setShowClientSearch(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-600 border-b border-gray-600 last:border-b-0"
                                  >
                                    <p className="font-medium text-white">{client.name}</p>
                                    <p className="text-sm text-gray-400">{client.phone} - {client.email}</p>
                                  </button>
                                ))
                              ) : (
                                <div className="px-4 py-3 text-gray-400 text-center">
                                  No se encontraron clientes
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowClientModal(true)}
                      className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg transition-colors"
                      title="Nuevo Cliente"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Calendar className="inline w-4 h-4 mr-1" />
                      Fecha de Venta *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.sale_date}
                      onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Clock className="inline w-4 h-4 mr-1" />
                      Frecuencia de Pago *
                    </label>
                    <select
                      required
                      value={formData.payment_frequency}
                      onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="daily">Diaria</option>
                      <option value="weekly">Semanal</option>
                      <option value="biweekly">Quincenal</option>
                      <option value="monthly">Mensual</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <DollarSign className="inline w-4 h-4 mr-1" />
                    Valor sin Interés *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.principal_amount}
                    onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Percent className="inline w-4 h-4 mr-1" />
                    Tasa de Interés *
                  </label>
                  <select
                    required
                    value={formData.interest_variable_id}
                    onChange={(e) => setFormData({ ...formData, interest_variable_id: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Seleccionar tasa...</option>
                    {interestVariables.map((variable) => (
                      <option key={variable.id} value={variable.id}>
                        {variable.name} - {variable.interest_rate}% ({variable.calculation_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Hash className="inline w-4 h-4 mr-1" />
                    Número de Pagos *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.number_of_payments}
                    onChange={(e) => setFormData({ ...formData, number_of_payments: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="Ej: 10"
                  />
                </div>

                {formData.principal_amount && formData.interest_variable_id && formData.number_of_payments && (
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 space-y-2">
                    <h3 className="font-semibold text-white mb-2">Resumen de Cálculo</h3>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Monto Prestado:</span>
                      <span className="text-white font-medium">${parseFloat(formData.principal_amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Interés:</span>
                      <span className="text-white font-medium">${(totalAmount - parseFloat(formData.principal_amount)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-gray-600 pt-2">
                      <span className="text-gray-300 font-medium">Total a Pagar:</span>
                      <span className="text-green-400 font-bold text-lg">${totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Cuota {frequencyLabels[formData.payment_frequency]}:</span>
                      <span className="text-blue-400 font-bold">${paymentAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setSelectedClient(null);
                      setFormData({
                        client_id: '',
                        payment_frequency: 'weekly',
                        principal_amount: '',
                        interest_variable_id: '',
                        number_of_payments: '',
                        sale_date: new Date().toISOString().split('T')[0],
                      });
                    }}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Save className="w-5 h-5" />
                    Guardar Venta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showClientModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Nuevo Cliente</h2>
                <button
                  onClick={() => setShowClientModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateClient} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <User className="inline w-4 h-4 mr-1" />
                    Nombre / Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientFormData.name}
                    onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Mail className="inline w-4 h-4 mr-1" />
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={clientFormData.email}
                      onChange={(e) => setClientFormData({ ...clientFormData, email: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Phone className="inline w-4 h-4 mr-1" />
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      required
                      value={clientFormData.phone}
                      onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={clientFormData.whatsapp}
                    onChange={(e) => setClientFormData({ ...clientFormData, whatsapp: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <MapPin className="inline w-4 h-4 mr-1" />
                    Dirección *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientFormData.address}
                    onChange={(e) => setClientFormData({ ...clientFormData, address: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Contacto Principal
                  </label>
                  <input
                    type="text"
                    value={clientFormData.contact_principal}
                    onChange={(e) => setClientFormData({ ...clientFormData, contact_principal: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <FileText className="inline w-4 h-4 mr-1" />
                    Documento
                  </label>
                  <input
                    type="text"
                    value={clientFormData.document_number}
                    onChange={(e) => setClientFormData({ ...clientFormData, document_number: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowClientModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Save className="w-5 h-5" />
                    Guardar Cliente
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid gap-6">
          {filteredSales.map((sale) => (
            <div key={sale.id} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-white">{sale.client.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        sale.status === 'active' ? 'bg-green-900 text-green-300' :
                        sale.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
                        sale.status === 'completed' ? 'bg-blue-900 text-blue-300' :
                        sale.status === 'renewed' ? 'bg-purple-900 text-purple-300' :
                        'bg-red-900 text-red-300'
                      }`}>
                        {statusLabels[sale.status]}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {sale.client.phone}
                      </div>
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {sale.client.email}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(sale.sale_date)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {frequencyLabels[sale.payment_frequency]}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={async () => {
                        if (selectedSale?.id === sale.id) {
                          setSelectedSale(null);
                          setPaymentSchedule([]);
                        } else {
                          setSelectedSale(sale);
                          await loadPaymentSchedule(sale.id);
                        }
                      }}
                      className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                    >
                      {selectedSale?.id === sale.id ? 'Ocultar' : 'Ver Cronograma'}
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('¿Cancelar esta venta?')) return;
                        await supabase
                          .from('sales')
                          .update({ status: 'cancelled', updated_by: user?.id, updated_at: new Date().toISOString() })
                          .eq('id', sale.id);
                        loadSales();
                      }}
                      className="text-red-400 hover:text-red-300 text-sm font-medium"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="bg-gray-700 rounded-lg p-3 sm:p-4">
                    <p className="text-label mb-1 truncate max-w-[120px]">Monto Prestado</p>
                    <p className="text-metric text-white">${sale.principal_amount.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3 sm:p-4">
                    <p className="text-label mb-1 truncate max-w-[120px]">Interés ({sale.interest_rate}%)</p>
                    <p className="text-metric text-orange-400">${(sale.total_amount - sale.principal_amount).toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3 sm:p-4">
                    <p className="text-label mb-1 truncate max-w-[120px]">Total a Pagar</p>
                    <p className="text-metric text-green-400">${sale.total_amount.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3 sm:p-4">
                    <p className="text-label mb-1 truncate max-w-[120px]">Cuota ({sale.number_of_payments}x)</p>
                    <p className="text-metric text-blue-400">${sale.payment_amount.toFixed(2)}</p>
                  </div>
                </div>

                {selectedSale?.id === sale.id && paymentSchedule.length > 0 && (
                  <div className="border-t border-gray-700 pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Cronograma de Pagos
                    </h4>
                    <div className="grid gap-2 max-h-96 overflow-y-auto">
                      {paymentSchedule.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between bg-gray-700 rounded p-3 text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400 font-medium">#{payment.payment_number}</span>
                            <div className="flex flex-col">
                              <span className="text-gray-300">
                                {formatDate(payment.due_date)}
                              </span>
                              {payment.status === 'paid' && payment.updated_at && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(payment.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-white font-semibold">${payment.amount.toFixed(2)}</span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              payment.status === 'paid' ? 'bg-green-900 text-green-300' :
                              payment.status === 'overdue' ? 'bg-red-900 text-red-300' :
                              'bg-yellow-900 text-yellow-300'
                            }`}>
                              {payment.status === 'paid' ? 'Pagado' :
                               payment.status === 'overdue' ? 'Vencido' : 'Pendiente'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredSales.length === 0 && sales.length > 0 && (
            <div className="text-center py-12 text-gray-400">
              <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No se encontraron ventas con los filtros aplicados</p>
            </div>
          )}

          {sales.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No hay ventas registradas</p>
              <p className="text-sm">Crea tu primera venta para comenzar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
