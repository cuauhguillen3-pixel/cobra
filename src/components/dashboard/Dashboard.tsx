import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { supabase } from '../../lib/supabase';
import {
  Users,
  DollarSign,
  ShoppingCart,
  MapPin,
  FileText,
  AlertCircle,
  TrendingUp,
  Calendar,
  CreditCard,
  Activity
} from 'lucide-react';

interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalSales: number;
  activeSales: number;
  totalPayments: number;
  totalPaymentsAmount: number;
  totalRoutes: number;
  activeRoutes: number;
  overduePayments: number;
  overdueAmount: number;
  salesThisMonth: number;
  salesAmountThisMonth: number;
  paymentsThisMonth: number;
  paymentsAmountThisMonth: number;
}

interface TopCollector {
  id: string;
  name: string;
  totalSales: number;
  salesCount: number;
  totalPayments: number;
  paymentsCount: number;
}

interface TopRoute {
  id: string;
  name: string;
  clientCount: number;
  totalSales: number;
  collectionRate: number;
}

export default function Dashboard() {
  const { userData } = useAuth();
  const { modules, hasModule, loading: permissionsLoading } = usePermissions();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topCollectors, setTopCollectors] = useState<TopCollector[]>([]);
  const [topRoutes, setTopRoutes] = useState<TopRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = userData?.role === 'admin';

  useEffect(() => {
    if (userData?.organization_id && !permissionsLoading) {
      loadDashboardData();
    }
  }, [userData, permissionsLoading]);

  const loadDashboardData = async () => {
    if (!userData?.organization_id) return;

    setLoading(true);
    try {
      const promises: Promise<any>[] = [];

      if (isAdmin || hasModule('clients')) {
        promises.push(loadClientsStats());
      }
      if (isAdmin || hasModule('sales')) {
        promises.push(loadSalesStats());
      }
      if (isAdmin || hasModule('payments')) {
        promises.push(loadPaymentsStats());
      }
      if (isAdmin || hasModule('routes')) {
        promises.push(loadRoutesStats());
      }
      if (isAdmin) {
        promises.push(loadTopCollectors());
        promises.push(loadTopRoutes());
      }

      await Promise.all(promises);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilterParams = () => {
    const isFilteredUser = userData?.role !== 'superadmin' && userData?.role !== 'admin' && !userData?.permissions?.includes('*:*');
    const assignedRoutes = userData?.assigned_routes || [];
    return { isFilteredUser, assignedRoutes };
  };

  const loadClientsStats = async () => {
    const { isFilteredUser, assignedRoutes } = getFilterParams();

    if (isFilteredUser && assignedRoutes.length === 0) {
       setStats(prev => ({ ...prev!, totalClients: 0, activeClients: 0 }));
       return;
    }

    let query = supabase
      .from('clients')
      .select('id')
      .eq('organization_id', userData!.organization_id);

    if (isFilteredUser) {
      query = query.in('route_id', assignedRoutes);
    }

    const { data, error } = await query;

    if (error) throw error;

    // To find 'active' clients, we could query clients who have 'active' sales
    let activeSalesQuery = supabase
      .from('sales')
      .select('client_id, client:clients!inner(route_id)')
      .eq('organization_id', userData!.organization_id)
      .eq('status', 'active');

    if (isFilteredUser) {
      activeSalesQuery = activeSalesQuery.in('client.route_id', assignedRoutes);
    }

    const { data: activeSales } = await activeSalesQuery;

    const activeClientIds = new Set(activeSales?.map(s => s.client_id));

    setStats(prev => ({
      ...prev!,
      totalClients: data?.length || 0,
      activeClients: activeClientIds.size,
    }));
  };

  const loadSalesStats = async () => {
    const { isFilteredUser, assignedRoutes } = getFilterParams();

    let query = supabase
      .from('sales')
      .select('status, total_amount, sale_date, client:clients!inner(route_id)')
      .eq('organization_id', userData!.organization_id);

    if (isFilteredUser) {
      query = query.in('client.route_id', assignedRoutes);
    }

    const { data, error } = await query;

    if (error) throw error;

    const now = new Date();
    // Correctly get the first day of the current month in local time format YYYY-MM-DD
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12).toISOString().split('T')[0]; // Noon to avoid timezone shifts

    const thisMonthSales = data?.filter(s => s.sale_date >= firstDayOfMonth) || [];

    setStats(prev => ({
      ...prev!,
      totalSales: data?.length || 0,
      activeSales: data?.filter(s => s.status === 'active').length || 0,
      salesThisMonth: thisMonthSales.length,
      salesAmountThisMonth: thisMonthSales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0),
    }));
  };

  const loadPaymentsStats = async () => {
    const { isFilteredUser, assignedRoutes } = getFilterParams();

    let query = supabase
      .from('payments')
      .select('status, total_amount, payment_date, client:clients!inner(route_id)')
      .eq('organization_id', userData!.organization_id);

    if (isFilteredUser) {
      query = query.in('client.route_id', assignedRoutes);
    }

    const { data, error } = await query;

    if (error) throw error;

    const now = new Date();
    // Correctly get the first day of the current month in local time format YYYY-MM-DD (Noon to avoid timezone shifts)
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12).toISOString().split('T')[0];
    const completed = data?.filter(p => p.status === 'completed') || [];
    const thisMonthPayments = completed.filter(p => p.payment_date >= firstDayOfMonth);

    // Get today in local time YYYY-MM-DD
    const todayLocal = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    let scheduleQuery = supabase
      .from('payment_schedule')
      .select('amount, sale:sales!inner(organization_id, client:clients!inner(route_id))')
      .eq('sale.organization_id', userData!.organization_id)
      .eq('status', 'pending')
      .lte('due_date', todayLocal);

    if (isFilteredUser) {
      scheduleQuery = scheduleQuery.in('sale.client.route_id', assignedRoutes);
    }

    const { data: scheduleData } = await scheduleQuery;

    setStats(prev => ({
      ...prev!,
      totalPayments: completed.length,
      totalPaymentsAmount: completed.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0),
      paymentsThisMonth: thisMonthPayments.length,
      paymentsAmountThisMonth: thisMonthPayments.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0),
      overduePayments: scheduleData?.length || 0,
      overdueAmount: scheduleData?.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0) || 0,
    }));
  };

  const loadRoutesStats = async () => {
    const { isFilteredUser, assignedRoutes } = getFilterParams();

    let query = supabase
      .from('routes')
      .select('id')
      .eq('organization_id', userData!.organization_id);

    if (isFilteredUser) {
      query = query.in('id', assignedRoutes);
    }

    const { data, error } = await query;

    if (error) throw error;

    setStats(prev => ({
      ...prev!,
      totalRoutes: data?.length || 0,
      activeRoutes: data?.length || 0,
    }));
  };

  const loadTopCollectors = async () => {
    const { data: salesData } = await supabase
      .from('sales')
      .select('total_amount, created_by')
      .eq('organization_id', userData!.organization_id)
      .eq('status', 'active');

    const { data: paymentsData } = await supabase
      .from('payments')
      .select('total_amount, collector_id')
      .eq('organization_id', userData!.organization_id)
      .eq('status', 'completed');

    const collectorIds = [
      ...new Set([
        ...(salesData?.map(s => s.created_by).filter(Boolean) || []),
        ...(paymentsData?.map(p => p.collector_id).filter(Boolean) || []),
      ])
    ];

    const { data: usersData } = await supabase
      .from('users')
      .select('id, name')
      .in('id', collectorIds);

    const usersMap = new Map(usersData?.map(u => [u.id, u.name]));

    const collectorStats = new Map<string, TopCollector>();

    salesData?.forEach(sale => {
      if (!sale.created_by) return;
      const existing = collectorStats.get(sale.created_by) || {
        id: sale.created_by,
        name: usersMap.get(sale.created_by) || 'Desconocido',
        totalSales: 0,
        salesCount: 0,
        totalPayments: 0,
        paymentsCount: 0,
      };
      existing.totalSales += parseFloat(sale.total_amount || 0);
      existing.salesCount += 1;
      collectorStats.set(sale.created_by, existing);
    });

    paymentsData?.forEach(payment => {
      if (!payment.collector_id) return;
      const existing = collectorStats.get(payment.collector_id) || {
        id: payment.collector_id,
        name: usersMap.get(payment.collector_id) || 'Desconocido',
        totalSales: 0,
        salesCount: 0,
        totalPayments: 0,
        paymentsCount: 0,
      };
      existing.totalPayments += parseFloat(payment.total_amount || 0);
      existing.paymentsCount += 1;
      collectorStats.set(payment.collector_id, existing);
    });

    const sorted = Array.from(collectorStats.values())
      .sort((a, b) => (b.totalSales + b.totalPayments) - (a.totalSales + a.totalPayments))
      .slice(0, 5);

    setTopCollectors(sorted);
  };

  const loadTopRoutes = async () => {
    const { data: routesData } = await supabase
      .from('routes')
      .select('id, nombre')
      .eq('organization_id', userData!.organization_id);

    if (!routesData) return;

    const routeStats: TopRoute[] = [];

    for (const route of routesData) {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id')
        .eq('route_id', route.id);

      const { data: salesData } = await supabase
        .from('sales')
        .select('total_amount, client:clients!inner(route_id)')
        .eq('client.route_id', route.id)
        .eq('organization_id', userData!.organization_id)
        .eq('status', 'active');

      const { data: paymentsData } = await supabase
        .from('payments')
        .select('total_amount, client:clients!inner(route_id)')
        .eq('client.route_id', route.id)
        .eq('organization_id', userData!.organization_id)
        .eq('status', 'completed');

      const totalSales = salesData?.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0) || 0;
      const totalPayments = paymentsData?.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0) || 0;
      const collectionRate = totalSales > 0 ? (totalPayments / totalSales) * 100 : 0;

      routeStats.push({
        id: route.id,
        name: route.nombre,
        clientCount: clientsData?.length || 0,
        totalSales,
        collectionRate,
      });
    }

    const sorted = routeStats
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 5);

    setTopRoutes(sorted);
  };

  if (loading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Dashboard</h2>
        <p className="text-gray-400">
          Bienvenido, {userData?.name}
        </p>
      </div>

      {isAdmin ? (
        <AdminDashboard
          stats={stats}
          topCollectors={topCollectors}
          topRoutes={topRoutes}
        />
      ) : (
        <UserDashboard
          stats={stats}
          modules={modules}
        />
      )}
    </div>
  );
}

interface AdminDashboardProps {
  stats: DashboardStats | null;
  topCollectors: TopCollector[];
  topRoutes: TopRoute[];
}

function AdminDashboard({ stats, topCollectors, topRoutes }: AdminDashboardProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Clientes Totales"
          value={stats?.totalClients || 0}
          subtitle={`${stats?.activeClients || 0} activos`}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Ventas Activas"
          value={stats?.activeSales || 0}
          subtitle={`$${(stats?.salesAmountThisMonth || 0).toFixed(2)} este mes`}
          icon={ShoppingCart}
          color="green"
        />
        <StatCard
          title="Cobros Totales"
          value={stats?.totalPayments || 0}
          subtitle={`$${(stats?.totalPaymentsAmount || 0).toFixed(2)}`}
          icon={DollarSign}
          color="orange"
        />
        <StatCard
          title="Rutas Activas"
          value={stats?.activeRoutes || 0}
          subtitle={`${stats?.totalRoutes || 0} totales`}
          icon={MapPin}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Ventas Este Mes"
          value={stats?.salesThisMonth || 0}
          subtitle={`$${(stats?.salesAmountThisMonth || 0).toFixed(2)}`}
          icon={TrendingUp}
          color="teal"
        />
        <StatCard
          title="Cobros Este Mes"
          value={stats?.paymentsThisMonth || 0}
          subtitle={`$${(stats?.paymentsAmountThisMonth || 0).toFixed(2)}`}
          icon={Calendar}
          color="indigo"
        />
        <StatCard
          title="Pagos Atrasados"
          value={stats?.overduePayments || 0}
          subtitle={`$${(stats?.overdueAmount || 0).toFixed(2)}`}
          icon={AlertCircle}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-orange-500" />
            Top 5 Cobradores
          </h3>
          <div className="space-y-3">
            {topCollectors.length === 0 ? (
              <p className="text-gray-400 text-sm">No hay datos disponibles</p>
            ) : (
              topCollectors.map((collector, index) => (
                <div key={collector.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-gray-200 font-medium">{collector.name}</p>
                      <p className="text-gray-400 text-sm">
                        {collector.salesCount} ventas, {collector.paymentsCount} cobros
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-200 font-semibold">
                      ${(collector.totalSales + collector.totalPayments).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-orange-500" />
            Top 5 Rutas
          </h3>
          <div className="space-y-3">
            {topRoutes.length === 0 ? (
              <p className="text-gray-400 text-sm">No hay datos disponibles</p>
            ) : (
              topRoutes.map((route, index) => (
                <div key={route.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-gray-200 font-medium">{route.name}</p>
                      <p className="text-gray-400 text-sm">
                        {route.clientCount} clientes, {route.collectionRate.toFixed(1)}% cobro
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-200 font-semibold">
                      ${route.totalSales.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

interface UserDashboardProps {
  stats: DashboardStats | null;
  modules: string[];
}

function UserDashboard({ stats, modules }: UserDashboardProps) {
  const moduleCards = [
    {
      module: 'clients',
      title: 'Clientes',
      value: stats?.totalClients || 0,
      subtitle: `${stats?.activeClients || 0} activos`,
      icon: Users,
      color: 'blue',
    },
    {
      module: 'sales',
      title: 'Ventas',
      value: stats?.activeSales || 0,
      subtitle: `${stats?.totalSales || 0} totales`,
      icon: ShoppingCart,
      color: 'green',
    },
    {
      module: 'payments',
      title: 'Cobros',
      value: stats?.totalPayments || 0,
      subtitle: `$${(stats?.totalPaymentsAmount || 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'orange',
    },
    {
      module: 'routes',
      title: 'Rutas',
      value: stats?.activeRoutes || 0,
      subtitle: `${stats?.totalRoutes || 0} totales`,
      icon: MapPin,
      color: 'purple',
    },
    {
      module: 'accounts_receivable',
      title: 'Cuentas por Cobrar',
      value: stats?.overduePayments || 0,
      subtitle: `$${(stats?.overdueAmount || 0).toFixed(2)} atrasado`,
      icon: CreditCard,
      color: 'red',
    },
    {
      module: 'reports',
      title: 'Reportes',
      value: '📊',
      subtitle: 'Ver reportes',
      icon: FileText,
      color: 'teal',
    },
    {
      module: 'alerts',
      title: 'Alertas',
      value: '🔔',
      subtitle: 'Ver alertas',
      icon: AlertCircle,
      color: 'yellow',
    },
  ];

  const visibleCards = moduleCards.filter(card => modules.includes(card.module));

  if (visibleCards.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-700 text-center">
        <AlertCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-300 text-lg">No tienes acceso a ningún módulo</p>
        <p className="text-gray-400 text-sm mt-2">Contacta a tu administrador para obtener permisos</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {visibleCards.map(card => (
        <StatCard
          key={card.module}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          color={card.color as any}
        />
      ))}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: any;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'teal' | 'indigo' | 'yellow';
}

function StatCard({ title, value, subtitle, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    orange: 'bg-orange-500/10 text-orange-400',
    purple: 'bg-purple-500/10 text-purple-400',
    red: 'bg-red-500/10 text-red-400',
    teal: 'bg-teal-500/10 text-teal-400',
    indigo: 'bg-indigo-500/10 text-indigo-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-100">{value}</p>
        <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}
