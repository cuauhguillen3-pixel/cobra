/*
  # Corregir Trigger de Cuentas por Cobrar - usar due_date

  1. Problema
    - El trigger estaba usando payment_date que no existe
    - La columna correcta es due_date en payment_schedule
    
  2. Solución
    - Actualizar la función del trigger para usar due_date
*/

CREATE OR REPLACE FUNCTION create_account_receivable_from_sale_after_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sale_record sales;
  first_due_date date;
  last_due_date date;
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
      MIN(due_date),
      MAX(due_date)
    INTO 
      first_due_date,
      last_due_date
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
      last_due_date,
      'pending',
      'Generada automáticamente desde venta',
      sale_record.created_by
    );
  END IF;

  RETURN NEW;
END;
$$;