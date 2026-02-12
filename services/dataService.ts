
import { supabase } from './supabase';
import { Merchant, Abono, Zone, User, Role } from '../types';

export const dataService = {
  // Configuración del sistema
  getSystemSettings: async () => {
    const { data, error } = await supabase.from('system_settings').select('*').eq('id', 'global_config').single();
    if (error) return { logo_url: null, delegates_can_collect: false };
    return data;
  },

  updateSystemSettings: async (updates: { logo_url?: string | null, delegates_can_collect?: boolean }) => {
    const { error } = await supabase.from('system_settings').update({ ...updates, updated_at: new Date() }).eq('id', 'global_config');
    if (error) throw error;
  },

  // --- SISTEMA DE SNAPSHOT DE SEGURIDAD (BACKUP JSON) ---
  
  /**
   * Genera un objeto completo con todas las tablas del sistema
   */
  getSnapshotData: async () => {
    const [merchants, zones, abonos, assignments] = await Promise.all([
      supabase.from('merchants').select('*'),
      supabase.from('zones').select('*'),
      supabase.from('abonos').select('*'),
      supabase.from('zone_assignments').select('*')
    ]);

    if (merchants.error) throw merchants.error;
    if (zones.error) throw zones.error;
    if (abonos.error) throw abonos.error;
    if (assignments.error) throw assignments.error;

    return {
      version: "2.5",
      timestamp: new Date().toISOString(),
      backup_id: Math.random().toString(36).substring(2, 15).toUpperCase(),
      data: {
        merchants: merchants.data,
        zones: zones.data,
        abonos: abonos.data,
        zone_assignments: assignments.data
      }
    };
  },

  /**
   * Restaura datos desde un objeto JSON mediante UPSERT
   */
  restoreSnapshot: async (snapshot: any) => {
    if (!snapshot.data || !snapshot.version) {
      throw new Error("El archivo no tiene un formato de Snapshot ATCEM válido.");
    }

    const { merchants, zones, abonos, zone_assignments } = snapshot.data;

    // 1. Restaurar Zonas primero (Requerido para llaves foráneas)
    if (zones?.length > 0) {
      const { error } = await supabase.from('zones').upsert(zones);
      if (error) throw new Error("Error en zonas: " + error.message);
    }

    // 2. Restaurar Comerciantes
    if (merchants?.length > 0) {
      const { error } = await supabase.from('merchants').upsert(merchants);
      if (error) throw new Error("Error en comerciantes: " + error.message);
    }

    // 3. Restaurar Asignaciones de Zona
    if (zone_assignments?.length > 0) {
      const { error } = await supabase.from('zone_assignments').upsert(zone_assignments);
      if (error) throw new Error("Error en asignaciones: " + error.message);
    }

    // 4. Restaurar Abonos
    if (abonos?.length > 0) {
      const { error } = await supabase.from('abonos').upsert(abonos);
      if (error) throw new Error("Error en abonos: " + error.message);
    }

    return true;
  },

  // Recuperación exclusiva para Administrador
  sendAdminPasswordReset: async (email: string) => {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      throw new Error("Usuario no encontrado.");
    }

    if (profile.role !== 'ADMIN') {
      throw new Error("Acceso denegado. Solo el administrador puede recuperar su contraseña por este medio.");
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (resetError) throw resetError;
    return true;
  },

  // Logística masiva
  batchUpdateMerchantsLogistics: async (ids: string[], received: boolean) => {
    const { data: currentMerchants } = await supabase.from('merchants').select('id, delivery_count').in('id', ids);
    
    const updates = currentMerchants?.map(m => ({
      id: m.id,
      admin_received: received,
      admin_received_at: received ? new Date().toISOString() : null,
      delivery_count: received ? (Number(m.delivery_count || 0) + 1) : m.delivery_count
    }));

    if (updates && updates.length > 0) {
      for (const update of updates) {
        await supabase.from('merchants').update(update).eq('id', update.id);
      }
    }
  },

  getMerchantById: async (id: string) => {
    const { data, error } = await supabase
      .from('merchants')
      .select(`
        *,
        zone_assignments(
          *,
          zones(name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    
    return {
      ...data,
      profile_photo: data.profile_photo_url,
      ine_photo: data.ine_photo_url,
      assignments: data.zone_assignments || []
    } as unknown as Merchant;
  },

  // Obtener todos los comerciantes para exportación
  getAllMerchantsForExport: async () => {
    const { data, error } = await supabase
      .from('merchants')
      .select(`
        *,
        zone_assignments(
          *,
          zones(name)
        )
      `)
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Búsqueda con filtros de ROL
  getMerchantsPaginated: async (page: number, pageSize: number, search: string = '', user: User | null) => {
    if (!user) return { data: [], totalCount: 0 };

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

    if (user.role === 'SECRETARY') {
      query = query.eq('status', 'PAID');
    }

    if (user.role === 'DELEGATE') {
      if (user.assigned_zones && user.assigned_zones.length > 0) {
        query = query.in('zone_assignments.zone_id', user.assigned_zones);
      } else {
        query = query.eq('id', '00000000-0000-0000-0000-000000000000');
      }
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
      assigned_zones: Array.isArray(profile?.assigned_zones) ? profile.assigned_zones : []
    };
  }
};
