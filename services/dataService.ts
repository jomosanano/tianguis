
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

  getMerchantsPaginated: async (page: number, pageSize: number, search: string = '', user: User | null, filter: string = 'ALL') => {
    if (!user) return { data: [], totalCount: 0 };
    const from = page * pageSize;
    const to = from + pageSize - 1;
    
    let selectString = `*, zone_assignments(*, zones(name))`;
    if (user.role === 'DELEGATE') {
      selectString = `*, zone_assignments!inner(*, zones(name))`;
    }
    
    let query = supabase.from('merchants').select(selectString, { count: 'exact' });
    
    if (user.role === 'SECRETARY') {
       query = query.eq('status', 'PAID');
    } else {
      if (filter === 'NO_PAYMENTS') {
        query = query.eq('status', 'PENDING');
      } else if (filter === 'IN_PROGRESS') {
        query = query.eq('status', 'PARTIAL');
      } else if (filter === 'LIQUIDATED') {
        query = query.eq('status', 'PAID');
      } else if (filter === 'NO_INE') {
        query = query.or('ine_photo_url.is.null,ine_photo_url.eq.""');
      } else if (filter === 'WITH_NOTE') {
        query = query.not('note', 'is', null).neq('note', '');
      }
    }
    
    if (user.role === 'DELEGATE') {
      if (user.assigned_zones && user.assigned_zones.length > 0) {
        query = query.in('zone_assignments.zone_id', user.assigned_zones);
      } else {
        return { data: [], totalCount: 0 };
      }
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name_paterno.ilike.%${search}%,giro.ilike.%${search}%`);
    }

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
    if (error) throw error;

    const formattedData = (data || []).map(m => ({ 
      ...m, 
      profile_photo: m.profile_photo_url || m.profile_photo, 
      ine_photo: m.ine_photo_url || m.ine_photo, 
      assignments: m.zone_assignments || [],
      full_name: `${m.first_name || ''} ${m.last_name_paterno || ''} ${m.last_name_materno || ''}`.trim()
    })) as unknown as Merchant[];

    return { data: formattedData, totalCount: count || 0 };
  },

  closeMerchantCycle: async (merchantId: string, newDebt: number) => {
    // 1. Archivar abonos actuales
    const { error: archiveError } = await supabase
      .from('abonos')
      .update({ archived: true })
      .eq('merchant_id', merchantId)
      .eq('archived', false);
    
    if (archiveError) throw archiveError;

    // 2. Actualizar deuda del comerciante (el trigger recalculará el balance)
    const { error: merchantError } = await supabase
      .from('merchants')
      .update({ 
        total_debt: newDebt,
        last_cycle_debt: newDebt // Opcional: podrías guardar la anterior antes de cambiarla
      })
      .eq('id', merchantId);

    if (merchantError) throw merchantError;
  },

  getMerchantsReadyForAdmin: async () => {
    const { data, error } = await supabase
      .from('merchants')
      .select('id, first_name, last_name_paterno, last_name_materno, giro')
      .eq('ready_for_admin', true)
      .eq('admin_received', false);
    if (error) throw error;
    return data || [];
  },

  getReceivedMerchants: async (limit: number = 5) => {
    const { data, error } = await supabase
      .from('merchants')
      .select('id, first_name, last_name_paterno, last_name_materno, giro, admin_received_at')
      .eq('admin_received', true)
      .order('admin_received_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  markAsReadyForAdmin: async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const { error } = await supabase
      .from('merchants')
      .update({ ready_for_admin: true, admin_received: false })
      .in('id', ids);
    if (error) throw error;
  },

  confirmAdminReceipt: async (ids: string[]) => {
    const { data: current, error: fetchError } = await supabase
      .from('merchants')
      .select('id, delivery_count')
      .in('id', ids);
    
    if (fetchError) throw fetchError;
    if (!current) return;

    for (const m of current) {
      await supabase.from('merchants').update({
        ready_for_admin: false,
        admin_received: true,
        admin_received_at: new Date().toISOString(),
        delivery_count: (Number(m.delivery_count || 0) + 1)
      }).eq('id', m.id);
    }
  },

  getAllMerchantsForExport: async () => {
    const { data, error } = await supabase
      .from('merchants')
      .select('*, zone_assignments(*, zones(name))')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(m => ({
      ...m,
      full_name: `${m.first_name || ''} ${m.last_name_paterno || ''} ${m.last_name_materno || ''}`.trim()
    }));
  },

  getMerchantById: async (id: string, user: User | null = null) => {
    let selectString = `*, zone_assignments(*, zones(name))`;
    if (user?.role === 'DELEGATE') selectString = `*, zone_assignments!inner(*, zones(name))`;
    
    let query = supabase.from('merchants').select(selectString).eq('id', id);
    if (user?.role === 'DELEGATE' && user.assigned_zones?.length) {
      query = query.in('zone_assignments.zone_id', user.assigned_zones);
    }

    const { data, error } = await query.single();
    if (error) throw new Error("Acceso denegado o no encontrado.");
    
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

  getAbonosByStaff: async (staffId: string) => {
    const { data, error } = await supabase
      .from('abonos')
      .select('*, merchants(first_name, last_name_paterno, last_name_materno)')
      .eq('recorded_by', staffId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data;
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
    return (data || []).map(p => ({ 
      id: p.id, 
      name: p.full_name, 
      email: p.email, 
      role: p.role, 
      assigned_zones: p.assigned_zones || [],
      can_collect: p.can_collect ?? false
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

  getCurrentUser: async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    return {
      id: user.id,
      email: user.email!,
      name: profile?.full_name || user.email!.split('@')[0],
      role: (profile?.role as Role) || 'DELEGATE',
      assigned_zones: Array.isArray(profile?.assigned_zones) ? profile.assigned_zones : [],
      can_collect: profile?.can_collect ?? false
    };
  }
};
