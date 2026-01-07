/*
  # Mejora del Sistema de Pagos

  ## Resumen
  Esta migración mejora el sistema de pagos para soportar múltiples formas de pago por transacción,
  imágenes de comprobantes, aplicación de pagos a múltiples facturas, y funcionalidad offline.

  ## 1. Nuevas Tablas
  
  ### `payment_methods_detail`
  Almacena las diferentes formas de pago utilizadas en una transacción de pago
  - `id` (uuid, primary key)
  - `payment_id` (uuid, foreign key a payments)
  - `payment_method` (text): efectivo, transferencia, tarjeta, cheque, otro
  - `amount` (numeric): monto aplicado con esta forma de pago
  - `reference` (text, nullable): número de referencia/autorización
  - `image_url` (text, nullable): URL de la imagen del comprobante
  - `created_at` (timestamptz)

  ### `payment_applications`
  Registra cómo se aplica un pago a una o más facturas
  - `id` (uuid, primary key)
  - `payment_id` (uuid, foreign key a payments)
  - `account_receivable_id` (uuid, foreign key a accounts_receivable)
  - `amount_applied` (numeric): monto aplicado a esta factura específica
  - `created_at` (timestamptz)

  ## 2. Modificaciones a Tabla `payments`
  
  ### Nuevos Campos
  - `client_id` (uuid): cliente que realiza el pago
  - `total_amount` (numeric): suma total de todos los payment_methods
  - `status` (text): pending, completed, cancelled
  - `synced` (boolean): indica si está sincronizado con el servidor
  - `local_id` (text): ID local para pagos offline
  - `synced_at` (timestamptz): fecha de sincronización

  ### Campos Deprecados (mantener por compatibilidad)
  - `payment_method`: se mantiene pero se usará payment_methods_detail
  - `amount`: se mantiene pero se usará total_amount
  - `account_receivable_id`: se mantiene pero se usará payment_applications

  ## 3. Seguridad
  - RLS deshabilitado (según configuración actual del sistema)

  ## 4. Índices
  - Índices en foreign keys para mejor performance
  - Índice en campos de sincronización offline

  ## Notas Importantes
  - Los pagos pueden tener múltiples formas de pago
  - Un pago puede aplicarse a múltiples facturas
  - Soporte completo para modo offline
  - Las imágenes se almacenarán en Supabase Storage
*/

-- Crear tabla de detalles de formas de pago
CREATE TABLE IF NOT EXISTS payment_methods_detail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  payment_method text NOT NULL CHECK (payment_method IN ('efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro')),
  amount numeric NOT NULL CHECK (amount > 0),
  reference text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de aplicación de pagos a facturas
CREATE TABLE IF NOT EXISTS payment_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  account_receivable_id uuid NOT NULL REFERENCES accounts_receivable(id) ON DELETE CASCADE,
  amount_applied numeric NOT NULL CHECK (amount_applied > 0),
  created_at timestamptz DEFAULT now()
);

-- Agregar nuevos campos a la tabla payments
DO $$
BEGIN
  -- Agregar client_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN client_id uuid REFERENCES clients(id);
  END IF;

  -- Agregar total_amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE payments ADD COLUMN total_amount numeric CHECK (total_amount >= 0);
  END IF;

  -- Agregar status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'status'
  ) THEN
    ALTER TABLE payments ADD COLUMN status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled'));
  END IF;

  -- Agregar synced (para offline)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'synced'
  ) THEN
    ALTER TABLE payments ADD COLUMN synced boolean DEFAULT true;
  END IF;

  -- Agregar local_id (para offline)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'local_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN local_id text;
  END IF;

  -- Agregar synced_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'synced_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN synced_at timestamptz;
  END IF;
END $$;

-- Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_detail_payment_id ON payment_methods_detail(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_applications_payment_id ON payment_applications(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_applications_account_receivable_id ON payment_applications(account_receivable_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_synced ON payments(synced);
CREATE INDEX IF NOT EXISTS idx_payments_local_id ON payments(local_id);

-- Deshabilitar RLS (según configuración actual)
ALTER TABLE payment_methods_detail DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_applications DISABLE ROW LEVEL SECURITY;