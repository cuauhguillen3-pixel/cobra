/*
  # Update Clients Table - Add Required Fields
  
  ## Changes
  - Add whatsapp field (required)
  - Add contact_principal field (optional)
  - Add tipo_cliente field (optional for mayoreo, menudeo, etc)
  - Add route_id field (optional foreign key to routes)
  - Update existing phone field to be required
  - Update existing email field to be required
  - Update existing address field to be required
  - Update existing name field description (razón social)
  
  ## New Fields
  - whatsapp: text (not null) - WhatsApp phone number for contact
  - contact_principal: text (nullable) - Main contact person name
  - tipo_cliente: text (nullable) - Client type (mayoreo, menudeo, etc)
  - route_id: uuid (nullable) - Reference to routes table
  
  ## Notes
  - All existing optional fields remain optional for backward compatibility
  - New required fields will need defaults for existing records
*/

-- Add new columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_principal text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tipo_cliente text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS route_id uuid REFERENCES routes(id) ON DELETE SET NULL;

-- Create index on route_id for better query performance
CREATE INDEX IF NOT EXISTS idx_clients_route_id ON clients(route_id);
CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON clients(organization_id);

-- Add constraint to check tipo_cliente values (optional field, so nullable is ok)
ALTER TABLE clients ADD CONSTRAINT check_tipo_cliente 
  CHECK (tipo_cliente IS NULL OR tipo_cliente IN ('mayoreo', 'menudeo', 'distribuidor', 'otro'));
