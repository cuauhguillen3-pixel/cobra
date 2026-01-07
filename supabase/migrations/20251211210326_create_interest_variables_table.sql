/*
  # Crear Tabla de Variables de Interés

  ## Resumen
  Esta migración crea una tabla para almacenar variables configurables del sistema,
  específicamente tasas de interés que se pueden aplicar a facturas vencidas.

  ## 1. Nuevas Tablas
  
  ### `interest_variables`
  Almacena las diferentes tasas de interés configurables
  - `id` (uuid, primary key): Identificador único
  - `organization_id` (uuid, foreign key): Organización a la que pertenece
  - `name` (text): Nombre descriptivo de la variable (ej: "Interés Moratorio Mensual")
  - `description` (text, nullable): Descripción detallada
  - `interest_rate` (numeric): Tasa de interés (porcentaje, ej: 5.5 para 5.5%)
  - `calculation_type` (text): Tipo de cálculo (daily, monthly, annual)
  - `is_active` (boolean): Si está activa para usar
  - `is_default` (boolean): Si es la tasa por defecto
  - `created_by` (uuid, foreign key): Usuario que creó la variable
  - `created_at` (timestamptz): Fecha de creación
  - `updated_at` (timestamptz): Fecha de última actualización

  ## 2. Seguridad
  - RLS deshabilitado (según configuración actual del sistema)

  ## 3. Índices
  - Índice en organization_id para consultas rápidas
  - Índice en is_active para filtrar variables activas
  - Índice en is_default para encontrar rápidamente la tasa por defecto

  ## Notas Importantes
  - Solo puede haber una tasa por defecto por organización
  - Las tasas se almacenan como porcentajes (5.5 = 5.5%)
  - El calculation_type determina cómo se aplica el interés
*/

-- Crear tabla de variables de interés
CREATE TABLE IF NOT EXISTS interest_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  interest_rate numeric NOT NULL CHECK (interest_rate >= 0 AND interest_rate <= 100),
  calculation_type text NOT NULL DEFAULT 'monthly' CHECK (calculation_type IN ('daily', 'monthly', 'annual')),
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_interest_variables_organization_id ON interest_variables(organization_id);
CREATE INDEX IF NOT EXISTS idx_interest_variables_is_active ON interest_variables(is_active);
CREATE INDEX IF NOT EXISTS idx_interest_variables_is_default ON interest_variables(is_default, organization_id);

-- Crear constraint único para evitar múltiples tasas por defecto por organización
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_per_org ON interest_variables(organization_id) WHERE is_default = true;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_interest_variables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_interest_variables_updated_at ON interest_variables;
CREATE TRIGGER trigger_update_interest_variables_updated_at
  BEFORE UPDATE ON interest_variables
  FOR EACH ROW
  EXECUTE FUNCTION update_interest_variables_updated_at();

-- Deshabilitar RLS (según configuración actual)
ALTER TABLE interest_variables DISABLE ROW LEVEL SECURITY;