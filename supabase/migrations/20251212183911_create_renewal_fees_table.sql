/*
  # Crear Tabla de Cuotas por Renovación

  1. Nueva Tabla: renewal_fees
    - Almacena las cuotas que se cobran cuando se renueva una venta
    - Similar a late_payment_fees pero para renovaciones
    
  2. Campos:
    - id (uuid, primary key)
    - organization_id (uuid, foreign key)
    - name (text) - Nombre descriptivo de la cuota
    - calculation_type (text) - 'percentage' o 'fixed_amount'
    - value (numeric) - Porcentaje o monto fijo
    - is_active (boolean) - Si la cuota está activa
    - created_at, updated_at (timestamptz)
    - created_by, updated_by (uuid)
    
  3. Seguridad
    - Se deshabilita RLS temporalmente para desarrollo (como las otras tablas)
*/

-- Crear tabla de cuotas por renovación
CREATE TABLE IF NOT EXISTS renewal_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  calculation_type text NOT NULL CHECK (calculation_type IN ('percentage', 'fixed_amount')),
  value numeric(10,2) NOT NULL CHECK (value >= 0),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_renewal_fees_organization ON renewal_fees(organization_id);
CREATE INDEX IF NOT EXISTS idx_renewal_fees_active ON renewal_fees(is_active) WHERE is_active = true;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_renewal_fees_updated_at
  BEFORE UPDATE ON renewal_fees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Deshabilitar RLS temporalmente (desarrollo)
ALTER TABLE renewal_fees DISABLE ROW LEVEL SECURITY;