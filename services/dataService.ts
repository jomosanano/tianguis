
import { supabase } from './supabase';
import { Merchant, Abono, Zone, User, Role } from '../types';

export const dataService = {
  // Configuración del sistema
  getSystemSettings: async () => {
    const { data, error } = await supabase.from('system_settings').select('*').eq('id', 'global_config').single();
    if (error) return { logo_url: null };
    return data;
  },

  updateSystemSettings: async (updates: { logo_url?: string }) => {
    const { error } = await supabase.from('system_settings').update({ ...updates, updated_at: new Date() }).eq('id', 'global_config');
    if (error) throw error;
  },

  // Búsqueda con filtros de ROL integrados
  getMerchantsPaginated: async (page: number, pageSize: number, search: string = '', user: User | null) => {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('merchants')
      .select(`
        *,
        zone_assignments!inner(
          *,
          zones(name)
        )
      `, { count: 'exact' });

    // REGLA SECRETARIA: Solo puede ver comerciantes liquidados (status = 'PAID')
    if (user?.role === 'SECRETARY') {
      query = query.eq('status', 'PAID');
    }

    // REGLA DELEGADO: Solo sus zonas
    if (user?.role === 'DELEGATE' && user.assigned_zones && user.assigned_zones.length > 0) {
      query = query.in('zone_assignments.zone_id', user.assigned_zones);
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name_paterno.ilike.%${search}%,giro.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    
    const formattedData = data.map(m => ({
      ...m,
      profile_photo: m.profile_photo_url,
      ine_photo: m.ine_photo_url,
      assignments: m.zone_assignments || []
    })) as unknown as Merchant[];

    return { data: formattedData, totalCount: count || 0 };
  },

  getStaffProfiles: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });
    if (error) throw error;
    return data.map(p => ({
      id: p.id,
      name: p.full_name,
      email: p.email,
      role: p.role,
      assigned_zones: p.assigned_zones || []
    }));
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

  getMerchantAbonos: async (merchantId: string) => {
    const { data, error } = await supabase
      .from('abonos')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data as Abono[];
  },

  getDashboardStats: async () => {
    const { data, error } = await supabase.rpc('get_dashboard_stats');
    if (error) throw error;
    return data;
  },

  getAbonos: async (limit: number = 5) => {
    const { data, error } = await supabase
      .from('abonos')
      .select('*')
      .order('date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as Abono[];
  },

  getZones: async () => {
    const { data, error } = await supabase
      .from('zones')
      .select('*')
      .order('name', { ascending: true });
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

  getCurrentUser: async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    return {
      id: user.id,
      email: user.email!,
      name: profile?.full_name || user.email!.split('@')[0],
      role: (profile?.role as Role) || 'DELEGATE',
      assigned_zones: profile?.assigned_zones || []
    };
  }
};
