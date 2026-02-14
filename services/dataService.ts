
import { supabase } from './supabase';
import { Merchant, Abono, Zone, User, Role } from '../types';

export const dataService = {
  getSystemSettings: async () => {
    const { data, error } = await supabase.from('system_settings').select('*').eq('id', 'global_config').single();
    if (error) return { logo_url: null, delegates_can_collect: false };
    return data;
  },

  updateSystemSettings: async (updates: { logo_url?: string | null, delegates_can_collect?: boolean }) => {
    const { error } = await supabase.from('system_settings').update({ ...updates, updated_at: new Date() }).eq('id', 'global_config');
    if (error) throw error;
  },

  getMerchantsPaginated: async (page: number, pageSize: number, search: string = '', user: User | null) => {
    if (!user) return { data: [], totalCount: 0 };
    const from = page * pageSize;
    const to = from + pageSize - 1;
    
    // Definimos la selección base. 
    // Si es delegado, usamos !inner para que el filtro de zona afecte al registro principal.
    let selectString = `*, zone_assignments(*, zones(name))`;
    if (user.role === 'DELEGATE') {
      selectString = `*, zone_assignments!inner(*, zones(name))`;
    }
    
    let query = supabase.from('merchants').select(selectString, { count: 'exact' });
    
    if (user.role === 'SECRETARY') query = query.eq('status', 'PAID');
    
    if (user.role === 'DELEGATE') {
      if (user.assigned_zones && user.assigned_zones.length > 0) {
        // Solo registros que pertenezcan a las zonas del delegado
        query = query.in('zone_assignments.zone_id', user.assigned_zones);
      } else {
        // Si no tiene zonas asignadas, no debe ver nada
        return { data: [], totalCount: 0 };
      }
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name_paterno.ilike.%${search}%,last_name_materno.ilike.%${search}%,giro.ilike.%${search}%`);
    }

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
    if (error) throw error;

    const formattedData = data.map(m => ({ 
      ...m, 
      profile_photo: m.profile_photo_url, 
      ine_photo: m.ine_photo_url, 
      assignments: m.zone_assignments || [],
      full_name: `${m.first_name} ${m.last_name_paterno} ${m.last_name_materno}`.trim()
    })) as unknown as Merchant[];

    return { data: formattedData, totalCount: count || 0 };
  },

  getAllMerchantsForExport: async () => {
    const { data, error } = await supabase
      .from('merchants')
      .select('*, zone_assignments(*, zones(name))')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data.map(m => ({
      ...m,
      full_name: `${m.first_name} ${m.last_name_paterno} ${m.last_name_materno}`.trim()
    }));
  },

  getMerchantById: async (id: string, user: User | null = null) => {
    let selectString = `*, zone_assignments(*, zones(name))`;
    if (user?.role === 'DELEGATE') {
      selectString = `*, zone_assignments!inner(*, zones(name))`;
    }
    
    let query = supabase.from('merchants').select(selectString).eq('id', id);
    
    if (user?.role === 'DELEGATE') {
      if (user.assigned_zones && user.assigned_zones.length > 0) {
        query = query.in('zone_assignments.zone_id', user.assigned_zones);
      } else {
        throw new Error("Acceso denegado: El delegado no tiene zonas asignadas.");
      }
    }

    const { data, error } = await query.single();
    if (error) throw new Error("Comerciante no encontrado o fuera de su jurisdicción.");
    
    return { 
      ...data, 
      profile_photo: data.profile_photo_url, 
      ine_photo: data.ine_photo_url, 
      assignments: data.zone_assignments || [],
      full_name: `${data.first_name} ${data.last_name_paterno} ${data.last_name_materno}`.trim()
    } as unknown as Merchant;
  },

  getMerchantAbonos: async (merchantId: string) => {
    const { data, error } = await supabase.from('abonos').select('*').eq('merchant_id', merchantId).order('date', { ascending: false });
    if (error) throw error;
    return data as Abono[];
  },

  getAbonos: async (limit: number = 5) => {
    const { data, error } = await supabase.from('abonos').select('*').order('date', { ascending: false }).limit(limit);
    if (error) throw error;
    return data as Abono[];
  },

  getDashboardStats: async () => {
    const { data, error } = await supabase.rpc('get_dashboard_stats');
    if (error) throw error;
    return data;
  },

  getZones: async () => {
    const { data, error } = await supabase.from('zones').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data as Zone[];
  },

  createZone: async (zone: Omit<Zone, 'id'>) => {
    const { data, error } = await supabase.from('zones').insert(zone).select().single();
    if (error) throw error;
    return data as Zone;
  },

  updateZone: async (id: string, zone: Partial<Zone>) => {
    const { data, error } = await supabase.from('zones').update(zone).eq('id', id).select().single();
    if (error) throw error;
    return data as Zone;
  },

  deleteZone: async (id: string) => {
    const { error } = await supabase.from('zones').delete().eq('id', id);
    if (error) throw error;
  },

  getStaffProfiles: async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });
    if (error) throw error;
    return data.map(p => ({ id: p.id, name: p.full_name, email: p.email, role: p.role, assigned_zones: p.assigned_zones || [] }));
  },

  updateProfile: async (id: string, updates: any) => {
    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (error) throw error;
  },

  deleteProfile: async (id: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
  },

  deleteMerchant: async (id: string) => {
    const { error } = await supabase.from('merchants').delete().eq('id', id);
    if (error) throw error;
  },

  getSnapshotData: async () => {
    const [merchants, zones, abonos, assignments] = await Promise.all([
      supabase.from('merchants').select('*'),
      supabase.from('zones').select('*'),
      supabase.from('abonos').select('*'),
      supabase.from('zone_assignments').select('*')
    ]);
    if (merchants.error || zones.error || abonos.error || assignments.error) throw new Error("Error en backup");
    return {
      version: "3.0",
      timestamp: new Date().toISOString(),
      data: { merchants: merchants.data, zones: zones.data, abonos: abonos.data, zone_assignments: assignments.data }
    };
  },

  restoreSnapshot: async (snapshot: any) => {
    const { merchants, zones, abonos, zone_assignments } = snapshot.data;
    if (zones?.length > 0) await supabase.from('zones').upsert(zones);
    if (merchants?.length > 0) await supabase.from('merchants').upsert(merchants);
    if (zone_assignments?.length > 0) await supabase.from('zone_assignments').upsert(zone_assignments);
    if (abonos?.length > 0) await supabase.from('abonos').upsert(abonos);
    return true;
  },

  sendAdminPasswordReset: async (email: string) => {
    const { data: profile, error } = await supabase.from('profiles').select('role').eq('email', email).single();
    if (error || profile.role !== 'ADMIN') throw new Error("Acceso denegado.");
    await supabase.auth.resetPasswordForEmail(email);
    return true;
  },

  batchUpdateMerchantsLogistics: async (ids: string[], received: boolean) => {
    const { data: current } = await supabase.from('merchants').select('id, delivery_count').in('id', ids);
    const updates = current?.map(m => ({
      id: m.id,
      admin_received: received,
      admin_received_at: received ? new Date().toISOString() : null,
      delivery_count: received ? (Number(m.delivery_count || 0) + 1) : m.delivery_count
    }));
    if (updates) for (const u of updates) await supabase.from('merchants').update(u).eq('id', u.id);
  },

  getCurrentUser: async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    return {
      id: user.id,
      email: user.email!,
      name: profile?.full_name || user.email!.split('@')[0],
      role: (profile?.role as Role) || 'DELEGATE',
      assigned_zones: Array.isArray(profile?.assigned_zones) ? profile.assigned_zones : []
    };
  }
};
