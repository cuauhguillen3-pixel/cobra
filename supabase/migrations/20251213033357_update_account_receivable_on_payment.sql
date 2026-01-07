/*
  # Actualizar Cuentas por Cobrar al Registrar Pagos
  
  1. Función y Trigger
    - Crea una función que actualice el balance de accounts_receivable cuando se registra un pago
    - El trigger se ejecuta después de insertar un pago en la tabla payments
    - Calcula el nuevo balance restando el monto pagado
    - Actualiza el estado a 'paid' cuando el balance llega a 0
  
  2. Comportamiento
    - Se busca la venta asociada al payment_schedule_id del pago
    - Se actualiza el balance de la cuenta por cobrar correspondiente
    - Si el balance llega a 0 o menos, marca la cuenta como 'paid'
*/

-- Función para actualizar el balance de cuentas por cobrar cuando se registra un pago
CREATE OR REPLACE FUNCTION update_account_receivable_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_id uuid;
  v_account_id uuid;
  v_current_balance numeric;
  v_new_balance numeric;
BEGIN
  -- Obtener el sale_id del payment_schedule asociado al pago
  SELECT sale_id INTO v_sale_id
  FROM payment_schedule
  WHERE id = NEW.payment_schedule_id;
  
  -- Si encontramos un sale_id, buscar la cuenta por cobrar
  IF v_sale_id IS NOT NULL THEN
    -- Buscar la cuenta por cobrar asociada a esta venta
    SELECT id, balance INTO v_account_id, v_current_balance
    FROM accounts_receivable
    WHERE sale_id = v_sale_id
    AND organization_id = NEW.organization_id;
    
    -- Si encontramos la cuenta, actualizar el balance
    IF v_account_id IS NOT NULL THEN
      -- Calcular el nuevo balance
      v_new_balance := v_current_balance - NEW.amount;
      
      -- Actualizar el balance y el estado si corresponde
      UPDATE accounts_receivable
      SET 
        balance = GREATEST(v_new_balance, 0),
        status = CASE 
          WHEN v_new_balance <= 0 THEN 'paid'
          ELSE status
        END,
        updated_at = now()
      WHERE id = v_account_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trigger_update_account_receivable_on_payment ON payments;

-- Crear trigger que se ejecuta después de insertar un pago
CREATE TRIGGER trigger_update_account_receivable_on_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_account_receivable_balance();