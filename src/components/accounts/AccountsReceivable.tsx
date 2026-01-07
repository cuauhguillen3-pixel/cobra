import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, DollarSign, Calendar, AlertCircle, Plus, X, Receipt, TrendingUp, Download, FileSpreadsheet } from 'lucide-react';
import { exportToExcel, exportToPDF, formatDate, formatCurrency } from '../../lib/exportUtils';

interface AccountReceivable {
  id: string;
  invoice_number: string;
  client_id: string;
  sale_id?: string;
  source_type: 'manual' | 'sale';
  amount: number;
  balance: number;
  start_date?: string;
  due_date: string;
  status: string;
  notes?: string;
  created_at: string;
  clients: {
    name: string;
    phone?: string;
    route_id?: string;
    routes?: {
      nombre_ruta: string;
    };
  };
  sales?: {
    payment_frequency: string;
    number_of_payments: number;
    interest_rate: number;
    payment_schedule?: {
        status: string;
        payment_number: number;
        due_date: string;
        amount: number;
      }[];
  };
}

interface Payment {
  id: string;
  payment_date: string;
  total_amount: number;
}

export default function AccountsReceivable() {
  const { user, userData } = useAuth();
  const [accounts, setAccounts] = useState<AccountReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountReceivable | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all');
  const [filterSource, setFilterSource] = useState<'all' | 'manual' | 'sale'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [selectedClientForHistory, setSelectedClientForHistory] = useState<{id: string, name: string} | null>(null);
  const [clientHistory, setClientHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [formData, setFormData] = useState({
    client_id: '',
    invoice_number: '',
    amount: '',
    due_date: '',
    notes: ''
  });

  const loadClientHistory = async (clientId: string) => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          users:created_by (name)
        `)
        .eq('organization_id', userData?.organization_id)
        .eq('client_id', clientId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setClientHistory(data || []);
    } catch (error) {
      console.error('Error loading client history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (selectedClientForHistory) {
      loadClientHistory(selectedClientForHistory.id);
    }
  }, [selectedClientForHistory]);


  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    loadAccounts();
    loadClients();
  }, [userData?.organization_id]);

  const loadClients = async () => {
    if (!userData?.organization_id) return;

    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .eq('organization_id', userData.organization_id)
      .order('name');

    if (data) setClients(data);
  };

  const loadAccounts = async () => {
    if (!userData?.organization_id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('accounts_receivable')
        .select(`
          *,
          clients!inner (name, phone, route_id, routes(nombre_ruta)),
          sales (payment_frequency, number_of_payments, interest_rate, payment_schedule(status, payment_number, due_date, amount))
        `)
        .eq('organization_id', userData.organization_id)
        .order('created_at', { ascending: false });

      if (userData?.role !== 'superadmin' && !userData?.permissions?.includes('*:*')) {
        if (userData?.assigned_routes && userData.assigned_routes.length > 0) {
          query = query.in('clients.route_id', userData.assigned_routes);
        } else {
          setAccounts([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async (accountId: string, saleId?: string) => {
    try {
      let query = supabase
        .from('payments')
        .select('id, payment_date, total_amount')
        .eq('organization_id', userData?.organization_id)
        .order('payment_date', { ascending: false });

      if (saleId) {
        const { data: scheduleData } = await supabase
          .from('payment_schedule')
          .select('id')
          .eq('sale_id', saleId);

        if (scheduleData && scheduleData.length > 0) {
          const scheduleIds = scheduleData.map(s => s.id);
          query = query.in('payment_schedule_id', scheduleIds);
        }
      }

      const { data } = await query;
      setPayments(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('accounts_receivable')
        .insert({
          organization_id: userData?.organization_id,
          client_id: formData.client_id,
          invoice_number: formData.invoice_number,
          amount: parseFloat(formData.amount),
          balance: parseFloat(formData.amount),
          due_date: formData.due_date,
          source_type: 'manual',
          status: 'pending',
          notes: formData.notes,
          created_by: user?.id
        });

      if (error) throw error;

      setShowAddModal(false);
      setFormData({
        client_id: '',
        invoice_number: '',
        amount: '',
        due_date: '',
        notes: ''
      });
      loadAccounts();
    } catch (error: any) {
      alert('Error al crear cuenta por cobrar: ' + error.message);
    }
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = new Date(dueDate) < new Date() && status === 'pending';

    if (isOverdue) {
      return <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Vencida</span>;
    }

    if (status === 'paid') {
      return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Pagada</span>;
    }

    return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">Pendiente</span>;
  };

  const getSourceBadge = (sourceType: string) => {
    if (sourceType === 'sale') {
      return <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />
        Venta
      </span>;
    }
    return <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400 flex items-center gap-1">
      <FileText className="w-3 h-3" />
      Manual
    </span>;
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch =
      !searchTerm ||
      account.clients.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (account.clients.phone || '').includes(searchTerm) ||
      account.invoice_number.toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = filterStatus === 'all' ||
      (filterStatus === 'overdue' && new Date(account.due_date) < new Date() && account.status === 'pending') ||
      (filterStatus === account.status);
    const sourceMatch = filterSource === 'all' || account.source_type === filterSource;
    const dueDate = new Date(account.due_date);
    const matchesDateFrom = !filterDateFrom || dueDate >= new Date(filterDateFrom);
    const matchesDateTo = !filterDateTo || dueDate <= new Date(filterDateTo + 'T23:59:59');
    return matchesSearch && statusMatch && sourceMatch && matchesDateFrom && matchesDateTo;
  });

  const totalReceivable = filteredAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
  const totalOverdue = filteredAccounts
    .filter(acc => new Date(acc.due_date) < new Date() && acc.status === 'pending')
    .reduce((sum, acc) => sum + Number(acc.balance), 0);

  const handleExportExcel = () => {
    const exportData = filteredAccounts.map(account => {
      const daysLate = account.status === 'pending' && new Date(account.due_date) < new Date() 
        ? Math.ceil((new Date().getTime() - new Date(account.due_date).getTime()) / (1000 * 3600 * 24)) 
        : 0;
      const paidPayments = account.sales?.payment_schedule?.filter(p => p.status === 'paid').length || 0;
      const totalPayments = account.sales?.number_of_payments || 0;
      const paymentValue = account.sales?.payment_schedule?.[0]?.amount || 0;

      return {
        numero_factura: account.invoice_number,
        cliente: account.clients.name,
        telefono: account.clients.phone || '',
        ruta: account.clients.routes?.nombre_ruta || 'N/A',
        origen: account.source_type === 'sale' ? 'Venta' : 'Manual',
        interes: account.sales?.interest_rate ? `${account.sales.interest_rate}%` : '-',
        valor_pago: paymentValue > 0 ? paymentValue : '-',
        pagos: account.source_type === 'sale' ? `${paidPayments}/${totalPayments}` : '-',
        dias_atraso: daysLate > 0 ? daysLate : '-',
        monto: account.amount,
        saldo: account.balance,
        fecha_vencimiento: formatDate(account.due_date),
        estado: account.status === 'paid' ? 'Pagada' : (new Date(account.due_date) < new Date() && account.status === 'pending') ? 'Vencida' : 'Pendiente',
        notas: account.notes || '',
      };
    });

    exportToExcel(
      exportData,
      [
        { header: 'No. Factura', key: 'numero_factura', width: 15 },
        { header: 'Cliente', key: 'cliente', width: 25 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'Ruta', key: 'ruta', width: 15 },
        { header: 'Origen', key: 'origen', width: 12 },
        { header: '% Int.', key: 'interes', width: 10 },
        { header: 'Valor Pago', key: 'valor_pago', width: 12 },
        { header: 'Pagos', key: 'pagos', width: 10 },
        { header: 'Días Atraso', key: 'dias_atraso', width: 12 },
        { header: 'Monto', key: 'monto', width: 12 },
        { header: 'Saldo', key: 'saldo', width: 12 },
        { header: 'Fecha Vencimiento', key: 'fecha_vencimiento', width: 18 },
        { header: 'Estado', key: 'estado', width: 12 },
        { header: 'Notas', key: 'notas', width: 30 },
      ],
      {
        filename: `Cuentas_Por_Cobrar_${new Date().toISOString().split('T')[0]}`,
        sheetName: 'Cuentas por Cobrar',
      }
    );
  };

  const handleExportPDF = () => {
    const exportData = filteredAccounts.map(account => ({
      numero_factura: account.invoice_number,
      cliente: account.clients.name,
      monto: formatCurrency(account.amount),
      saldo: formatCurrency(account.balance),
      fecha_vencimiento: formatDate(account.due_date),
      estado: account.status === 'paid' ? 'Pagada' : (new Date(account.due_date) < new Date() && account.status === 'pending') ? 'Vencida' : 'Pendiente',
    }));

    exportToPDF(
      exportData,
      [
        { header: 'No. Factura', key: 'numero_factura' },
        { header: 'Cliente', key: 'cliente' },
        { header: 'Monto', key: 'monto' },
        { header: 'Saldo', key: 'saldo' },
        { header: 'Vencimiento', key: 'fecha_vencimiento' },
        { header: 'Estado', key: 'estado' },
      ],
      {
        filename: `Cuentas_Por_Cobrar_${new Date().toISOString().split('T')[0]}`,
        title: 'Cuentas por Cobrar',
      }
    );
  };

  if (loading) {
    return <div className="text-gray-400">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Cuentas por Cobrar</h2>
          <p className="text-gray-400">Administra las facturas pendientes de cobro</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            title="Exportar a Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            title="Exportar a PDF"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nueva Cuenta Manual
          </button>
        </div>
      </div>

      

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total por Cobrar</p>
              <p className="text-2xl font-bold text-gray-100">${totalReceivable.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Vencidas</p>
              <p className="text-2xl font-bold text-red-400">${totalOverdue.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <input
            type="text"
            placeholder="Buscar cliente, factura o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-base input-mobile bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-label mb-1 block">Estado</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="input-base input-mobile bg-gray-700 border-gray-600 text-white focus:border-blue-500"
          >
            <option value="all">Todas</option>
            <option value="pending">Pendientes</option>
            <option value="overdue">Vencidas</option>
            <option value="paid">Pagadas</option>
          </select>
        </div>
        <div>
          <label className="text-label mb-1 block">Origen</label>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as any)}
            className="input-base input-mobile bg-gray-700 border-gray-600 text-white focus:border-blue-500"
          >
            <option value="all">Todas</option>
            <option value="manual">Manuales</option>
            <option value="sale">Ventas</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <label className="text-label mb-1 block">Fecha de vencimiento desde:</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="input-base input-mobile bg-gray-700 border-gray-600 text-white focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-label mb-1 block">Hasta:</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="input-base input-mobile bg-gray-700 border-gray-600 text-white focus:border-blue-500"
          />
        </div>
        {(filterDateFrom || filterDateTo) && (
          <div className="col-span-2 flex justify-end">
            <button
              onClick={() => {
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
              className="btn-base btn-ghost btn-mobile"
            >
              Limpiar fechas
            </button>
          </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden">
        {filteredAccounts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No hay cuentas por cobrar
          </div>
        ) : (
          <>
            {/* Grouping Logic */}
            {(() => {
              const groupedAccounts = filteredAccounts.reduce((acc, account) => {
                const clientId = account.client_id;
                if (!acc[clientId]) {
                  acc[clientId] = {
                    clientName: account.clients.name,
                    clientPhone: account.clients.phone,
                    accounts: [],
                    totalBalance: 0
                  };
                }
                acc[clientId].accounts.push(account);
                acc[clientId].totalBalance += Number(account.balance);
                return acc;
              }, {} as Record<string, { clientName: string; clientPhone?: string; accounts: AccountReceivable[]; totalBalance: number }>);

              const sortedGroups = Object.values(groupedAccounts).sort((a, b) => 
                a.clientName.localeCompare(b.clientName)
              );

              return (
                <>
                  {/* Vista de tarjetas para móvil */}
                  <div className="block md:hidden">
                    <div className="divide-y divide-gray-700">
                      {sortedGroups.map((group, groupIndex) => (
                        <div key={groupIndex} className="bg-gray-800/50">
                          <div className="p-4 bg-gray-900/50 border-b border-gray-700 flex justify-between items-center">
                            <div>
                              <button 
                                onClick={() => setSelectedClientForHistory({ id: group.accounts[0].client_id, name: group.clientName })}
                                className="font-bold text-gray-100 hover:text-blue-400 transition-colors text-left"
                              >
                                {group.clientName}
                              </button>
                              {group.clientPhone && (
                                <p className="text-sm text-gray-400">{group.clientPhone}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-400">Total Deuda</p>
                              <p className="text-lg font-bold text-blue-400">
                                ${group.totalBalance.toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="divide-y divide-gray-700">
                            {group.accounts.map((account) => (
                              <div key={account.id} className="p-4 hover:bg-gray-700/50 pl-8 border-l-4 border-l-blue-500/20">
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Receipt className="w-4 h-4 text-gray-400" />
                                      <p className="font-semibold text-gray-100">{account.invoice_number}</p>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    {getStatusBadge(account.status, account.due_date)}
                                    {getSourceBadge(account.source_type)}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                  <div>
                                    <p className="text-xs text-gray-400">Monto Original</p>
                                    <p className="text-sm font-medium text-gray-100">
                                      ${Number(account.amount).toFixed(2)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-400">Saldo</p>
                                    <p className="text-lg font-bold text-blue-400">
                                      ${Number(account.balance).toFixed(2)}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                      Pagado: ${Number(account.amount - account.balance).toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                                <div className="space-y-1 mb-3">
                                  {account.start_date && (
                                    <p className="text-xs text-gray-400">
                                      Inicio: {new Date(account.start_date).toLocaleDateString()}
                                    </p>
                                  )}
                                  <p className="text-xs text-gray-300">
                                    Vence: {new Date(account.due_date).toLocaleDateString()}
                                  </p>
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedAccount(account);
                                    loadPayments(account.id, account.sale_id);
                                  }}
                                  className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                                >
                                  Ver Detalles
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Vista de tabla para escritorio */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-900/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Factura
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Ruta
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            % Int.
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Valor Pago
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Pagos
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            # Pend.
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Días Atraso
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Monto/Saldo
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      {sortedGroups.map((group, groupIndex) => (
                        <tbody key={groupIndex} className="divide-y divide-gray-700 border-b border-gray-700">
                          {/* Client Header Row */}
                          <tr className="bg-gray-900/30">
                            <td colSpan={9} className="px-6 py-3">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-1 bg-blue-500 rounded-full"></div>
                                  <div>
                                    <button 
                                      onClick={() => setSelectedClientForHistory({ id: group.accounts[0].client_id, name: group.clientName })}
                                      className="font-bold text-gray-100 text-lg hover:text-blue-400 transition-colors text-left"
                                    >
                                      {group.clientName}
                                    </button>
                                    {group.clientPhone && (
                                      <p className="text-sm text-gray-400 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                        {group.clientPhone}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right pr-4">
                                  <span className="text-sm text-gray-400 mr-2">Total Deuda:</span>
                                  <span className="text-lg font-bold text-blue-400">
                                    ${group.totalBalance.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                          {/* Account Rows */}
                          {group.accounts.map((account) => {
                             const daysLate = account.status === 'pending' && new Date(account.due_date) < new Date() 
                                ? Math.ceil((new Date().getTime() - new Date(account.due_date).getTime()) / (1000 * 3600 * 24)) 
                                : 0;
                             
                             const paidPayments = account.sales?.payment_schedule?.filter(p => p.status === 'paid').length || 0;
                             const totalPayments = account.sales?.number_of_payments || 0;
                             const pendingNumbers = account.sales?.payment_schedule
                                ?.filter(p => p.status === 'pending')
                                .sort((a, b) => a.payment_number - b.payment_number)
                                .map(p => `#${p.payment_number}`)
                                .slice(0, 3)
                                .join(', ') || '-';
                                
                             const hasMorePending = (account.sales?.payment_schedule?.filter(p => p.status === 'pending').length || 0) > 3;
                             const paymentValue = account.sales?.payment_schedule?.[0]?.amount || 0;

                             return (
                            <tr key={account.id} className="hover:bg-gray-700/50 bg-gray-800/20">
                              <td className="px-6 py-4 whitespace-nowrap pl-10">
                                <div className="flex items-center gap-2">
                                  <Receipt className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-100">
                                    {account.invoice_number}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-400 ml-6">
                                   {getSourceBadge(account.source_type)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                {account.clients.routes?.nombre_ruta || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                {account.sales?.interest_rate ? `${account.sales.interest_rate}%` : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                {paymentValue > 0 ? `$${paymentValue.toFixed(2)}` : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                {account.source_type === 'sale' ? `${paidPayments}/${totalPayments}` : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                {pendingNumbers}
                                {hasMorePending ? '...' : ''}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {daysLate > 0 ? (
                                    <span className="text-red-400 font-bold">{daysLate} días</span>
                                ) : (
                                    <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-100">
                                  ${Number(account.amount).toFixed(2)}
                                </div>
                                <div className="text-sm font-bold text-blue-400">
                                  Saldo: ${Number(account.balance).toFixed(2)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(account.status, account.due_date)}
                                <div className="text-xs text-gray-400 mt-1">
                                    Vence: {new Date(account.due_date).toLocaleDateString()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    setSelectedAccount(account);
                                    loadPayments(account.id, account.sale_id);
                                  }}
                                  className="text-blue-400 hover:text-blue-300 text-sm"
                                >
                                  Ver Detalles
                                </button>
                              </td>
                            </tr>
                          )})}
                        </tbody>
                      ))}
                    </table>
                  </div>
                </>
              );
            })()}
          </>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-100">Nueva Cuenta por Cobrar</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Cliente</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-100"
                  required
                >
                  <option value="">Seleccionar cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Número de Factura</label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Monto</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Fecha de Vencimiento</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Notas (opcional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-100"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  Crear Cuenta
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-700 text-gray-300 py-2 rounded-lg hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-100">Detalles de Cuenta</h3>
              <button onClick={() => setSelectedAccount(null)} className="text-gray-400 hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Factura</p>
                  <p className="text-lg font-semibold text-gray-100">{selectedAccount.invoice_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Cliente</p>
                  <p className="text-lg font-semibold text-gray-100">{selectedAccount.clients.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Monto Original</p>
                  <p className="text-lg font-semibold text-gray-100">${Number(selectedAccount.amount).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Saldo Restante</p>
                  <p className="text-lg font-bold text-blue-400">${Number(selectedAccount.balance).toFixed(2)}</p>
                </div>
                {selectedAccount.start_date && (
                  <div>
                    <p className="text-sm text-gray-400">Fecha de Inicio</p>
                    <p className="text-lg text-gray-100">{new Date(selectedAccount.start_date).toLocaleDateString()}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-400">Fecha de Vencimiento</p>
                  <p className="text-lg text-gray-100">{new Date(selectedAccount.due_date).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedAccount.sales && (
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-100 mb-2">Información de Venta</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Frecuencia</p>
                      <p className="text-gray-100">{selectedAccount.sales.payment_frequency}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Núm. Pagos</p>
                      <p className="text-gray-100">{selectedAccount.sales.number_of_payments}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Tasa Interés</p>
                      <p className="text-gray-100">{selectedAccount.sales.interest_rate}%</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedAccount.notes && (
                <div>
                  <p className="text-sm text-gray-400 mb-1">Notas</p>
                  <p className="text-gray-100">{selectedAccount.notes}</p>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-gray-100 mb-2">Historial de Pagos</h4>
                {payments.length > 0 ? (
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <div key={payment.id} className="bg-gray-900/50 rounded-lg p-3 flex justify-between items-center">
                        <div>
                          <p className="text-sm text-gray-100">{new Date(payment.payment_date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-green-400">${Number(payment.total_amount).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No hay pagos registrados</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedClientForHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-100">
                Movimientos de {selectedClientForHistory.name}
              </h3>
              <button 
                onClick={() => setSelectedClientForHistory(null)} 
                className="text-gray-400 hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="text-center py-8 text-gray-400">Cargando movimientos...</div>
            ) : clientHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No hay movimientos registrados para este cliente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clientHistory.map((payment) => (
                  <div key={payment.id} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-200">
                          {new Date(payment.payment_date || payment.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-400 capitalize">
                          Método: {payment.payment_method}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-400 text-lg">
                          ${Number(payment.total_amount).toFixed(2)}
                        </p>
                        <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                          Completado
                        </span>
                      </div>
                    </div>
                    {payment.users && (
                      <p className="text-xs text-gray-500 mt-2 border-t border-gray-700 pt-2">
                        Registrado por: {payment.users.name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
