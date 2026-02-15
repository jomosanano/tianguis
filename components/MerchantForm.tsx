
import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Loader2, User as UserIcon, MapPin, ShieldCheck, ArrowUpRight, RotateCw } from 'lucide-react';
import { ImagePicker } from './ImagePicker';
import { supabase, uploadImage } from '../services/supabase';
import { dataService } from '../services/dataService';
import { Zone, ZoneAssignment, Merchant, User } from '../types';

interface MerchantFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Merchant | null;
}

const WORK_DAYS = ['Diario', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Fines de Semana'];

export const MerchantForm: React.FC<MerchantFormProps> = ({ onSuccess, onCancel, initialData }) => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [formData, setFormData] = useState({
    first_name: initialData?.first_name || '',
    last_name_paterno: initialData?.last_name_paterno || '',
    last_name_materno: initialData?.last_name_materno || '',
    giro: initialData?.giro || '',
    phone: initialData?.phone || '',
    profile_photo: initialData?.profile_photo || '',
    ine_photo: initialData?.ine_photo || '',
    note: initialData?.note || ''
  });

  const [assignments, setAssignments] = useState<ZoneAssignment[]>(initialData?.assignments || []);

  useEffect(() => {
    const init = async () => {
      const [zonesData, userData] = await Promise.all([dataService.getZones(), dataService.getCurrentUser()]);
      setCurrentUser(userData);
      if (userData?.role === 'DELEGATE') {
        const allowedIds = userData.assigned_zones || [];
        setZones(zonesData.filter(z => allowedIds.includes(z.id)));
      } else { setZones(zonesData); }
    };
    init();
  }, []);

  const addAssignment = () => {
    if (zones.length === 0) return;
    setAssignments([...assignments, { zone_id: zones[0].id, meters: 1, calculated_cost: 0, work_day: 'Diario' }]);
  };

  const removeAssignment = (index: number) => { setAssignments(assignments.filter((_, i) => i !== index)); };

  const updateAssignment = (index: number, field: keyof ZoneAssignment, value: any) => {
    const newAssignments = [...assignments];
    newAssignments[index] = { ...newAssignments[index], [field]: value };
    setAssignments(newAssignments);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus(null);
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión expirada.");

      const uploadIfNeeded = async (current: string) => {
        if (current && current.startsWith('data:image')) return await uploadImage(current, 'profiles');
        return current;
      };

      const [finalProfileUrl, finalIneUrl] = await Promise.all([
        uploadIfNeeded(formData.profile_photo),
        uploadIfNeeded(formData.ine_photo)
      ]);

      const payload: any = {
        first_name: formData.first_name.trim(),
        last_name_paterno: formData.last_name_paterno.trim(),
        last_name_materno: formData.last_name_materno.trim(),
        giro: formData.giro.trim(),
        phone: formData.phone.trim(),
        note: formData.note.trim(),
        profile_photo_url: finalProfileUrl || null,
        ine_photo_url: finalIneUrl || null,
        created_by: user.id
      };

      let merchantId = initialData?.id;

      if (initialData) {
        await supabase.from('merchants').update(payload).eq('id', initialData.id);
      } else {
        const { data: m } = await supabase.from('merchants').insert({ ...payload, created_at: new Date().toISOString() }).select().single();
        merchantId = m.id;
      }

      if (merchantId) {
        await supabase.from('zone_assignments').delete().eq('merchant_id', merchantId);
        if (assignments.length > 0) {
          const cleaned = assignments.map(a => ({ 
            merchant_id: merchantId, 
            zone_id: a.zone_id, 
            meters: a.meters || 1, 
            calculated_cost: a.calculated_cost || 0, 
            work_day: a.work_day || 'Diario' 
          }));
          await supabase.from('zone_assignments').insert(cleaned);
        }
      }

      onSuccess();
    } catch (err: any) { 
      setErrorStatus(err.message); 
      console.error(err);
    } finally { 
      setLoading(false); 
    }
  };

  const costoZonas = assignments.reduce((sum, a) => sum + (Number(a.calculated_cost) || 0), 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20 text-white">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black uppercase italic tracking-tighter">
            {initialData ? 'Editar' : 'Nuevo'} <span className="text-blue-500">Expediente</span>
          </h2>
        </div>
        <button type="button" onClick={onCancel} className="px-6 py-3 bg-slate-800 border-2 border-black rounded-2xl font-black uppercase text-xs neobrutalism-shadow active:scale-95 transition-all">Cancelar</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8 bg-slate-800 p-8 rounded-[2.5rem] border-4 border-black neobrutalism-shadow">
          <h3 className="text-xl font-black uppercase flex items-center gap-3 text-blue-400"><UserIcon /> Datos Personales</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input type="text" required placeholder="Nombres" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none focus:border-blue-500 text-white" />
            <input type="text" required placeholder="Ap. Paterno" value={formData.last_name_paterno} onChange={e => setFormData({ ...formData, last_name_paterno: e.target.value })} className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none focus:border-blue-500 text-white" />
            <input type="text" placeholder="Ap. Materno" value={formData.last_name_materno} onChange={e => setFormData({ ...formData, last_name_materno: e.target.value })} className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none focus:border-blue-500 text-white" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="text" required placeholder="Giro Comercial" value={formData.giro} onChange={e => setFormData({ ...formData, giro: e.target.value })} className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none focus:border-blue-500 text-white" />
            <input type="tel" placeholder="WhatsApp / Tel." value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none focus:border-blue-500 text-white" />
          </div>
          <textarea placeholder="Notas u observaciones del expediente..." value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none h-24 focus:border-blue-500 text-white" />
          <div className="grid grid-cols-2 gap-6">
            <ImagePicker label="Foto Perfil" onCapture={img => setFormData({...formData, profile_photo: img})} />
            <ImagePicker label="Identificación" onCapture={img => setFormData({...formData, ine_photo: img})} />
          </div>
        </div>

        <div className="lg:col-span-5 bg-slate-800 p-8 rounded-[2.5rem] border-4 border-black neobrutalism-shadow flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black uppercase text-blue-400 flex items-center gap-3"><MapPin /> Ubicación</h3>
            <button type="button" onClick={addAssignment} className="p-2 bg-blue-600 border-2 border-black rounded-xl neobrutalism-shadow active:scale-90 text-white"><Plus/></button>
          </div>
          <div className="flex-1 space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {assignments.map((a, i) => (
              <div key={i} className="p-4 bg-slate-900 border-2 border-black rounded-2xl relative group">
                <button type="button" onClick={() => removeAssignment(i)} className="absolute -top-2 -right-2 p-1.5 bg-rose-600 border-2 border-black rounded-lg text-white"><Trash2 size={12}/></button>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select value={a.zone_id} onChange={e => updateAssignment(i, 'zone_id', e.target.value)} className="w-full bg-slate-800 p-2 rounded-xl text-xs font-bold outline-none text-white">{zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
                  <input type="number" step="0.1" value={a.meters} onChange={e => updateAssignment(i, 'meters', parseFloat(e.target.value))} className="w-full bg-slate-800 p-2 rounded-xl text-xs font-bold outline-none text-white" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={a.work_day} onChange={e => updateAssignment(i, 'work_day', e.target.value)} className="w-full bg-slate-800 p-2 rounded-xl text-xs font-bold outline-none text-white">{WORK_DAYS.map(d => <option key={d} value={d}>{d}</option>)}</select>
                  <input type="number" value={a.calculated_cost} onChange={e => updateAssignment(i, 'calculated_cost', parseFloat(e.target.value))} className="w-full bg-slate-800 p-2 rounded-xl text-xs font-black text-blue-400 outline-none" placeholder="Costo" />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 pt-6 border-t-2 border-slate-700 space-y-4">
             {/* ÁREA DE TOTAL DEL CICLO / SINCRONIZACIÓN */}
             <div className="relative p-6 bg-slate-900 border-4 border-black rounded-[2rem] flex flex-col items-center gap-2 group hover:border-blue-500 transition-colors">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 border-2 border-black px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-lg">
                   Total del Ciclo
                </div>
                
                <div className="text-4xl font-black text-white italic tracking-tighter flex items-center gap-3 mt-2">
                  <ArrowUpRight className="text-emerald-500 w-8 h-8 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  ${costoZonas.toLocaleString()}
                </div>

                <div className="flex items-center gap-2 bg-black border border-slate-700 px-3 py-1 rounded-xl mt-2">
                   <RotateCw className="w-3 h-3 text-blue-500 animate-subtle-blink" />
                   <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Cálculo Sincronizado</span>
                </div>
             </div>

             <button type="submit" disabled={loading} className="w-full bg-blue-600 border-4 border-black p-5 rounded-2xl font-black text-lg text-white neobrutalism-shadow flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 transition-all">
               {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck />} 
               {initialData ? 'GUARDAR CAMBIOS' : 'REGISTRAR COMERCIANTE'}
             </button>
          </div>
        </div>
      </div>
    </form>
  );
};
