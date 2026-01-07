import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { supabase } from '../../lib/supabase';
import { Client, Route } from '../../types/client';
import {
  UserPlus,
  Search,
  Edit2,
  Trash2,
  X,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  User,
  Building2,
  FileText,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { exportToExcel, exportToPDF, formatDate } from '../../lib/exportUtils';

export default function Clients() {
  const { user, userData } = useAuth();
  const [organizationId, setOrganizationId] = useState<string>('');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    contact_principal: '',
    tipo_cliente: '',
    route_id: '',
    document_number: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const allowedRouteIds = (userData?.role === 'superadmin' || userData?.role === 'admin' || userData?.permissions?.includes('*:*'))
    ? undefined
    : (userData?.assigned_routes || []);

  const { clients, loading, isOnline, syncing, createClient, updateClient, deleteClient, refresh } = useClients(organizationId, allowedRouteIds);

  useEffect(() => {
    if (userData?.organization_id) {
      setOrganizationId(userData.organization_id);
      fetchRoutes(userData.organization_id);
    }
  }, [userData]);

  const fetchRoutes = async (orgId: string) => {
    let query = supabase
      .from('routes')
      .select('id, nombre_ruta, descripcion, zona_region')
      .eq('organization_id', orgId)
      .order('nombre_ruta');

    if (userData?.role !== 'superadmin' && !userData?.permissions?.includes('*:*')) {
      if (userData?.assigned_routes && userData.assigned_routes.length > 0) {
        query = query.in('id', userData.assigned_routes);
      } else {
        setRoutes([]);
        return;
      }
    }

    const { data } = await query;
    if (data) setRoutes(data);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre o razón social es obligatorio';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'El teléfono es obligatorio';
    }

    if (!formData.whatsapp.trim()) {
      newErrors.whatsapp = 'El WhatsApp es obligatorio';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'La dirección es obligatoria';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const clientData = {
        ...formData,
        organization_id: organizationId,
        tipo_cliente: (formData.tipo_cliente || undefined) as 'mayoreo' | 'menudeo' | 'distribuidor' | 'otro' | undefined,
        route_id: formData.route_id || undefined,
      };

      if (editingClient) {
        await updateClient(editingClient.id, { ...clientData, updated_by: user?.id });
      } else {
        await createClient({ ...clientData, created_by: user?.id } as Omit<Client, 'id' | 'created_at' | 'updated_at'>);
      }

      resetForm();
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      whatsapp: '',
      address: '',
      contact_principal: '',
      tipo_cliente: '',
      route_id: '',
      document_number: '',
      notes: '',
    });
    setErrors({});
    setShowForm(false);
    setEditingClient(null);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone,
      whatsapp: client.whatsapp,
      address: client.address,
      contact_principal: client.contact_principal || '',
      tipo_cliente: client.tipo_cliente || '',
      route_id: client.route_id || '',
      document_number: client.document_number || '',
      notes: client.notes || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este cliente?')) {
      await deleteClient(id);
    }
  };

  const filteredClients = clients.filter(
    (client) =>
      (selectedRoute === '' || client.route_id === selectedRoute) &&
      (client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm) ||
      client.whatsapp.includes(searchTerm))
  );

  const handleExportExcel = () => {
    const exportData = filteredClients.map(client => ({
      nombre: client.name,
      email: client.email,
      telefono: client.phone,
      whatsapp: client.whatsapp,
      direccion: client.address,
      contacto_principal: client.contact_principal || '',
      tipo_cliente: client.tipo_cliente || '',
      documento: client.document_number || '',
      notas: client.notes || '',
    }));

    exportToExcel(
      exportData,
      [
        { header: 'Nombre', key: 'nombre', width: 25 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'WhatsApp', key: 'whatsapp', width: 15 },
        { header: 'Dirección', key: 'direccion', width: 30 },
        { header: 'Contacto Principal', key: 'contacto_principal', width: 20 },
        { header: 'Tipo Cliente', key: 'tipo_cliente', width: 15 },
        { header: 'Documento', key: 'documento', width: 20 },
        { header: 'Notas', key: 'notas', width: 30 },
      ],
      {
        filename: `Clientes_${new Date().toISOString().split('T')[0]}`,
        sheetName: 'Clientes',
      }
    );
  };

  const handleExportPDF = () => {
    const exportData = filteredClients.map(client => ({
      nombre: client.name,
      telefono: client.phone,
      email: client.email,
      direccion: client.address,
      tipo: client.tipo_cliente || 'N/A',
    }));

    exportToPDF(
      exportData,
      [
        { header: 'Nombre', key: 'nombre' },
        { header: 'Teléfono', key: 'telefono' },
        { header: 'Email', key: 'email' },
        { header: 'Dirección', key: 'direccion' },
        { header: 'Tipo', key: 'tipo' },
      ],
      {
        filename: `Clientes_${new Date().toISOString().split('T')[0]}`,
        title: 'Listado de Clientes',
      }
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Cargando clientes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Clientes / Deudores</h2>
          <p className="text-gray-400">Gestiona tu cartera de clientes</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            title="Exportar a Excel"
          >
            <FileSpreadsheet size={18} />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            title="Exportar a PDF"
          >
            <Download size={18} />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
            {isOnline ? (
              <>
                <Wifi className="text-green-500" size={18} />
                <span className="text-sm text-gray-300">En línea</span>
              </>
            ) : (
              <>
                <WifiOff className="text-orange-500" size={18} />
                <span className="text-sm text-gray-300">Modo offline</span>
              </>
            )}
          </div>
          {syncing && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 rounded-lg border border-blue-500">
              <RefreshCw className="text-blue-400 animate-spin" size={18} />
              <span className="text-sm text-blue-300">Sincronizando...</span>
            </div>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition"
          >
            <UserPlus size={20} />
            Nuevo Cliente
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre, email, teléfono o WhatsApp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-orange-500"
            />
          </div>
          
          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-orange-500 md:w-64"
          >
            <option value="">Todas las rutas</option>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.nombre_ruta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredClients.length === 0 ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
            <p className="text-gray-400">
              {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
            </p>
          </div>
        ) : (
          filteredClients.map((client) => (
            <div
              key={client.id}
              className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-orange-500 transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-100">{client.name}</h3>
                      {client.contact_principal && (
                        <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                          <User size={14} />
                          Contacto: {client.contact_principal}
                        </p>
                      )}
                    </div>
                    {client.pending_sync && (
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded border border-yellow-500">
                        Pendiente de sincronizar
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Mail size={16} className="text-gray-500" />
                      <span className="text-sm">{client.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Phone size={16} className="text-gray-500" />
                      <span className="text-sm">{client.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <MessageCircle size={16} className="text-green-500" />
                      <span className="text-sm">{client.whatsapp}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <MapPin size={16} className="text-gray-500" />
                      <span className="text-sm">{client.address}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {client.tipo_cliente && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500">
                        <Building2 size={12} className="inline mr-1" />
                        {client.tipo_cliente}
                      </span>
                    )}
                    {client.route_id && (
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded border border-purple-500">
                        <MapPin size={12} className="inline mr-1" />
                        {routes.find(r => r.id === client.route_id)?.nombre_ruta || 'Ruta asignada'}
                      </span>
                    )}
                    {client.document_number && (
                      <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                        <FileText size={12} className="inline mr-1" />
                        {client.document_number}
                      </span>
                    )}
                  </div>

                  {client.notes && (
                    <p className="text-sm text-gray-400 italic">{client.notes}</p>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(client)}
                    className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-800 w-full max-w-2xl border border-gray-700 rounded-xl shadow-xl flex flex-col max-h-[90vh] sm:max-h-[85vh]">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-700 flex-none">
              <h3 className="text-xl font-semibold text-gray-100">
                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-300 transition p-2 hover:bg-gray-700 rounded-full"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form id="client-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nombre o Razón Social <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={`w-full px-4 py-3 sm:py-2 bg-gray-900 border ${
                        errors.name ? 'border-red-500' : 'border-gray-700'
                      } rounded-lg text-gray-100 focus:outline-none focus:border-orange-500`}
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full px-4 py-3 sm:py-2 bg-gray-900 border ${
                        errors.email ? 'border-red-500' : 'border-gray-700'
                      } rounded-lg text-gray-100 focus:outline-none focus:border-orange-500`}
                    />
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Teléfono <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className={`w-full px-4 py-3 sm:py-2 bg-gray-900 border ${
                        errors.phone ? 'border-red-500' : 'border-gray-700'
                      } rounded-lg text-gray-100 focus:outline-none focus:border-orange-500`}
                    />
                    {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      WhatsApp <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      className={`w-full px-4 py-3 sm:py-2 bg-gray-900 border ${
                        errors.whatsapp ? 'border-red-500' : 'border-gray-700'
                      } rounded-lg text-gray-100 focus:outline-none focus:border-orange-500`}
                    />
                    {errors.whatsapp && <p className="text-red-500 text-sm mt-1">{errors.whatsapp}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Contacto Principal
                    </label>
                    <input
                      type="text"
                      value={formData.contact_principal}
                      onChange={(e) => setFormData({ ...formData, contact_principal: e.target.value })}
                      className="w-full px-4 py-3 sm:py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Dirección <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className={`w-full px-4 py-3 sm:py-2 bg-gray-900 border ${
                        errors.address ? 'border-red-500' : 'border-gray-700'
                      } rounded-lg text-gray-100 focus:outline-none focus:border-orange-500`}
                    />
                    {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tipo de Cliente
                    </label>
                    <select
                      value={formData.tipo_cliente}
                      onChange={(e) => setFormData({ ...formData, tipo_cliente: e.target.value })}
                      className="w-full px-4 py-3 sm:py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-orange-500"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="mayoreo">Mayoreo</option>
                      <option value="menudeo">Menudeo</option>
                      <option value="distribuidor">Distribuidor</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Ruta Asignada
                    </label>
                    <select
                      value={formData.route_id}
                      onChange={(e) => setFormData({ ...formData, route_id: e.target.value })}
                      className="w-full px-4 py-3 sm:py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-orange-500"
                    >
                      <option value="">Sin ruta asignada</option>
                      {routes.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.nombre_ruta} - {route.zona_region}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Número de Documento
                    </label>
                    <input
                      type="text"
                      value={formData.document_number}
                      onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                      className="w-full px-4 py-3 sm:py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-orange-500"
                      placeholder="RFC, CURP, etc."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Notas
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 sm:py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-gray-700 flex-none bg-gray-800 rounded-b-xl">
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full sm:w-auto px-6 py-3 sm:py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="client-form"
                  className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition font-medium shadow-lg shadow-orange-500/20"
                >
                  {editingClient ? 'Actualizar' : 'Crear'} Cliente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
