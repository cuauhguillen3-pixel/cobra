import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  X,
  UserPlus,
  Search,
  Mail,
  Phone,
  MessageCircle,
  MapPin,
  Building2,
  FileText,
  Trash2,
  User
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  contact_principal: string | null;
  tipo_cliente: string | null;
  document_number: string | null;
  notes: string | null;
  route_id: string | null;
}

interface Route {
  id: string;
  nombre_ruta: string;
  zona_region: string;
  descripcion: string;
}

interface RouteClientsProps {
  route: Route;
  onClose: () => void;
}

export default function RouteClients({ route, onClose }: RouteClientsProps) {
  const { userData, user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    contact_principal: '',
    tipo_cliente: '',
    document_number: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchRouteClients();
    fetchAvailableClients();
  }, [route.id]);

  const fetchRouteClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('route_id', route.id)
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching route clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('organization_id', userData?.organization_id)
        .is('route_id', null)
        .order('name');

      if (error) throw error;
      setAvailableClients(data || []);
    } catch (error) {
      console.error('Error fetching available clients:', error);
    }
  };

  const handleAddClients = async () => {
    if (selectedClients.length === 0) return;

    try {
      const updates = selectedClients.map(clientId =>
        supabase
          .from('clients')
          .update({
            route_id: route.id,
            updated_by: user?.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', clientId)
      );

      await Promise.all(updates);

      setShowAddModal(false);
      setSelectedClients([]);
      fetchRouteClients();
      fetchAvailableClients();
    } catch (error) {
      console.error('Error adding clients to route:', error);
      alert('Error al agregar clientes a la ruta');
    }
  };

  const handleRemoveClient = async (clientId: string) => {
    if (!confirm('¿Quitar este cliente de la ruta?')) return;

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          route_id: null,
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId);

      if (error) throw error;
      fetchRouteClients();
      fetchAvailableClients();
    } catch (error) {
      console.error('Error removing client from route:', error);
      alert('Error al quitar cliente de la ruta');
    }
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const validateNewClientForm = () => {
    const errors: Record<string, string> = {};

    if (!newClientData.name.trim()) {
      errors.name = 'El nombre es obligatorio';
    }
    if (!newClientData.email.trim()) {
      errors.email = 'El email es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClientData.email)) {
      errors.email = 'Email inválido';
    }
    if (!newClientData.phone.trim()) {
      errors.phone = 'El teléfono es obligatorio';
    }
    if (!newClientData.whatsapp.trim()) {
      errors.whatsapp = 'El WhatsApp es obligatorio';
    }
    if (!newClientData.address.trim()) {
      errors.address = 'La dirección es obligatoria';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateNewClient = async () => {
    if (!validateNewClientForm()) return;

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          ...newClientData,
          organization_id: userData?.organization_id,
          route_id: route.id,
          tipo_cliente: newClientData.tipo_cliente || null,
          created_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      setShowNewClientForm(false);
      setNewClientData({
        name: '',
        email: '',
        phone: '',
        whatsapp: '',
        address: '',
        contact_principal: '',
        tipo_cliente: '',
        document_number: '',
        notes: '',
      });
      setFormErrors({});
      fetchRouteClients();
      fetchAvailableClients();
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Error al crear el cliente');
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm)
  );

  const filteredAvailableClients = availableClients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Clientes de la Ruta</h2>
            <p className="text-gray-400 text-sm mt-1">{route.nombre_ruta} - {route.zona_region}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition p-2 hover:bg-gray-700 rounded-lg"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4 flex-shrink-0">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar clientes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition"
            >
              <UserPlus size={20} />
              Agregar Clientes
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
          {filteredClients.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">
                {searchTerm ? 'No se encontraron clientes' : 'No hay clientes asignados a esta ruta'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="bg-gray-900 rounded-lg p-4 border border-gray-700 hover:border-orange-500 transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-2">
                      <div>
                        <h3 className="text-base font-semibold text-white">{client.name}</h3>
                        {client.contact_principal && (
                          <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                            <User size={12} />
                            {client.contact_principal}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Mail size={14} className="text-gray-500" />
                          {client.email}
                        </div>
                        <div className="flex items-center gap-2 text-gray-300">
                          <Phone size={14} className="text-gray-500" />
                          {client.phone}
                        </div>
                        <div className="flex items-center gap-2 text-gray-300">
                          <MessageCircle size={14} className="text-green-500" />
                          {client.whatsapp}
                        </div>
                        <div className="flex items-center gap-2 text-gray-300">
                          <MapPin size={14} className="text-gray-500" />
                          {client.address}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {client.tipo_cliente && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500">
                            <Building2 size={10} className="inline mr-1" />
                            {client.tipo_cliente}
                          </span>
                        )}
                        {client.document_number && (
                          <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                            <FileText size={10} className="inline mr-1" />
                            {client.document_number}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveClient(client.id)}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition ml-2"
                      title="Quitar de la ruta"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
                <h3 className="text-xl font-bold text-white">Agregar Clientes a la Ruta</h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedClients([]);
                    setSearchTerm('');
                  }}
                  className="text-gray-400 hover:text-white transition p-2 hover:bg-gray-700 rounded-lg"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 flex-shrink-0 space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Buscar clientes disponibles..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <button
                    onClick={() => setShowNewClientForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition whitespace-nowrap"
                  >
                    <UserPlus size={20} />
                    Nuevo Cliente
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 px-6 pb-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
                {filteredAvailableClients.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400">
                      {searchTerm ? 'No se encontraron clientes' : 'No hay clientes disponibles sin ruta asignada'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAvailableClients.map((client) => (
                      <label
                        key={client.id}
                        className="flex items-center gap-3 p-4 bg-gray-900 rounded-lg border border-gray-700 hover:border-orange-500 transition cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedClients.includes(client.id)}
                          onChange={() => toggleClientSelection(client.id)}
                          className="w-4 h-4 rounded border-gray-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                        />
                        <div className="flex-1">
                          <h4 className="text-white font-medium">{client.name}</h4>
                          <div className="flex gap-4 mt-1 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Mail size={12} />
                              {client.email}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone size={12} />
                              {client.phone}
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-700 flex-shrink-0">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedClients([]);
                    setSearchTerm('');
                  }}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddClients}
                  disabled={selectedClients.length === 0}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Agregar {selectedClients.length > 0 && `(${selectedClients.length})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {showNewClientForm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-lg w-full max-w-2xl border border-gray-700 my-8">
              <div className="flex justify-between items-center p-6 border-b border-gray-700">
                <h3 className="text-xl font-semibold text-white">Nuevo Cliente</h3>
                <button
                  onClick={() => {
                    setShowNewClientForm(false);
                    setNewClientData({
                      name: '',
                      email: '',
                      phone: '',
                      whatsapp: '',
                      address: '',
                      contact_principal: '',
                      tipo_cliente: '',
                      document_number: '',
                      notes: '',
                    });
                    setFormErrors({});
                  }}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[calc(90vh-200px)] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nombre o Razón Social <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newClientData.name}
                      onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                      className={`w-full px-4 py-2 bg-gray-900 border ${
                        formErrors.name ? 'border-red-500' : 'border-gray-700'
                      } rounded-lg text-white focus:outline-none focus:border-orange-500`}
                    />
                    {formErrors.name && <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={newClientData.email}
                      onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                      className={`w-full px-4 py-2 bg-gray-900 border ${
                        formErrors.email ? 'border-red-500' : 'border-gray-700'
                      } rounded-lg text-white focus:outline-none focus:border-orange-500`}
                    />
                    {formErrors.email && <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Teléfono <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={newClientData.phone}
                      onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                      className={`w-full px-4 py-2 bg-gray-900 border ${
                        formErrors.phone ? 'border-red-500' : 'border-gray-700'
                      } rounded-lg text-white focus:outline-none focus:border-orange-500`}
                    />
                    {formErrors.phone && <p className="text-red-500 text-sm mt-1">{formErrors.phone}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      WhatsApp <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={newClientData.whatsapp}
                      onChange={(e) => setNewClientData({ ...newClientData, whatsapp: e.target.value })}
                      className={`w-full px-4 py-2 bg-gray-900 border ${
                        formErrors.whatsapp ? 'border-red-500' : 'border-gray-700'
                      } rounded-lg text-white focus:outline-none focus:border-orange-500`}
                    />
                    {formErrors.whatsapp && <p className="text-red-500 text-sm mt-1">{formErrors.whatsapp}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Contacto Principal
                    </label>
                    <input
                      type="text"
                      value={newClientData.contact_principal}
                      onChange={(e) => setNewClientData({ ...newClientData, contact_principal: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Dirección <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newClientData.address}
                      onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
                      className={`w-full px-4 py-2 bg-gray-900 border ${
                        formErrors.address ? 'border-red-500' : 'border-gray-700'
                      } rounded-lg text-white focus:outline-none focus:border-orange-500`}
                    />
                    {formErrors.address && <p className="text-red-500 text-sm mt-1">{formErrors.address}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tipo de Cliente
                    </label>
                    <select
                      value={newClientData.tipo_cliente}
                      onChange={(e) => setNewClientData({ ...newClientData, tipo_cliente: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
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
                      Número de Documento
                    </label>
                    <input
                      type="text"
                      value={newClientData.document_number}
                      onChange={(e) => setNewClientData({ ...newClientData, document_number: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                      placeholder="RFC, CURP, etc."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Notas
                    </label>
                    <textarea
                      value={newClientData.notes}
                      onChange={(e) => setNewClientData({ ...newClientData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-sm text-blue-300">
                    Este cliente se asignará automáticamente a la ruta <span className="font-semibold">{route.nombre_ruta}</span>
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
                <button
                  onClick={() => {
                    setShowNewClientForm(false);
                    setNewClientData({
                      name: '',
                      email: '',
                      phone: '',
                      whatsapp: '',
                      address: '',
                      contact_principal: '',
                      tipo_cliente: '',
                      document_number: '',
                      notes: '',
                    });
                    setFormErrors({});
                  }}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateNewClient}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                >
                  Crear Cliente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
