import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Search, Filter, Download, DollarSign, RefreshCw, AlertCircle, CheckCircle, ChevronDown, ChevronRight, Users, List, FileSpreadsheet } from 'lucide-react';
import { exportToExcel, formatDate, formatCurrency } from '../../lib/exportUtils';

interface FeeMovement {
  id: string;
  type: string;
  amount: number;
  payment_method: string;
  concept: string;
  movement_date: string;
  client?: { name: string };
  routeName?: string;
  status?: 'paid' | 'pending';
  days_late?: number;
}

interface ClientGroup {
  clientName: string;
  routeName: string;
  totalPaid: number;
  totalPending: number;
  maxDaysLate: number;
  movements: FeeMovement[];
}

interface LateFeeConfig {
  id: string;
  name: string;
  fee_type: 'percentage' | 'fixed';
  fee_value: number;
  is_active: boolean;
}

export default function FeesReport() {
  const { userData } = useAuth();
  const [movements, setMovements] = useState<FeeMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<'all' | 'morosidad' | 'apertura'>('all');
  const [viewMode, setViewMode] = useState<'detailed' | 'grouped'>('grouped');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [lateFeeConfig, setLateFeeConfig] = useState<LateFeeConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (userData?.organization_id) {
      loadLateFeeConfig();
    }
  }, [userData]);

  useEffect(() => {
    if (userData?.organization_id && lateFeeConfig) {
      loadData();
    }
  }, [userData, dateFrom, dateTo, lateFeeConfig]);

  const loadLateFeeConfig = async () => {
    // Try to get default active late fee
    let { data, error } = await supabase
      .from('late_payment_fees')
      .select('*')
      .eq('organization_id', userData!.organization_id)
      .eq('is_default', true)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (!data) {
       // Fallback: any active fee
       const { data: fallback } = await supabase
         .from('late_payment_fees')
         .select('*')
         .eq('organization_id', userData!.organization_id)
         .eq('is_active', true)
         .limit(1)
         .maybeSingle();
       data = fallback;
    }
    
    setLateFeeConfig(data);
  };

  const loadData = async () => {
    setLoading(true);
    const allData: FeeMovement[] = [];

    const isFilteredUser = userData?.role !== 'superadmin' && userData?.role !== 'admin' && !userData?.permissions?.includes('*:*');
    const assignedRoutes = userData?.assigned_routes || [];

    if (isFilteredUser && assignedRoutes.length === 0) {
      setLoading(false);
      setMovements([]);
      return;
    }

    try {
      // 1. Cargar Aperturas/Renovaciones (Desde Caja - Pagados)
      let cashQuery = supabase
        .from('cash_register_movements')
        .select('*, client:clients!inner(name, route_id, route:routes(nombre_ruta))')
        .gte('movement_date', dateFrom)
        .lte('movement_date', dateTo + 'T23:59:59')
        .eq('type', 'payment')
        .ilike('concept', '%apertura%'); // Solo aperturas/renovaciones

      if (isFilteredUser) {
        cashQuery = cashQuery.in('client.route_id', assignedRoutes);
      }

      const { data: cashData } = await cashQuery;

      if (cashData) {
        const mappedCash = cashData.map(m => ({
          ...m,
          status: 'paid' as const,
          concept: 'Cuota de Apertura / Renovación',
          routeName: m.client?.route?.nombre_ruta || 'Sin Ruta'
        }));
        allData.push(...mappedCash);
      }

      // 2. Cargar Morosidad Pagada (Desde Cronograma de Pagos)
      // Buscamos pagos completados que tengan late_fee_amount > 0
      let paidQuery = supabase
        .from('payment_schedule')
        .select('id, paid_amount, late_fee_amount, paid_date, days_late, sale:sales!inner(client:clients!inner(name, route_id, route:routes(nombre_ruta)))')
        .eq('status', 'paid')
        .gt('late_fee_amount', 0)
        .gte('paid_date', dateFrom)
        .lte('paid_date', dateTo);

      if (isFilteredUser) {
        paidQuery = paidQuery.in('sale.client.route_id', assignedRoutes);
      }

      const { data: paidLateFees } = await paidQuery;

      if (paidLateFees) {
        const mappedPaid = paidLateFees.map((item: any) => ({
          id: item.id,
          type: 'late_fee_paid',
          amount: item.late_fee_amount,
          payment_method: 'N/A', // O buscar en tabla payments si es necesario
          concept: `Morosidad Pagada (${item.days_late} días)`,
          movement_date: item.paid_date,
          client: item.sale?.client,
          routeName: item.sale?.client?.route?.nombre_ruta || 'Sin Ruta',
          status: 'paid' as const,
          days_late: item.days_late
        }));
        allData.push(...mappedPaid);
      }

      // 3. Cargar Morosidad Pendiente (Agrupada por cliente)
      // La regla es: Cuota diaria * Días de atraso del pago más antiguo
      const today = new Date();
      today.setHours(0,0,0,0);

      let pendingQuery = supabase
        .from('payment_schedule')
        .select('id, amount, due_date, sale:sales!inner(client:clients!inner(id, name, route_id, route:routes(nombre_ruta)))')
        .eq('status', 'pending')
        .lt('due_date', new Date().toISOString().split('T')[0]); // Vencidos

      if (isFilteredUser) {
        pendingQuery = pendingQuery.in('sale.client.route_id', assignedRoutes);
      }

      const { data: pendingLate } = await pendingQuery;

      if (pendingLate && lateFeeConfig) {
        // Agrupar por cliente para encontrar la fecha más antigua
        const clientPendingMap: { [key: string]: { minDueDate: Date, clientName: string, clientId: string, routeName: string } } = {};

        pendingLate.forEach((item: any) => {
          const clientId = item.sale.client.id;
          const dueDate = new Date(item.due_date);
          dueDate.setHours(0,0,0,0);

          if (!clientPendingMap[clientId]) {
            clientPendingMap[clientId] = {
              minDueDate: dueDate,
              clientName: item.sale.client.name,
              clientId: clientId,
              routeName: item.sale.client.route?.nombre_ruta || 'Sin Ruta'
            };
          } else {
            if (dueDate < clientPendingMap[clientId].minDueDate) {
              clientPendingMap[clientId].minDueDate = dueDate;
            }
          }
        });

        // Generar un único registro de deuda por cliente
        Object.values(clientPendingMap).forEach(c => {
          const diffTime = Math.abs(today.getTime() - c.minDueDate.getTime());
          const daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          
          let feeAmount = 0;
          if (lateFeeConfig.fee_type === 'percentage') {
             // Si es porcentaje, mantenemos lógica anterior o aplicamos sobre deuda total?
             // El usuario especificó lógica de "cuota * días". Asumiremos que esto aplica principalmente a montos fijos.
             // Para porcentaje, sumaremos el recargo calculado sobre cada cuota vencida (comportamiento estándar)
             // PERO, para simplificar y seguir la instrucción "solo total", si es fixed usamos la nueva lógica.
             // Si el usuario usa fixed (ejemplo 50), aplicamos: 50 * días.
             feeAmount = 0; // Placeholder si entrara aquí, pero con el ejemplo del usuario es Fixed.
             // Revertimos a cálculo por cuota si es porcentaje? 
             // Mejor: Si es porcentaje, calculamos sobre el total de deuda vencida?
             // Por seguridad, si es porcentaje, iteramos las cuotas de este cliente.
             const clientItems = pendingLate.filter((i: any) => i.sale.client.id === c.clientId);
             clientItems.forEach((i: any) => {
                const iDate = new Date(i.due_date);
                iDate.setHours(0,0,0,0);
                const iDiff = Math.abs(today.getTime() - iDate.getTime());
                const iDays = Math.ceil(iDiff / (1000 * 60 * 60 * 24));
                feeAmount += (i.amount * lateFeeConfig.fee_value / 100) * iDays;
             });
          } else {
             // Lógica solicitada: Valor Fijo * Días de atraso (del más antiguo)
             feeAmount = lateFeeConfig.fee_value * daysLate;
          }

          allData.push({
            id: `pending-${c.clientId}`,
            type: 'late_fee_pending',
            amount: feeAmount,
            payment_method: '-',
            concept: `Morosidad Acumulada (${daysLate} días)`,
            movement_date: c.minDueDate.toISOString(),
            client: { name: c.clientName },
            routeName: c.routeName,
            status: 'pending' as const,
            days_late: daysLate
          });
        });
      }

    } catch (error) {
      console.error('Error loading data:', error);
    }

    // Ordenar por fecha
    allData.sort((a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime());
    
    setMovements(allData);
    setLoading(false);
  };

  const getFilteredMovements = () => {
    return movements.filter(m => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (m.client?.name || '').toLowerCase().includes(searchLower) ||
        (m.routeName || '').toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      const concept = m.concept ? m.concept.toLowerCase() : '';
      if (filterType === 'morosidad') return concept.includes('morosidad');
      if (filterType === 'apertura') return concept.includes('apertura');
      return true;
    });
  };

  const getGroupedMovements = () => {
    const filtered = getFilteredMovements();
    const groups: { [key: string]: ClientGroup } = {};

    filtered.forEach(m => {
      const clientName = m.client?.name || 'Desconocido';
      if (!groups[clientName]) {
        groups[clientName] = {
          clientName,
          routeName: m.routeName || 'Sin Ruta',
          totalPaid: 0,
          totalPending: 0,
          maxDaysLate: 0,
          movements: []
        };
      }
      
      groups[clientName].movements.push(m);
      
      if (m.status === 'paid') {
        groups[clientName].totalPaid += m.amount;
      } else {
        groups[clientName].totalPending += m.amount;
        if (m.days_late && m.days_late > groups[clientName].maxDaysLate) {
          groups[clientName].maxDaysLate = m.days_late;
        }
      }
    });

    return Object.values(groups).sort((a, b) => b.totalPending - a.totalPending); // Ordenar por mayor deuda
  };

  const toggleClient = (clientName: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientName)) {
      newExpanded.delete(clientName);
    } else {
      newExpanded.add(clientName);
    }
    setExpandedClients(newExpanded);
  };

  const handleExport = () => {
    const groupedData = getGroupedMovements();
    const exportData = groupedData.map(g => ({
      'Cliente': g.clientName,
      'Ruta': g.routeName,
      'Total Cobrado': g.totalPaid,
      'Deuda Pendiente': g.totalPending,
      'Días Morosidad (Max)': g.maxDaysLate
    }));
    exportToExcel(exportData, 'Reporte_Morosidad_Agrupado');
  };

  const filteredData = getFilteredMovements();
  const groupedData = getGroupedMovements();
  
  // Totales
  const totalPaid = filteredData.filter(m => m.status === 'paid').reduce((sum, m) => sum + m.amount, 0);
  const totalPending = filteredData.filter(m => m.status === 'pending').reduce((sum, m) => sum + m.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporte de Morosidad y Aperturas</h1>
          <p className="text-gray-600">Control de recargos cobrados y pendientes</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
          <div className="flex-1">
             <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Ingreso</label>
             <select
               value={filterType}
               onChange={(e) => setFilterType(e.target.value as any)}
               className="w-full px-3 py-2 border border-gray-300 rounded-md"
             >
               <option value="all">Todos</option>
               <option value="morosidad">Solo Morosidad</option>
               <option value="apertura">Solo Aperturas</option>
             </select>
          </div>
          <div className="flex-1">
             <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
             <div className="relative">
               <input
                 type="text"
                 placeholder="Cliente o Ruta..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md"
               />
               <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
             </div>
          </div>
          <div className="flex items-end">
             <button
                onClick={handleExport}
                className="w-full md:w-auto px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
             >
               <FileSpreadsheet size={18} />
               Exportar
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
           <div className="bg-green-50 p-4 rounded-lg flex items-center justify-between border border-green-100">
              <div>
                <p className="text-green-700 text-sm font-semibold">Total Cobrado (Real)</p>
                <p className="text-2xl font-bold text-green-800">{formatCurrency(totalPaid)}</p>
              </div>
              <CheckCircle className="text-green-400" size={32} />
           </div>
           <div className="bg-red-50 p-4 rounded-lg flex items-center justify-between border border-red-100">
              <div>
                <p className="text-red-700 text-sm font-semibold">Morosidad Pendiente (Estimado)</p>
                <p className="text-2xl font-bold text-red-800">{formatCurrency(totalPending)}</p>
              </div>
              <AlertCircle className="text-red-400" size={32} />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruta</th>
                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cobrado</th>
                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Deuda Pendiente</th>
                 <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Días Morosidad</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center">Cargando...</td></tr>
              ) : groupedData.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No hay registros encontrados</td></tr>
              ) : (
                groupedData.map((group) => (
                  <tr key={group.clientName} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {group.clientName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {group.routeName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-700 font-medium">
                      {group.totalPaid > 0 ? formatCurrency(group.totalPaid) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-700 font-bold">
                      {group.totalPending > 0 ? formatCurrency(group.totalPending) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      {group.maxDaysLate > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {group.maxDaysLate} días
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
