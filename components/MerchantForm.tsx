
import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Loader2, User as UserIcon, MapPin, AlertCircle, CheckCircle2, CalendarDays } from 'lucide-react';
import { ImagePicker } from './ImagePicker';
import { supabase, uploadImage } from '../services/supabase';
import { dataService } from '../services/dataService';
import { Zone, ZoneAssignment, Merchant, User } from '../types';

interface MerchantFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Merchant | null;
}

const WORK_DAYS = [
  'Diario',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
  'Fines de Semana'
];

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
    ine_photo: initialData?.ine_photo || ''
  });

  const [assignments, setAssignments] = useState<ZoneAssignment[]>(initialData?.assignments || []);

  useEffect(() => {
    const init = async () => {
      const [zonesData, userData] = await Promise.all([
        dataService.getZones(),
        dataService.getCurrentUser()
      ]);
      
      setCurrentUser(userData);
      
      // Filtrar zonas si es delegado
      if (userData?.role === 'DELEGATE') {
        const allowedIds = userData.assigned_zones || [];
        setZones(zonesData.filter(z => allowedIds.includes(z.id)));
      } else {
        setZones(zonesData);
      }
    };
    init();
  }, []);

  const addAssignment = () => {
    if (zones.length === 0) {
      alert("No tienes zonas asignadas para registrar.");
      return;
    }
    setAssignments([...assignments, { 
      zone_id: zones[0].id, 
      meters: 1, 
      calculated_cost: 0, 
      work_day: 'Diario' 
    }]);
  };

  const removeAssignment = (index: number) => {
    setAssignments(assignments.filter((_, i) => i !== index));
  };

  const updateAssignment = (index: number, field: keyof ZoneAssignment, value: any) => {
    const newAssignments = [...assignments];
    newAssignments[index] = { ...newAssignments[index], [field]: value };
    setAssignments(newAssignments);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus(null);

    if (!formData.first_name.trim() || !formData.last_name_paterno.trim() || !formData.giro.trim()) {
      setErrorStatus("Faltan campos obligatorios.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión expirada.");

      const uploadIfNeeded = async (current: string) => {
        if (current && current.startsWith('data:image')) {
          return await uploadImage(current, 'profiles');
        }
        return current;
      };

      const [finalProfileUrl, finalIneUrl] = await Promise.all([
        uploadIfNeeded(formData.profile_photo),
        uploadIfNeeded(formData.ine_photo)
      ]);

      const merchantPayload = {
        first_name: formData.first_name.trim(),
        last_name_paterno: formData.last_name_paterno.trim(),
        last_name_materno: formData.last_name_materno.trim(),
        giro: formData.giro.trim(),
        phone: formData.phone.trim(),
        profile_photo_url: finalProfileUrl || null,
        ine_photo_url: finalIneUrl || null,
        created_by: user.id
      };

      let merchantId = initialData?.id;

      if (initialData) {
        const { error: mError } = await supabase
          .from('merchants')
          .update(merchantPayload)
          .eq('id', initialData.id);
        if (mError) throw mError;
        await supabase.from('zone_assignments').delete().eq('merchant_id', initialData.id);
      } else {
        const { data: merchant, error: mError } = await supabase
          .from('merchants')
          .insert(merchantPayload)
          .select()
          .single();
        if (mError) throw mError;
        merchantId = merchant.id;
      }

      if (assignments.length > 0 && merchantId) {
        const cleanedAssignments = assignments.map(a => ({
          merchant_id: merchantId,
          zone_id: a.zone_id,
          meters: a.meters || 1,
          calculated_cost: a.calculated_cost || 0,
          work_day: a.work_day || 'Diario'
        }));
        await supabase.from('zone_assignments').insert(cleanedAssignments);
      }

      onSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorStatus(err.message || "Error al procesar registro.");
    } finally {
      setLoading(false);
    }
  };

  const totalCalculated = assignments.reduce((sum, a) => sum + (Number(a.calculated_cost) || 0), 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h2 className="text-4xl font-black text-slate-100 uppercase tracking-tighter">
             {initialData ? 'Editar' : 'Nuevo'} <span className="text-blue-500">Registro</span>
           </h2>
           <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Expediente de comerciante ATCEM</p>
        </div>
        <button type="button" onClick={onCancel} className="px-6 py-3 bg-slate-800 border-2 border-black rounded-2xl font-black uppercase text-xs tracking-widest neobrutalism-shadow active:scale-95">
          Volver
        </button>
      </div>

      {errorStatus && (
        <div className="p-4 bg-rose-500/10 border-2 border-rose-500 rounded-2xl flex items-center gap-3 text-rose-500 font-bold text-sm uppercase">
          <AlertCircle className="w-5 h-5" /> {errorStatus}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8 bg-slate-800 p-8 rounded-[2.5rem] border-2 border-black neobrutalism-shadow">
          <h3 className="text-xl font-black uppercase flex items-center gap-3 text-blue-400">
            <UserIcon className="w-5 h-5" /> Información Personal
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nombres</label>
              <input type="text" required value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-4 font-bold outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Ap. Paterno</label>
              <input type="text" required value={formData.last_name_paterno} onChange={e => setFormData({ ...formData, last_name_paterno: e.target.value })} className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-4 font-bold outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Ap. Materno</label>
              <input type="text" value={formData.last_name_materno} onChange={e => setFormData({ ...formData, last_name_materno: e.target.value })} className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-4 font-bold outline-none focus:border-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Giro Comercial</label>
              <input type="text" required value={formData.giro} onChange={e => setFormData({ ...formData, giro: e.target.value })} className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-4 font-bold outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Teléfono</label>
              <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-4 font-bold outline-none focus:border-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
            <ImagePicker label="Foto de Perfil" onCapture={img => setFormData({ ...formData, profile_photo: img })} />
            <ImagePicker label="Identificación (INE)" onCapture={img => setFormData({ ...formData, ine_photo: img })} />
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6 bg-slate-800 p-8 rounded-[2.5rem] border-2 border-black neobrutalism-shadow flex flex-col">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black uppercase flex items-center gap-3 text-blue-400">
              <MapPin className="w-5 h-5" /> Jurisdicción de Zonas
            </h3>
            <button type="button" onClick={addAssignment} className="p-2 bg-blue-600 border-2 border-black rounded-xl neobrutalism-shadow active:scale-90 transition-transform">
              <Plus className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="flex-1 space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
            {assignments.map((a, index) => (
              <div key={index} className="p-4 bg-slate-900 border-2 border-slate-700 rounded-2xl space-y-4 relative">
                <button type="button" onClick={() => removeAssignment(index)} className="absolute -top-2 -right-2 p-1.5 bg-rose-600 border-2 border-black rounded-lg z-10">
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </button>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase">Zona</span>
                    <select value={a.zone_id} onChange={e => updateAssignment(index, 'zone_id', e.target.value)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-2 text-xs font-bold text-white outline-none">
                      {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase">Metros</span>
                    <input type="number" step="0.1" value={a.meters} onChange={e => updateAssignment(index, 'meters', parseFloat(e.target.value))} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-2 text-xs font-bold text-white outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> Día
                    </span>
                    <select value={a.work_day} onChange={e => updateAssignment(index, 'work_day', e.target.value)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-2 text-xs font-bold text-white outline-none">
                      {WORK_DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase">Costo ($)</span>
                    <input type="number" step="10" value={a.calculated_cost} onChange={e => updateAssignment(index, 'calculated_cost', parseFloat(e.target.value))} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-2 text-sm font-black text-emerald-400 outline-none" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t-2 border-slate-700 mt-auto">
            <div className="bg-slate-900 p-6 rounded-2xl border-2 border-black mb-6">
              <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Impacto Financiero Inicial</span>
              <span className="text-4xl font-black text-emerald-500">${totalCalculated.toLocaleString()}</span>
            </div>
            <button type="submit" disabled={loading} className="w-full py-5 bg-blue-600 border-4 border-black rounded-2xl neobrutalism-shadow font-black text-lg text-white flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 transition-all">
              {loading ? <Loader2 className="animate-spin w-6 h-6" /> : <Save className="w-6 h-6" />} 
              {initialData ? 'ACTUALIZAR DATOS' : 'GUARDAR REGISTRO'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
