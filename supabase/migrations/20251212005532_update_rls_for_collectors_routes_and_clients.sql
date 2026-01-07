/*
  # Actualizar RLS para Cobradores en Rutas y Clientes

  1. Cambios en políticas de seguridad
    - Actualizar políticas en tabla `routes` para que cobradores solo vean rutas asignadas
    - Actualizar políticas en tabla `clients` para que cobradores solo vean clientes de sus rutas
    - Administradores y superadministradores mantienen acceso completo

  2. Políticas nuevas
    - Cobradores pueden ver solo las rutas donde están asignados (cobrador_asignado)
    - Cobradores pueden ver solo los clientes que pertenecen a sus rutas asignadas
    - Administradores pueden ver y gestionar todas las rutas y clientes de su organización

  3. Notas importantes
    - Las políticas existentes se actualizan para incluir el rol de cobrador
    - Se mantiene la seguridad multi-tenant por organización
*/

-- Eliminar políticas antiguas de routes para recrearlas con mejor lógica
DROP POLICY IF EXISTS "Users can view routes from their organization" ON routes;

-- Nueva política para ver rutas: Admin/Superadmin ven todas, Cobradores solo las asignadas
CREATE POLICY "Users can view routes based on role"
  ON routes FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      -- Admins y superadmins ven todas las rutas de su organización
      (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'superadmin')
      OR
      -- Cobradores solo ven rutas donde están asignados
      (
        (SELECT role FROM users WHERE id = auth.uid()) = 'collector'
        AND cobrador_asignado = auth.uid()
      )
    )
  );

-- Eliminar políticas antiguas de clients para recrearlas con mejor lógica
DROP POLICY IF EXISTS "Users can view clients from their organization" ON clients;

-- Nueva política para ver clientes: Admin/Superadmin ven todos, Cobradores solo los de sus rutas
CREATE POLICY "Users can view clients based on role"
  ON clients FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      -- Admins y superadmins ven todos los clientes de su organización
      (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'superadmin')
      OR
      -- Cobradores solo ven clientes de rutas donde están asignados
      (
        (SELECT role FROM users WHERE id = auth.uid()) = 'collector'
        AND route_id IN (
          SELECT id FROM routes WHERE cobrador_asignado = auth.uid()
        )
      )
    )
  );

-- Política para que cobradores puedan actualizar clientes de sus rutas
DROP POLICY IF EXISTS "Admins can update clients from their organization" ON clients;
CREATE POLICY "Users can update clients based on role"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      -- Admins y superadmins pueden actualizar todos los clientes
      (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'superadmin')
      OR
      -- Cobradores solo pueden actualizar clientes de sus rutas
      (
        (SELECT role FROM users WHERE id = auth.uid()) = 'collector'
        AND route_id IN (
          SELECT id FROM routes WHERE cobrador_asignado = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'superadmin')
      OR
      (
        (SELECT role FROM users WHERE id = auth.uid()) = 'collector'
        AND route_id IN (
          SELECT id FROM routes WHERE cobrador_asignado = auth.uid()
        )
      )
    )
  );