import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  X,
  Save,
  Plus,
  Filter,
  Calendar,
  CreditCard,
  Upload,
  Lock,
  Edit,
  Unlock,
  AlertCircle,
} from 'lucide-react';

interface Route {
  id: string;
  nombre_ruta: string;
  cobrador_asignado: string | null;
}

interface Collector {
  id: string;
  name: string;
}

interface CashRegister {
  id: string;
  organization_id: string;
  user_id: string;
  opening_amount: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
}

interface Movement {
  id: string;
  cash_register_id: string;
  type: 'payment' | 'expense' | 'adjustment';
  amount: number;
  payment_method: 'cash' | 'card' | 'transfer';
  reference_id: string | null;
  client_id: string | null;
  concept: string;
  evidence_url: string | null;
  movement_date: string;
  client?: { name: string; route_id?: string };
  payment_number?: number;
}

interface CashSummary {
  totalPayments: number;
  totalExpenses: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  expectedCash: number;
}

export default function CashRegister() {
  const { userData } = useAuth();
  const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [summary, setSummary] = useState<CashSummary>({
    totalPayments: 0,
    totalExpenses: 0,
    totalCash: 0,
    totalCard: 0,
    totalTransfer: 0,
    expectedCash: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('all');

  const isAdmin = userData?.role === 'admin' || userData?.role === 'superadmin';
  const hasAssignedRoutes = userData?.assigned_routes && userData.assigned_routes.length > 0;
  const showFilters = isAdmin || hasAssignedRoutes;

  const [routes, setRoutes] = useState<Route[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [showEditBalanceModal, setShowEditBalanceModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [historyRegisters, setHistoryRegisters] = useState<any[]>([]);

  useEffect(() => {
    if (userData?.id) {
      if (!selectedUserId) {
        setSelectedUserId(userData.id);
      }
    }
  }, [userData]);

  useEffect(() => {
    if ((isAdmin || hasAssignedRoutes) && userData?.organization_id) {
      fetchRoutesAndCollectors();
    }
  }, [isAdmin, hasAssignedRoutes, userData?.organization_id]);

  useEffect(() => {
    if (activeTab === 'current' && selectedUserId) {
      loadCurrentRegister();
    } else if (activeTab === 'history') {
      loadHistory();
    }
  }, [selectedUserId, activeTab]);

  // useEffect(() => {
  //   if (userData?.id && currentRegister === null && !loading) {
  //     checkAndAutoOpenRegister();
  //   }
  // }, [userData, currentRegister, loading]);

  const fetchRoutesAndCollectors = async () => {
    try {
      let routesQuery = supabase
        .from('routes')
        .select('id, nombre_ruta, cobrador_asignado')
        .eq('organization_id', userData!.organization_id)
        .order('nombre_ruta');

      if (!isAdmin && hasAssignedRoutes) {
        routesQuery = routesQuery.in('id', userData!.assigned_routes!);
      }

      const promises: any[] = [routesQuery];

      if (isAdmin) {
        promises.push(
          supabase
            .from('users')
            .select('id, name')
            .eq('organization_id', userData!.organization_id)
            .in('role', ['collector', 'admin', 'superadmin'])
            .order('name')
        );
      }

      const [routesResult, collectorsResult] = await Promise.all(promises);

      if (routesResult.data) setRoutes(routesResult.data);
      if (isAdmin && collectorsResult?.data) setCollectors(collectorsResult.data);
    } catch (error) {
      console.error('Error fetching filter data:', error);
    }
  };

  const handleRouteChange = (routeId: string) => {
    setSelectedRouteId(routeId);
    if (isAdmin && routeId) {
      const route = routes.find(r => r.id === routeId);
      if (route?.cobrador_asignado) {
        setSelectedUserId(route.cobrador_asignado);
      }
    }
  };

  const loadCurrentRegister = async () => {
    const targetId = selectedUserId || userData?.id;
    if (!targetId) return;

    try {
      setLoading(true);

      const { data: registerData, error: registerError } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('user_id', targetId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (registerError) throw registerError;

      setCurrentRegister(registerData);

      if (registerData) {
        await loadMovements(registerData.id);
      } else {
        setMovements([]);
        setSummary({
          totalPayments: 0,
          totalExpenses: 0,
          totalCash: 0,
          totalCard: 0,
          totalTransfer: 0,
          expectedCash: 0,
        });
      }
    } catch (error) {
      console.error('Error loading cash register:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('cash_registers')
        .select(`
          *,
          user:users(name),
          closure:cash_register_closures(*)
        `)
        .eq('organization_id', userData?.organization_id)
        .eq('status', 'closed')
        .order('opened_at', { ascending: false });

      if (selectedUserId) {
        query = query.eq('user_id', selectedUserId);
      } else if (!isAdmin) {
         query = query.eq('user_id', userData?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setHistoryRegisters(data || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAndAutoOpenRegister = async () => {
    if (!userData?.id || !userData?.organization_id) return;

    // Use local date to avoid "tomorrow" issues in evening
    const today = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const lastCheckKey = `lastCashRegisterCheck_${userData.id}`;
    const lastCheck = localStorage.getItem(lastCheckKey);

    if (lastCheck === today) {
      return;
    }

    try {
      const { error } = await supabase.from('cash_registers').insert({
        organization_id: userData.organization_id,
        user_id: userData.id,
        opening_amount: 0,
        status: 'open',
        notes: 'Apertura automática diaria',
        created_by: userData.id,
      });

      if (!error) {
        localStorage.setItem(lastCheckKey, today);
        await loadCurrentRegister();
      }
    } catch (error) {
      console.error('Error auto-opening cash register:', error);
    }
  };

  const loadMovements = async (registerId: string) => {
    try {
      const { data, error } = await supabase
        .from('cash_register_movements')
        .select(`
          *,
          client:clients(name, route_id)
        `)
        .eq('cash_register_id', registerId)
        .order('movement_date', { ascending: false });

      if (error) throw error;

      let movementsData = data || [];

      // Fetch payment numbers for payment movements
      const paymentIds = movementsData
        .filter(m => m.type === 'payment' && m.reference_id)
        .map(m => m.reference_id);

      if (paymentIds.length > 0) {
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('id, payment_schedule(payment_number)')
          .in('id', paymentIds);

        if (paymentsData) {
          const paymentMap = new Map(
            paymentsData.map(p => [
              p.id, 
              // @ts-ignore
              p.payment_schedule?.payment_number
            ])
          );

          movementsData = movementsData.map(m => ({
            ...m,
            payment_number: m.reference_id && m.type === 'payment' 
              ? paymentMap.get(m.reference_id) 
              : undefined
          }));
        }
      }

      setMovements(movementsData);
      calculateSummary(movementsData);
    } catch (error) {
      console.error('Error loading movements:', error);
    }
  };

  const calculateSummary = (movementsData: Movement[]) => {
    const summary = movementsData.reduce(
      (acc, movement) => {
        if (movement.type === 'payment') {
          acc.totalPayments += parseFloat(movement.amount.toString());
          if (movement.payment_method === 'cash') {
            acc.totalCash += parseFloat(movement.amount.toString());
          } else if (movement.payment_method === 'card') {
            acc.totalCard += parseFloat(movement.amount.toString());
          } else if (movement.payment_method === 'transfer') {
            acc.totalTransfer += parseFloat(movement.amount.toString());
          }
        } else if (movement.type === 'expense') {
          acc.totalExpenses += parseFloat(movement.amount.toString());
          if (movement.payment_method === 'cash') {
            acc.totalCash -= parseFloat(movement.amount.toString());
          }
        }
        return acc;
      },
      {
        totalPayments: 0,
        totalExpenses: 0,
        totalCash: 0,
        totalCard: 0,
        totalTransfer: 0,
        expectedCash: 0,
      }
    );

    summary.expectedCash = (currentRegister?.opening_amount || 0) + summary.totalCash;
    setSummary(summary);
  };

  const filteredMovements = movements.filter((movement) => {
    if (filterType !== 'all' && movement.type !== filterType) return false;
    if (filterPaymentMethod !== 'all' && movement.payment_method !== filterPaymentMethod) return false;
    
    // Si no es admin y hay una ruta seleccionada, filtrar por ruta (solo para movimientos con cliente)
    // Para gastos generales (sin cliente), se muestran siempre
    if (!isAdmin && selectedRouteId && movement.client?.route_id && movement.client.route_id !== selectedRouteId) {
      return false;
    }
    
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showFilters && (
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-3">
            {isAdmin ? 'Filtros de Administración' : 'Filtros'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Ruta</label>
              <select
                value={selectedRouteId}
                onChange={(e) => handleRouteChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="">{isAdmin ? 'Seleccionar Ruta' : 'Todas mis rutas'}</option>
                {routes.map(route => (
                  <option key={route.id} value={route.id}>{route.nombre_ruta}</option>
                ))}
              </select>
            </div>
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Cobrador</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setSelectedRouteId('');
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">Seleccionar Cobrador</option>
                  {collectors.map(collector => (
                    <option key={collector.id} value={collector.id}>{collector.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex space-x-4 border-b border-gray-700 pb-4">
        <button
          onClick={() => setActiveTab('current')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'current'
              ? 'bg-orange-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          Caja Actual
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-orange-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Historial de Cajas
          </button>
        )}
      </div>

      {activeTab === 'current' ? (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-100">Corte de Caja</h2>
              <p className="text-gray-400">Gestiona tu caja y movimientos</p>
            </div>
            {!currentRegister ? (
              <button
                onClick={() => setShowOpenModal(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
              >
                <Unlock className="h-5 w-5" />
                Abrir Caja
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Registrar Gasto
                </button>
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
                >
                  <Lock className="h-5 w-5" />
                  Cerrar Caja
            </button>
          </div>
        )}
      </div>

      {currentRegister ? (
            <>
              <CashStatus
                register={currentRegister}
                summary={summary}
                isAdmin={isAdmin}
                onEditBalance={() => setShowEditBalanceModal(true)}
              />

              <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-100">Movimientos</h3>
                  <div className="flex gap-2">
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200"
                    >
                      <option value="all">Todos los tipos</option>
                      <option value="payment">Cobros</option>
                      <option value="expense">Gastos</option>
                      <option value="adjustment">Ajustes</option>
                    </select>
                    <select
                      value={filterPaymentMethod}
                      onChange={(e) => setFilterPaymentMethod(e.target.value)}
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200"
                    >
                      <option value="all">Todas las formas</option>
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="transfer">Transferencia</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Fecha</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Tipo</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Pago #</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Concepto</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Cliente</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Forma de Pago</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMovements.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-gray-400">
                            No hay movimientos registrados
                          </td>
                        </tr>
                      ) : (
                        filteredMovements.map((movement) => (
                          <tr key={movement.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                            <td className="py-3 px-4 text-gray-300">
                              {new Date(movement.movement_date).toLocaleString('es-MX', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  movement.type === 'payment'
                                    ? 'bg-green-500/20 text-green-400'
                                    : movement.type === 'expense'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-blue-500/20 text-blue-400'
                                }`}
                              >
                                {movement.type === 'payment' ? 'Cobro' : movement.type === 'expense' ? 'Gasto' : 'Ajuste'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-300 font-medium">
                              {movement.payment_number ? `#${movement.payment_number}` : '-'}
                            </td>
                            <td className="py-3 px-4 text-gray-300">{movement.concept}</td>
                            <td className="py-3 px-4 text-gray-300">{movement.client?.name || '-'}</td>
                            <td className="py-3 px-4 text-gray-300">
                              {movement.payment_method === 'cash'
                                ? 'Efectivo'
                                : movement.payment_method === 'card'
                                ? 'Tarjeta'
                                : 'Transferencia'}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-semibold ${
                                movement.type === 'expense' ? 'text-red-400' : 'text-green-400'
                              }`}
                            >
                              {movement.type === 'expense' ? '-' : '+'}${parseFloat(movement.amount.toString()).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gray-800 rounded-xl shadow-lg p-12 border border-gray-700 text-center">
              <AlertCircle className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-200 mb-2">No hay caja abierta</h3>
              <p className="text-gray-400 mb-6">Abre una caja para comenzar a registrar movimientos</p>
              <button
                onClick={() => setShowOpenModal(true)}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 mx-auto"
              >
                <Unlock className="h-5 w-5" />
                Abrir Caja
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Historial de Cajas Cerradas</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Usuario</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Apertura</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Cierre</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Saldo Inicial</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Saldo Final (Contado)</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Diferencia</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Notas</th>
                </tr>
              </thead>
              <tbody>
                {historyRegisters.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      No hay historial disponible
                    </td>
                  </tr>
                ) : (
                  historyRegisters.map((reg) => (
                    <tr key={reg.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-3 px-4 text-gray-300">{reg.user?.name || 'Desconocido'}</td>
                      <td className="py-3 px-4 text-gray-300">
                        {new Date(reg.opened_at).toLocaleString('es-MX')}
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {reg.closed_at ? new Date(reg.closed_at).toLocaleString('es-MX') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-300">
                        ${reg.opening_amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-300">
                        ${(reg.closure?.[0]?.counted_cash || 0).toFixed(2)}
                      </td>
                      <td className={`py-3 px-4 text-right font-medium ${
                        (reg.closure?.[0]?.difference || 0) < 0 ? 'text-red-400' : 
                        (reg.closure?.[0]?.difference || 0) > 0 ? 'text-green-400' : 'text-gray-300'
                      }`}>
                        ${(reg.closure?.[0]?.difference || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-sm italic">
                        {reg.closure?.[0]?.notes || reg.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showOpenModal && (
        <OpenCashModal
          onClose={() => setShowOpenModal(false)}
          onSuccess={() => {
            setShowOpenModal(false);
            loadCurrentRegister();
          }}
        />
      )}

      {showExpenseModal && currentRegister && (
        <ExpenseModal
          registerId={currentRegister.id}
          onClose={() => setShowExpenseModal(false)}
          onSuccess={() => {
            setShowExpenseModal(false);
            loadMovements(currentRegister.id);
          }}
        />
      )}

      {showCloseModal && currentRegister && (
        <CloseCashModal
          register={currentRegister}
          summary={summary}
          onClose={() => setShowCloseModal(false)}
          onSuccess={() => {
            setShowCloseModal(false);
            loadCurrentRegister();
          }}
        />
      )}

      {showEditBalanceModal && currentRegister && (
        <EditInitialBalanceModal
          registerId={currentRegister.id}
          currentAmount={currentRegister.opening_amount}
          onClose={() => setShowEditBalanceModal(false)}
          onSuccess={() => {
            setShowEditBalanceModal(false);
            loadCurrentRegister();
          }}
        />
      )}
    </div>
  );
}

function CashStatus({
  register,
  summary,
  isAdmin,
  onEditBalance
}: {
  register: CashRegister;
  summary: CashSummary;
  isAdmin: boolean;
  onEditBalance: () => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-400">Estado</h3>
          <div className="p-2 rounded-lg bg-green-500/10">
            <Unlock className="h-5 w-5 text-green-400" />
          </div>
        </div>
        <p className="text-2xl font-bold text-green-400">Abierta</p>
        <p className="text-xs text-gray-400 mt-1">
          Desde {new Date(register.opened_at).toLocaleString('es-MX')}
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-400">Saldo Inicial</h3>
          <div className="flex gap-2">
            {isAdmin && (
              <button
                onClick={onEditBalance}
                className="p-1 hover:bg-gray-700 rounded text-blue-400"
                title="Editar saldo inicial"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
            <div className="p-2 rounded-lg bg-blue-500/10">
              <DollarSign className="h-5 w-5 text-blue-400" />
            </div>
          </div>
        </div>
        <p className="text-2xl font-bold text-gray-100">${register.opening_amount.toFixed(2)}</p>
        <p className="text-xs text-gray-400 mt-1">Apertura de caja</p>
      </div>

      <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-400">Total Cobrado</h3>
          <div className="p-2 rounded-lg bg-green-500/10">
            <TrendingUp className="h-5 w-5 text-green-400" />
          </div>
        </div>
        <p className="text-2xl font-bold text-gray-100">${summary.totalPayments.toFixed(2)}</p>
        <p className="text-xs text-gray-400 mt-1">
          Efectivo: ${summary.totalCash.toFixed(2)} | Otros: ${(summary.totalCard + summary.totalTransfer).toFixed(2)}
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-400">Efectivo Esperado</h3>
          <div className="p-2 rounded-lg bg-orange-500/10">
            <CreditCard className="h-5 w-5 text-orange-400" />
          </div>
        </div>
        <p className="text-2xl font-bold text-gray-100">${summary.expectedCash.toFixed(2)}</p>
        <p className="text-xs text-gray-400 mt-1">Gastos: ${summary.totalExpenses.toFixed(2)}</p>
      </div>
    </div>
  );
}

function OpenCashModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { userData } = useAuth();
  const [openingAmount, setOpeningAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.id || !userData?.organization_id) return;

    try {
      setLoading(true);

      const { error } = await supabase.from('cash_registers').insert({
        organization_id: userData.organization_id,
        user_id: userData.id,
        opening_amount: parseFloat(openingAmount),
        status: 'open',
        notes,
        created_by: userData.id,
      });

      if (error) throw error;

      onSuccess();
    } catch (error) {
      console.error('Error opening cash register:', error);
      alert('Error al abrir la caja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-xl max-w-md w-full border border-gray-700">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h3 className="text-xl font-bold text-gray-100">Abrir Caja</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Monto Inicial</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Abriendo...' : (
                <>
                  <Save className="h-4 w-4" />
                  Abrir Caja
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditInitialBalanceModal({
  registerId,
  currentAmount,
  onClose,
  onSuccess,
}: {
  registerId: string;
  currentAmount: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(currentAmount.toString());
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { error } = await supabase
        .from('cash_registers')
        .update({ opening_amount: parseFloat(amount) })
        .eq('id', registerId);

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error updating opening amount:', error);
      alert('Error al actualizar el saldo inicial');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-xl max-w-md w-full border border-gray-700">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h3 className="text-xl font-bold text-gray-100">Editar Saldo Inicial</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Monto Inicial</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Guardando...' : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExpenseModal({
  registerId,
  onClose,
  onSuccess,
}: {
  registerId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { userData } = useAuth();
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.id || !userData?.organization_id) return;

    try {
      setLoading(true);

      const { error } = await supabase.from('cash_register_movements').insert({
        cash_register_id: registerId,
        organization_id: userData.organization_id,
        type: 'expense',
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        concept,
        created_by: userData.id,
      });

      if (error) throw error;

      onSuccess();
    } catch (error) {
      console.error('Error creating expense:', error);
      alert('Error al registrar el gasto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-xl max-w-md w-full border border-gray-700">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h3 className="text-xl font-bold text-gray-100">Registrar Gasto</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Concepto</label>
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
              required
              placeholder="Ej: Gasolina, Comida, Material, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Monto</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Forma de Pago</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'transfer')}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
            >
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
              <option value="transfer">Transferencia</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Guardando...' : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar Gasto
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CloseCashModal({
  register,
  summary,
  onClose,
  onSuccess,
}: {
  register: CashRegister;
  summary: CashSummary;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { userData } = useAuth();
  const [countedCash, setCountedCash] = useState(summary.expectedCash.toString());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const difference = parseFloat(countedCash || '0') - summary.expectedCash;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.id || !userData?.organization_id) return;

    try {
      setLoading(true);

      const { error: closureError } = await supabase.from('cash_register_closures').insert({
        cash_register_id: register.id,
        organization_id: userData.organization_id,
        expected_cash: summary.expectedCash,
        counted_cash: parseFloat(countedCash),
        difference,
        total_payments: summary.totalPayments,
        total_expenses: summary.totalExpenses,
        total_card: summary.totalCard,
        total_transfer: summary.totalTransfer,
        notes,
        closed_by: userData.id,
        created_by: userData.id,
      });

      if (closureError) throw closureError;

      const { error: updateError } = await supabase
        .from('cash_registers')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          updated_by: userData.id,
        })
        .eq('id', register.id);

      if (updateError) throw updateError;

      onSuccess();
    } catch (error) {
      console.error('Error closing cash register:', error);
      alert('Error al cerrar la caja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full border border-gray-700 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-700 flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-100">Cerrar Caja</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-700/50 p-4 rounded-lg">
              <p className="text-sm text-gray-400 mb-1">Saldo Inicial</p>
              <p className="text-xl font-bold text-gray-100">${register.opening_amount.toFixed(2)}</p>
            </div>
            <div className="bg-gray-700/50 p-4 rounded-lg">
              <p className="text-sm text-gray-400 mb-1">Total Cobrado</p>
              <p className="text-xl font-bold text-green-400">${summary.totalPayments.toFixed(2)}</p>
            </div>
            <div className="bg-gray-700/50 p-4 rounded-lg">
              <p className="text-sm text-gray-400 mb-1">Total Gastos</p>
              <p className="text-xl font-bold text-red-400">${summary.totalExpenses.toFixed(2)}</p>
            </div>
            <div className="bg-gray-700/50 p-4 rounded-lg">
              <p className="text-sm text-gray-400 mb-1">Efectivo Esperado</p>
              <p className="text-xl font-bold text-orange-400">${summary.expectedCash.toFixed(2)}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Efectivo Contado (Físico)
              </label>
              <input
                type="number"
                step="0.01"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                required
              />
            </div>

            {difference !== 0 && (
              <div
                className={`p-4 rounded-lg ${
                  difference > 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className={`h-5 w-5 ${difference > 0 ? 'text-green-400' : 'text-red-400'}`} />
                  <p className={`font-semibold ${difference > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    Diferencia: {difference > 0 ? '+' : ''}${difference.toFixed(2)}
                  </p>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {difference > 0 ? 'Sobrante de efectivo' : 'Faltante de efectivo'}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Observaciones</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100"
                rows={3}
                placeholder="Notas sobre el cierre de caja..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Cerrando...' : (
                  <>
                    <Lock className="h-4 w-4" />
                    Cerrar Caja
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
