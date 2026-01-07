import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit2, Trash2, Save, X, CheckCircle, Circle, RefreshCw, AlertCircle, DollarSign, Percent } from 'lucide-react';

interface RenewalFee {
  id: string;
  organization_id: string;
  name: string;
  calculation_type: 'percentage' | 'fixed_amount';
  value: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  calculation_type: 'percentage' | 'fixed_amount';
  value: string;
  is_active: boolean;
}

export default function RenewalFees() {
  const { user } = useAuth();
  const [fees, setFees] = useState<RenewalFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    calculation_type: 'percentage',
    value: '',
    is_active: true
  });

  useEffect(() => {
    if (user) {
      loadFees();
    }
  }, [user]);

  const loadFees = async () => {
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

      const { data, error } = await supabase
        .from('renewal_fees')
        .select('*')
        .eq('organization_id', userData.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFees(data || []);
    } catch (error) {
      console.error('Error loading fees:', error);
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

      const feeData = {
        organization_id: userData.organization_id,
        name: formData.name,
        calculation_type: formData.calculation_type,
        value: parseFloat(formData.value),
        is_active: formData.is_active,
        created_by: user.id,
        updated_by: user.id
      };

      if (editingId) {
        const { error } = await supabase
          .from('renewal_fees')
          .update(feeData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('renewal_fees')
          .insert([feeData]);

        if (error) throw error;
      }

      resetForm();
      loadFees();
    } catch (error) {
      console.error('Error saving fee:', error);
      alert('Error al guardar la cuota de renovación');
    }
  };

  const handleEdit = (fee: RenewalFee) => {
    setEditingId(fee.id);
    setFormData({
      name: fee.name,
      calculation_type: fee.calculation_type,
      value: fee.value.toString(),
      is_active: fee.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta cuota de renovación?')) return;

    try {
      const { error } = await supabase
        .from('renewal_fees')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadFees();
    } catch (error) {
      console.error('Error deleting fee:', error);
      alert('Error al eliminar la cuota de renovación');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('renewal_fees')
        .update({ is_active: !currentStatus, updated_by: user?.id })
        .eq('id', id);

      if (error) throw error;
      loadFees();
    } catch (error) {
      console.error('Error toggling active status:', error);
      alert('Error al cambiar el estado');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      calculation_type: 'percentage',
      value: '',
      is_active: true
    });
    setEditingId(null);
    setShowForm(false);
  };

  const getCalculationTypeLabel = (type: string) => {
    return type === 'percentage' ? 'Porcentaje' : 'Cantidad Fija';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw className="animate-spin" size={20} />
          <span>Cargando cuotas...</span>
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
          Nueva Cuota
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-100">
              {editingId ? 'Editar Cuota' : 'Nueva Cuota de Renovación'}
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
                Nombre *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                placeholder="Ej: Cargo por Renovación de Venta"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tipo de Cálculo *
                </label>
                <select
                  value={formData.calculation_type}
                  onChange={(e) => setFormData({ ...formData, calculation_type: e.target.value as 'percentage' | 'fixed_amount' })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="fixed_amount">Cantidad Fija ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Valor *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full px-4 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder={formData.calculation_type === 'percentage' ? '10.0' : '50.00'}
                  />
                  {formData.calculation_type === 'percentage' ? (
                    <Percent size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  ) : (
                    <DollarSign size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-300">Activa</span>
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
        {fees.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="mx-auto text-gray-600 mb-4" size={48} />
            <p className="text-gray-400 text-lg">No hay cuotas de renovación configuradas</p>
            <p className="text-gray-500 text-sm mt-2">
              Crea tu primera cuota para aplicar cargos al renovar ventas
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              <Plus size={20} />
              Nueva Cuota
            </button>
          </div>
        ) : (
          <>
            {/* Vista de tarjetas para móvil */}
            <div className="block md:hidden">
              <div className="divide-y divide-gray-700">
                {fees.map((fee) => (
                  <div key={fee.id} className="p-4 hover:bg-gray-750">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-gray-100">{fee.name}</p>
                      </div>
                      <button
                        onClick={() => handleToggleActive(fee.id, fee.is_active)}
                        className="flex items-center gap-1"
                      >
                        {fee.is_active ? (
                          <>
                            <CheckCircle size={16} className="text-green-500" />
                            <span className="text-xs text-green-500">Activa</span>
                          </>
                        ) : (
                          <>
                            <Circle size={16} className="text-gray-500" />
                            <span className="text-xs text-gray-500">Inactiva</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-gray-400">Tipo</p>
                        <p className="text-sm text-gray-300">
                          {getCalculationTypeLabel(fee.calculation_type)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Valor</p>
                        <p className="text-lg font-semibold text-green-400">
                          {fee.calculation_type === 'percentage' ? `${fee.value}%` : `$${fee.value.toFixed(2)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(fee)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Edit2 size={16} />
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(fee.id)}
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
                      Nombre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Valor
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
                  {fees.map((fee) => (
                    <tr key={fee.id} className="hover:bg-gray-750 transition">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-100">{fee.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-300">
                          {getCalculationTypeLabel(fee.calculation_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <span className="text-lg font-semibold text-green-400">
                            {fee.calculation_type === 'percentage' ? `${fee.value}%` : `$${fee.value.toFixed(2)}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(fee.id, fee.is_active)}
                          className="flex items-center gap-2"
                        >
                          {fee.is_active ? (
                            <>
                              <CheckCircle size={16} className="text-green-500" />
                              <span className="text-xs text-green-500">Activa</span>
                            </>
                          ) : (
                            <>
                              <Circle size={16} className="text-gray-500" />
                              <span className="text-xs text-gray-500">Inactiva</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(fee)}
                            className="p-2 hover:bg-gray-700 rounded-lg transition"
                            title="Editar"
                          >
                            <Edit2 size={16} className="text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleDelete(fee.id)}
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

      {fees.length > 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-green-400 flex-shrink-0 mt-1" size={20} />
            <div className="text-sm text-green-300">
              <p className="font-semibold mb-1">Acerca de las Cuotas de Renovación</p>
              <ul className="text-green-400 space-y-1">
                <li>• Se aplican cuando se renueva una venta en el módulo de Pagos</li>
                <li>• El porcentaje se calcula sobre el saldo de la venta original</li>
                <li>• La cantidad fija es un valor constante que se suma al total</li>
                <li>• Solo las cuotas activas se aplicarán al renovar ventas</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
