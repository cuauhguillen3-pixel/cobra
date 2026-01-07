/*
  # Agregar permisos de Corte de Caja

  ## Descripción
  Agrega los permisos necesarios para el módulo de corte de caja

  ## Permisos
  - cash_register.view: Ver caja
  - cash_register.open: Abrir caja
  - cash_register.close: Cerrar caja
  - cash_register.expense: Registrar gastos
*/

-- Insertar permisos de corte de caja
INSERT INTO permissions (module, action, name, description) VALUES
  ('cash_register', 'view', 'Ver Caja', 'Visualizar estado y movimientos de caja'),
  ('cash_register', 'open', 'Abrir Caja', 'Abrir una nueva caja'),
  ('cash_register', 'close', 'Cerrar Caja', 'Cerrar y hacer corte de caja'),
  ('cash_register', 'expense', 'Registrar Gastos', 'Registrar gastos y egresos')
ON CONFLICT (module, action) DO NOTHING;
