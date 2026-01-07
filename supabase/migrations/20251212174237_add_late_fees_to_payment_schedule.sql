/*
  # Agregar campos de morosidad al payment_schedule

  1. Cambios en payment_schedule
    - `late_fee_amount` (numeric, default 0) - Monto de morosidad calculado
    - `late_fee_override` (numeric, nullable) - Morosidad manual (cuando se desactiva la variable)
    - `days_late` (integer, default 0) - Días de atraso calculados
    - `is_late_fee_editable` (boolean, default false) - Si la morosidad es editable manualmente
    - `late_fee_applied_date` (timestamptz, nullable) - Fecha cuando se aplicó la morosidad

  2. Notas importantes
    - late_fee_amount se calcula automáticamente basado en la cuota diaria de morosidad
    - late_fee_override permite a los admin editar manualmente la morosidad cuando las variables están desactivadas
    - days_late se calcula como la diferencia entre hoy y due_date si está vencido
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_schedule' AND column_name = 'late_fee_amount'
  ) THEN
    ALTER TABLE payment_schedule ADD COLUMN late_fee_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_schedule' AND column_name = 'late_fee_override'
  ) THEN
    ALTER TABLE payment_schedule ADD COLUMN late_fee_override numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_schedule' AND column_name = 'days_late'
  ) THEN
    ALTER TABLE payment_schedule ADD COLUMN days_late integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_schedule' AND column_name = 'is_late_fee_editable'
  ) THEN
    ALTER TABLE payment_schedule ADD COLUMN is_late_fee_editable boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_schedule' AND column_name = 'late_fee_applied_date'
  ) THEN
    ALTER TABLE payment_schedule ADD COLUMN late_fee_applied_date timestamptz;
  END IF;
END $$;