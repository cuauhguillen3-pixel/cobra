import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, Clock, CheckCircle, Calendar, DollarSign, Bell, BellOff, RefreshCw } from 'lucide-react';

interface Alert {
  id: string;
  type: 'overdue' | 'due_soon' | 'promise_due';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  clientName: string;
  amount?: number;
  dueDate?: string;
  invoiceNumber?: string;
  createdAt: Date;
}

export default function Alerts() {
  const { user, userData } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'due_soon' | 'promise_due'>('all');
  const [showRead, setShowRead] = useState(false);

  useEffect(() => {
    if (user && userData?.organization_id) {
      loadAlerts();
    }
  }, [user, userData]);

  const loadAlerts = async () => {
    if (!user || !userData?.organization_id) return;

    try {
      setLoading(true);
      const generatedAlerts: Alert[] = [];

      const isFilteredUser = userData.role !== 'superadmin' && userData.role !== 'admin' && !userData.permissions?.includes('*:*');
      const assignedRoutes = userData.assigned_routes || [];

      if (isFilteredUser && assignedRoutes.length === 0) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysFromNow = new Date(today);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      let receivablesQuery = supabase
        .from('accounts_receivable')
        .select(`
          *,
          clients!inner (
            name,
            route_id
          )
        `)
        .eq('organization_id', userData.organization_id)
        .neq('status', 'paid')
        .order('due_date', { ascending: true });

      if (isFilteredUser) {
        receivablesQuery = receivablesQuery.in('clients.route_id', assignedRoutes);
      }

      const { data: receivables } = await receivablesQuery;

      if (receivables) {
        receivables.forEach((receivable) => {
          const dueDate = new Date(receivable.due_date);
          dueDate.setHours(0, 0, 0, 0);
          // @ts-ignore - Supabase types mapping
          const clientName = receivable.clients?.name || 'Cliente desconocido';

          if (dueDate < today) {
            const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            generatedAlerts.push({
              id: `overdue-${receivable.id}`,
              type: 'overdue',
              priority: daysOverdue > 30 ? 'high' : daysOverdue > 15 ? 'medium' : 'low',
              title: 'Factura Vencida',
              message: `Factura ${receivable.invoice_number} vencida hace ${daysOverdue} días`,
              clientName,
              amount: receivable.balance,
              dueDate: receivable.due_date,
              invoiceNumber: receivable.invoice_number,
              createdAt: new Date(receivable.created_at)
            });
          } else if (dueDate <= sevenDaysFromNow) {
            const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            generatedAlerts.push({
              id: `due-soon-${receivable.id}`,
              type: 'due_soon',
              priority: daysUntilDue <= 3 ? 'high' : 'medium',
              title: 'Factura Próxima a Vencer',
              message: `Factura ${receivable.invoice_number} vence en ${daysUntilDue} días`,
              clientName,
              amount: receivable.balance,
              dueDate: receivable.due_date,
              invoiceNumber: receivable.invoice_number,
              createdAt: new Date(receivable.created_at)
            });
          }
        });
      }

      let promisesQuery = supabase
        .from('collection_activities')
        .select(`
          *,
          clients!inner (
            name,
            route_id
          ),
          accounts_receivable (
            invoice_number,
            balance
          )
        `)
        .eq('organization_id', userData.organization_id)
        .eq('activity_type', 'promise')
        .eq('completed', false)
        .gte('scheduled_date', today.toISOString())
        .lt('scheduled_date', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

      if (isFilteredUser) {
        promisesQuery = promisesQuery.in('clients.route_id', assignedRoutes);
      }

      const { data: promises } = await promisesQuery;

      if (promises) {
        promises.forEach((promise) => {
          // @ts-ignore
          const clientName = promise.clients?.name || 'Cliente desconocido';
          const invoiceNumber = promise.accounts_receivable?.invoice_number || 'N/A';
          const amount = promise.accounts_receivable?.balance || 0;

          generatedAlerts.push({
            id: `promise-${promise.id}`,
            type: 'promise_due',
            priority: 'high',
            title: 'Promesa de Pago Hoy',
            message: `El cliente prometió pagar hoy la factura ${invoiceNumber}`,
            clientName,
            amount,
            invoiceNumber,
            dueDate: promise.scheduled_date,
            createdAt: new Date(promise.created_at)
          });
        });
      }

      generatedAlerts.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      setAlerts(generatedAlerts);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter !== 'all' && alert.type !== filter) return false;
    return true;
  });

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'overdue':
        return <AlertCircle className="text-red-500" size={24} />;
      case 'due_soon':
        return <Clock className="text-orange-500" size={24} />;
      case 'promise_due':
        return <Calendar className="text-blue-500" size={24} />;
    }
  };

  const getPriorityColor = (priority: Alert['priority']) => {
    switch (priority) {
      case 'high':
        return 'border-red-500 bg-red-500/5';
      case 'medium':
        return 'border-orange-500 bg-orange-500/5';
      case 'low':
        return 'border-yellow-500 bg-yellow-500/5';
    }
  };

  const getTypeLabel = (type: Alert['type']) => {
    switch (type) {
      case 'overdue':
        return 'Vencida';
      case 'due_soon':
        return 'Por Vencer';
      case 'promise_due':
        return 'Promesa Hoy';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Alertas y Recordatorios</h2>
          <p className="text-gray-400">Notificaciones importantes sobre cobros</p>
        </div>
        <div className="bg-gray-800 rounded-xl shadow-lg p-12 border border-gray-700 flex items-center justify-center">
          <div className="flex items-center gap-3 text-gray-400">
            <RefreshCw className="animate-spin" size={20} />
            <span>Cargando alertas...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Alertas y Recordatorios</h2>
          <p className="text-gray-400">Notificaciones importantes sobre cobros</p>
        </div>
        <button
          onClick={loadAlerts}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition"
        >
          <RefreshCw size={18} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-6 border-2 border-red-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Facturas Vencidas</p>
              <p className="text-3xl font-bold text-red-500 mt-1">
                {alerts.filter(a => a.type === 'overdue').length}
              </p>
            </div>
            <AlertCircle className="text-red-500" size={32} />
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border-2 border-orange-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Por Vencer (7 días)</p>
              <p className="text-3xl font-bold text-orange-500 mt-1">
                {alerts.filter(a => a.type === 'due_soon').length}
              </p>
            </div>
            <Clock className="text-orange-500" size={32} />
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border-2 border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Promesas Hoy</p>
              <p className="text-3xl font-bold text-blue-500 mt-1">
                {alerts.filter(a => a.type === 'promise_due').length}
              </p>
            </div>
            <Calendar className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border-2 border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Alertas</p>
              <p className="text-3xl font-bold text-green-500 mt-1">
                {alerts.length}
              </p>
            </div>
            <Bell className="text-green-500" size={32} />
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Todas ({alerts.length})
            </button>
            <button
              onClick={() => setFilter('overdue')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'overdue'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Vencidas ({alerts.filter(a => a.type === 'overdue').length})
            </button>
            <button
              onClick={() => setFilter('due_soon')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'due_soon'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Por Vencer ({alerts.filter(a => a.type === 'due_soon').length})
            </button>
            <button
              onClick={() => setFilter('promise_due')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'promise_due'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Promesas Hoy ({alerts.filter(a => a.type === 'promise_due').length})
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-700">
          {filteredAlerts.length === 0 ? (
            <div className="p-12 text-center">
              <BellOff className="mx-auto text-gray-600 mb-4" size={48} />
              <p className="text-gray-400 text-lg">No hay alertas en este momento</p>
              <p className="text-gray-500 text-sm mt-2">
                Las alertas aparecerán aquí cuando haya facturas vencidas, próximas a vencer o promesas de pago
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 border-l-4 ${getPriorityColor(alert.priority)} hover:bg-gray-750 transition`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-semibold">{alert.title}</h3>
                          <span className={`text-xs px-2 py-1 rounded ${
                            alert.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                            alert.priority === 'medium' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {getTypeLabel(alert.type)}
                          </span>
                        </div>
                        <p className="text-gray-300 mb-2">{alert.message}</p>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                          <span className="font-medium text-gray-300">Cliente: {alert.clientName}</span>
                          {alert.amount && (
                            <span className="flex items-center gap-1">
                              <DollarSign size={14} />
                              {formatCurrency(alert.amount)}
                            </span>
                          )}
                          {alert.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar size={14} />
                              {formatDate(alert.dueDate)}
                            </span>
                          )}
                          {alert.invoiceNumber && (
                            <span>Factura: {alert.invoiceNumber}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {filteredAlerts.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Bell className="text-blue-400 flex-shrink-0 mt-1" size={20} />
            <div className="text-sm text-blue-300">
              <p className="font-semibold mb-1">Tip: Mantén tus cobros al día</p>
              <p className="text-blue-400">
                Revisa estas alertas regularmente para mantener un mejor control de tus cuentas por cobrar.
                Las alertas de alta prioridad requieren atención inmediata.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
