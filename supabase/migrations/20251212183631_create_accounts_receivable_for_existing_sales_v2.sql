/*
  # Crear Cuentas por Cobrar para Ventas Existentes

  1. Propósito
    - Genera cuentas por cobrar automáticamente para todas las ventas existentes
      que aún no tienen una cuenta por cobrar asociada
    
  2. Proceso
    - Busca todas las ventas sin cuenta por cobrar
    - Para cada venta, calcula las fechas de inicio y vencimiento desde payment_schedule
    - Crea la cuenta por cobrar con toda la información necesaria
    
  3. Ejecución
    - Se ejecuta una sola vez para migrar datos históricos
    - Las nuevas ventas usarán el trigger automático
*/

DO $$
DECLARE
  sale_record RECORD;
  first_due_date date;
  last_due_date date;
BEGIN
  -- Recorrer todas las ventas que no tienen cuenta por cobrar
  FOR sale_record IN 
    SELECT s.*
    FROM sales s
    WHERE NOT EXISTS (
      SELECT 1 FROM accounts_receivable ar WHERE ar.sale_id = s.id
    )
  LOOP
    -- Obtener fechas de pagos programados
    SELECT 
      MIN(due_date),
      MAX(due_date)
    INTO 
      first_due_date,
      last_due_date
    FROM payment_schedule
    WHERE sale_id = sale_record.id;

    -- Solo crear si hay payment_schedule
    IF last_due_date IS NOT NULL THEN
      -- Crear cuenta por cobrar para esta venta
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
        created_by,
        created_at
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
        'Generada automáticamente desde venta existente',
        sale_record.created_by,
        sale_record.created_at
      );
      
      RAISE NOTICE 'Cuenta por cobrar creada para venta %', sale_record.id;
    ELSE
      RAISE NOTICE 'No hay payment_schedule para venta %, se omite', sale_record.id;
    END IF;
  END LOOP;
END $$;