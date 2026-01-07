import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit2, Trash2, Save, X, CheckCircle, Circle, RefreshCw, AlertCircle, Search, User, Mail, Lock, MapPin } from 'lucide-react';

interface AppUser {
  id: string;
  email: string;
  name: string;
  organization_id: string;
  is_active: boolean;
  created_at: string;
  roles?: { id: string; name: string }[];
  routes?: { id: string; nombre_ruta: string }[];
}

interface Role {
  id: string;
  name: string;
}

interface Route {
  id: string;
  nombre_ruta: string;
}

interface FormData {
  email: string;
  password: string;
  name: string;
  is_active: boolean;
  role_ids: string[];
  route_ids: string[];
}

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userLimit, setUserLimit] = useState({ max: 5, extra: 0, current: 0 });
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    name: '',
    is_active: true,
    role_ids: [],
    route_ids: []
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

      const [orgResult, usersResult, rolesResult, routesResult] = await Promise.all([
        supabase
          .from('organizations')
          .select('max_users, extra_users_paid')
          .eq('id', userData.organization_id)
          .maybeSingle(),
        supabase
          .from('users')
          .select('*')
          .eq('organization_id', userData.organization_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('roles')
          .select('id, name')
          .eq('organization_id', userData.organization_id)
          .order('name'),
        supabase
          .from('routes')
          .select('id, nombre_ruta')
          .eq('organization_id', userData.organization_id)
          .order('nombre_ruta')
      ]);

      if (orgResult.data) {
        setUserLimit({
          max: orgResult.data.max_users || 5,
          extra: orgResult.data.extra_users_paid || 0,
          current: usersResult.data?.length || 0
        });
      }

      if (usersResult.data) {
        const usersWithDetails = await Promise.all(
          usersResult.data.map(async (u) => {
            const [rolesRes, routesRes] = await Promise.all([
              supabase
                .from('user_roles')
                .select('role_id, roles(id, name)')
                .eq('user_id', u.id),
              supabase
                .from('user_routes')
                .select('route_id, routes(id, nombre_ruta)')
                .eq('user_id', u.id)
            ]);

            return {
              ...u,
              roles: rolesRes.data?.map((r: any) => r.roles).filter(Boolean) || [],
              routes: routesRes.data?.map((r: any) => r.routes).filter(Boolean) || []
            };
          })
        );
        setUsers(usersWithDetails);
      }

      // Filtrar roles administrativos para mantener política de único administrador
      const filteredRoles = (rolesResult.data || []).filter(r => 
        r.name.toLowerCase() !== 'admin' && r.name.toLowerCase() !== 'superadmin'
      );
      setRoles(filteredRoles);
      setRoutes(routesResult.data || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert('Error al cargar datos: ' + (error.message || 'Error desconocido'));
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

      if (!editingId) {
        const totalAllowed = userLimit.max + userLimit.extra;
        if (userLimit.current >= totalAllowed) {
          alert(`Has alcanzado el límite de usuarios (${totalAllowed}). Contacta al administrador para agregar más usuarios.`);
          return;
        }

        console.log('Creating new user in Auth...');
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              organization_id: userData.organization_id
            }
          }
        });

        if (authError) {
          console.error('Auth error:', authError);
          throw authError;
        }
        
        if (!authData.user) throw new Error('No se pudo crear el usuario en Auth');
        
        console.log('User created in Auth with ID:', authData.user.id);
        console.log('Inserting into public.users table...');

        const { error: userError } = await supabase
          .from('users')
          .insert([{
            id: authData.user.id,
            email: formData.email,
            name: formData.name,
            organization_id: userData.organization_id,
            is_active: formData.is_active,
            created_by: user.id
          }]);

        if (userError) {
          console.error('Error inserting into public.users:', userError);
          // If insert fails, we might want to alert the user specifically about this
          throw new Error(`Usuario creado en Auth pero falló al guardar detalles: ${userError.message}`);
        }
        
        console.log('User inserted into public.users successfully');

        if (formData.role_ids.length > 0) {
          console.log('Assigning roles...');
          const { error: rolesError } = await supabase
            .from('user_roles')
            .insert(
              formData.role_ids.map(roleId => ({
                user_id: authData.user!.id,
                role_id: roleId,
                assigned_by: user.id
              }))
            );
            
          if (rolesError) console.error('Error assigning roles:', rolesError);
        }
      } else {
        const { error: userError } = await supabase
          .from('users')
          .update({
            name: formData.name,
            is_active: formData.is_active,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (userError) throw userError;

        await supabase.from('user_roles').delete().eq('user_id', editingId);
        if (formData.role_ids.length > 0) {
          await supabase
            .from('user_roles')
            .insert(
              formData.role_ids.map(roleId => ({
                user_id: editingId,
                role_id: roleId,
                assigned_by: user.id
              }))
            );
        }
      }

      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving user:', error);
      alert(error.message || 'Error al guardar el usuario');
    }
  };

  const handleEdit = (appUser: AppUser) => {
    setEditingId(appUser.id);
    setFormData({
      email: appUser.email,
      password: '',
      name: appUser.name,
      is_active: appUser.is_active,
      role_ids: appUser.roles?.map(r => r.id) || [],
      route_ids: appUser.routes?.map(r => r.id) || []
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error al eliminar el usuario');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus, updated_by: user?.id })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error toggling active status:', error);
      alert('Error al cambiar el estado');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      name: '',
      is_active: true,
      role_ids: [],
      route_ids: []
    });
    setEditingId(null);
    setShowForm(false);
  };

  const filteredUsers = users.filter(u =>
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAllowed = userLimit.max + userLimit.extra;
  const isAtLimit = userLimit.current >= totalAllowed;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw className="animate-spin" size={20} />
          <span>Cargando usuarios...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar usuarios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-400">
            Usuarios: <span className={`font-semibold ${isAtLimit ? 'text-red-400' : 'text-blue-400'}`}>
              {userLimit.current}/{totalAllowed}
            </span>
          </div>
          <button
            onClick={() => setShowForm(true)}
            disabled={isAtLimit && !editingId}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              isAtLimit && !editingId
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Plus size={20} />
            Nuevo Usuario
          </button>
        </div>
      </div>

      {isAtLimit && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-orange-400 flex-shrink-0 mt-1" size={20} />
            <div className="text-sm text-orange-300">
              <p className="font-semibold mb-1">Límite de Usuarios Alcanzado</p>
              <p className="text-orange-400">
                Has alcanzado el límite de {totalAllowed} usuarios. Contacta al administrador del sistema para aumentar tu límite.
              </p>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-100">
              {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h3>
            <button
              onClick={resetForm}
              className="p-2 hover:bg-gray-700 rounded-lg transition"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center gap-2">
                    <Mail size={16} />
                    Email *
                  </div>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={!!editingId}
                  placeholder="usuario@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center gap-2">
                    <User size={16} />
                    Nombre Completo *
                  </div>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  placeholder="Juan Pérez"
                />
              </div>
            </div>

            {!editingId && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center gap-2">
                    <Lock size={16} />
                    Contraseña *
                  </div>
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Roles
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center gap-2 p-2 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition">
                    <input
                      type="checkbox"
                      checked={formData.role_ids.includes(role.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, role_ids: [...formData.role_ids, role.id] });
                        } else {
                          setFormData({ ...formData, role_ids: formData.role_ids.filter(id => id !== role.id) });
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-300">{role.name}</span>
                  </label>
                ))}
              </div>
              {roles.length === 0 && (
                <p className="text-sm text-gray-500 italic">No hay roles disponibles. Crea roles primero.</p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-300">Usuario Activo</span>
              </label>
            </div>

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
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <User className="mx-auto text-gray-600 mb-4" size={48} />
            <p className="text-gray-400 text-lg">
              {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
            </p>
            {!searchTerm && (
              <>
                <p className="text-gray-500 text-sm mt-2">
                  Crea tu primer usuario para comenzar
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  disabled={isAtLimit}
                  className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                    isAtLimit
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Plus size={20} />
                  Nuevo Usuario
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Vista de tarjetas para móvil */}
            <div className="block md:hidden">
              <div className="divide-y divide-gray-700">
                {filteredUsers.map((appUser) => (
                  <div key={appUser.id} className="p-4 hover:bg-gray-750">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-gray-100">{appUser.name}</p>
                        <p className="text-xs text-gray-400">{appUser.email}</p>
                      </div>
                      <button
                        onClick={() => handleToggleActive(appUser.id, appUser.is_active)}
                        className="flex items-center gap-1"
                      >
                        {appUser.is_active ? (
                          <>
                            <CheckCircle size={16} className="text-green-500" />
                            <span className="text-xs text-green-500">Activo</span>
                          </>
                        ) : (
                          <>
                            <Circle size={16} className="text-gray-500" />
                            <span className="text-xs text-gray-500">Inactivo</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="space-y-2 mb-3">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Roles</p>
                        <div className="flex flex-wrap gap-1">
                          {appUser.roles && appUser.roles.length > 0 ? (
                            appUser.roles.map((role) => (
                              <span
                                key={role.id}
                                className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs"
                              >
                                {role.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-500 italic">Sin roles</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Rutas</p>
                        {appUser.routes && appUser.routes.length > 0 ? (
                          <span className="text-xs text-gray-400">
                            {appUser.routes.length} ruta{appUser.routes.length !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 italic">Sin rutas</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(appUser)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Edit2 size={16} />
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(appUser.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
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
                      Usuario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Roles
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Rutas Asignadas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredUsers.map((appUser) => (
                    <tr key={appUser.id} className="hover:bg-gray-750 transition">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-100">{appUser.name}</p>
                          <p className="text-xs text-gray-400">{appUser.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {appUser.roles && appUser.roles.length > 0 ? (
                            appUser.roles.map((role) => (
                              <span
                                key={role.id}
                                className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs"
                              >
                                {role.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-500 italic">Sin roles</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {appUser.routes && appUser.routes.length > 0 ? (
                            <>
                              <span className="text-xs text-gray-400">
                                {appUser.routes.length} ruta{appUser.routes.length !== 1 ? 's' : ''}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-500 italic">Sin rutas</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(appUser.id, appUser.is_active)}
                          className="flex items-center gap-2"
                        >
                          {appUser.is_active ? (
                            <>
                              <CheckCircle size={16} className="text-green-500" />
                              <span className="text-xs text-green-500">Activo</span>
                            </>
                          ) : (
                            <>
                              <Circle size={16} className="text-gray-500" />
                              <span className="text-xs text-gray-500">Inactivo</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(appUser)}
                            className="p-2 hover:bg-gray-700 rounded-lg transition"
                            title="Editar"
                          >
                            <Edit2 size={16} className="text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleDelete(appUser.id)}
                            className="p-2 hover:bg-gray-700 rounded-lg transition"
                            title="Eliminar"
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
    </div>
  );
}
