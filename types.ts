
export type Role = 'ADMIN' | 'SECRETARY' | 'DELEGATE';

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
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
  phone: string;
  profile_photo: string; // Base64 compressed
  ine_photo: string;     // Base64 compressed
  total_debt: number;
  balance: number;
  status: 'PENDING' | 'PAID' | 'PARTIAL';
  assignments: ZoneAssignment[];
  created_at: string;
}

export interface AppConfig {
  company_name: string;
  currency: string;
}
