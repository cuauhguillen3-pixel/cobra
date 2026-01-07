/*
  # Integración de Cuentas por Cobrar con Ventas

  1. Cambios en accounts_receivable
    - Agregar `sale_id` (uuid, nullable, foreign key a sales)
      - Vincula la cuenta por cobrar con una venta
    - Agregar `source_type` (text, default 'manual')
      - 'manual': Captura manual independiente
      - 'sale': Generada automáticamente desde una venta
    - Agregar `start_date` (date, nullable)
      - Fecha de inicio de la venta (para cuentas generadas desde ventas)
    - Modificar `invoice_number` para que sea nullable
      - Las cuentas generadas desde ventas pueden no tener factura manual

  2. Funcionalidad
    - Permite capturar cuentas por cobrar manualmente (sistema existente)
    - Permite generar cuentas por cobrar automáticamente desde ventas
    - Mantiene trazabilidad completa entre ventas y cuentas por cobrar

  3. Trigger Automático
    - Al crear un payment_schedule, automáticamente se crea la cuenta por cobrar
    - Calcula fechas de inicio y vencimiento basado en el calendario de pagos
*/

-- Agregar sale_id para vincular con sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts_receivable' AND column_name = 'sale_id'
  ) THEN
    ALTER TABLE accounts_receivable 
    ADD COLUMN sale_id uuid REFERENCES sales(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Agregar source_type para identificar el origen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts_receivable' AND column_name = 'source_type'
  ) THEN
    ALTER TABLE accounts_receivable 
    ADD COLUMN source_type text DEFAULT 'manual' CHECK (source_type IN ('manual', 'sale'));
  END IF;
END $$;

-- Agregar start_date para fecha de inicio de la venta
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts_receivable' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE accounts_receivable 
    ADD COLUMN start_date date;
  END IF;
END $$;

-- Hacer invoice_number nullable para cuentas generadas desde ventas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts_receivable' 
    AND column_name = 'invoice_number' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE accounts_receivable ALTER COLUMN invoice_number DROP NOT NULL;
  END IF;
END $$;

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_sale_id ON accounts_receivable(sale_id);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_source_type ON accounts_receivable(source_type);

-- Crear función para generar número de factura automático
CREATE OR REPLACE FUNCTION generate_invoice_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_number integer;
  invoice_num text;
BEGIN
  -- Obtener el siguiente número de factura para la organización
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM accounts_receivable
  WHERE organization_id = org_id
  AND invoice_number ~ '^INV-[0-9]+$';
  
  -- Generar número de factura con formato INV-XXXXX
  invoice_num := 'INV-' || LPAD(next_number::text, 5, '0');
  
  RETURN invoice_num;
END;
$$;

-- Función que se ejecuta después de crear payment_schedule
CREATE OR REPLACE FUNCTION create_account_receivable_from_sale_after_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sale_record sales;
  first_payment_date date;
  last_payment_date date;
  account_exists boolean;
BEGIN
  -- Verificar si ya existe una cuenta por cobrar para esta venta
  SELECT EXISTS(
    SELECT 1 FROM accounts_receivable 
    WHERE sale_id = NEW.sale_id
  ) INTO account_exists;

  -- Solo crear si no existe
  IF NOT account_exists THEN
    -- Obtener información de la venta
    SELECT * INTO sale_record
    FROM sales
    WHERE id = NEW.sale_id;

    -- Obtener la fecha del primer y último pago programado
    SELECT 
      MIN(payment_date),
      MAX(payment_date)
    INTO 
      first_payment_date,
      last_payment_date
    FROM payment_schedule
    WHERE sale_id = NEW.sale_id;

    -- Crear cuenta por cobrar vinculada a la venta
    INSERT INTO accounts_receivable (
      organization_id,
      client_id,
      sale_id,
      source_type,
      invoice_number,
      amount,
      balance,
      start_date,
      due_date,
      status,
      notes,
      created_by
    ) VALUES (
      sale_record.organization_id,
      sale_record.client_id,
      sale_record.id,
      'sale',
      generate_invoice_number(sale_record.organization_id),
      sale_record.total_amount,
      sale_record.total_amount,
      sale_record.sale_date,
      last_payment_date,
      'pending',
      'Generada automáticamente desde venta',
      sale_record.created_by
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_create_account_receivable_after_payment_schedule ON payment_schedule;

-- Crear trigger que se ejecuta después de insertar payment_schedule
CREATE TRIGGER trigger_create_account_receivable_after_payment_schedule
AFTER INSERT ON payment_schedule
FOR EACH ROW
EXECUTE FUNCTION create_account_receivable_from_sale_after_schedule();