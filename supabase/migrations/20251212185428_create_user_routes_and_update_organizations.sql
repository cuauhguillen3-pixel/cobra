/*
  # Asignación de Rutas a Usuarios y Límite de Usuarios por Organización

  ## 1. Nueva Tabla: user_routes
    - Relaciona usuarios con rutas asignadas
    - Un usuario puede tener acceso a múltiples rutas
    - Solo podrá ver clientes de esas rutas
    - Campos:
      - user_id (uuid, foreign key)
      - route_id (uuid, foreign key)
      - assigned_at (timestamptz)
      - assigned_by (uuid, foreign key)
      - primary key compuesta (user_id, route_id)
  
  ## 2. Actualizar Tabla: organizations
    - Agregar campos para control de usuarios
    - Campos nuevos:
      - max_users (integer) - Límite de usuarios (default 5)
      - extra_users_paid (integer) - Usuarios extra pagados (default 0)
  
  ## 3. Seguridad
    - RLS deshabilitado temporalmente para desarrollo
*/

-- Crear tabla de asignación de rutas a usuarios
CREATE TABLE IF NOT EXISTS user_routes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (user_id, route_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_user_routes_user ON user_routes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_routes_route ON user_routes(route_id);

-- Agregar columnas a organizations si no existen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'max_users'
  ) THEN
    ALTER TABLE organizations ADD COLUMN max_users integer DEFAULT 5 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'extra_users_paid'
  ) THEN
    ALTER TABLE organizations ADD COLUMN extra_users_paid integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Deshabilitar RLS temporalmente (desarrollo)
ALTER TABLE user_routes DISABLE ROW LEVEL SECURITY;