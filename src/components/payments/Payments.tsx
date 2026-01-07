import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DollarSign, Plus, Trash2, X, Check, AlertCircle, Wifi, WifiOff, Search, Edit2, RefreshCw, Save, Upload, Camera, FileText, Download, FileSpreadsheet, User, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { exportToExcel, exportToPDF, formatDate, formatCurrency } from '../../lib/exportUtils';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface ClientSummary {
  total_balance: number;
  next_payment_date: string | null;
  next_payment_amount: number;
  pending_payment_number: number;
  credit_balance: number;
  late_fee_amount: number;
  days_late: number;
}

interface PaymentScheduleItem {
  id: string;
  sale_id: string;
  payment_number: number;
  due_date: string;
  amount: number;
  status: string;
  late_fee_amount: number;
  late_fee_override: number | null;
  days_late: number;
  late_days_paid: number;
  is_late_fee_editable: boolean;
}

interface PaymentMethod {
  id: string;
  method: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'otro';
  amount: string;
  reference: string;
  image_file?: File | null;
  image_url?: string;
}

interface PaymentsProps {
  onNavigate?: (view: string) => void;
}

export default function Payments({ onNavigate }: PaymentsProps) {
  const { userData, user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientSummary, setClientSummary] = useState<ClientSummary | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PaymentScheduleItem | null>(null);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState<string>('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { id: '1', method: 'efectivo', amount: '', reference: '' }
  ]);
  const [notes, setNotes] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showForm, setShowForm] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lateFeeOverride, setLateFeeOverride] = useState<string>('');
  const [isLateFeeEditable, setIsLateFeeEditable] = useState(false);
  const [defaultLateFee, setDefaultLateFee] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Obtener fecha local en formato YYYY-MM-DD
  const today = new Date();
  const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  
  const [filterDateFrom, setFilterDateFrom] = useState<string>(todayStr);
  const [filterDateTo, setFilterDateTo] = useState<string>(todayStr);
  const [paymentDate, setPaymentDate] = useState<string>(todayStr);
  const [renewalFees, setRenewalFees] = useState<any[]>([]);
  const [renewalLateFeeTotal, setRenewalLateFeeTotal] = useState<number>(0);
  const [renewalLateDaysTotal, setRenewalLateDaysTotal] = useState<number>(0);
  const [renewalOutstanding, setRenewalOutstanding] = useState<number>(0);
  const [renewalFeeAmount, setRenewalFeeAmount] = useState<number>(0);
  const [renewalNewTotal, setRenewalNewTotal] = useState<number>(0);
  const [renewalPaidAmount, setRenewalPaidAmount] = useState<number>(0);
  const [renewalTotalAmount, setRenewalTotalAmount] = useState<number>(0);
  const [renewalCashHandout, setRenewalCashHandout] = useState<number>(0);
  const [showRenewalDetails, setShowRenewalDetails] = useState<boolean>(false);
  const [editableRenewalAmount, setEditableRenewalAmount] = useState<number>(0);

  const [showRenewalModal, setShowRenewalModal] = useState<boolean>(false);
  const [lastLateFeeAppliedDate, setLastLateFeeAppliedDate] = useState<string | null>(null);
  const [hasOpenCashRegister, setHasOpenCashRegister] = useState<boolean | null>(null);

  useEffect(() => {
    const checkCashRegister = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('cash_registers')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'open')
          .maybeSingle();
        setHasOpenCashRegister(!!data);
      } catch (err) {
        console.error('Error checking cash register:', err);
        setHasOpenCashRegister(false);
      }
    };
    checkCashRegister();
  }, [user, showForm]); // Re-check when form opens

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    loadClients();
    loadPayments();
    loadDefaultLateFee();
    loadRenewalFees();
  }, [userData]);

  useEffect(() => {
    if (clientSearchTerm.length > 0) {
      const filtered = clients.filter(client =>
        client.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
        client.phone.includes(clientSearchTerm)
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(clients);
    }
  }, [clientSearchTerm, clients]);

  useEffect(() => {
    if (selectedClient) {
      loadClientSummary(selectedClient.id);
      loadPendingPayment(selectedClient.id);
    } else {
      setClientSummary(null);
      setPendingPayment(null);
      setActiveLoans([]);
      setSelectedSaleId('');
    }
  }, [selectedClient]);

  useEffect(() => {
    if (selectedSaleId && activeLoans.length > 0) {
      const loan = activeLoans.find(l => l.id === selectedSaleId);
      if (loan) {
        setPendingPayment(loan.nextPayment);
      }
      loadLastLateFeeAppliedDate(selectedSaleId);
    } else if (activeLoans.length === 0) {
      setPendingPayment(null);
    }
  }, [selectedSaleId, activeLoans]);

  useEffect(() => {
    if (pendingPayment && pendingPayment.due_date) {
      calculateLateFee();
    }
  }, [pendingPayment, defaultLateFee]);

  const loadDefaultLateFee = async () => {
    if (!userData?.organization_id) return;

    try {
      // 1. Intentar cargar la mora por defecto
      let { data, error } = await supabase
        .from('late_payment_fees')
        .select('*')
        .eq('organization_id', userData.organization_id)
        .eq('is_default', true)
        .eq('is_active', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      // 2. Si no hay default, cargar cualquiera activa
      if (!data) {
        const { data: fallback, error: fallbackError } = await supabase
          .from('late_payment_fees')
          .select('*')
          .eq('organization_id', userData.organization_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
          
        if (fallbackError && fallbackError.code !== 'PGRST116') throw fallbackError;
        data = fallback;
      }

      setDefaultLateFee(data);
    } catch (error) {
      console.error('Error loading default late fee:', error);
    }
  };

  const loadLastLateFeeAppliedDate = async (saleId: string) => {
    try {
      const { data, error } = await supabase
        .from('payment_schedule')
        .select('late_fee_applied_date')
        .eq('sale_id', saleId)
        .eq('status', 'paid')
        .order('late_fee_applied_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setLastLateFeeAppliedDate(data?.late_fee_applied_date || null);
    } catch (error) {
      console.error('Error loading last late fee applied date:', error);
      setLastLateFeeAppliedDate(null);
    }
  };

  const calculateLateFee = () => {
    if (!pendingPayment || !pendingPayment.due_date) return;

    const dueDate = new Date(pendingPayment.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const isLateFeeJustPaidToday = lastLateFeeAppliedDate
      ? new Date(lastLateFeeAppliedDate).toDateString() === today.toDateString()
      : false;

    const totalDaysLate = isLateFeeJustPaidToday
      ? 0
      : Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Calculate Net Days Late (subtracting paid days)
    const lateDaysPaid = pendingPayment.late_days_paid || 0;
    const netDaysLate = Math.max(0, totalDaysLate - lateDaysPaid);

    if (totalDaysLate > 0 && defaultLateFee && defaultLateFee.is_active) {
      let lateFeeAmount = 0;

      if (defaultLateFee.fee_type === 'percentage') {
        lateFeeAmount = (pendingPayment.amount * defaultLateFee.fee_value / 100) * netDaysLate;
      } else {
        lateFeeAmount = defaultLateFee.fee_value * netDaysLate;
      }

      // Avoid infinite loop if values haven't changed
      if (pendingPayment.days_late === totalDaysLate && 
          Math.abs(pendingPayment.late_fee_amount - lateFeeAmount) < 0.01 && 
          pendingPayment.is_late_fee_editable === false) {
        return;
      }

      setPendingPayment(prev => prev ? {
        ...prev,
        days_late: totalDaysLate,
        late_fee_amount: lateFeeAmount,
        is_late_fee_editable: false
      } : null);
    } else if (totalDaysLate > 0 && !defaultLateFee?.is_active) {
      if (pendingPayment.days_late === totalDaysLate && pendingPayment.is_late_fee_editable === true) {
        return;
      }

      setPendingPayment(prev => prev ? {
        ...prev,
        days_late: totalDaysLate,
        is_late_fee_editable: true
      } : null);
    } else if (totalDaysLate === 0) {
      if (pendingPayment.days_late === 0 && pendingPayment.late_fee_amount === 0) {
        return;
      }
      setPendingPayment(prev => prev ? {
        ...prev,
        days_late: 0,
        late_fee_amount: 0,
      } : null);
    }
  };

  const loadRenewalFees = async () => {
    if (!userData?.organization_id) return;
    try {
      const { data, error } = await supabase
        .from('renewal_fees')
        .select('*')
        .eq('organization_id', userData.organization_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRenewalFees(data || []);
    } catch (error) {
      console.error('Error loading renewal fees:', error);
    }
  };

  const computeLateFeeTotalForSale = async (saleId: string) => {
    try {
      const { data: schedule, error } = await supabase
        .from('payment_schedule')
        .select('*')
        .eq('sale_id', saleId);
      if (error) throw error;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let totalAmount = 0;
      let totalDays = 0;
      if (defaultLateFee && defaultLateFee.is_active) {
        for (const item of schedule || []) {
          let currentDaysLate = 0;
          
          if (item.status === 'pending') {
            const due = new Date(item.due_date);
            due.setHours(0, 0, 0, 0);
            currentDaysLate = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
          } else {
            // For paid items, use the stored days_late
            currentDaysLate = item.days_late || 0;
          }

          // Determine how many days were paid
          // We distinguish between legacy records (late_days_paid IS NULL) and new records (late_days_paid IS NOT NULL)
          // Requires migration: UPDATE payment_schedule SET late_days_paid = NULL WHERE late_days_paid = 0 AND updated_at < '2026-01-06'
          let paidDays = item.late_days_paid || 0;
          
          if (item.status === 'paid' && item.late_days_paid === null && item.days_late > 0) {
             // Legacy record: assume fully paid/waived
             paidDays = currentDaysLate;
          }

          const netDaysLate = Math.max(0, currentDaysLate - paidDays);

          if (netDaysLate > 0) {
            totalDays += netDaysLate;
            if (defaultLateFee.fee_type === 'percentage') {
              totalAmount += (parseFloat(item.amount.toString()) * defaultLateFee.fee_value / 100) * netDaysLate;
            } else {
              totalAmount += defaultLateFee.fee_value * netDaysLate;
            }
          }
        }
      }
      return { amount: totalAmount, days: totalDays };
    } catch (error) {
      console.error('Error computing late fee total:', error);
      return { amount: 0, days: 0 };
    }
  };

  const getOutstandingPendingForSale = async (saleId: string) => {
    try {
      const { data, error } = await supabase
        .from('payment_schedule')
        .select('amount, status')
        .eq('sale_id', saleId)
        .eq('status', 'pending');
      if (error) throw error;
      return (data || []).reduce((sum, p: any) => sum + parseFloat(p.amount), 0);
    } catch (error) {
      console.error('Error computing outstanding:', error);
      return 0;
    }
  };

  const recalcRenewalTotals = async (amountOverride?: number) => {
    if (!pendingPayment?.sale_id) return;
    
    // Fetch Sale Info (Total Amount and Principal)
    const { data: saleData } = await supabase
      .from('sales')
      .select('total_amount, principal_amount')
      .eq('id', pendingPayment.sale_id)
      .single();

    if (!saleData) return;

    const [lateResult, outstanding] = await Promise.all([
      computeLateFeeTotalForSale(pendingPayment.sale_id),
      getOutstandingPendingForSale(pendingPayment.sale_id),
    ]);
    
    // Calculate Liquidation Amount (Outstanding Balance)
    // This is what needs to be paid off to liquidate the old loan
    const liquidationAmount = outstanding;

    const lateTotal = lateResult.amount;
    const lateDays = lateResult.days;

    setRenewalLateFeeTotal(lateTotal);
    setRenewalLateDaysTotal(lateDays);
    setRenewalOutstanding(outstanding);
    setRenewalPaidAmount(liquidationAmount);
    
    // Use override or default to current principal
    const newPrincipal = amountOverride !== undefined ? amountOverride : saleData.principal_amount;
    
    // Update editable state if it wasn't the source of the change (initial load)
    if (amountOverride === undefined) {
      setEditableRenewalAmount(newPrincipal);
    }
    
    // We use the Principal as the "Total Amount" for the purpose of the renewal loan (Cash Out)
    setRenewalTotalAmount(newPrincipal);

    let feeAmount = 0;
    renewalFees.forEach(fee => {
      if (fee.calculation_type === 'percentage') {
        feeAmount += outstanding * (fee.value / 100);
      } else {
        feeAmount += fee.value;
      }
    });
    setRenewalFeeAmount(feeAmount);
    
    // New Calculation: Cash Handout = New Principal - Liquidation(Outstanding) - Fees - LateFees
    const cashHandout = newPrincipal - liquidationAmount - feeAmount - lateTotal;
    setRenewalCashHandout(cashHandout);
    
    // We don't calculate the new Total Debt here as it depends on interest settings in the new sale
    setRenewalNewTotal(0); 
  };

  useEffect(() => {
    recalcRenewalTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPayment, defaultLateFee, renewalFees]);

  const loadClients = async () => {
    if (!userData?.organization_id) return;

    try {
      let query = supabase
        .from('clients')
        .select('id, name, email, phone, sales!inner(status), route_id')
        .eq('organization_id', userData.organization_id)
        .eq('sales.status', 'active')
        .order('name');

      if (userData?.role !== 'superadmin' && userData?.role !== 'admin' && !userData?.permissions?.includes('*:*')) {
        if (userData?.assigned_routes && userData.assigned_routes.length > 0) {
          query = query.in('route_id', userData.assigned_routes);
        } else {
          setClients([]);
          return;
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadClientSummary = async (clientId: string) => {
    if (!userData?.organization_id) return;

    try {
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('id')
        .eq('organization_id', userData.organization_id)
        .eq('client_id', clientId)
        .eq('status', 'active');

      if (salesError) throw salesError;

      if (!sales || sales.length === 0) {
        setClientSummary({
          total_balance: 0,
          next_payment_date: null,
          next_payment_amount: 0,
          pending_payment_number: 0,
          credit_balance: 0,
          late_fee_amount: 0,
          days_late: 0
        });
        return;
      }

      const saleIds = sales.map(s => s.id);

      const { data: schedule, error: scheduleError } = await supabase
        .from('payment_schedule')
        .select('*')
        .in('sale_id', saleIds)
        .eq('status', 'pending')
        .order('due_date');

      if (scheduleError) throw scheduleError;

      const { data: creditBalance, error: creditError } = await supabase
        .from('client_credit_balance')
        .select('amount')
        .eq('organization_id', userData.organization_id)
        .eq('client_id', clientId)
        .eq('status', 'available')
        .maybeSingle();

      if (creditError) throw creditError;

      const totalBalance = schedule?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;
      const nextPayment = schedule && schedule.length > 0 ? schedule[0] : null;

      setClientSummary({
        total_balance: totalBalance,
        next_payment_date: nextPayment?.due_date || null,
        next_payment_amount: nextPayment ? parseFloat(nextPayment.amount) : 0,
        pending_payment_number: nextPayment?.payment_number || 0,
        credit_balance: creditBalance?.amount || 0,
        late_fee_amount: nextPayment?.late_fee_amount || 0,
        days_late: nextPayment?.days_late || 0
      });
    } catch (error) {
      console.error('Error loading client summary:', error);
    }
  };

  const loadPendingPayment = async (clientId: string) => {
    if (!userData?.organization_id) return;

    try {
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('id, total_amount, principal_amount')
        .eq('organization_id', userData.organization_id)
        .eq('client_id', clientId)
        .eq('status', 'active');

      if (salesError) throw salesError;

      if (!sales || sales.length === 0) {
        setPendingPayment(null);
        setActiveLoans([]);
        setSelectedSaleId('');
        return;
      }

      const saleIds = sales.map(s => s.id);

      const { data: allSchedules, error: scheduleError } = await supabase
        .from('payment_schedule')
        .select('*')
        .in('sale_id', saleIds)
        .eq('status', 'pending')
        .order('due_date');

      if (scheduleError) throw scheduleError;

      const loans = sales.map(sale => {
        const schedules = (allSchedules || []).filter(s => s.sale_id === sale.id);
        if (schedules.length === 0) return null;
        
        schedules.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        
        return {
          ...sale,
          nextPayment: schedules[0],
          pendingCount: schedules.length,
          totalPending: schedules.reduce((sum, s) => sum + parseFloat(s.amount), 0)
        };
      }).filter((l): l is NonNullable<typeof l> => l !== null);

      setActiveLoans(loans);

      if (loans.length > 0) {
        // If no selection or invalid selection, pick the first one
        // Ideally we pick the one with earliest due date, but they are implicitly ordered by sales order if not sorted
        // Let's sort loans by next payment due date
        loans.sort((a, b) => new Date(a.nextPayment.due_date).getTime() - new Date(b.nextPayment.due_date).getTime());
        
        if (!selectedSaleId || !loans.find(l => l.id === selectedSaleId)) {
          setSelectedSaleId(loans[0].id);
        } else {
           // If we have a selection, ensure pendingPayment is updated immediately or via effect
           // The effect will handle it.
        }
      } else {
        setPendingPayment(null);
        setSelectedSaleId('');
      }
    } catch (error) {
      console.error('Error loading pending payment:', error);
    }
  };

  const loadPayments = async () => {
    if (!userData?.organization_id) return;

    try {
      setLoading(true);
      let query = supabase
        .from('payments')
        .select(`
          *,
          client:clients!inner(name, route_id),
          collector:users!payments_collector_id_fkey(name)
        `)
        .eq('organization_id', userData.organization_id)
        .order('created_at', { ascending: false });

      if (userData?.role !== 'superadmin' && !userData?.permissions?.includes('*:*')) {
        if (userData?.assigned_routes && userData.assigned_routes.length > 0) {
          query = query.in('client.route_id', userData.assigned_routes);
        } else {
          setPayments([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      console.log('Pagos cargados:', data?.length || 0);
      setPayments(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectClient = (client: Client) => {
    setSelectedClient(client);
    setClientSearchTerm(client.name);
    setShowClientDropdown(false);
  };

  const addPaymentMethod = () => {
    setPaymentMethods([
      ...paymentMethods,
      { id: Date.now().toString(), method: 'efectivo', amount: '', reference: '' }
    ]);
  };

  const removePaymentMethod = (id: string) => {
    if (paymentMethods.length > 1) {
      setPaymentMethods(paymentMethods.filter(pm => pm.id !== id));
    }
  };

  const updatePaymentMethod = (id: string, field: string, value: any) => {
    setPaymentMethods(paymentMethods.map(pm =>
      pm.id === id ? { ...pm, [field]: value } : pm
    ));
  };

  const handleImageSelect = (id: string, file: File | null) => {
    setPaymentMethods(paymentMethods.map(pm =>
      pm.id === id ? { ...pm, image_file: file } : pm
    ));
  };

  const uploadPaymentImage = async (file: File, paymentId: string, methodIndex: number): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${paymentId}_${methodIndex}_${Date.now()}.${fileExt}`;
      const filePath = `payment-receipts/${userData?.organization_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('payment-receipts')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const calculateTotalPayment = () => {
    return paymentMethods.reduce((sum, pm) => sum + (parseFloat(pm.amount) || 0), 0);
  };

  const calculateTotalDue = () => {
    if (!pendingPayment) return 0;
    const baseDue = parseFloat(pendingPayment.amount.toString());
    let lateFee = pendingPayment.late_fee_amount || 0;
    
    if (isLateFeeEditable) {
      const parsedOverride = parseFloat(lateFeeOverride);
      if (!isNaN(parsedOverride)) {
        lateFee = parsedOverride;
      } else if (lateFeeOverride === '') {
        lateFee = 0;
      }
    }

    return baseDue + lateFee;
  };

  const toggleLateFeeEditable = async () => {
    // Permite a todos editar la morosidad
    const newEditableState = !isLateFeeEditable;
    setIsLateFeeEditable(newEditableState);

    if (newEditableState) {
      setLateFeeOverride(pendingPayment?.late_fee_amount?.toString() || '0');
    } else {
      setLateFeeOverride('');
      calculateLateFee();
    }
  };

  const handleRenewSale = async (): Promise<boolean> => {
    if (!selectedClient || !pendingPayment) {
      alert('Selecciona un cliente con un pago pendiente');
      return false;
    }

    // Validar que exista una caja abierta
    const { data: cashRegisterCheck } = await supabase
      .from('cash_registers')
      .select('id')
      .eq('user_id', user?.id)
      .eq('status', 'open')
      .maybeSingle();

    if (!cashRegisterCheck) {
      alert('Debe abrir caja antes de realizar una renovación.');
      return false;
    }

    if (editableRenewalAmount <= 0) {
      alert('El monto del nuevo préstamo debe ser mayor a 0.');
      return false;
    }

    if (renewalCashHandout < 0) {
      alert(`No es posible renovar: El monto a entregar sería negativo ($${renewalCashHandout.toFixed(2)}).`);
      return false;
    }

    if (!confirm(`¿Confirmar renovación?\n\nSe liquidará el préstamo actual y se redirigirá a la creación del nuevo préstamo.\n\nMonto a entregar: $${renewalCashHandout.toFixed(2)}`)) {
      return false;
    }

    setIsSubmitting(true);
    try {
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('*')
        .eq('id', pendingPayment.sale_id)
        .maybeSingle();

      if (saleError) throw saleError;
      if (!sale) {
        alert('No se encontró la venta a renovar');
        return false;
      }

      // 1. Update old sale to 'completed' (saldada) and mark as renewed
      const { error: updateSaleError } = await supabase
        .from('sales')
        .update({
          status: 'completed',
          renewal_status: 'renewed',
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', sale.id);

      if (updateSaleError) throw updateSaleError;

      // 2. Record Income Movements (Settlement of old loan)
      if (cashRegisterCheck) {
         // Income: Cancelación saldo anterior
         if (renewalPaidAmount > 0) {
            const { error: m2Error } = await supabase.from('cash_register_movements').insert({
              organization_id: userData?.organization_id,
              cash_register_id: cashRegisterCheck.id,
              type: 'payment',
              amount: renewalPaidAmount,
              payment_method: 'cash',
              concept: `Pago de liquidación (Renovación) - ${selectedClient.name}`,
              client_id: selectedClient.id,
              movement_date: new Date().toISOString(),
              created_by: user?.id
            });
            if (m2Error) throw m2Error;
         }

         // Income: Morosidad
         if (renewalLateFeeTotal > 0) {
            const { error: m3Error } = await supabase.from('cash_register_movements').insert({
              organization_id: userData?.organization_id,
              cash_register_id: cashRegisterCheck.id,
              type: 'payment',
              amount: renewalLateFeeTotal,
              payment_method: 'cash',
              concept: `Pago de morosidad (Renovación) - ${selectedClient.name}`,
              client_id: selectedClient.id,
              movement_date: new Date().toISOString(),
              created_by: user?.id
            });
            if (m3Error) throw m3Error;
         }

         // Income: Cuotas de Renovación (Desglosadas)
         for (const fee of renewalFees) {
            const thisFeeAmount = fee.calculation_type === 'percentage'
              ? renewalOutstanding * (fee.value / 100)
              : fee.value;

            if (thisFeeAmount > 0) {
              const { error: m4Error } = await supabase.from('cash_register_movements').insert({
                organization_id: userData?.organization_id,
                cash_register_id: cashRegisterCheck.id,
                type: 'payment',
                amount: thisFeeAmount,
                payment_method: 'cash',
                concept: `Pago de renovación: ${fee.name} - ${selectedClient.name}`,
                client_id: selectedClient.id,
                movement_date: new Date().toISOString(),
                created_by: user?.id
              });
              if (m4Error) throw m4Error;
            }
         }
      }

      // 3. Redirect to New Sale
      const params = new URLSearchParams({
        client_id: selectedClient.id,
        principal_amount: editableRenewalAmount.toString(),
        renewal_from_sale_id: sale.id
      });

      setShowRenewalModal(false);
      
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({}, '', newUrl);
      
      if (onNavigate) {
        onNavigate('sales');
      }
      return true;

    } catch (error: any) {
      console.error('Error renewing sale:', error);
      alert(`Error al renovar la venta: ${error.message || 'Error desconocido'}`);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClient) {
      alert('Selecciona un cliente');
      return;
    }

    if (!pendingPayment) {
      alert('No hay pagos pendientes para este cliente');
      return;
    }

    const totalPayment = calculateTotalPayment();
    const totalDue = calculateTotalDue();

    if (totalPayment <= 0) {
      alert('El monto total del pago debe ser mayor a 0');
      return;
    }

    const principalAmount = parseFloat(pendingPayment.amount.toString());
    if (totalPayment < principalAmount) {
      alert(`El monto del pago ($${totalPayment.toFixed(2)}) debe cubrir al menos la cuota base ($${principalAmount.toFixed(2)})`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Validar que exista una caja abierta
      const { data: cashRegister } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('user_id', user?.id)
        .eq('status', 'open')
        .maybeSingle();
      
      if (!cashRegister) {
        alert('Debe abrir caja antes de realizar cualquier movimiento.');
        return;
      }

      const askedLateFee = isLateFeeEditable && lateFeeOverride
        ? parseFloat(lateFeeOverride)
        : (pendingPayment.late_fee_amount || 0);

      const availableForLateFee = Math.max(0, totalPayment - principalAmount);
      
      // Si el pago es menor al total requerido (capital + mora solicitada), 
      // la mora final es lo que sobre después del capital.
      // Si el pago cubre todo, la mora final es la solicitada.
      const finalLateFee = totalPayment < (principalAmount + askedLateFee)
        ? availableForLateFee
        : askedLateFee;

      // Calcular días pagados basados en el monto final pagado

      // Calcular días pagados basados en el monto final pagado
      let daysPaid = 0;
      if (finalLateFee > 0 && defaultLateFee && defaultLateFee.is_active) {
         let costPerDay = 0;
         if (defaultLateFee.fee_type === 'percentage') {
            costPerDay = (parseFloat(pendingPayment.amount.toString()) * defaultLateFee.fee_value / 100);
         } else {
            costPerDay = defaultLateFee.fee_value;
         }
         
         if (costPerDay > 0) {
            // Permitir decimales para precisión
            daysPaid = Number((finalLateFee / costPerDay).toFixed(4));
         }
      }

      const mapPaymentMethod = (method: string) => {
        const methodMap: Record<string, string> = {
          'efectivo': 'cash',
          'transferencia': 'transfer',
          'tarjeta': 'card',
          'cheque': 'check',
          'otro': 'other'
        };
        return methodMap[method] || 'cash';
      };

      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          organization_id: userData?.organization_id,
          client_id: selectedClient.id,
          collector_id: user?.id,
          created_by: user?.id,
          amount: totalPayment,
          total_amount: totalPayment,
          payment_date: paymentDate,
          payment_method: mapPaymentMethod(paymentMethods[0]?.method || 'efectivo'),
          payment_schedule_id: pendingPayment.id,
          notes,
          status: 'completed',
          synced: true,
          synced_at: new Date().toISOString()
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      for (let i = 0; i < paymentMethods.length; i++) {
        const method = paymentMethods[i];
        const methodAmount = parseFloat(method.amount);
        if (isNaN(methodAmount) || methodAmount <= 0) continue;

        let imageUrl = null;
        if (method.image_file) {
          imageUrl = await uploadPaymentImage(method.image_file, payment.id, i);
        }

        const { error: methodError } = await supabase
          .from('payment_methods_detail')
          .insert({
            payment_id: payment.id,
            payment_method: method.method,
            amount: methodAmount,
            reference: method.reference,
            image_url: imageUrl,
            created_by: user?.id
          });

        if (methodError) throw methodError;
      }

      const currentLateDaysPaid = pendingPayment.late_days_paid || 0;

      const { error: scheduleError } = await supabase
        .from('payment_schedule')
        .update({
          status: 'paid',
          paid_amount: parseFloat(pendingPayment.amount.toString()),
          paid_date: paymentDate,
          late_fee_amount: finalLateFee,
          late_fee_override: isLateFeeEditable ? finalLateFee : null,
          days_late: pendingPayment.days_late || 0,
          late_days_paid: currentLateDaysPaid + daysPaid,
          late_fee_applied_date: finalLateFee > 0 ? new Date().toISOString() : null,
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', pendingPayment.id);

      if (scheduleError) {
        // Si falla la actualización del cronograma, intentamos revertir el pago o avisar
        console.error('Error updating schedule:', scheduleError);
        throw new Error(`Error al actualizar el cronograma: ${scheduleError.message}`);
      }

      if (totalPayment > totalDue) {
        const excess = totalPayment - totalDue;
        await supabase
          .from('client_credit_balance')
          .insert({
            organization_id: userData?.organization_id,
            client_id: selectedClient.id,
            amount: excess,
            origin_payment_id: payment.id,
            status: 'available',
            created_by: user?.id
          });
      }

      // Registrar movimiento en caja (ya validada)
      if (cashRegister) {
        // Obtener datos de la venta para calcular interés
        const { data: saleData } = await supabase
          .from('sales')
          .select('total_amount, principal_amount')
          .eq('id', pendingPayment.sale_id)
          .single();

        let remainingLateFee = finalLateFee;

        for (const method of paymentMethods) {
          const amount = parseFloat(method.amount);
          if (isNaN(amount) || amount <= 0) continue;

          let feePortion = 0;
          let principalPortion = amount;

          if (remainingLateFee > 0) {
            feePortion = Math.min(amount, remainingLateFee);
            principalPortion = amount - feePortion;
            remainingLateFee -= feePortion;
          }

          const methodType = mapPaymentMethod(method.method);

          if (feePortion > 0) {
            const { error: feeError } = await supabase.from('cash_register_movements').insert({
              organization_id: userData?.organization_id,
              cash_register_id: cashRegister.id,
              type: 'payment',
              amount: feePortion,
              payment_method: methodType as 'cash' | 'card' | 'transfer',
              reference_id: payment.id,
              client_id: selectedClient.id,
              concept: `Pago de morosidad - ${selectedClient.name}`,
              movement_date: new Date().toISOString(),
              created_by: user?.id
            });
            if (feeError) throw feeError;
          }

          if (principalPortion > 0) {
            let interestAmount = 0;
            let capitalAmount = principalPortion;

            if (saleData && saleData.total_amount > 0) {
              const totalInterest = saleData.total_amount - saleData.principal_amount;
              const interestRatio = totalInterest / saleData.total_amount;
              interestAmount = Number((principalPortion * interestRatio).toFixed(2));
              capitalAmount = Number((principalPortion - interestAmount).toFixed(2));
            }

            if (interestAmount > 0) {
              const { error: interestError } = await supabase.from('cash_register_movements').insert({
                organization_id: userData?.organization_id,
                cash_register_id: cashRegister.id,
                type: 'payment',
                amount: interestAmount,
                payment_method: methodType as 'cash' | 'card' | 'transfer',
                reference_id: payment.id,
                client_id: selectedClient.id,
                concept: `Pago de intereses - ${selectedClient.name}`,
                movement_date: new Date().toISOString(),
                created_by: user?.id
              });
              if (interestError) throw interestError;
            }

            if (capitalAmount > 0) {
              const { error: capitalError } = await supabase.from('cash_register_movements').insert({
                organization_id: userData?.organization_id,
                cash_register_id: cashRegister.id,
                type: 'payment',
                amount: capitalAmount,
                payment_method: methodType as 'cash' | 'card' | 'transfer',
                reference_id: payment.id,
                client_id: selectedClient.id,
                concept: `Pago de abono - ${selectedClient.name}`,
                movement_date: new Date().toISOString(),
                created_by: user?.id
              });
              if (capitalError) throw capitalError;
            }
          }
        }
      }

      await loadPayments();
      alert('Pago registrado exitosamente');
      resetForm();
    } catch (error: any) {
      console.error('Error saving payment:', error);
      alert(`Error al guardar el pago: ${error.message || 'Error desconocido'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedClient(null);
    setClientSearchTerm('');
    setPaymentMethods([{ id: '1', method: 'efectivo', amount: '', reference: '' }]);
    setNotes('');
    setShowForm(false);
    setLateFeeOverride('');
    setIsLateFeeEditable(false);
    setPendingPayment(null);
    setPaymentDate(todayStr);
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || payment.status === filterStatus;

    let paymentDateStr = '';
    
    // Lógica unificada de detección de fecha correcta (coincide con la visualización)
    const rawPaymentDate = payment.payment_date;
    const createdDate = new Date(payment.created_at);
    const utcDateStr = createdDate.toISOString().split('T')[0];
    const localDate = new Date(createdDate.getTime() - (createdDate.getTimezoneOffset() * 60000));
    const localDateStr = localDate.toISOString().split('T')[0];

    // Si la fecha de pago guardada coincide con la fecha UTC de creación, pero es diferente a la fecha local
    // (síntoma del bug de zona horaria), usamos la fecha local de creación.
    if (rawPaymentDate === utcDateStr && rawPaymentDate !== localDateStr) {
      paymentDateStr = localDateStr;
    } else if (rawPaymentDate && rawPaymentDate.length === 10) {
      paymentDateStr = rawPaymentDate;
    } else {
      paymentDateStr = localDateStr;
    }

    const matchesDateFrom = !filterDateFrom || paymentDateStr >= filterDateFrom;
    const matchesDateTo = !filterDateTo || paymentDateStr <= filterDateTo;

    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  const handleRegisterFromHistory = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setSelectedClient(client);
      setClientSearchTerm(client.name);
      setShowForm(true);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredPayments.map(payment => ({
      fecha: formatDate(payment.payment_date || payment.created_at),
      cliente: payment.client?.name || 'N/A',
      monto: payment.total_amount || payment.amount || 0,
      cobrador: payment.collector?.name || 'N/A',
      estado: 'Completado',
    }));

    exportToExcel(
      exportData,
      [
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Cliente', key: 'cliente', width: 25 },
        { header: 'Monto', key: 'monto', width: 12 },
        { header: 'Cobrador', key: 'cobrador', width: 20 },
        { header: 'Estado', key: 'estado', width: 12 },
      ],
      {
        filename: `Pagos_${new Date().toISOString().split('T')[0]}`,
        sheetName: 'Pagos',
      }
    );
  };

  const handleExportPDF = () => {
    const exportData = filteredPayments.map(payment => ({
      fecha: formatDate(payment.payment_date || payment.created_at),
      cliente: payment.client?.name || 'N/A',
      monto: formatCurrency(payment.total_amount || payment.amount || 0),
      cobrador: payment.collector?.name || 'N/A',
      estado: 'Completado',
    }));

    exportToPDF(
      exportData,
      [
        { header: 'Fecha', key: 'fecha' },
        { header: 'Cliente', key: 'cliente' },
        { header: 'Monto', key: 'monto' },
        { header: 'Cobrador', key: 'cobrador' },
        { header: 'Estado', key: 'estado' },
      ],
      {
        filename: `Pagos_${new Date().toISOString().split('T')[0]}`,
        title: 'Historial de Pagos',
      }
    );
  };

  const totalPayment = calculateTotalPayment();
  const totalDue = calculateTotalDue();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Pagos</h1>
          <p className="text-gray-600 mt-1 hidden sm:block">Registra y gestiona los pagos</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span className="text-sm font-medium">{isOnline ? 'En línea' : 'Sin conexión'}</span>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-base btn-primary btn-mobile gap-2 bg-orange-500 hover:bg-orange-600"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Registrar Pago</span>
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Nuevo Pago</h2>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cliente *
              </label>
              {selectedClient ? (
                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                      <User size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{selectedClient.name}</p>
                      <p className="text-xs text-gray-500">{selectedClient.phone || 'Sin teléfono'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null);
                      setClientSearchTerm('');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                  >
                    Cambiar cliente
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      value={clientSearchTerm}
                      onChange={(e) => setClientSearchTerm(e.target.value)}
                      className="input-base input-mobile pl-10 pr-4"
                      placeholder="Buscar cliente por nombre o teléfono..."
                      required={!selectedClient}
                      autoFocus
                    />
                  </div>
                  
                  {clientSearchTerm && !selectedClient && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">
                        {clientSearchTerm ? 'Resultados de búsqueda' : 'Todos los clientes'}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                        {filteredClients.map(client => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => selectClient(client)}
                            className="flex items-center p-3 bg-white border border-gray-200 rounded-lg hover:border-orange-500 hover:shadow-md transition-all group text-left"
                          >
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors mr-3 flex-shrink-0">
                              <User size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate group-hover:text-orange-700 transition-colors">
                                {client.name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {client.phone || 'Sin teléfono'}
                              </p>
                            </div>
                            <ChevronRight className="text-gray-300 group-hover:text-orange-500 ml-2" size={18} />
                          </button>
                        ))}
                        {filteredClients.length === 0 && (
                          <div className="col-span-full py-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            <User size={32} className="mx-auto text-gray-300 mb-2" />
                            <p>No se encontraron clientes</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {selectedClient && clientSummary && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                  <h3 className="text-sm font-semibold text-blue-900">Información del Cliente</h3>
                  {activeLoans.length > 1 && (
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <span className="text-xs text-blue-700 font-medium whitespace-nowrap">Seleccionar préstamo:</span>
                      <select
                        value={selectedSaleId}
                        onChange={(e) => setSelectedSaleId(e.target.value)}
                        className="w-full sm:w-auto text-sm border-blue-300 rounded-md bg-white text-blue-900 px-2 py-1 focus:ring-blue-500 focus:border-blue-500 outline-none truncate max-w-full sm:max-w-xs"
                      >
                        {activeLoans.map(loan => (
                          <option key={loan.id} value={loan.id} className="truncate">
                            Préstamo {new Date(loan.sale_date || loan.created_at || Date.now()).toLocaleDateString()} - ${loan.total_amount}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-label text-blue-700 mb-1">Saldo Pendiente {activeLoans.length > 1 ? '(Cuenta)' : ''}</p>
                    <p className="text-metric text-blue-900">
                      ${(selectedSaleId && activeLoans.find(l => l.id === selectedSaleId)?.totalPending || clientSummary.total_balance).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-label text-blue-700 mb-1">Valor de Cuota</p>
                    <p className="text-metric text-blue-900">
                      ${(pendingPayment ? parseFloat(pendingPayment.amount.toString()) : clientSummary.next_payment_amount).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-label text-blue-700 mb-1">Próxima Fecha</p>
                    <p className="text-metric text-blue-900">
                      {(pendingPayment?.due_date || clientSummary.next_payment_date)
                        ? new Date(pendingPayment?.due_date || clientSummary.next_payment_date!).toLocaleDateString()
                        : 'N/A'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-label text-blue-700 mb-1"># Pago Pendiente</p>
                    <p className="text-metric text-blue-900">
                      #{(pendingPayment?.payment_number || clientSummary.pending_payment_number)}
                    </p>
                  </div>
                </div>
                {pendingPayment && pendingPayment.days_late > 0 && (
                  <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
                      <div className="flex gap-4 w-full sm:w-auto">
                        <div>
                          <p className="text-xs text-orange-700 font-semibold">Días de Atraso</p>
                          <p className="text-lg font-bold text-orange-900">{pendingPayment.days_late} días</p>
                        </div>
                        <div>
                          <p className="text-xs text-orange-700 font-semibold">Morosidad</p>
                          <p className="text-lg font-bold text-orange-900">
                            ${(isLateFeeEditable && lateFeeOverride ? parseFloat(lateFeeOverride) : pendingPayment.late_fee_amount || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={toggleLateFeeEditable}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-1 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
                      >
                        <Edit2 size={14} />
                        {isLateFeeEditable ? 'Bloquear' : 'Editar'}
                      </button>
                    </div>
                    {isLateFeeEditable && (
                      <div>
                        <label className="block text-xs text-orange-700 mb-1">Monto de Morosidad Manual</label>
                        <input
                          type="number"
                          step="0.01"
                          value={lateFeeOverride}
                          onChange={(e) => setLateFeeOverride(e.target.value)}
                          className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    )}
                    <div className="mt-2">
                      <p className="text-xs text-orange-700 font-semibold">Nuevo Total a Pagar</p>
                      <p className="text-2xl font-bold text-orange-900">${totalDue.toFixed(2)}</p>
                    </div>
                  </div>
                )}
                {clientSummary.credit_balance > 0 && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-700 mb-1">Saldo a Favor</p>
                    <p className="text-lg font-bold text-green-900">${clientSummary.credit_balance.toFixed(2)}</p>
                  </div>
                )}
              </div>
            )}

            {selectedClient && !pendingPayment && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Este cliente no tiene pagos pendientes</p>
                  <p className="text-xs text-yellow-700 mt-1">No es posible registrar un pago en este momento</p>
                </div>
              </div>
            )}

            {selectedClient && pendingPayment && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Formas de Pago *
                    </label>
                    <button
                      type="button"
                      onClick={addPaymentMethod}
                      className="flex items-center gap-1 text-sm text-orange-500 hover:text-orange-600"
                    >
                      <Plus size={16} />
                      Agregar forma de pago
                    </button>
                  </div>

                  <div className="space-y-4">
                    {paymentMethods.map((pm, index) => (
                      <div key={pm.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-sm font-medium text-gray-700">
                            Forma de pago #{index + 1}
                          </span>
                          {paymentMethods.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePaymentMethod(pm.id)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Método</label>
                          <select
                            value={pm.method}
                            onChange={(e) => updatePaymentMethod(pm.id, 'method', e.target.value)}
                            className="input-base input-mobile"
                            required
                          >
                            <option value="efectivo">Efectivo</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="tarjeta">Tarjeta</option>
                              <option value="cheque">Cheque</option>
                              <option value="otro">Otro</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Monto *</label>
                            <input
                              type="number"
                              step="0.01"
                              value={pm.amount}
                              onChange={(e) => updatePaymentMethod(pm.id, 'amount', e.target.value)}
                              className="input-base input-mobile"
                              placeholder="0.00"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Referencia</label>
                            <input
                              type="text"
                              value={pm.reference}
                              onChange={(e) => updatePaymentMethod(pm.id, 'reference', e.target.value)}
                              className="input-base input-mobile"
                              placeholder="# Autorización"
                            />
                          </div>
                        </div>

                        {(pm.method === 'transferencia' || pm.method === 'tarjeta' || pm.method === 'cheque') && (
                          <div className="mt-3">
                            <label className="block text-sm text-gray-600 mb-1">
                              Comprobante {pm.method === 'transferencia' ? '(Obligatorio)' : '(Opcional)'}
                            </label>
                            <div className="flex items-center gap-2">
                              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 cursor-pointer transition">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleImageSelect(pm.id, e.target.files?.[0] || null)}
                                  className="hidden"
                                  required={pm.method === 'transferencia'}
                                />
                                <Upload size={20} className="text-gray-500" />
                                <span className="text-sm text-gray-600">
                                  {pm.image_file ? pm.image_file.name : 'Seleccionar archivo'}
                                </span>
                              </label>
                              <label className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 cursor-pointer transition">
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={(e) => handleImageSelect(pm.id, e.target.files?.[0] || null)}
                                  className="hidden"
                                />
                                <Camera size={20} className="text-blue-600" />
                                <span className="text-sm text-blue-600">Cámara</span>
                              </label>
                            </div>
                            {pm.image_file && (
                              <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                                <Check size={16} />
                                <span>Archivo seleccionado: {pm.image_file.name}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 p-4 bg-blue-50 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-700">Total del Pago:</span>
                      <span className="text-2xl font-bold text-blue-600">
                        ${totalPayment.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-700">Total Adeudado:</span>
                      <span className="text-2xl font-bold text-gray-900">
                        ${totalDue.toFixed(2)}
                      </span>
                    </div>
                    {totalPayment > totalDue && totalDue > 0 && (
                      <div className="pt-2 border-t border-blue-200">
                        <div className="flex items-center gap-2 text-green-600">
                          <Check size={20} />
                          <span className="font-semibold">Excedente (Saldo a Favor): ${(totalPayment - totalDue).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    {Number(totalPayment.toFixed(2)) < Number((parseFloat(pendingPayment.amount.toString())).toFixed(2)) && totalPayment > 0 && (
                      <div className="pt-2 border-t border-blue-200">
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertCircle size={20} />
                          <span className="font-semibold">El pago debe cubrir al menos la cuota base (${parseFloat(pendingPayment.amount.toString()).toFixed(2)})</span>
                        </div>
                      </div>
                    )}
                    {Number(totalPayment.toFixed(2)) >= Number((parseFloat(pendingPayment.amount.toString())).toFixed(2)) && Number(totalPayment.toFixed(2)) < Number(totalDue.toFixed(2)) && totalPayment > 0 && (
                      <div className="pt-2 border-t border-blue-200">
                        <div className="flex items-center gap-2 text-orange-600">
                          <AlertCircle size={20} />
                          <span className="font-semibold">Pago parcial de morosidad detectado. El saldo restante se acumulará.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha del Pago
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="input-base px-4 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notas
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="input-base px-4 py-2"
                    placeholder="Observaciones adicionales..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting || (pendingPayment && Number(totalPayment.toFixed(2)) < Number(parseFloat(pendingPayment.amount.toString()).toFixed(2))) || hasOpenCashRegister === false}
                    className="flex-1 btn-base btn-primary btn-mobile gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <span className="animate-spin">⌛</span> : <Save size={20} />}
                    <span className="hidden sm:inline">{isSubmitting ? 'Guardando...' : 'Guardar Pago'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShowRenewalModal(true)}
                    className="btn-base btn-primary btn-mobile gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={20} />
                    <span className="hidden sm:inline">Renovar</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={resetForm}
                    className="btn-base btn-mobile border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <span className="hidden sm:inline">Cancelar</span>
                    <X size={18} className="sm:hidden" />
                  </button>
                </div>
                
              </>
            )}
          </form>
        </div>
      )}
      {showRenewalModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-blue-50 rounded-xl w-full max-w-2xl shadow-2xl border border-blue-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 shrink-0">
              <h3 className="text-lg font-semibold text-blue-900">Renovación</h3>
              <button
                onClick={() => setShowRenewalModal(false)}
                className="btn-base btn-icon btn-ghost"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700 mb-1">Nuevo Préstamo</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={editableRenewalAmount}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setEditableRenewalAmount(isNaN(val) ? 0 : val);
                        }}
                        className="w-full text-xl font-bold text-blue-900 border border-blue-200 rounded-lg px-2 py-1"
                      />
                      <button 
                        onClick={() => recalcRenewalTotals(editableRenewalAmount)} 
                        className="bg-blue-600 text-white rounded-lg px-3 hover:bg-blue-700 text-sm font-medium"
                        title="Recalcular montos"
                      >
                        <RefreshCw size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800 mb-1 font-bold">A Entregar</p>
                    <p className={`text-xl font-bold ${renewalCashHandout < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      ${renewalCashHandout.toFixed(2)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowRenewalDetails(!showRenewalDetails)}
                  className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-700">Ver Desglose y Detalles</span>
                  {showRenewalDetails ? <ChevronUp size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
                </button>

                {showRenewalDetails && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">(-) Saldo a Liquidar</span>
                      <span className="font-medium text-gray-900">${renewalPaidAmount.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">(-) Morosidad ({renewalLateDaysTotal} días)</span>
                      <span className="font-medium text-red-600">${renewalLateFeeTotal.toFixed(2)}</span>
                    </div>

                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-gray-600">(-) Cuotas Renovación (Total)</label>
                        <span className="font-medium text-gray-900">${renewalFeeAmount.toFixed(2)}</span>
                      </div>
                      <div className="mt-2 space-y-1 bg-white p-2 rounded border border-gray-200">
                        {renewalFees.map((fee) => {
                           const amount = fee.calculation_type === 'percentage' 
                             ? renewalOutstanding * (fee.value / 100) 
                             : fee.value;
                           return (
                             <div key={fee.id} className="flex justify-between text-xs text-gray-600">
                               <span>{fee.name} ({fee.calculation_type === 'percentage' ? `${fee.value}%` : `$${fee.value}`})</span>
                               <span>${amount.toFixed(2)}</span>
                             </div>
                           );
                        })}
                        {renewalFees.length === 0 && <p className="text-xs text-gray-500 italic">No hay cuotas activas</p>}
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-blue-100 rounded text-sm text-blue-800">
                      <p className="font-bold">Resumen de la Operación:</p>
                      <ul className="list-disc pl-5 mt-1">
                          <li>Se cancelará el saldo pendiente actual.</li>
                          <li>Se creará un nuevo préstamo por <strong>${editableRenewalAmount.toFixed(2)}</strong> (Mismo plan).</li>
                          <li>El cobrador entregará la diferencia en efectivo: <strong>${renewalCashHandout.toFixed(2)}</strong>.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-4 py-3 border-t border-blue-200 shrink-0">
              <button
                type="button"
                className="btn-base btn-mobile btn-ghost"
                onClick={() => setShowRenewalModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-base btn-primary btn-mobile bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={isSubmitting}
                onClick={async () => {
                  const ok = await handleRenewSale();
                  if (ok) setShowRenewalModal(false);
                }}
              >
                {isSubmitting ? 'Procesando...' : 'Continuar a Nueva Venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!showForm && (
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 md:p-6 border-b border-gray-200">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900">Historial de Pagos</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  title="Exportar a Excel"
                >
                  <FileSpreadsheet size={18} />
                  <span className="hidden sm:inline">Excel</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                  title="Exportar a PDF"
                >
                  <Download size={18} />
                  <span className="hidden sm:inline">PDF</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Buscar pagos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">Todos los estados</option>
                <option value="completed">Completado</option>
                <option value="pending">Pendiente</option>
                <option value="cancelled">Cancelado</option>
              </select>
              <input
                type="date"
                placeholder="Desde"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <input
                type="date"
                placeholder="Hasta"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando pagos...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <DollarSign size={48} className="mx-auto mb-2 text-gray-400" />
            <p>No hay pagos registrados</p>
          </div>
        ) : (
          <>
            {/* Vista de tarjetas para móvil */}
            <div className="block md:hidden">
              <div className="divide-y divide-gray-200">
                {filteredPayments.map(payment => (
                  <div key={payment.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{payment.client?.name || 'N/A'}</p>
                        <p className="text-sm text-gray-600">
                          {formatDate(payment.payment_date || payment.created_at)}
                        </p>
                      </div>
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Completado
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-gray-500">Monto</p>
                        <p className="text-lg font-bold text-gray-900">
                          ${(payment.total_amount || payment.amount || 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Cobrador</p>
                        <p className="text-sm text-gray-900">{payment.collector?.name || 'N/A'}</p>
                      </div>
                    </div>
                    {payment.client_id && (
                      <button
                        onClick={() => handleRegisterFromHistory(payment.client_id)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                      >
                        <FileText size={16} />
                        Registrar Pago
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Vista de tabla para escritorio */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cobrador</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPayments.map(payment => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(() => {
                          const paymentDate = payment.payment_date;
                          const createdDate = new Date(payment.created_at);
                          const utcDateStr = createdDate.toISOString().split('T')[0];
                          const localDate = new Date(createdDate.getTime() - (createdDate.getTimezoneOffset() * 60000));
                          const localDateStr = localDate.toISOString().split('T')[0];
                          
                          // Si la fecha de pago es igual a la fecha UTC de creación, pero diferente a la fecha local
                          // (indicando que se guardó con UTC en lugar de local), mostrar la fecha local de creación.
                          // Esto corrige visualmente los registros afectados por el bug de zona horaria.
                          if (paymentDate === utcDateStr && paymentDate !== localDateStr) {
                             return formatDate(payment.created_at);
                          }
                          
                          return formatDate(payment.payment_date || payment.created_at);
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.client?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ${(payment.total_amount || payment.amount || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {payment.collector?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Completado
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {payment.client_id && (
                          <button
                            onClick={() => handleRegisterFromHistory(payment.client_id)}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            <FileText size={14} />
                            Registrar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}
