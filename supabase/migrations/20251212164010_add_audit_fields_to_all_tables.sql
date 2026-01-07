/*
  # Agregar campos de auditoría a todas las tablas
  
  1. Cambios
    - Agrega `created_by` y `updated_by` a todas las tablas que no los tienen
    - Estos campos registran qué usuario creó o modificó cada registro
    - Se agregan foreign keys a la tabla users
  
  2. Tablas afectadas
    - organizations: created_by, updated_by
    - users: created_by, updated_by
    - clients: created_by, updated_by
    - accounts_receivable: created_by, updated_by
    - payments: created_by, updated_by (ya tiene collector_id)
    - payment_methods_detail: created_by, updated_by
    - payment_applications: created_by, updated_by
    - collection_activities: created_by, updated_by (ya tiene collector_id)
    - alerts: created_by, updated_by
    - routes: updated_by (ya tiene created_by)
    - interest_variables: updated_by (ya tiene created_by)
    - sales: updated_by (ya tiene created_by)
    - payment_schedule: created_by, updated_by
  
  3. Notas
    - Los campos created_by no son obligatorios para permitir migración de datos existentes
    - Los campos se pueden llenar posteriormente con triggers o aplicación
*/

-- Agregar campos a organizations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'created_by') THEN
    ALTER TABLE organizations ADD COLUMN created_by uuid REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'updated_by') THEN
    ALTER TABLE organizations ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Agregar campos a users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_by') THEN
    ALTER TABLE users ADD COLUMN created_by uuid REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updated_by') THEN
    ALTER TABLE users ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Agregar campos a clients
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'created_by') THEN
    ALTER TABLE clients ADD COLUMN created_by uuid REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'updated_by') THEN
    ALTER TABLE clients ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Agregar campos a accounts_receivable
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts_receivable' AND column_name = 'created_by') THEN
    ALTER TABLE accounts_receivable ADD COLUMN created_by uuid REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts_receivable' AND column_name = 'updated_by') THEN
    ALTER TABLE accounts_receivable ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Agregar campos a payments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'created_by') THEN
    ALTER TABLE payments ADD COLUMN created_by uuid REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'updated_by') THEN
    ALTER TABLE payments ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Agregar campos a payment_methods_detail
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_methods_detail' AND column_name = 'created_by') THEN
    ALTER TABLE payment_methods_detail ADD COLUMN created_by uuid REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_methods_detail' AND column_name = 'updated_by') THEN
    ALTER TABLE payment_methods_detail ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Agregar campos a payment_applications
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_applications' AND column_name = 'created_by') THEN
    ALTER TABLE payment_applications ADD COLUMN created_by uuid REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_applications' AND column_name = 'updated_by') THEN
    ALTER TABLE payment_applications ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Agregar campos a collection_activities
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collection_activities' AND column_name = 'created_by') THEN
    ALTER TABLE collection_activities ADD COLUMN created_by uuid REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collection_activities' AND column_name = 'updated_by') THEN
    ALTER TABLE collection_activities ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Agregar campos a alerts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'created_by') THEN
    ALTER TABLE alerts ADD COLUMN created_by uuid REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'updated_by') THEN
    ALTER TABLE alerts ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Agregar campo updated_by a routes (ya tiene created_by)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'updated_by') THEN
    ALTER TABLE routes ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Agregar campo updated_by a interest_variables (ya tiene created_by)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'interest_variables' AND column_name = 'updated_by') THEN
    ALTER TABLE interest_variables ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Agregar campo updated_by a sales (ya tiene created_by)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'updated_by') THEN
    ALTER TABLE sales ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Agregar campos a payment_schedule
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_schedule' AND column_name = 'created_by') THEN
    ALTER TABLE payment_schedule ADD COLUMN created_by uuid REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_schedule' AND column_name = 'updated_by') THEN
    ALTER TABLE payment_schedule ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;
END $$;