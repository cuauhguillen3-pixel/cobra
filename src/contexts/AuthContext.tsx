import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UserData {
  id: string;
  organization_id: string | null;
  role: 'superadmin' | 'admin' | 'collector';
  name: string;
  email: string;
  is_active: boolean;
  permissions?: string[];
  assigned_routes?: string[];
}

interface Organization {
  id: string;
  name: string;
  email: string;
  status: 'trial' | 'active' | 'inactive' | 'expired';
  trial_end_date: string;
  max_users: number;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  organization: Organization | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, organizationName: string) => Promise<void>;
  signOut: () => Promise<void>;
  devLogin: (userId: string) => Promise<void>;
  hasPermission: (module: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserData(session.user.id);
        }
        setLoading(false);
      })();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserData(session.user.id);
        } else {
          setUserData(null);
          setOrganization(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (userError) throw userError;

      if (userData) {
        // Cargar roles y permisos
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role_id, roles(is_admin, role_permissions(permission_id, permissions(module, action)))')
          .eq('user_id', userId);

        let permissions: string[] = [];
        let isAdmin = false;

        if (userRoles) {
          userRoles.forEach((ur: any) => {
            if (ur.roles?.is_admin) isAdmin = true;
            
            ur.roles?.role_permissions?.forEach((rp: any) => {
              if (rp.permissions) {
                permissions.push(`${rp.permissions.module}:${rp.permissions.action}`);
              }
            });
          });
        }

        // Cargar rutas asignadas explícitamente en tabla user_routes
        const { data: userRoutes } = await supabase
          .from('user_routes')
          .select('route_id')
          .eq('user_id', userId);

        // Cargar rutas donde el usuario es el cobrador asignado en la tabla routes
        const { data: assignedAsCollector } = await supabase
          .from('routes')
          .select('id')
          .eq('cobrador_asignado', userId);
          
        const explicitRoutes = userRoutes?.map(ur => ur.route_id) || [];
        const collectorRoutes = assignedAsCollector?.map(r => r.id) || [];
        
        // Unir ambas listas de rutas (evitando duplicados)
        const assigned_routes = Array.from(new Set([...explicitRoutes, ...collectorRoutes]));

        // HARDCODE: Forzar permisos de administrador para el usuario principal
        if (userData.email === 'cuauhguillen3@gmail.com') {
          isAdmin = true;
          userData.role = 'admin';
        }

        // Si es admin del sistema (superadmin) o admin de organización, tiene todos los permisos
        if (userData.role === 'superadmin' || isAdmin) {
          permissions = ['*:*'];
        }

        setUserData({ ...userData, permissions, assigned_routes });

        if (userData.organization_id) {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', userData.organization_id)
            .maybeSingle();

          if (orgError) throw orgError;
          setOrganization(orgData);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const hasPermission = (module: string, action: string) => {
    if (!userData?.permissions) return false;
    if (userData.permissions.includes('*:*')) return true;
    return userData.permissions.includes(`${module}:${action}`);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  };

  const signUp = async (email: string, password: string, name: string, organizationName: string) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('No se pudo crear el usuario');

    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: organizationName,
        email: email,
        status: 'trial',
        max_users: 5,
      })
      .select()
      .single();

    if (orgError) throw orgError;

    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        organization_id: orgData.id,
        role: 'admin',
        name: name,
        email: email,
        is_active: true,
      });

    if (userError) throw userError;
  };

  const devLogin = async (userId: string) => {
    setLoading(true);
    try {
      // Fetch user data from public table first to confirm existence
      const { data: publicUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      
      // Mock Supabase User object
      const mockUser: User = {
        id: publicUser.id,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: publicUser.created_at,
        email: publicUser.email,
        phone: '',
        confirmed_at: new Date().toISOString(),
        email_confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: 'authenticated',
        updated_at: new Date().toISOString(),
      };
      
      setUser(mockUser);
      await loadUserData(userId);
    } catch (error) {
      console.error('Dev login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUserData(null);
    setOrganization(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        organization,
        loading,
        signIn,
        signUp,
        signOut,
        devLogin,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
