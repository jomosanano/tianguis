
export type Role = 'ADMIN' | 'SECRETARY' | 'DELEGATE';

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
  assigned_zones?: string[]; // UUIDs de zonas permitidas
}

export interface Zone {
  id: string;
  name: string;
  cost_per_meter: number;
}

export interface ZoneAssignment {
  zone_id: string;
  meters: number;
  calculated_cost: number;
  work_day: string;
  zones?: {
    name: string;
  };
}

export interface Abono {
  id: string;
  merchant_id: string;
  amount: number;
  date: string;
  recorded_by: string;
}

export interface Merchant {
  id: string;
  full_name: string;
  first_name: string;
  last_name_paterno: string;
  last_name_materno: string;
  giro: string;
  phone: string;
  profile_photo: string;
  ine_photo: string;
  total_debt: number;
  balance: number;
  carry_over_debt?: number; // Adeudo arrastrado de ciclos anteriores
  note?: string;
  status: 'PENDING' | 'PAID' | 'PARTIAL';
  assignments: ZoneAssignment[];
  created_at: string;
  admin_received?: boolean;
  admin_received_at?: string;
  delivery_count?: number; // Contador de veces que se ha enviado al admin
}
