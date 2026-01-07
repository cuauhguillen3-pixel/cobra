export interface Client {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  contact_principal?: string;
  tipo_cliente?: 'mayoreo' | 'menudeo' | 'distribuidor' | 'otro';
  route_id?: string;
  document_number?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  synced?: boolean;
  pending_sync?: boolean;
}

export interface Route {
  id: string;
  nombre_ruta: string;
  descripcion: string;
  zona_region: string;
}
