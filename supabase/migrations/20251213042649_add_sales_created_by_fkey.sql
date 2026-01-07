/*
  # Agregar foreign key para sales.created_by
  
  1. Cambios
    - Agregar constraint de foreign key a sales.created_by referenciando users(id)
    - Esto permitirá hacer joins entre sales y users para reportes
  
  2. Notas
    - Se usa ON DELETE RESTRICT para prevenir eliminación de usuarios con ventas
    - El constraint se llama sales_created_by_fkey para consistencia
*/

DO $$
BEGIN
  -- Agregar foreign key si no existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sales_created_by_fkey'
  ) THEN
    ALTER TABLE sales
    ADD CONSTRAINT sales_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES auth.users(id)
    ON DELETE RESTRICT;
  END IF;
END $$;
