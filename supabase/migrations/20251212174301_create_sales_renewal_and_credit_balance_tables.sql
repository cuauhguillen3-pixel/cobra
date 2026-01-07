/*
  # Crear tablas para renovaciones de ventas y saldos a favor

  1. Nueva tabla: sales_renewals
    - `id` (uuid, primary key)
    - `organization_id` (uuid, foreign key a organizations)
    - `original_sale_id` (uuid, foreign key a sales) - Venta original que se renovó
    - `new_sale_id` (uuid, foreign key a sales) - Nueva venta creada
    - `renewal_date` (date) - Fecha de renovación
    - `renewal_reason` (text, nullable) - Razón de la renovación
    - `created_by` (uuid, foreign key a auth.users)
    - `created_at` (timestamptz)

  2. Nueva tabla: client_credit_balance
    - `id` (uuid, primary key)
    - `organization_id` (uuid, foreign key a organizations)
    - `client_id` (uuid, foreign key a clients)
    - `amount` (numeric) - Monto del saldo a favor
    - `origin_payment_id` (uuid, nullable, foreign key a payments) - Pago que generó el saldo
    - `applied_to_payment_id` (uuid, nullable, foreign key a payments) - Pago donde se aplicó
    - `status` (text) - 'available', 'applied', 'expired'
    - `created_by` (uuid, foreign key a auth.users)
    - `created_at` (timestamptz)
    - `applied_at` (timestamptz, nullable)

  3. Modificaciones a sales
    - Agregar campo `renewal_status` ('original', 'renewed', 'renewal') - Estado de renovación

  4. Notas importantes
    - Las renovaciones mantienen un historial completo
    - Los saldos a favor pueden aplicarse a pagos futuros
    - Solo puede haber un saldo a favor 'available' por cliente a la vez
*/

-- Tabla de renovaciones de ventas
CREATE TABLE IF NOT EXISTS sales_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  original_sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  new_sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  renewal_date date NOT NULL DEFAULT CURRENT_DATE,
  renewal_reason text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_renewals_organization ON sales_renewals(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_renewals_original_sale ON sales_renewals(original_sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_renewals_new_sale ON sales_renewals(new_sale_id);

-- Tabla de saldos a favor de clientes
CREATE TABLE IF NOT EXISTS client_credit_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  origin_payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  applied_to_payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'applied', 'expired')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  applied_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_credit_balance_organization ON client_credit_balance(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_balance_client ON client_credit_balance(client_id);
CREATE INDEX IF NOT EXISTS idx_credit_balance_status ON client_credit_balance(status);

-- Agregar campos de renovación a sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'renewal_status'
  ) THEN
    ALTER TABLE sales ADD COLUMN renewal_status text DEFAULT 'original' CHECK (renewal_status IN ('original', 'renewed', 'renewal'));
  END IF;
END $$;