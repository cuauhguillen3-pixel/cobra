import { ReactNode, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Home, Users, FileText, DollarSign, Calendar, Bell, BarChart3, Menu, X, LogOut, Settings, ChevronLeft, ChevronRight, MapPin, Percent, ShoppingCart, Shield, Wallet, TrendingUp } from 'lucide-react';
import PWAInstallButton from './PWAInstallButton';
import { useAlertCount } from '../../hooks/useAlertCount';

interface LayoutProps {
  children: ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
}

export default function Layout({ children, currentView, onNavigate }: LayoutProps) {
  const { userData, organization, signOut, hasPermission } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const alertCount = useAlertCount();

  const menuItems = [
    { id: 'dashboard', label: 'Inicio', icon: Home },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'sales', label: 'Ventas', icon: ShoppingCart },
    { id: 'accounts', label: 'Cuentas por cobrar', icon: FileText },
    { id: 'payments', label: 'Pagos', icon: DollarSign },
    { id: 'cash_register', label: 'Caja', icon: Wallet },
    { id: 'fees_report', label: 'Morosidad y Apertura', icon: TrendingUp },
    { id: 'routes', label: 'Rutas', icon: MapPin },
    { id: 'activities', label: 'Agenda', icon: Calendar },
    { id: 'alerts', label: 'Alertas', icon: Bell },
    { id: 'users', label: 'Usuarios', icon: Shield },
    { id: 'variables', label: 'Variables', icon: Percent },
    { id: 'reports', label: 'Reportes', icon: BarChart3 },
  ];

  if (userData?.role === 'superadmin') {
    menuItems.push({ id: 'admin', label: 'Administración', icon: Settings });
  }

  const filteredMenuItems = menuItems.filter(item => {
    // Dashboard siempre visible
    if (item.id === 'dashboard') return true;

    // Mapear IDs de menú a módulos de permisos si son diferentes
    // 'accounts' en el menú corresponde a 'accounts_receivable' en los permisos de la BD
    const permissionModule = item.id === 'accounts' ? 'accounts_receivable' : item.id;

    // Verificar permiso de lectura ('view')
    return hasPermission(permissionModule, 'view');
  });

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700 fixed w-full z-30 top-0 shadow-lg">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-300 hover:bg-gray-700"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden md:flex p-2 rounded-lg text-gray-300 hover:bg-gray-700 transition"
                title={sidebarCollapsed ? 'Expandir menú' : 'Ocultar menú'}
              >
                {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
              </button>
              <div className="ml-2 md:ml-0">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">Cobraapp</h1>
                <p className="text-xs text-gray-400">{organization?.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-200">{userData?.name}</p>
                <p className="text-xs text-gray-400 capitalize">{userData?.role}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg text-gray-300 hover:bg-gray-700 transition"
                title="Cerrar sesión"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-700 bg-gray-800">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const showBadge = item.id === 'alerts' && alertCount > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                    currentView === item.id
                      ? 'bg-blue-600/20 text-blue-400 border-l-4 border-blue-500'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <div className="relative">
                    <Icon size={20} />
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                        {alertCount > 9 ? '9+' : alertCount}
                      </span>
                    )}
                  </div>
                  <span className="font-medium">{item.label}</span>
                  {showBadge && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                      {alertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </nav>

      <div className="flex pt-16">
        <aside className={`hidden md:flex md:flex-shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
          <div className="w-full border-r border-gray-800 bg-gray-850 min-h-screen">
            <nav className="p-4 space-y-1">
              {filteredMenuItems.map((item) => {
                const Icon = item.icon;
                const showBadge = item.id === 'alerts' && alertCount > 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg text-left transition ${
                      currentView === item.id
                        ? 'bg-blue-600/20 text-blue-400 shadow-lg'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <div className="relative">
                      <Icon size={20} />
                      {showBadge && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                          {alertCount > 9 ? '9+' : alertCount}
                        </span>
                      )}
                    </div>
                    {!sidebarCollapsed && (
                      <>
                        <span className="font-medium flex-1">{item.label}</span>
                        {showBadge && (
                          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                            {alertCount}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-gray-900">
          {children}
        </main>
      </div>
      <PWAInstallButton />
    </div>
  );
}
