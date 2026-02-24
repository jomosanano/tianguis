
import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, MapPin, Trash2, Loader2, Save, X, UserCheck, Key, Mail, ShieldCheck, AlertCircle, Edit2, Check, UserCircle, DollarSign, History, Download, FileText, Calendar } from 'lucide-react';
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

  const [historyStaff, setHistoryStaff] = useState<any | null>(null);
  const [historyAbonos, setHistoryAbonos] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
            role: newStaff.role 
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

  const handleToggleCollect = async (id: string, currentStatus: boolean) => {
    try {
      await dataService.updateProfile(id, { can_collect: !currentStatus });
      fetchData();
    } catch (err) {
      alert("Error al actualizar permiso de cobro");
    }
  };

  const openStaffHistory = async (member: any) => {
    setHistoryStaff(member);
    setHistoryLoading(true);
    setHistoryAbonos([]);
    try {
      const data = await dataService.getAbonosByStaff(member.id);
      setHistoryAbonos(data || []);
    } catch (err: any) {
      console.error(err);
      alert("Error al cargar historial: " + err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getMerchantName = (a: any) => {
    const m = a.merchants || a.merchant;
    if (!m) return 'ID: ' + (a.merchant_id?.slice(0, 8) || '---');
    if (Array.isArray(m)) {
      const first = m[0];
      if (!first) return 'ID: ' + (a.merchant_id?.slice(0, 8) || '---');
      return `${first.first_name || ''} ${first.last_name_paterno || ''}`.trim();
    }
    return `${m.first_name || ''} ${m.last_name_paterno || ''}`.trim();
  };

  const exportStaffHistory = () => {
    if (!historyStaff || historyAbonos.length === 0) return;
    
    const headers = ["Fecha", "Comerciante", "Monto", "ID Abono"];
    const rows = historyAbonos.map(a => [
      new Date(a.date).toLocaleString(),
      getMerchantName(a),
      `$${a.amount}`,
      a.id
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Cobros_${historyStaff.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-2 tracking-widest">Permisos Especiales</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleCollect(member.id, member.can_collect)}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 border-black font-black text-[10px] uppercase transition-all flex items-center justify-between ${
                      member.can_collect ? 'bg-emerald-500 text-white neobrutalism-shadow' : 'bg-slate-900 text-slate-500 hover:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <DollarSign className={`w-4 h-4 ${member.can_collect ? 'text-white' : 'text-slate-600'}`} />
                      <span>Permitir Cobros</span>
                    </div>
                    <div className={`w-10 h-5 rounded-full border-2 border-black relative transition-colors ${member.can_collect ? 'bg-white' : 'bg-slate-800'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full border border-black transition-all ${member.can_collect ? 'right-0.5 bg-emerald-500' : 'left-0.5 bg-slate-600'}`} />
                    </div>
                  </button>
                  <button
                    onClick={() => openStaffHistory(member)}
                    className="px-4 py-3 bg-slate-700 border-2 border-black rounded-xl text-white hover:bg-blue-600 transition-all active:scale-95 neobrutalism-shadow"
                    title="Ver Historial de Cobros"
                  >
                    <History className="w-5 h-5" />
                  </button>
                </div>
              </div>

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

      {/* MODAL DE HISTORIAL DE COBROS DEL PERSONAL */}
      {historyStaff && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-slate-800 border-4 border-black p-8 rounded-[3rem] w-full max-w-2xl text-white h-[80vh] flex flex-col neobrutalism-shadow-lg animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8">
               <div className="flex items-center gap-4">
                  <div className="bg-blue-600 w-12 h-12 rounded-xl border-2 border-black flex items-center justify-center shadow-lg">
                    <History className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none">Historial de Cobros</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{historyStaff.name}</p>
                  </div>
               </div>
               <div className="flex gap-2">
                 {historyAbonos.length > 0 && (
                   <button 
                     onClick={exportStaffHistory}
                     className="p-3 bg-emerald-600 border-2 border-black rounded-xl hover:bg-emerald-500 transition-all neobrutalism-shadow active:scale-90"
                     title="Exportar a CSV"
                   >
                     <Download size={20} />
                   </button>
                 )}
                 <button onClick={() => setHistoryStaff(null)} className="p-3 bg-slate-700 border-2 border-black rounded-xl hover:bg-rose-600 transition-all"><X /></button>
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-900 border-2 border-black p-5 rounded-2xl neobrutalism-shadow">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Recaudado</p>
                <p className="text-3xl font-black text-emerald-500 italic tracking-tighter">
                  ${historyAbonos.reduce((acc, curr) => acc + Number(curr.amount), 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-900 border-2 border-black p-5 rounded-2xl neobrutalism-shadow">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Operaciones</p>
                <p className="text-3xl font-black text-blue-400 italic tracking-tighter">{historyAbonos.length}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
               {historyLoading ? (
                 <div className="flex flex-col items-center justify-center py-20">
                   <Loader2 className="animate-spin text-blue-500 w-10 h-10 mb-4" />
                   <p className="text-xs font-black text-slate-500 uppercase animate-pulse">Cargando registros...</p>
                 </div>
               ) : historyAbonos.length === 0 ? (
                 <div className="text-center py-20 bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-3xl">
                   <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                   <p className="text-sm font-black text-slate-500 uppercase">No hay cobros registrados por este colaborador</p>
                 </div>
               ) : (
                 historyAbonos.map(a => (
                   <div key={a.id} className="flex justify-between items-center p-5 bg-slate-900 border-2 border-black rounded-2xl hover:border-blue-500 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                          <DollarSign size={18} />
                        </div>
                        <div>
                          <p className="font-black text-sm uppercase leading-none mb-1">
                            {getMerchantName(a)}
                          </p>
                          <div className="flex items-center gap-2 text-slate-500">
                             <Calendar size={10} />
                             <p className="text-[10px] font-bold uppercase tracking-wider">
                               {new Date(a.date).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                             </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-emerald-500 leading-none mb-1">+${Number(a.amount).toLocaleString()}</p>
                        <p className="text-[8px] font-black text-slate-600 uppercase">ID: {a.id.slice(0, 8)}</p>
                      </div>
                   </div>
                 ))
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
