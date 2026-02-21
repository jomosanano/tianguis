
import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, MapPin, Trash2, Loader2, Save, X, UserCheck, Key, Mail, ShieldCheck, AlertCircle, Edit2, Check, UserCircle, DollarSign } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { dataService } from '../services/dataService';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../services/supabase';
import { Zone, Role, User } from '../types';

export const StaffManagement: React.FC = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [newStaff, setNewStaff] = useState({ email: '', password: '', name: '', role: 'DELEGATE' as Role });
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profilesData, zonesData, userData] = await Promise.all([
        dataService.getStaffProfiles(),
        dataService.getZones(),
        dataService.getCurrentUser()
      ]);
      setStaff(profilesData);
      setZones(zonesData);
      setCurrentUser(userData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    console.log("Iniciando creación de cuenta para:", newStaff.email);
    
    try {
      /**
       * SOLUCIÓN AL PROBLEMA DE SESIÓN:
       * Creamos un cliente temporal específicamente para esta operación.
       * 'persistSession: false' evita que la nueva cuenta sobreescriba la sesión
       * del administrador en el LocalStorage.
       */
      const tempSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      const { data, error } = await tempSupabase.auth.signUp({
        email: newStaff.email,
        password: newStaff.password,
        options: {
          data: { 
            full_name: newStaff.name,
            role: newStaff.role,
            can_collect: newStaff.role !== 'DELEGATE' // Admins y Secretarias pueden cobrar por defecto
          }
        }
      });

      if (error) {
        console.error("Error de Supabase Auth:", error);
        throw error;
      }

      console.log("Respuesta de registro:", data);

      if (data.user) {
        alert("¡CUENTA CREADA EXITOSAMENTE!\n\nEl administrador mantiene su sesión activa. El nuevo perfil aparecerá en la lista en unos instantes.");
        
        setNewStaff({ email: '', password: '', name: '', role: 'DELEGATE' });
        setIsAdding(false);
        
        // Pausa táctica para que el trigger de Supabase termine su trabajo
        setTimeout(() => fetchData(), 1500);
      } else {
        alert("La cuenta parece haberse registrado pero no se devolvió información de usuario. Verifica la configuración de Auth en Supabase.");
      }
      
    } catch (err: any) {
      console.error("Excepción en handleCreateAccount:", err);
      alert("ERROR AL CREAR CUENTA: " + (err.message || "Error desconocido"));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!deleteConfirmId) return;
    setLoading(true);
    try {
      await dataService.deleteProfile(deleteConfirmId);
      setDeleteConfirmId(null);
      await fetchData();
    } catch (err) {
      alert("Error al eliminar perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async (id: string) => {
    if (!tempName.trim()) return;
    try {
      await dataService.updateProfile(id, { full_name: tempName });
      setEditingNameId(null);
      fetchData();
    } catch (err) {
      alert("Error al actualizar nombre");
    }
  };

  const handleUpdateRole = async (id: string, role: Role) => {
    if (id === currentUser?.id) {
      alert("No puedes cambiar tu propio rol.");
      return;
    }
    try {
      await dataService.updateProfile(id, { role });
      fetchData();
    } catch (err) {
      alert("Error al actualizar rol");
    }
  };

  const handleToggleZone = async (profile: any, zoneId: string) => {
    const currentZones = profile.assigned_zones || [];
    const newZones = currentZones.includes(zoneId)
      ? currentZones.filter((id: string) => id !== zoneId)
      : [...currentZones, zoneId];
    
    try {
      await dataService.updateProfile(profile.id, { assigned_zones: newZones });
      fetchData();
    } catch (err) {
      alert("Error al actualizar zonas");
    }
  };

  const handleToggleCollect = async (id: string, currentVal: boolean) => {
    try {
      await dataService.updateProfile(id, { can_collect: !currentVal });
      fetchData();
    } catch (err) {
      alert("Error al actualizar permiso de cobro");
    }
  };

  if (loading && !deleteConfirmId) return <div className="flex justify-center py-20"><Loader2 className="animate-spin w-10 h-10 text-blue-500" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-100 uppercase tracking-tighter">
            Gestión de <span className="text-blue-500">Personal</span>
          </h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Control de acceso y jurisdicciones territoriales</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="w-full sm:w-auto bg-blue-600 border-2 border-black p-4 rounded-2xl font-black flex items-center justify-center gap-2 neobrutalism-shadow active:scale-95 transition-all"
          >
            <UserPlus className="w-6 h-6" /> AGREGAR PERSONAL
          </button>
        )}
      </header>

      {isAdding && (
        <form onSubmit={handleCreateAccount} className="bg-slate-800 border-4 border-black p-8 rounded-[2.5rem] neobrutalism-shadow-lg animate-in zoom-in-95">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black uppercase italic flex items-center gap-3">
              <UserCircle className="w-6 h-6 text-blue-500" /> Registro de Personal
            </h3>
            <button type="button" onClick={() => setIsAdding(false)} className="p-2 bg-slate-700 rounded-xl hover:bg-rose-600 transition-colors"><X /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Nombre Completo</label>
              <input 
                type="text" required 
                value={newStaff.name} 
                onChange={e => setNewStaff({...newStaff, name: e.target.value})} 
                className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none focus:border-blue-500" 
                placeholder="Nombre del colaborador"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Email Institucional</label>
              <input 
                type="email" required 
                value={newStaff.email} 
                onChange={e => setNewStaff({...newStaff, email: e.target.value})} 
                className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none focus:border-blue-500" 
                placeholder="correo@atcem.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Contraseña Temporal</label>
              <input 
                type="password" required 
                value={newStaff.password} 
                onChange={e => setNewStaff({...newStaff, password: e.target.value})} 
                className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none focus:border-blue-500" 
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Cargo</label>
              <select 
                value={newStaff.role} 
                onChange={e => setNewStaff({...newStaff, role: e.target.value as Role})} 
                className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none focus:border-blue-500 appearance-none"
              >
                <option value="SECRETARY">SECRETARIA (Cobranza y Auditoría)</option>
                <option value="DELEGATE">DELEGADO (Vigilancia de Zona)</option>
                <option value="ADMIN">ADMINISTRADOR (Control Total)</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={createLoading} className="w-full bg-emerald-500 border-4 border-black p-5 rounded-2xl font-black text-xl neobrutalism-shadow active:scale-95 transition-all flex items-center justify-center gap-3">
            {createLoading ? (
              <>
                <Loader2 className="animate-spin w-6 h-6" /> PROCESANDO...
              </>
            ) : (
              <>
                <UserPlus className="w-6 h-6" /> CREAR CUENTA
              </>
            )}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {staff.map(member => (
          <div key={member.id} className="bg-slate-800 border-2 border-black p-6 rounded-[2.5rem] neobrutalism-shadow flex flex-col gap-6 group hover:border-blue-500 transition-colors relative">
            
            {member.id !== currentUser?.id && (
              <div className="absolute top-4 right-4 flex gap-2">
                <button 
                  onClick={() => { setEditingNameId(member.id); setTempName(member.name); }}
                  className="p-2 bg-blue-600 border-2 border-black rounded-xl hover:bg-blue-500 transition-colors shadow-sm"
                >
                  <Edit2 className="w-4 h-4 text-white" />
                </button>
                <button 
                  onClick={() => setDeleteConfirmId(member.id)}
                  className="p-2 bg-rose-600 border-2 border-black rounded-xl hover:bg-rose-500 transition-colors shadow-sm"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl border-2 border-black flex items-center justify-center font-black text-white ${
                member.role === 'ADMIN' ? 'bg-blue-600' : member.role === 'SECRETARY' ? 'bg-purple-600' : 'bg-orange-500'
              }`}>
                {member.name?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0 pr-16">
                {editingNameId === member.id ? (
                  <div className="flex gap-2">
                    <input 
                      autoFocus
                      className="bg-slate-900 border-2 border-blue-500 rounded-lg px-2 py-1 font-bold text-sm w-full outline-none"
                      value={tempName}
                      onChange={e => setTempName(e.target.value)}
                    />
                    <button onClick={() => handleSaveName(member.id)} className="bg-emerald-500 p-1 rounded-lg border border-black"><Check className="w-4 h-4"/></button>
                    <button onClick={() => setEditingNameId(null)} className="bg-slate-700 p-1 rounded-lg border border-black"><X className="w-4 h-4"/></button>
                  </div>
                ) : (
                  <h3 className="font-black text-xl truncate uppercase italic leading-tight">{member.name}</h3>
                )}
                <div className="flex items-center gap-1.5 mt-0.5 mb-1.5">
                  <Mail className="w-3 h-3 text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-400 truncate">{member.email || 'Sin correo'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`w-3 h-3 ${member.role === 'ADMIN' ? 'text-blue-400' : 'text-emerald-500'}`} />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{member.role}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {member.role === 'DELEGATE' && (
                <div className="p-4 bg-slate-900 border-2 border-black rounded-2xl flex items-center justify-between group/collect hover:border-emerald-500 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg border border-black ${member.can_collect ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white uppercase tracking-tight">Permiso de Cobro</p>
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                        {member.can_collect ? 'Habilitado para cobrar' : 'Solo lectura de datos'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleToggleCollect(member.id, member.can_collect)}
                    className={`w-12 h-6 rounded-full border-2 border-black p-0.5 transition-colors ${member.can_collect ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 bg-white border border-black rounded-full transition-transform ${member.can_collect ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              )}

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-2 tracking-widest">Cambiar Cargo</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ADMIN', 'SECRETARY', 'DELEGATE'] as Role[]).map(r => (
                    <button
                      key={r}
                      disabled={member.id === currentUser?.id}
                      onClick={() => handleUpdateRole(member.id, r)}
                      className={`py-2 px-1 rounded-xl border-2 border-black font-black text-[9px] uppercase transition-all ${
                        member.role === r ? 'bg-white text-black' : 'bg-slate-900 text-slate-500 hover:text-white'
                      } ${member.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {member.role === 'DELEGATE' && (
                <div className="pt-4 border-t-2 border-slate-700">
                  <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2 mb-2 tracking-widest">
                    <MapPin className="w-3 h-3 text-orange-500" /> Jurisdicción de Zonas
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {zones.map(zone => (
                      <button
                        key={zone.id}
                        onClick={() => handleToggleZone(member, zone.id)}
                        className={`px-3 py-1.5 rounded-lg border-2 border-black text-[9px] font-black uppercase transition-all active:scale-95 ${
                          member.assigned_zones.includes(zone.id) ? 'bg-orange-500 text-white neobrutalism-shadow' : 'bg-slate-900 text-slate-500'
                        }`}
                      >
                        {zone.name}
                      </button>
                    ))}
                  </div>
                  {member.assigned_zones.length === 0 && (
                    <p className="text-[8px] text-rose-400 mt-2 font-black uppercase italic">Sin zonas - El delegado no tendrá visibilidad de datos.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-slate-800 border-4 border-black p-10 rounded-[3rem] w-full max-w-md text-center neobrutalism-shadow-lg animate-in zoom-in-95">
            <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-6" />
            <h3 className="text-2xl font-black uppercase mb-4 tracking-tighter">¿Eliminar Colaborador?</h3>
            <p className="font-bold text-slate-400 text-sm mb-8 uppercase tracking-widest">Esta acción revocará el acceso inmediatamente del sistema.</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-700 border-2 border-black p-4 rounded-2xl font-black active:scale-95">CANCELAR</button>
              <button onClick={handleDeleteStaff} className="bg-rose-600 border-2 border-black p-4 rounded-2xl font-black text-white active:scale-95">ELIMINAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
