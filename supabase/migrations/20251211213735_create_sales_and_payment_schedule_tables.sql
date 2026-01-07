/*
  # Crear Sistema de Ventas y Cronograma de Pagos

  1. Nueva Tabla: sales (ventas)
    - `id` (uuid, primary key) - ID único de la venta
    - `organization_id` (uuid) - Organización propietaria
    - `client_id` (uuid, foreign key) - Cliente asociado
    - `payment_frequency` (text) - Frecuencia de pago: daily, weekly, biweekly, monthly
    - `principal_amount` (decimal) - Monto prestado sin interés
    - `interest_variable_id` (uuid, foreign key) - Variable de interés aplicada
    - `interest_rate` (decimal) - Tasa de interés en el momento de la venta
    - `number_of_payments` (integer) - Número total de pagos
    - `total_amount` (decimal) - Monto total (principal + interés)
    - `payment_amount` (decimal) - Monto de cada cuota
    - `sale_date` (date) - Fecha de la venta
    - `status` (text) - Estado: active, completed, cancelled
    - `created_by` (uuid) - Usuario que creó la venta
    - `created_at` (timestamp) - Fecha de creación
    - `updated_at` (timestamp) - Fecha de última actualización

  2. Nueva Tabla: payment_schedule (cronograma de pagos)
    - `id` (uuid, primary key) - ID único del pago
    - `sale_id` (uuid, foreign key) - Venta asociada
    - `payment_number` (integer) - Número de cuota
    - `due_date` (date) - Fecha de vencimiento
    - `amount` (decimal) - Monto de la cuota
    - `status` (text) - Estado: pending, paid, overdue
    - `paid_date` (date, nullable) - Fecha de pago
    - `paid_amount` (decimal, nullable) - Monto pagado
    - `created_at` (timestamp) - Fecha de creación
    - `updated_at` (timestamp) - Fecha de última actualización

  3. Seguridad
    - RLS deshabilitado para ambas tablas (consistente con otras tablas)

  4. Índices
    - Índice en client_id para búsquedas rápidas
    - Índice en sale_id en payment_schedule
    - Índice en organization_id
*/

-- Crear tabla de ventas
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  payment_frequency text NOT NULL CHECK (payment_frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  principal_amount decimal(12,2) NOT NULL CHECK (principal_amount > 0),
  interest_variable_id uuid REFERENCES interest_variables(id) ON DELETE RESTRICT,
  interest_rate decimal(5,2) NOT NULL CHECK (interest_rate >= 0),
  number_of_payments integer NOT NULL CHECK (number_of_payments > 0),
  total_amount decimal(12,2) NOT NULL CHECK (total_amount > 0),
  payment_amount decimal(12,2) NOT NULL CHECK (payment_amount > 0),
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de cronograma de pagos
CREATE TABLE IF NOT EXISTS payment_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_number integer NOT NULL CHECK (payment_number > 0),
  due_date date NOT NULL,
  amount decimal(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  paid_date date,
  paid_amount decimal(12,2) CHECK (paid_amount >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sale_id, payment_number)
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_sales_organization_id ON sales(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_client_id ON sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_sale_id ON payment_schedule(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_status ON payment_schedule(status);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_due_date ON payment_schedule(due_date);

-- Deshabilitar RLS (consistente con otras tablas del sistema)
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedule DISABLE ROW LEVEL SECURITY;