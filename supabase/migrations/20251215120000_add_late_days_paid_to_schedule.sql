/*
  # Agregar tracking de días de morosidad pagados

  1. Cambios en payment_schedule
    - `late_days_paid` (numeric, default 0) - Días de morosidad que ya han sido pagados
    
  2. Objetivo
    - Permitir pagos parciales de morosidad basados en días
    - Calcular la deuda de morosidad basada en (días reales - días pagados)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_schedule' AND column_name = 'late_days_paid'
  ) THEN
    ALTER TABLE payment_schedule ADD COLUMN late_days_paid numeric DEFAULT 0;
  END IF;
END $$;
