/*
  # Sistema de Roles y Permisos

  ## 1. Nueva Tabla: roles
    - Almacena los roles del sistema (Administrador, Cobrador, etc.)
    - Campos:
      - id (uuid, primary key)
      - organization_id (uuid, foreign key)
      - name (text) - Nombre del rol
      - description (text) - Descripción del rol
      - is_admin (boolean) - Si es rol de administrador (todos los permisos)
      - is_system (boolean) - Si es rol del sistema (no se puede eliminar)
      - created_at, updated_at, created_by, updated_by
  
  ## 2. Nueva Tabla: permissions
    - Almacena los permisos disponibles por módulo
    - Campos:
      - id (uuid, primary key)
      - module (text) - Módulo (clientes, ventas, pagos, etc.)
      - action (text) - Acción (view, create, edit, delete)
      - name (text) - Nombre descriptivo
      - description (text)
  
  ## 3. Nueva Tabla: role_permissions
    - Relación entre roles y permisos
    - Campos:
      - role_id (uuid, foreign key)
      - permission_id (uuid, foreign key)
      - primary key compuesta (role_id, permission_id)
  
  ## 4. Nueva Tabla: user_roles
    - Relación entre usuarios y roles
    - Campos:
      - user_id (uuid, foreign key)
      - role_id (uuid, foreign key)
      - assigned_at (timestamptz)
      - assigned_by (uuid, foreign key)
      - primary key compuesta (user_id, role_id)
  
  ## 5. Seguridad
    - RLS deshabilitado temporalmente para desarrollo
*/

-- Crear tabla de roles
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_admin boolean DEFAULT false,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT unique_role_name_per_org UNIQUE (organization_id, name)
);

-- Crear tabla de permisos
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_permission UNIQUE (module, action)
);

-- Crear tabla de relación roles-permisos
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

-- Crear tabla de relación usuarios-roles
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (user_id, role_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_roles_organization ON roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- Trigger para actualizar updated_at en roles
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insertar permisos del sistema
INSERT INTO permissions (module, action, name, description) VALUES
  -- Clientes
  ('clients', 'view', 'Ver Clientes', 'Visualizar información de clientes'),
  ('clients', 'create', 'Crear Clientes', 'Crear nuevos clientes'),
  ('clients', 'edit', 'Editar Clientes', 'Modificar información de clientes'),
  ('clients', 'delete', 'Eliminar Clientes', 'Eliminar clientes'),
  
  -- Ventas
  ('sales', 'view', 'Ver Ventas', 'Visualizar ventas'),
  ('sales', 'create', 'Crear Ventas', 'Crear nuevas ventas'),
  ('sales', 'edit', 'Editar Ventas', 'Modificar ventas'),
  ('sales', 'delete', 'Eliminar Ventas', 'Eliminar ventas'),
  
  -- Pagos
  ('payments', 'view', 'Ver Pagos', 'Visualizar pagos'),
  ('payments', 'create', 'Crear Pagos', 'Registrar pagos'),
  ('payments', 'edit', 'Editar Pagos', 'Modificar pagos'),
  ('payments', 'delete', 'Eliminar Pagos', 'Eliminar pagos'),
  
  -- Rutas
  ('routes', 'view', 'Ver Rutas', 'Visualizar rutas'),
  ('routes', 'create', 'Crear Rutas', 'Crear nuevas rutas'),
  ('routes', 'edit', 'Editar Rutas', 'Modificar rutas'),
  ('routes', 'delete', 'Eliminar Rutas', 'Eliminar rutas'),
  
  -- Cuentas por Cobrar
  ('accounts_receivable', 'view', 'Ver Cuentas por Cobrar', 'Visualizar cuentas por cobrar'),
  
  -- Reportes
  ('reports', 'view', 'Ver Reportes', 'Visualizar reportes'),
  ('reports', 'export', 'Exportar Reportes', 'Exportar reportes'),
  
  -- Alertas
  ('alerts', 'view', 'Ver Alertas', 'Visualizar alertas'),
  
  -- Variables
  ('variables', 'view', 'Ver Variables', 'Visualizar variables'),
  ('variables', 'edit', 'Editar Variables', 'Modificar variables'),
  
  -- Usuarios
  ('users', 'view', 'Ver Usuarios', 'Visualizar usuarios'),
  ('users', 'create', 'Crear Usuarios', 'Crear nuevos usuarios'),
  ('users', 'edit', 'Editar Usuarios', 'Modificar usuarios'),
  ('users', 'delete', 'Eliminar Usuarios', 'Eliminar usuarios'),
  
  -- Roles
  ('roles', 'view', 'Ver Roles', 'Visualizar roles'),
  ('roles', 'create', 'Crear Roles', 'Crear nuevos roles'),
  ('roles', 'edit', 'Editar Roles', 'Modificar roles'),
  ('roles', 'delete', 'Eliminar Roles', 'Eliminar roles')
ON CONFLICT (module, action) DO NOTHING;

-- Deshabilitar RLS temporalmente (desarrollo)
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;