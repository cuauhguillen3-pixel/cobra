/*
  # Actualizar Tipo de Cálculo - Agregar opción "Libre"

  ## Resumen
  Esta migración actualiza la tabla interest_variables para hacer el campo calculation_type
  más flexible, permitiendo valores nulos y agregando "libre" como opción predeterminada.

  ## 1. Cambios en Tablas Existentes
  
  ### `interest_variables`
  - Modificar constraint de `calculation_type` para incluir 'libre'
  - Cambiar valor por defecto a 'libre'
  - Hacer el campo nullable (opcional)

  ## 2. Opciones de Tipo de Cálculo
  - daily: Cálculo diario
  - monthly: Cálculo mensual
  - annual: Cálculo anual
  - libre: Sin tipo de cálculo específico (personalizado)
  - null: Sin especificar

  ## Notas Importantes
  - Esta migración es segura y no afecta datos existentes
  - Variables existentes mantienen su tipo de cálculo actual
  - La opción "libre" permite mayor flexibilidad en la configuración
*/

-- Eliminar el constraint existente de calculation_type
ALTER TABLE interest_variables 
DROP CONSTRAINT IF EXISTS interest_variables_calculation_type_check;

-- Hacer el campo nullable
ALTER TABLE interest_variables 
ALTER COLUMN calculation_type DROP NOT NULL;

-- Cambiar el valor por defecto a 'libre'
ALTER TABLE interest_variables 
ALTER COLUMN calculation_type SET DEFAULT 'libre';

-- Agregar nuevo constraint que incluye 'libre' como opción
ALTER TABLE interest_variables 
ADD CONSTRAINT interest_variables_calculation_type_check 
CHECK (calculation_type IS NULL OR calculation_type IN ('daily', 'monthly', 'annual', 'libre'));