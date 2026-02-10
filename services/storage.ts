
import { Merchant, User, Abono, Zone } from '../types';

const STORAGE_KEYS = {
  MERCHANTS: 'atcem_merchants',
  ABONOS: 'atcem_abonos',
  ZONES: 'atcem_zones',
  USER: 'atcem_current_user'
};

export const storage = {
  getMerchants: (): Merchant[] => {
    const data = localStorage.getItem(STORAGE_KEYS.MERCHANTS);
    return data ? JSON.parse(data) : [];
  },
  saveMerchants: (merchants: Merchant[]) => {
    localStorage.setItem(STORAGE_KEYS.MERCHANTS, JSON.stringify(merchants));
  },
  getAbonos: (): Abono[] => {
    const data = localStorage.getItem(STORAGE_KEYS.ABONOS);
    return data ? JSON.parse(data) : [];
  },
  saveAbonos: (abonos: Abono[]) => {
    localStorage.setItem(STORAGE_KEYS.ABONOS, JSON.stringify(abonos));
  },
  getZones: (): Zone[] => {
    const data = localStorage.getItem(STORAGE_KEYS.ZONES);
    return data ? JSON.parse(data) : [
      { id: 'z1', name: 'Centro Histórico', cost_per_meter: 150 },
      { id: 'z2', name: 'Mercado Norte', cost_per_meter: 80 },
      { id: 'z3', name: 'Tianguis Domingo', cost_per_meter: 120 }
    ];
  },
  getCurrentUser: (): User => {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : { id: 'u1', email: 'admin@atcem.com', role: 'ADMIN', name: 'Admin Principal' };
  }
};
