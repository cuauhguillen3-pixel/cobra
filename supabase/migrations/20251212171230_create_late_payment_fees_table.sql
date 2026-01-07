/*
  # Crear tabla de Cuotas de Morosidad

  1. Nueva tabla
    - `late_payment_fees`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key a organizations)
      - `name` (text) - Nombre de la cuota de morosidad
      - `description` (text, nullable) - Descripción opcional
      - `fee_type` (text) - Tipo de cuota: 'percentage' o 'fixed_amount'
      - `fee_value` (numeric) - Valor de la cuota (porcentaje o cantidad fija)
      - `frequency` (text) - Frecuencia de aplicación: 'daily', 'weekly', 'biweekly', 'monthly'
      - `is_active` (boolean) - Si está activa o no
      - `is_default` (boolean) - Si es la cuota predeterminada
      - `created_by` (uuid, foreign key a auth.users)
      - `created_at` (timestamptz) - Fecha de creación
      - `updated_at` (timestamptz) - Fecha de última actualización
      - `updated_by` (uuid, nullable, foreign key a auth.users)

  2. Seguridad
    - RLS está deshabilitado (se maneja a nivel de aplicación)

  3. Notas importantes
    - Solo puede haber una cuota predeterminada por organización
    - La frecuencia determina cada cuánto tiempo se aplica el cargo
    - El tipo determina si es porcentaje o cantidad fija
    - Esta tabla se usará para aplicar cargos automáticos cuando un pago se atrasa
*/

CREATE TABLE IF NOT EXISTS late_payment_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  fee_type text NOT NULL CHECK (fee_type IN ('percentage', 'fixed_amount')),
  fee_value numeric NOT NULL CHECK (fee_value >= 0),
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_late_payment_fees_organization ON late_payment_fees(organization_id);
CREATE INDEX IF NOT EXISTS idx_late_payment_fees_is_active ON late_payment_fees(is_active);
CREATE INDEX IF NOT EXISTS idx_late_payment_fees_is_default ON late_payment_fees(is_default);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_late_payment_fees_updated_at
  BEFORE UPDATE ON late_payment_fees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();