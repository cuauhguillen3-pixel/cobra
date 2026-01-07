/*
  # Actualizar Campo Frecuencia en Rutas

  1. Cambios en tabla routes
    - Hacer el campo `frecuencia` opcional (permitir NULL)
    - Cambiar el valor por defecto de 'Semanal' a 'Libre'
    - Agregar 'Libre' como opción válida de frecuencia

  2. Notas Importantes
    - Este cambio permite mayor flexibilidad en la configuración de rutas
    - Las rutas existentes mantendrán sus valores actuales
    - El nuevo valor por defecto será 'Libre' para nuevas rutas
*/

-- Hacer el campo frecuencia opcional y cambiar el valor por defecto
ALTER TABLE routes 
  ALTER COLUMN frecuencia DROP NOT NULL,
  ALTER COLUMN frecuencia SET DEFAULT 'Libre';