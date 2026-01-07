import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Layout from './components/layout/Layout';
import Dashboard from './components/dashboard/Dashboard';
import Clients from './components/clients/Clients';
import Sales from './components/sales/Sales';
import AccountsReceivable from './components/accounts/AccountsReceivable';
import Payments from './components/payments/Payments';
import CashRegister from './components/cashRegister/CashRegister';
import Routes from './components/routes/Routes';
import Activities from './components/activities/Activities';
import Alerts from './components/alerts/Alerts';
import Reports from './components/reports/Reports';
import Variables from './components/variables/Variables';
import FeesReport from './components/reports/FeesReport';
import Admin from './components/admin/Admin';
import Users from './components/users/Users';
import { AlertCircle } from 'lucide-react';

console.log('App.tsx loaded successfully');

function AppContent() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [currentView, setCurrentView] = useState('dashboard');
  const [showRouteWarning, setShowRouteWarning] = useState(false);
  const [checkingRoutes, setCheckingRoutes] = useState(true);
  const [isFirstRoute, setIsFirstRoute] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  useEffect(() => {
    const checkUserRoutes = async () => {
      if (user) {
        try {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('organization_id')
            .eq('id', user.id)
            .maybeSingle();

          if (userError) {
            console.error('Error fetching user data:', userError);
            setCheckingRoutes(false);
            return;
          }

          if (!userData?.organization_id) {
            setCheckingRoutes(false);
            return;
          }

          const { count, error } = await supabase
            .from('routes')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', userData.organization_id);

          if (error) {
            console.error('Error checking routes:', error);
            setCheckingRoutes(false);
            return;
          }

          if (count === 0) {
            setShowRouteWarning(true);
          }
          setCheckingRoutes(false);
        } catch (error) {
          console.error('Error:', error);
          setCheckingRoutes(false);
        }
      } else {
        setCheckingRoutes(false);
      }
    };

    checkUserRoutes();
  }, [user]);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const { error } = await supabase
          .from('organizations')
          .select('id', { count: 'exact', head: true });
        setBackendOk(!error);
      } catch (_err) {
        setBackendOk(false);
      }
    };
    checkBackend();
  }, []);

  const handleCreateFirstRoute = () => {
    setShowRouteWarning(false);
    setIsFirstRoute(true);
    setCurrentView('routes');
  };

  const handleRouteCreated = () => {
    setIsFirstRoute(false);
  };

  if (loading || checkingRoutes) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return authMode === 'login' ? (
      <Login onToggleMode={() => setAuthMode('register')} />
    ) : (
      <Register onToggleMode={() => setAuthMode('login')} />
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'clients':
        return <Clients />;
      case 'sales':
        return <Sales />;
      case 'accounts':
        return <AccountsReceivable />;
      case 'payments':
        return <Payments onNavigate={setCurrentView} />;
      case 'cash_register':
        return <CashRegister />;
      case 'routes':
        return <Routes isFirstRoute={isFirstRoute} onRouteCreated={handleRouteCreated} />;
      case 'activities':
        return <Activities />;
      case 'alerts':
        return <Alerts />;
      case 'reports':
        return <Reports />;
      case 'fees_report':
        return <FeesReport />;
      case 'variables':
        return <Variables />;
      case 'users':
        return <Users />;
      case 'admin':
        return <Admin />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <Layout currentView={currentView} onNavigate={setCurrentView}>
        {renderView()}
      </Layout>

      {showRouteWarning && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-md shadow-2xl border-2 border-orange-500">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-center">
                <div className="bg-orange-500/20 p-3 rounded-full">
                  <AlertCircle className="text-orange-500" size={48} />
                </div>
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">
                  Acción Requerida
                </h2>
                <p className="text-gray-300 text-lg">
                  Antes de comenzar a usar el sistema, necesitas crear al menos una ruta de cobro.
                </p>
                <p className="text-gray-400 text-sm">
                  Las rutas te permiten organizar y planificar tus actividades de cobro de manera eficiente.
                </p>
              </div>

              <button
                onClick={handleCreateFirstRoute}
                className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition font-semibold text-lg"
              >
                Crear Mi Primera Ruta
              </button>
            </div>
          </div>
        </div>
      )}
      {backendOk !== null && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`px-3 py-2 rounded-lg text-sm shadow-lg ${
              backendOk ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {backendOk ? 'Backend: Conectado' : 'Backend: Error de conexión'}
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
