/*
  # Create Routes Table

  ## Overview
  This migration creates the routes management system for collection agencies.
  Routes allow agencies to organize their collection activities geographically and temporally.

  ## 1. New Tables
    - `routes`
      - `id` (uuid, primary key) - Auto-generated unique identifier
      - `organization_id` (uuid, FK) - Links route to specific organization (multi-tenant support)
      - `created_by` (uuid, FK) - Admin user who created the route
      - `nombre_ruta` (text, required) - Route name (e.g., "Ruta Norte Lunes")
      - `descripcion` (text, required) - Brief explanation of route coverage
      - `zona_region` (text, required) - Geographic zone (e.g., "Norte", "Centro", "Sur")
      - `frecuencia` (text, required) - Frequency: Diario/Semanal/Quincenal/Mensual
      - `dias_programados` (text[], required) - Scheduled days array
      - `hora_inicio_planeada` (time) - Planned start time
      - `hora_fin_planeada` (time, optional) - Planned end time
      - `cobrador_asignado` (uuid, FK) - Assigned collector (user reference)
      - `medio_transporte` (text, optional) - Transportation method
      - `prioridad_ruta` (text, required) - Priority: Alta/Media/Baja
      - `estado_ruta` (text, required) - Status: Activa/Inactiva/En prueba
      - `notas` (text, optional) - General observations
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  ## 2. Security
    - Enable RLS on `routes` table
    - Policies ensure users can only access routes from their organization
    - Separate policies for SELECT, INSERT, UPDATE, DELETE operations
    - Admin and superadmin roles have full access to their organization's routes
    - Collectors can view routes assigned to them

  ## 3. Indexes
    - Index on `organization_id` for fast multi-tenant queries
    - Index on `cobrador_asignado` for collector route lookups
    - Index on `estado_ruta` for filtering active routes
*/

-- Create routes table
CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  nombre_ruta text NOT NULL,
  descripcion text NOT NULL,
  zona_region text NOT NULL,
  frecuencia text NOT NULL DEFAULT 'Semanal',
  dias_programados text[] NOT NULL DEFAULT '{}',
  hora_inicio_planeada time,
  hora_fin_planeada time,
  cobrador_asignado uuid REFERENCES users(id) ON DELETE SET NULL,
  medio_transporte text,
  prioridad_ruta text NOT NULL DEFAULT 'Media',
  estado_ruta text NOT NULL DEFAULT 'Activa',
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_routes_organization_id ON routes(organization_id);
CREATE INDEX IF NOT EXISTS idx_routes_cobrador_asignado ON routes(cobrador_asignado);
CREATE INDEX IF NOT EXISTS idx_routes_estado_ruta ON routes(estado_ruta);
CREATE INDEX IF NOT EXISTS idx_routes_zona_region ON routes(zona_region);

-- Enable Row Level Security
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and superadmins can view routes from their organization
CREATE POLICY "Users can view routes from their organization"
  ON routes FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Admins and superadmins can create routes for their organization
CREATE POLICY "Admins can create routes for their organization"
  ON routes FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Policy: Admins and superadmins can update routes from their organization
CREATE POLICY "Admins can update routes from their organization"
  ON routes FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Policy: Admins and superadmins can delete routes from their organization
CREATE POLICY "Admins can delete routes from their organization"
  ON routes FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_routes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before updates
DROP TRIGGER IF EXISTS update_routes_updated_at_trigger ON routes;
CREATE TRIGGER update_routes_updated_at_trigger
  BEFORE UPDATE ON routes
  FOR EACH ROW
  EXECUTE FUNCTION update_routes_updated_at();
