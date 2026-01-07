/*
  # Actualizar tabla payments para trabajar con payment_schedule

  1. Cambios en payments
    - Hacer `account_receivable_id` nullable (ya que ahora trabajamos con payment_schedule)
    - Agregar `payment_schedule_id` (uuid, nullable, foreign key a payment_schedule)
    
  2. Notas
    - Esto permite registrar pagos tanto del sistema antiguo (accounts_receivable) 
      como del nuevo sistema (payment_schedule)
*/

-- Hacer account_receivable_id nullable
DO $$
BEGIN
  -- Primero verificar si la columna existe y tiene la restricción NOT NULL
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'payments' 
    AND column_name = 'account_receivable_id' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE payments ALTER COLUMN account_receivable_id DROP NOT NULL;
  END IF;
END $$;

-- Agregar payment_schedule_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'payment_schedule_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN payment_schedule_id uuid REFERENCES payment_schedule(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Crear índice para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_payments_payment_schedule ON payments(payment_schedule_id);