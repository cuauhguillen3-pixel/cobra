import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import RouteClients from './RouteClients';
import {
  MapPin,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Calendar,
  Clock,
  User,
  Truck,
  AlertCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  UserPlus,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { exportToExcel, exportToPDF, formatDate } from '../../lib/exportUtils';

interface Route {
  id: string;
  nombre_ruta: string;
  descripcion: string;
  zona_region: string;
  frecuencia: string;
  dias_programados: string[];
  hora_inicio_planeada: string | null;
  hora_fin_planeada: string | null;
  cobrador_asignado: string | null;
  medio_transporte: string | null;
  prioridad_ruta: string;
  estado_ruta: string;
  notas: string | null;
  created_at: string;
  cobrador?: {
    id: string;
    name: string;
  };
}

interface Collector {
  id: string;
  name: string;
  role: string;
}

interface RoutesProps {
  isFirstRoute?: boolean;
  onRouteCreated?: () => void;
}

export default function Routes({ isFirstRoute = false, onRouteCreated }: RoutesProps = {}) {
  const { userData } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterZona, setFilterZona] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterPrioridad, setFilterPrioridad] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    nombre_ruta: '',
    descripcion: '',
    zona_region: '',
    frecuencia: 'Libre',
    dias_programados: [] as string[],
    hora_inicio_planeada: '',
    hora_fin_planeada: '',
    cobrador_asignado: '',
    medio_transporte: '',
    prioridad_ruta: 'Media',
    estado_ruta: 'Activa',
    notas: ''
  });

  const frecuenciaOptions = ['Libre', 'Diario', 'Semanal', 'Quincenal', 'Mensual'];
  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const prioridadOptions = ['Alta', 'Media', 'Baja'];
  const estadoOptions = ['Activa', 'Inactiva', 'En prueba'];
  const transporteOptions = ['Pie', 'Moto', 'Auto', 'Camioneta', 'Transporte público'];

  useEffect(() => {
    fetchRoutes();
    fetchCollectors();
  }, []);

  useEffect(() => {
    if (isFirstRoute) {
      setShowModal(true);
    }
  }, [isFirstRoute]);

  const fetchRoutes = async () => {
    try {
      let query = supabase
        .from('routes')
        .select(`
          *,
          cobrador:users!routes_cobrador_asignado_fkey(id, name)
        `)
        .eq('organization_id', userData?.organization_id)
        .order('created_at', { ascending: false });

      if (userData?.role !== 'superadmin' && !userData?.permissions?.includes('*:*')) {
        // Filtrar por rutas asignadas si no es admin
        if (userData?.assigned_routes && userData.assigned_routes.length > 0) {
          query = query.in('id', userData.assigned_routes);
        } else {
          // Si no tiene rutas asignadas, no mostrar nada
          setRoutes([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setRoutes(data || []);
    } catch (error) {
      console.error('Error fetching routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCollectors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role')
        .eq('organization_id', userData?.organization_id)
        .in('role', ['collector', 'admin', 'superadmin'])
        .order('name');

      if (error) throw error;
      setCollectors(data || []);
    } catch (error) {
      console.error('Error fetching collectors:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const routeData = {
        ...formData,
        organization_id: userData?.organization_id,
        created_by: userData?.id,
        cobrador_asignado: formData.cobrador_asignado || null,
        hora_inicio_planeada: formData.hora_inicio_planeada || null,
        hora_fin_planeada: formData.hora_fin_planeada || null,
        medio_transporte: formData.medio_transporte || null,
        notas: formData.notas || null
      };

      if (editingRoute) {
        const { error } = await supabase
          .from('routes')
          .update(routeData)
          .eq('id', editingRoute.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('routes')
          .insert([routeData]);

        if (error) throw error;

        if (onRouteCreated) {
          onRouteCreated();
        }
      }

      setShowModal(false);
      resetForm();
      fetchRoutes();
    } catch (error) {
      console.error('Error saving route:', error);
      alert('Error al guardar la ruta');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta ruta?')) return;

    try {
      const { error } = await supabase
        .from('routes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchRoutes();
    } catch (error) {
      console.error('Error deleting route:', error);
      alert('Error al eliminar la ruta');
    }
  };

  const handleEdit = (route: Route) => {
    setEditingRoute(route);
    setFormData({
      nombre_ruta: route.nombre_ruta,
      descripcion: route.descripcion,
      zona_region: route.zona_region,
      frecuencia: route.frecuencia,
      dias_programados: route.dias_programados || [],
      hora_inicio_planeada: route.hora_inicio_planeada || '',
      hora_fin_planeada: route.hora_fin_planeada || '',
      cobrador_asignado: route.cobrador_asignado || '',
      medio_transporte: route.medio_transporte || '',
      prioridad_ruta: route.prioridad_ruta,
      estado_ruta: route.estado_ruta,
      notas: route.notas || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      nombre_ruta: '',
      descripcion: '',
      zona_region: '',
      frecuencia: 'Libre',
      dias_programados: [],
      hora_inicio_planeada: '',
      hora_fin_planeada: '',
      cobrador_asignado: '',
      medio_transporte: '',
      prioridad_ruta: 'Media',
      estado_ruta: 'Activa',
      notas: ''
    });
    setEditingRoute(null);
  };

  const toggleDia = (dia: string) => {
    setFormData(prev => ({
      ...prev,
      dias_programados: prev.dias_programados.includes(dia)
        ? prev.dias_programados.filter(d => d !== dia)
        : [...prev.dias_programados, dia]
    }));
  };

  const filteredRoutes = routes.filter(route => {
    const matchesSearch = route.nombre_ruta.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         route.zona_region.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         route.descripcion.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZona = !filterZona || route.zona_region === filterZona;
    const matchesEstado = !filterEstado || route.estado_ruta === filterEstado;
    const matchesPrioridad = !filterPrioridad || route.prioridad_ruta === filterPrioridad;

    return matchesSearch && matchesZona && matchesEstado && matchesPrioridad;
  });

  const handleExportExcel = () => {
    const exportData = filteredRoutes.map(route => ({
      nombre: route.nombre_ruta,
      descripcion: route.descripcion,
      zona: route.zona_region,
      frecuencia: route.frecuencia,
      dias: route.dias_programados?.join(', ') || '',
      hora_inicio: route.hora_inicio_planeada || '',
      hora_fin: route.hora_fin_planeada || '',
      cobrador: route.cobrador?.name || 'Sin asignar',
      transporte: route.medio_transporte || '',
      prioridad: route.prioridad_ruta,
      estado: route.estado_ruta,
      notas: route.notas || '',
    }));

    exportToExcel(
      exportData,
      [
        { header: 'Nombre', key: 'nombre', width: 20 },
        { header: 'Descripción', key: 'descripcion', width: 30 },
        { header: 'Zona', key: 'zona', width: 15 },
        { header: 'Frecuencia', key: 'frecuencia', width: 12 },
        { header: 'Días', key: 'dias', width: 20 },
        { header: 'Hora Inicio', key: 'hora_inicio', width: 12 },
        { header: 'Hora Fin', key: 'hora_fin', width: 12 },
        { header: 'Cobrador', key: 'cobrador', width: 20 },
        { header: 'Transporte', key: 'transporte', width: 15 },
        { header: 'Prioridad', key: 'prioridad', width: 12 },
        { header: 'Estado', key: 'estado', width: 12 },
        { header: 'Notas', key: 'notas', width: 30 },
      ],
      {
        filename: `Rutas_${new Date().toISOString().split('T')[0]}`,
        sheetName: 'Rutas',
      }
    );
  };

  const handleExportPDF = () => {
    const exportData = filteredRoutes.map(route => ({
      nombre: route.nombre_ruta,
      zona: route.zona_region,
      cobrador: route.cobrador?.name || 'Sin asignar',
      frecuencia: route.frecuencia,
      prioridad: route.prioridad_ruta,
      estado: route.estado_ruta,
    }));

    exportToPDF(
      exportData,
      [
        { header: 'Nombre', key: 'nombre' },
        { header: 'Zona', key: 'zona' },
        { header: 'Cobrador', key: 'cobrador' },
        { header: 'Frecuencia', key: 'frecuencia' },
        { header: 'Prioridad', key: 'prioridad' },
        { header: 'Estado', key: 'estado' },
      ],
      {
        filename: `Rutas_${new Date().toISOString().split('T')[0]}`,
        title: 'Listado de Rutas',
      }
    );
  };

  const totalPages = Math.ceil(filteredRoutes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRoutes = filteredRoutes.slice(startIndex, startIndex + itemsPerPage);

  const uniqueZonas = Array.from(new Set(routes.map(r => r.zona_region))).sort();

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'Alta': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'Media': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'Baja': return 'text-green-400 bg-green-400/10 border-green-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'Activa': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'Inactiva': return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
      case 'En prueba': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
            <MapPin className="text-blue-400" size={24} />
            Rutas
          </h1>
          <p className="text-gray-400 mt-1 text-sm">Gestiona las rutas de cobranza</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition shadow-lg"
            title="Exportar a Excel"
          >
            <FileSpreadsheet size={20} />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition shadow-lg"
            title="Exportar a PDF"
          >
            <Download size={20} />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-lg"
          >
            <Plus size={20} />
            Nueva Ruta
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar rutas..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 hover:border-gray-600 text-white rounded-lg transition"
            >
              <Filter size={20} />
              <span className="hidden sm:inline">Filtros</span>
              {(filterZona || filterEstado || filterPrioridad) && (
                <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {[filterZona, filterEstado, filterPrioridad].filter(Boolean).length}
                </span>
              )}
            </button>
            <div className="flex bg-gray-900 border border-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 rounded ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                title="Vista de tarjetas"
              >
                <LayoutGrid size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                title="Vista de lista"
              >
                <List size={20} />
              </button>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-900 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Zona</label>
              <select
                value={filterZona}
                onChange={(e) => {
                  setFilterZona(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Todas</option>
                {uniqueZonas.map(zona => (
                  <option key={zona} value={zona}>{zona}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Estado</label>
              <select
                value={filterEstado}
                onChange={(e) => {
                  setFilterEstado(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Todos</option>
                {estadoOptions.map(estado => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Prioridad</label>
              <select
                value={filterPrioridad}
                onChange={(e) => {
                  setFilterPrioridad(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Todas</option>
                {prioridadOptions.map(prioridad => (
                  <option key={prioridad} value={prioridad}>{prioridad}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedRoutes.length === 0 ? (
            <div className="col-span-full bg-gray-800 rounded-lg p-8 text-center text-gray-400">
              {searchTerm || filterZona || filterEstado || filterPrioridad
                ? 'No se encontraron rutas'
                : 'No hay rutas registradas'}
            </div>
          ) : (
            paginatedRoutes.map((route) => (
              <div key={route.id} className="bg-gray-800 rounded-lg p-5 hover:bg-gray-750 transition shadow-lg border border-gray-700">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-bold text-white flex-1">{route.nombre_ruta}</h3>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => {
                        setSelectedRoute(route);
                        setShowClientsModal(true);
                      }}
                      className="p-2 text-orange-400 hover:bg-orange-400/10 rounded-lg transition"
                      title="Clientes de esta ruta"
                    >
                      <UserPlus size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(route)}
                      className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(route.id)}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-gray-400 mb-4 line-clamp-2">{route.descripcion}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin size={16} className="text-gray-400" />
                    <span className="text-gray-300">{route.zona_region}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={16} className="text-gray-400" />
                    <span className="text-gray-300">{route.frecuencia}</span>
                  </div>

                  {route.dias_programados && route.dias_programados.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {route.dias_programados.map(dia => (
                        <span key={dia} className="text-xs px-2 py-1 bg-gray-900 text-gray-300 rounded">
                          {dia.slice(0, 3)}
                        </span>
                      ))}
                    </div>
                  )}

                  {(route.hora_inicio_planeada || route.hora_fin_planeada) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock size={16} className="text-gray-400" />
                      <span className="text-gray-300">
                        {route.hora_inicio_planeada || '--:--'} - {route.hora_fin_planeada || '--:--'}
                      </span>
                    </div>
                  )}

                  {route.cobrador && (
                    <div className="flex items-center gap-2 text-sm">
                      <User size={16} className="text-gray-400" />
                      <span className="text-gray-300">{route.cobrador.name}</span>
                    </div>
                  )}

                  {route.medio_transporte && (
                    <div className="flex items-center gap-2 text-sm">
                      <Truck size={16} className="text-gray-400" />
                      <span className="text-gray-300">{route.medio_transporte}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getPrioridadColor(route.prioridad_ruta)}`}>
                    {route.prioridad_ruta}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getEstadoColor(route.estado_ruta)}`}>
                    {route.estado_ruta}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="divide-y divide-gray-700">
            {paginatedRoutes.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                {searchTerm || filterZona || filterEstado || filterPrioridad
                  ? 'No se encontraron rutas'
                  : 'No hay rutas registradas'}
              </div>
            ) : (
              paginatedRoutes.map((route) => (
                <div key={route.id} className="p-4 hover:bg-gray-700/50 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-lg font-bold text-white">{route.nombre_ruta}</h3>
                        <div className="flex gap-2 shrink-0">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPrioridadColor(route.prioridad_ruta)}`}>
                            {route.prioridad_ruta}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getEstadoColor(route.estado_ruta)}`}>
                            {route.estado_ruta}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-400 mb-3">{route.descripcion}</p>

                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                        <span className="flex items-center gap-1 text-gray-300">
                          <MapPin size={14} className="text-gray-400" />
                          {route.zona_region}
                        </span>
                        <span className="flex items-center gap-1 text-gray-300">
                          <Calendar size={14} className="text-gray-400" />
                          {route.frecuencia}
                        </span>
                        {route.cobrador && (
                          <span className="flex items-center gap-1 text-gray-300">
                            <User size={14} className="text-gray-400" />
                            {route.cobrador.name}
                          </span>
                        )}
                        {route.medio_transporte && (
                          <span className="flex items-center gap-1 text-gray-300">
                            <Truck size={14} className="text-gray-400" />
                            {route.medio_transporte}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 sm:flex-col">
                      <button
                        onClick={() => {
                          setSelectedRoute(route);
                          setShowClientsModal(true);
                        }}
                        className="flex-1 sm:flex-none p-2 text-orange-400 hover:bg-orange-400/10 rounded-lg transition"
                        title="Clientes de esta ruta"
                      >
                        <UserPlus size={18} />
                      </button>
                      <button
                        onClick={() => handleEdit(route)}
                        className="flex-1 sm:flex-none p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(route.id)}
                        className="flex-1 sm:flex-none p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-400">
            {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredRoutes.length)} de {filteredRoutes.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 rounded-lg transition ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <span className="sm:hidden px-3 py-1 text-white">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-gray-800 rounded-none sm:rounded-lg w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-700 flex-shrink-0">
              <h2 className="text-xl font-bold text-white">
                {editingRoute ? 'Editar Ruta' : 'Nueva Ruta'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-white transition p-2 hover:bg-gray-700 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
              <form onSubmit={handleSubmit} className="p-4 sm:p-6">
              {isFirstRoute && !editingRoute && (
                <div className="mb-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-orange-500 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="text-orange-100 font-medium text-sm">
                        Bienvenido al sistema
                      </p>
                      <p className="text-orange-200/80 text-sm mt-1">
                        Crea tu primera ruta de cobro para comenzar a organizar tus actividades. Las rutas te ayudan a planificar y optimizar tu trabajo diario.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre de la Ruta *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre_ruta}
                    onChange={(e) => setFormData({ ...formData, nombre_ruta: e.target.value })}
                    placeholder="Ej: Ruta Norte Lunes"
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Descripción *
                  </label>
                  <textarea
                    required
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    placeholder="Breve explicación de qué cubre esta ruta"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Zona / Región *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.zona_region}
                      onChange={(e) => setFormData({ ...formData, zona_region: e.target.value })}
                      placeholder="Ej: Norte, Centro"
                      className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Frecuencia
                    </label>
                    <select
                      value={formData.frecuencia}
                      onChange={(e) => setFormData({ ...formData, frecuencia: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      {frecuenciaOptions.map(freq => (
                        <option key={freq} value={freq}>{freq}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Días Programados *
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {diasSemana.map(dia => (
                      <button
                        key={dia}
                        type="button"
                        onClick={() => toggleDia(dia)}
                        className={`px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                          formData.dias_programados.includes(dia)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-900 text-gray-400 hover:bg-gray-700 border border-gray-700'
                        }`}
                      >
                        {dia.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                  {formData.dias_programados.length === 0 && (
                    <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                      <AlertCircle size={16} />
                      Selecciona al menos un día
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <User size={16} className="inline mr-1" />
                      Cobrador Asignado
                    </label>
                    <select
                      value={formData.cobrador_asignado}
                      onChange={(e) => setFormData({ ...formData, cobrador_asignado: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Sin asignar</option>
                      {collectors.map(collector => (
                        <option key={collector.id} value={collector.id}>
                          {collector.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Truck size={16} className="inline mr-1" />
                      Transporte
                    </label>
                    <select
                      value={formData.medio_transporte}
                      onChange={(e) => setFormData({ ...formData, medio_transporte: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Seleccionar...</option>
                      {transporteOptions.map(transporte => (
                        <option key={transporte} value={transporte}>{transporte}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Prioridad *
                    </label>
                    <select
                      required
                      value={formData.prioridad_ruta}
                      onChange={(e) => setFormData({ ...formData, prioridad_ruta: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      {prioridadOptions.map(prioridad => (
                        <option key={prioridad} value={prioridad}>{prioridad}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Estado *
                    </label>
                    <select
                      required
                      value={formData.estado_ruta}
                      onChange={(e) => setFormData({ ...formData, estado_ruta: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      {estadoOptions.map(estado => (
                        <option key={estado} value={estado}>{estado}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Notas / Observaciones
                  </label>
                  <textarea
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    placeholder="Observaciones generales"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-6 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formData.dias_programados.length === 0}
                  className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingRoute ? 'Actualizar' : 'Guardar'} Ruta
                </button>
              </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showClientsModal && selectedRoute && (
        <RouteClients
          route={selectedRoute}
          onClose={() => {
            setShowClientsModal(false);
            setSelectedRoute(null);
          }}
        />
      )}
    </div>
  );
}
