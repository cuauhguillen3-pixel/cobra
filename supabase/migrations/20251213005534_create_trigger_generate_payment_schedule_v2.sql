/*
  # Trigger para Generar Cronograma de Pagos Automáticamente

  ## 1. Función: generate_payment_schedule_for_sale
    - Función que genera automáticamente el cronograma de pagos
    - Se ejecuta cuando se crea una nueva venta
    - Calcula las fechas de vencimiento según la frecuencia de pago
    - Crea registros en payment_schedule por cada cuota

  ## 2. Trigger: trigger_generate_payment_schedule
    - Se activa después de insertar una nueva venta
    - Llama a la función generate_payment_schedule_for_sale
    - Solo se ejecuta para ventas con status 'active'

  ## 3. Lógica de Cálculo de Fechas
    - daily: añade 1 día
    - weekly: añade 7 días
    - biweekly: añade 14 días
    - monthly: añade 1 mes

  ## 4. Notas Importantes
    - El cronograma se genera solo para ventas nuevas
    - La primera fecha de pago se toma del campo first_payment_date
    - Si first_payment_date no existe, se calculará desde sale_date
*/

-- Crear función para generar cronograma de pagos
CREATE OR REPLACE FUNCTION generate_payment_schedule_for_sale()
RETURNS TRIGGER AS $$
DECLARE
  next_payment_date date;
  payment_num integer;
  first_payment_date date;
BEGIN
  -- Verificar que la venta esté activa
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Obtener la fecha del primer pago
  first_payment_date := COALESCE(NEW.first_payment_date, NEW.sale_date);

  -- Generar el cronograma de pagos
  next_payment_date := first_payment_date;
  
  FOR payment_num IN 1..NEW.number_of_payments LOOP
    INSERT INTO payment_schedule (
      sale_id,
      payment_number,
      due_date,
      amount,
      status,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      payment_num,
      next_payment_date,
      NEW.payment_amount,
      'pending',
      NOW(),
      NOW()
    );

    -- Calcular la siguiente fecha según la frecuencia
    CASE NEW.payment_frequency
      WHEN 'daily' THEN
        next_payment_date := next_payment_date + INTERVAL '1 day';
      WHEN 'weekly' THEN
        next_payment_date := next_payment_date + INTERVAL '7 days';
      WHEN 'biweekly' THEN
        next_payment_date := next_payment_date + INTERVAL '14 days';
      WHEN 'monthly' THEN
        next_payment_date := next_payment_date + INTERVAL '1 month';
    END CASE;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para generar cronograma automáticamente
DROP TRIGGER IF EXISTS trigger_generate_payment_schedule ON sales;

CREATE TRIGGER trigger_generate_payment_schedule
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION generate_payment_schedule_for_sale();

-- Agregar columna first_payment_date si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'first_payment_date'
  ) THEN
    ALTER TABLE sales ADD COLUMN first_payment_date date;
  END IF;
END $$;