/*
  # Sistema de Corte de Caja

  ## Descripción
  Sistema completo para gestionar cajas, movimientos de efectivo, gastos y cierres de caja.

  ## Nuevas Tablas

  ### 1. cash_registers
  Tabla principal de cajas por usuario/organización
  - `id` (uuid, PK): Identificador único
  - `organization_id` (uuid, FK): Organización
  - `user_id` (uuid, FK): Usuario responsable de la caja
  - `opening_amount` (decimal): Saldo inicial de apertura
  - `status` (text): Estado de la caja (open/closed)
  - `opened_at` (timestamptz): Fecha/hora de apertura
  - `closed_at` (timestamptz): Fecha/hora de cierre
  - `notes` (text): Notas adicionales
  - Campos de auditoría

  ### 2. cash_register_movements
  Registro de todos los movimientos de caja
  - `id` (uuid, PK): Identificador único
  - `cash_register_id` (uuid, FK): Referencia a la caja
  - `organization_id` (uuid, FK): Organización
  - `type` (text): Tipo de movimiento (payment/expense/adjustment)
  - `amount` (decimal): Monto del movimiento
  - `payment_method` (text): Forma de pago (cash/card/transfer)
  - `reference_id` (uuid): ID de referencia (payment_id si es cobro)
  - `client_id` (uuid, FK): Cliente relacionado (opcional)
  - `concept` (text): Concepto del movimiento
  - `evidence_url` (text): URL de evidencia (foto)
  - `movement_date` (timestamptz): Fecha del movimiento
  - Campos de auditoría

  ### 3. cash_register_closures
  Registro de cierres de caja
  - `id` (uuid, PK): Identificador único
  - `cash_register_id` (uuid, FK): Referencia a la caja
  - `organization_id` (uuid, FK): Organización
  - `expected_cash` (decimal): Efectivo esperado
  - `counted_cash` (decimal): Efectivo contado físicamente
  - `difference` (decimal): Diferencia (counted - expected)
  - `total_payments` (decimal): Total de cobros
  - `total_expenses` (decimal): Total de gastos
  - `total_card` (decimal): Total en tarjeta
  - `total_transfer` (decimal): Total en transferencias
  - `notes` (text): Observaciones del cierre
  - `closed_by` (uuid, FK): Usuario que cerró
  - `closed_at` (timestamptz): Fecha/hora de cierre
  - Campos de auditoría

  ## Seguridad
  - RLS deshabilitado para consistencia con el resto del sistema
  - Control de acceso por organización

  ## Índices
  - Índices en organization_id, user_id, status para optimizar consultas
  - Índices en fechas para reportes
*/

-- Tabla de cajas
CREATE TABLE IF NOT EXISTS cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  opening_amount decimal(12,2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Tabla de movimientos de caja
CREATE TABLE IF NOT EXISTS cash_register_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('payment', 'expense', 'adjustment')),
  amount decimal(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer')),
  reference_id uuid,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  concept text NOT NULL,
  evidence_url text,
  movement_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Tabla de cierres de caja
CREATE TABLE IF NOT EXISTS cash_register_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expected_cash decimal(12,2) NOT NULL DEFAULT 0,
  counted_cash decimal(12,2) NOT NULL DEFAULT 0,
  difference decimal(12,2) NOT NULL DEFAULT 0,
  total_payments decimal(12,2) NOT NULL DEFAULT 0,
  total_expenses decimal(12,2) NOT NULL DEFAULT 0,
  total_card decimal(12,2) NOT NULL DEFAULT 0,
  total_transfer decimal(12,2) NOT NULL DEFAULT 0,
  notes text,
  closed_by uuid NOT NULL REFERENCES auth.users(id),
  closed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Índices para cash_registers
CREATE INDEX IF NOT EXISTS idx_cash_registers_organization ON cash_registers(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_user ON cash_registers(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON cash_registers(status);
CREATE INDEX IF NOT EXISTS idx_cash_registers_opened_at ON cash_registers(opened_at);

-- Índices para cash_register_movements
CREATE INDEX IF NOT EXISTS idx_cash_movements_register ON cash_register_movements(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_organization ON cash_register_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_type ON cash_register_movements(type);
CREATE INDEX IF NOT EXISTS idx_cash_movements_date ON cash_register_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_cash_movements_client ON cash_register_movements(client_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_reference ON cash_register_movements(reference_id);

-- Índices para cash_register_closures
CREATE INDEX IF NOT EXISTS idx_cash_closures_register ON cash_register_closures(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_organization ON cash_register_closures(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_date ON cash_register_closures(closed_at);

-- Deshabilitar RLS (consistente con otras tablas del sistema)
ALTER TABLE cash_registers DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_closures DISABLE ROW LEVEL SECURITY;

-- Triggers para updated_at
CREATE TRIGGER update_cash_registers_updated_at
  BEFORE UPDATE ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cash_movements_updated_at
  BEFORE UPDATE ON cash_register_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cash_closures_updated_at
  BEFORE UPDATE ON cash_register_closures
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
