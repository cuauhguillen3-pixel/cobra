import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit2, Trash2, Save, X, CheckCircle, Circle, Star, RefreshCw, AlertCircle, DollarSign, Percent } from 'lucide-react';

interface LatePaymentFee {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  fee_type: 'percentage' | 'fixed_amount';
  fee_value: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  is_active: boolean;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  description: string;
  fee_type: 'percentage' | 'fixed_amount';
  fee_value: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  is_active: boolean;
  is_default: boolean;
}

export default function LatePaymentFees() {
  const { user } = useAuth();
  const [fees, setFees] = useState<LatePaymentFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    fee_type: 'percentage',
    fee_value: '',
    frequency: 'daily',
    is_active: true,
    is_default: false
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
        .from('late_payment_fees')
        .select('*')
        .eq('organization_id', userData.organization_id)
        .order('is_default', { ascending: false })
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

      if (formData.is_default) {
        await supabase
          .from('late_payment_fees')
          .update({ is_default: false })
          .eq('organization_id', userData.organization_id);
      }

      const feeData = {
        organization_id: userData.organization_id,
        name: formData.name,
        description: formData.description || null,
        fee_type: formData.fee_type,
        fee_value: parseFloat(formData.fee_value),
        frequency: formData.frequency,
        is_active: formData.is_active,
        is_default: formData.is_default,
        created_by: user.id,
        updated_by: user.id
      };

      if (editingId) {
        const { error } = await supabase
          .from('late_payment_fees')
          .update(feeData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('late_payment_fees')
          .insert([feeData]);

        if (error) throw error;
      }

      resetForm();
      loadFees();
    } catch (error) {
      console.error('Error saving fee:', error);
      alert('Error al guardar la cuota de morosidad');
    }
  };

  const handleEdit = (fee: LatePaymentFee) => {
    setEditingId(fee.id);
    setFormData({
      name: fee.name,
      description: fee.description || '',
      fee_type: fee.fee_type,
      fee_value: fee.fee_value.toString(),
      frequency: fee.frequency,
      is_active: fee.is_active,
      is_default: fee.is_default
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta cuota de morosidad?')) return;

    try {
      const { error } = await supabase
        .from('late_payment_fees')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadFees();
    } catch (error) {
      console.error('Error deleting fee:', error);
      alert('Error al eliminar la cuota de morosidad');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('late_payment_fees')
        .update({ is_active: !currentStatus, updated_by: user?.id })
        .eq('id', id);

      if (error) throw error;
      loadFees();
    } catch (error) {
      console.error('Error toggling active status:', error);
      alert('Error al cambiar el estado');
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!userData?.organization_id) return;

      await supabase
        .from('late_payment_fees')
        .update({ is_default: false })
        .eq('organization_id', userData.organization_id);

      const { error } = await supabase
        .from('late_payment_fees')
        .update({ is_default: true, updated_by: user.id })
        .eq('id', id);

      if (error) throw error;
      loadFees();
    } catch (error) {
      console.error('Error setting default:', error);
      alert('Error al establecer como predeterminada');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      fee_type: 'percentage',
      fee_value: '',
      frequency: 'daily',
      is_active: true,
      is_default: false
    });
    setEditingId(null);
    setShowForm(false);
  };

  const getFeeTypeLabel = (type: string) => {
    return type === 'percentage' ? 'Porcentaje' : 'Cantidad Fija';
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'daily':
        return 'Diario';
      case 'weekly':
        return 'Semanal';
      case 'biweekly':
        return 'Quincenal';
      case 'monthly':
        return 'Mensual';
      default:
        return frequency;
    }
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
              {editingId ? 'Editar Cuota' : 'Nueva Cuota de Morosidad'}
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
                placeholder="Ej: Cargo por Pago Atrasado Diario"
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
                placeholder="Descripción opcional de la cuota"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tipo de Cuota *
                </label>
                <select
                  value={formData.fee_type}
                  onChange={(e) => setFormData({ ...formData, fee_type: e.target.value as 'percentage' | 'fixed_amount' })}
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
                    value={formData.fee_value}
                    onChange={(e) => setFormData({ ...formData, fee_value: e.target.value })}
                    className="w-full px-4 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder={formData.fee_type === 'percentage' ? '5.0' : '100.00'}
                  />
                  {formData.fee_type === 'percentage' ? (
                    <Percent size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  ) : (
                    <DollarSign size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Frecuencia de Aplicación *
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
              </select>
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

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-300">Predeterminada</span>
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
            <p className="text-gray-400 text-lg">No hay cuotas de morosidad configuradas</p>
            <p className="text-gray-500 text-sm mt-2">
              Crea tu primera cuota para aplicar cargos a pagos atrasados
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
                      <div className="flex items-center gap-2">
                        {fee.is_default && (
                          <Star size={16} className="text-yellow-500 fill-yellow-500" />
                        )}
                        <div>
                          <p className="font-semibold text-gray-100">{fee.name}</p>
                          {fee.description && (
                            <p className="text-xs text-gray-400 mt-1">{fee.description}</p>
                          )}
                        </div>
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
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-gray-400">Tipo</p>
                        <p className="text-sm text-gray-300">
                          {getFeeTypeLabel(fee.fee_type)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Valor</p>
                        <p className="text-lg font-semibold text-orange-400">
                          {fee.fee_type === 'percentage' ? `${fee.fee_value}%` : `$${fee.fee_value.toFixed(2)}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Frecuencia</p>
                        <p className="text-sm text-gray-300">
                          {getFrequencyLabel(fee.frequency)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!fee.is_default && (
                        <button
                          onClick={() => handleSetDefault(fee.id)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-xs"
                        >
                          <Star size={14} />
                          Predeterminada
                        </button>
                      )}
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
                      Frecuencia
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
                        <div className="flex items-center gap-2">
                          {fee.is_default && (
                            <Star size={16} className="text-yellow-500 fill-yellow-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-100">{fee.name}</p>
                            {fee.description && (
                              <p className="text-xs text-gray-400 mt-1">{fee.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-300">
                          {getFeeTypeLabel(fee.fee_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <span className="text-lg font-semibold text-orange-400">
                            {fee.fee_type === 'percentage' ? `${fee.fee_value}%` : `$${fee.fee_value.toFixed(2)}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-300">
                          {getFrequencyLabel(fee.frequency)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
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
                          {!fee.is_default && (
                            <button
                              onClick={() => handleSetDefault(fee.id)}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-yellow-500 transition"
                            >
                              <Star size={14} />
                              Hacer predeterminada
                            </button>
                          )}
                        </div>
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
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-orange-400 flex-shrink-0 mt-1" size={20} />
            <div className="text-sm text-orange-300">
              <p className="font-semibold mb-1">Acerca de las Cuotas de Morosidad</p>
              <ul className="text-orange-400 space-y-1">
                <li>• Se aplican automáticamente cuando un pago se atrasa según su fecha de vencimiento</li>
                <li>• La frecuencia determina cada cuánto tiempo se cobra el cargo (diario, semanal, quincenal o mensual)</li>
                <li>• El porcentaje se calcula sobre el saldo pendiente, la cantidad fija es un valor constante</li>
                <li>• Solo la cuota predeterminada se aplicará automáticamente a nuevos pagos</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
