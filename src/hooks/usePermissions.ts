import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface Permission {
  module: string;
  action: string;
  name: string;
  description: string | null;
}

export function usePermissions() {
  const { userData } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userData?.id) {
      loadPermissions();
    }
  }, [userData]);

  const loadPermissions = async () => {
    if (!userData?.id) return;

    try {
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userData.id);

      if (userRolesError) throw userRolesError;

      if (!userRolesData || userRolesData.length === 0) {
        setPermissions([]);
        setModules([]);
        setLoading(false);
        return;
      }

      const roleIds = userRolesData.map((ur: any) => ur.role_id);

      const { data: rolePermissionsData, error: rolePermissionsError } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .in('role_id', roleIds);

      if (rolePermissionsError) throw rolePermissionsError;

      if (!rolePermissionsData || rolePermissionsData.length === 0) {
        setPermissions([]);
        setModules([]);
        setLoading(false);
        return;
      }

      const permissionIds = [...new Set(rolePermissionsData.map((rp: any) => rp.permission_id))];

      const { data: permissionsData, error: permissionsError } = await supabase
        .from('permissions')
        .select('*')
        .in('id', permissionIds);

      if (permissionsError) throw permissionsError;

      setPermissions(permissionsData || []);

      const uniqueModules = [...new Set(permissionsData?.map((p: any) => p.module) || [])];
      setModules(uniqueModules);
    } catch (error) {
      console.error('Error loading permissions:', error);
      setPermissions([]);
      setModules([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (module: string, action?: string): boolean => {
    if (userData?.role === 'admin') return true;

    if (action) {
      return permissions.some(p => p.module === module && p.action === action);
    }
    return permissions.some(p => p.module === module);
  };

  const hasModule = (module: string): boolean => {
    if (userData?.role === 'admin') return true;
    return modules.includes(module);
  };

  return {
    permissions,
    modules,
    loading,
    hasPermission,
    hasModule,
  };
}
