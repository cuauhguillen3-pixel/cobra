import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit2, Trash2, Save, X, Shield, RefreshCw, AlertCircle, CheckSquare, Square } from 'lucide-react';

interface Role {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_admin: boolean;
  is_system: boolean;
  created_at: string;
  permissions?: Permission[];
}

interface Permission {
  id: string;
  module: string;
  action: string;
  name: string;
  description: string | null;
}

interface FormData {
  name: string;
  description: string;
  is_admin: boolean;
  permission_ids: string[];
}

export default function RoleManagement() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    is_admin: false,
    permission_ids: []
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!userData?.organization_id) {
        setLoading(false);
        return;
      }

      const [rolesResult, permissionsResult] = await Promise.all([
        supabase
          .from('roles')
          .select('*')
          .eq('organization_id', userData.organization_id)
          .order('is_admin', { ascending: false })
          .order('name'),
        supabase
          .from('permissions')
          .select('*')
          .order('module')
          .order('action')
      ]);

      if (rolesResult.data) {
        const rolesWithPermissions = await Promise.all(
          rolesResult.data.map(async (role) => {
            const { data: rolePerms } = await supabase
              .from('role_permissions')
              .select('permission_id, permissions(*)')
              .eq('role_id', role.id);

            return {
              ...role,
              permissions: rolePerms?.map((rp: any) => rp.permissions).filter(Boolean) || []
            };
          })
        );
        setRoles(rolesWithPermissions);
      }

      setPermissions(permissionsResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!userData?.organization_id) return;

      const roleData = {
        organization_id: userData.organization_id,
        name: formData.name,
        description: formData.description || null,
        is_admin: editingId ? formData.is_admin : false, // Enforce single admin policy for new roles
        is_system: false,
        created_by: user.id,
        updated_by: user.id
      };

      let roleId: string;

      if (editingId) {
        const { error } = await supabase
          .from('roles')
          .update(roleData)
          .eq('id', editingId);

        if (error) throw error;
        roleId = editingId;

        await supabase.from('role_permissions').delete().eq('role_id', roleId);
      } else {
        const { data, error } = await supabase
          .from('roles')
          .insert([roleData])
          .select()
          .single();

        if (error) throw error;
        roleId = data.id;
      }

      if (!formData.is_admin && formData.permission_ids.length > 0) {
        await supabase
          .from('role_permissions')
          .insert(
            formData.permission_ids.map(permId => ({
              role_id: roleId,
              permission_id: permId
            }))
          );
      }

      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving role:', error);
      alert(error.message || 'Error al guardar el rol');
    }
  };

  const handleEdit = (role: Role) => {
    if (role.is_system) {
      alert('No se puede editar un rol del sistema');
      return;
    }

    setEditingId(role.id);
    setFormData({
      name: role.name,
      description: role.description || '',
      is_admin: role.is_admin,
      permission_ids: role.permissions?.map(p => p.id) || []
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const role = roles.find(r => r.id === id);
    if (role?.is_system) {
      alert('No se puede eliminar un rol del sistema');
      return;
    }

    if (!confirm('¿Estás seguro de eliminar este rol? Los usuarios con este rol perderán sus permisos.')) return;

    try {
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting role:', error);
      alert('Error al eliminar el rol');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_admin: false,
      permission_ids: []
    });
    setEditingId(null);
    setShowForm(false);
  };

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const getModuleLabel = (module: string) => {
    const labels: Record<string, string> = {
      clients: 'Clientes',
      sales: 'Ventas',
      payments: 'Pagos',
      routes: 'Rutas',
      accounts_receivable: 'Cuentas por Cobrar',
      reports: 'Reportes',
      alerts: 'Alertas',
      variables: 'Variables',
      users: 'Usuarios',
      roles: 'Roles'
    };
    return labels[module] || module;
  };

  const toggleModulePermissions = (module: string) => {
    const modulePerms = groupedPermissions[module].map(p => p.id);
    const allSelected = modulePerms.every(id => formData.permission_ids.includes(id));

    if (allSelected) {
      setFormData({
        ...formData,
        permission_ids: formData.permission_ids.filter(id => !modulePerms.includes(id))
      });
    } else {
      setFormData({
        ...formData,
        permission_ids: [...new Set([...formData.permission_ids, ...modulePerms])]
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw className="animate-spin" size={20} />
          <span>Cargando roles...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          <Plus size={20} />
          Nuevo Rol
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-100">
              {editingId ? 'Editar Rol' : 'Nuevo Rol'}
            </h3>
            <button
              onClick={resetForm}
              className="p-2 hover:bg-gray-700 rounded-lg transition"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nombre del Rol *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                placeholder="Ej: Cobrador, Supervisor"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Descripción
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Descripción del rol y sus responsabilidades"
              />
            </div>

            {/* 
            <div className="flex items-center gap-4 p-4 bg-blue-600/10 border border-blue-600/30 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_admin}
                  onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked, permission_ids: [] })}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-300 font-medium">Administrador (Todos los permisos)</span>
              </label>
            </div>
            */}

            {formData.is_admin && (
               <div className="p-4 bg-yellow-600/10 border border-yellow-600/30 rounded-lg mb-4">
                 <p className="text-yellow-400 font-medium flex items-center gap-2">
                   <Shield size={20} />
                   Este rol tiene permisos de administrador
                 </p>
               </div>
            )}

            {!formData.is_admin && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Permisos
                </label>
                <div className="space-y-3 max-h-96 overflow-y-auto p-3 bg-gray-900 rounded-lg">
                  {Object.entries(groupedPermissions).map(([module, perms]) => {
                    const modulePerms = perms.map(p => p.id);
                    const allSelected = modulePerms.every(id => formData.permission_ids.includes(id));
                    const someSelected = modulePerms.some(id => formData.permission_ids.includes(id));

                    return (
                      <div key={module} className="border border-gray-700 rounded-lg p-3 bg-gray-800">
                        <button
                          type="button"
                          onClick={() => toggleModulePermissions(module)}
                          className="flex items-center gap-2 mb-2 font-medium text-gray-200 hover:text-blue-400 transition"
                        >
                          {allSelected ? (
                            <CheckSquare size={18} className="text-blue-500" />
                          ) : someSelected ? (
                            <Square size={18} className="text-blue-400" />
                          ) : (
                            <Square size={18} className="text-gray-500" />
                          )}
                          {getModuleLabel(module)}
                        </button>
                        <div className="grid grid-cols-2 gap-2 ml-6">
                          {perms.map((perm) => (
                            <label
                              key={perm.id}
                              className="flex items-center gap-2 p-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 transition"
                            >
                              <input
                                type="checkbox"
                                checked={formData.permission_ids.includes(perm.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData({ ...formData, permission_ids: [...formData.permission_ids, perm.id] });
                                  } else {
                                    setFormData({ ...formData, permission_ids: formData.permission_ids.filter(id => id !== perm.id) });
                                  }
                                }}
                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-300">{perm.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                <Save size={18} />
                {editingId ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden">
        {roles.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="mx-auto text-gray-600 mb-4" size={48} />
            <p className="text-gray-400 text-lg">No hay roles configurados</p>
            <p className="text-gray-500 text-sm mt-2">
              Crea tu primer rol para asignar permisos a usuarios
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              <Plus size={20} />
              Nuevo Rol
            </button>
          </div>
        ) : (
          <>
            {/* Vista de tarjetas para móvil */}
            <div className="block md:hidden">
              <div className="divide-y divide-gray-700">
                {roles.map((role) => (
                  <div key={role.id} className="p-4 hover:bg-gray-750">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        {role.is_admin && (
                          <Shield size={16} className="text-yellow-500" />
                        )}
                        <div>
                          <p className="font-semibold text-gray-100">{role.name}</p>
                          {role.description && (
                            <p className="text-xs text-gray-400 mt-1">{role.description}</p>
                          )}
                          {role.is_system && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">
                              Sistema
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mb-3">
                      {role.is_admin ? (
                        <span className="px-3 py-1 bg-yellow-600/20 text-yellow-400 rounded-full text-xs font-medium">
                          Todos los permisos
                        </span>
                      ) : (
                        <div>
                          {role.permissions && role.permissions.length > 0 ? (
                            <span className="text-xs text-gray-400">
                              {role.permissions.length} permiso{role.permissions.length !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 italic">Sin permisos</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(role)}
                        disabled={role.is_system}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition ${
                          role.is_system
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <Edit2 size={16} />
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(role.id)}
                        disabled={role.is_system}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition ${
                          role.is_system
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-red-600 text-white hover:bg-red-700'
                        }`}
                      >
                        <Trash2 size={16} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vista de tabla para escritorio */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Permisos
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {roles.map((role) => (
                    <tr key={role.id} className="hover:bg-gray-750 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {role.is_admin && (
                            <Shield size={16} className="text-yellow-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-100">{role.name}</p>
                            {role.description && (
                              <p className="text-xs text-gray-400 mt-1">{role.description}</p>
                            )}
                            {role.is_system && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">
                                Sistema
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {role.is_admin ? (
                          <span className="px-3 py-1 bg-yellow-600/20 text-yellow-400 rounded-full text-xs font-medium">
                            Todos los permisos
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {role.permissions && role.permissions.length > 0 ? (
                              <span className="text-xs text-gray-400">
                                {role.permissions.length} permiso{role.permissions.length !== 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 italic">Sin permisos</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(role)}
                            disabled={role.is_system}
                            className={`p-2 rounded-lg transition ${
                              role.is_system
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-gray-700'
                            }`}
                            title={role.is_system ? 'No se puede editar un rol del sistema' : 'Editar'}
                          >
                            <Edit2 size={16} className="text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleDelete(role.id)}
                            disabled={role.is_system}
                            className={`p-2 rounded-lg transition ${
                              role.is_system
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-gray-700'
                            }`}
                            title={role.is_system ? 'No se puede eliminar un rol del sistema' : 'Eliminar'}
                          >
                            <Trash2 size={16} className="text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {roles.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-blue-400 flex-shrink-0 mt-1" size={20} />
            <div className="text-sm text-blue-300">
              <p className="font-semibold mb-1">Acerca de Roles y Permisos</p>
              <ul className="text-blue-400 space-y-1">
                <li>• El rol de Administrador tiene acceso completo a todos los módulos</li>
                <li>• Los usuarios pueden tener múltiples roles y sus permisos se combinan</li>
                <li>• Los usuarios con rutas asignadas solo verán información de esas rutas</li>
                <li>• Los roles del sistema no se pueden modificar ni eliminar</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
