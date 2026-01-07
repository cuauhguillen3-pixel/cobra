/*
  # Agregar Política SELECT para Pagos
  
  1. Políticas
    - Agrega política SELECT para la tabla payments
    - Permite a usuarios autenticados ver pagos de su organización
  
  2. Seguridad
    - Los usuarios solo pueden ver pagos de su propia organización
*/

-- Crear política SELECT para payments
CREATE POLICY "Users can view organization payments"
  ON payments
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM users
      WHERE id = auth.uid()
    )
  );