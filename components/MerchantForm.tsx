
import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Loader2, User as UserIcon, MapPin, AlertCircle, History, ShieldCheck, StickyNote, ArrowUpRight } from 'lucide-react';
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

      const costoNuevasZonas = assignments.reduce((sum, a) => sum + (Number(a.calculated_cost) || 0), 0);
      const balanceActualAlMomento = Number(initialData?.balance || 0);
      
      // SALDO OBJETIVO (Ej: $3500 + $200 = $3700)
      const saldoObjetivo = costoNuevasZonas + balanceActualAlMomento;

      let merchantId = initialData?.id;
      const now = new Date().toISOString();

      // PASO 0: SI ES RENOVACIÓN, ARCHIVAR ABONOS VIEJOS PARA QUE NO DESCUENTEN DEL NUEVO SALDO
      if (initialData) {
        const { error: archiveError } = await supabase
          .from('abonos')
          .update({ archived: true })
          .eq('merchant_id', initialData.id);
        
        if (archiveError) console.warn("Aviso: No se pudieron archivar abonos (posiblemente la columna no existe aún)");
      }

      // PASO 1: DATOS BÁSICOS Y RESET DE CICLO
      const basicPayload: any = {
        first_name: formData.first_name.trim(),
        last_name_paterno: formData.last_name_paterno.trim(),
        last_name_materno: formData.last_name_materno.trim(),
        giro: formData.giro.trim(),
        phone: formData.phone.trim(),
        note: formData.note.trim(),
        profile_photo_url: finalProfileUrl || null,
        ine_photo_url: finalIneUrl || null,
        carry_over_debt: balanceActualAlMomento,
        created_by: user.id,
        created_at: now,
        total_debt: saldoObjetivo, // Seteamos la deuda total inicial
        balance: saldoObjetivo      // Forzamos el balance inicial igual a la deuda (porque archivamos los abonos)
      };

      if (initialData) {
        await supabase.from('merchants').update(basicPayload).eq('id', initialData.id);
      } else {
        const { data: m, error: mError } = await supabase.from('merchants').insert(basicPayload).select().single();
        if (mError) throw mError;
        merchantId = m.id;
      }

      // PASO 2: ASIGNAR ZONAS
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

      // PASO 3: RE-CONFIRMACIÓN DE SALDO (GOLPE DE GRACIA)
      // Actualizamos una última vez el balance para asegurar que los triggers no lo movieran
      await supabase
        .from('merchants')
        .update({ balance: saldoObjetivo, total_debt: saldoObjetivo })
        .eq('id', merchantId);

      onSuccess();
    } catch (err: any) { 
      setErrorStatus(err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const costoZonas = assignments.reduce((sum, a) => sum + (Number(a.calculated_cost) || 0), 0);
  const arrastre = Number(initialData?.balance || 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">
            {initialData ? 'Renovación de' : 'Nuevo'} <span className="text-blue-500">Expediente</span>
          </h2>
        </div>
        <button type="button" onClick={onCancel} className="px-6 py-3 bg-slate-800 border-2 border-black rounded-2xl font-black uppercase text-xs neobrutalism-shadow active:scale-95 transition-all">Cancelar</button>
      </div>

      {arrastre > 0 && (
        <div className="p-6 bg-amber-600/20 border-2 border-amber-500 rounded-[2.5rem] flex items-center gap-6 animate-in zoom-in-95">
          <div className="bg-amber-500 p-4 rounded-2xl border-2 border-black neobrutalism-shadow">
            <History className="w-8 h-8 text-white" />
          </div>
          <div>
            <h4 className="font-black text-amber-500 uppercase italic">Adeudo Pasado Detectado</h4>
            <p className="text-xs font-bold text-slate-400 uppercase leading-relaxed">
              El saldo pendiente de <span className="text-amber-500 font-black">${arrastre.toLocaleString()}</span> se sumará al nuevo expediente. El sistema limpiará pagos anteriores para este ciclo.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8 bg-slate-800 p-8 rounded-[2.5rem] border-4 border-black neobrutalism-shadow">
          <h3 className="text-xl font-black uppercase flex items-center gap-3 text-blue-400"><UserIcon /> Datos Generales</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input type="text" required placeholder="Nombres" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none focus:border-blue-500" />
            <input type="text" required placeholder="Ap. Paterno" value={formData.last_name_paterno} onChange={e => setFormData({ ...formData, last_name_paterno: e.target.value })} className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none focus:border-blue-500" />
            <input type="text" placeholder="Ap. Materno" value={formData.last_name_materno} onChange={e => setFormData({ ...formData, last_name_materno: e.target.value })} className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="text" required placeholder="Giro" value={formData.giro} onChange={e => setFormData({ ...formData, giro: e.target.value })} className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none focus:border-blue-500" />
            <input type="tel" placeholder="WhatsApp" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none focus:border-blue-500" />
          </div>
          <textarea placeholder="Notas u observaciones..." value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-bold outline-none h-24 focus:border-blue-500" />
          <div className="grid grid-cols-2 gap-6">
            <ImagePicker label="Foto Rostro" onCapture={img => setFormData({...formData, profile_photo: img})} />
            <ImagePicker label="INE" onCapture={img => setFormData({...formData, ine_photo: img})} />
          </div>
        </div>

        <div className="lg:col-span-5 bg-slate-800 p-8 rounded-[2.5rem] border-4 border-black neobrutalism-shadow flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black uppercase text-blue-400 flex items-center gap-3"><MapPin /> Zonas</h3>
            <button type="button" onClick={addAssignment} className="p-2 bg-blue-600 border-2 border-black rounded-xl neobrutalism-shadow active:scale-90"><Plus/></button>
          </div>
          <div className="flex-1 space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {assignments.map((a, i) => (
              <div key={i} className="p-4 bg-slate-900 border-2 border-black rounded-2xl relative group">
                <button type="button" onClick={() => removeAssignment(i)} className="absolute -top-2 -right-2 p-1.5 bg-rose-600 border-2 border-black rounded-lg group-hover:scale-110 transition-transform"><Trash2 size={12}/></button>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select value={a.zone_id} onChange={e => updateAssignment(i, 'zone_id', e.target.value)} className="w-full bg-slate-800 p-2 rounded-xl text-xs font-bold outline-none">{zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
                  <input type="number" step="0.1" value={a.meters} onChange={e => updateAssignment(i, 'meters', parseFloat(e.target.value))} className="w-full bg-slate-800 p-2 rounded-xl text-xs font-bold outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={a.work_day} onChange={e => updateAssignment(i, 'work_day', e.target.value)} className="w-full bg-slate-800 p-2 rounded-xl text-xs font-bold outline-none">{WORK_DAYS.map(d => <option key={d} value={d}>{d}</option>)}</select>
                  <input type="number" value={a.calculated_cost} onChange={e => updateAssignment(i, 'calculated_cost', parseFloat(e.target.value))} className="w-full bg-slate-800 p-2 rounded-xl text-xs font-black text-blue-400 outline-none" placeholder="Costo" />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 pt-6 border-t-2 border-slate-700 space-y-4">
             <div className="flex justify-between font-bold text-slate-400 text-xs"><span>Nuevas Zonas:</span><span className="text-white">${costoZonas.toLocaleString()}</span></div>
             <div className="flex justify-between font-bold text-amber-500 text-xs"><span>Adeudo Pasado:</span><span className="italic">+${arrastre.toLocaleString()}</span></div>
             
             <div className="relative text-3xl font-black text-white italic text-center py-5 bg-slate-900 border-4 border-black rounded-2xl flex flex-col items-center">
                <span className="text-[10px] text-blue-400 font-black not-italic uppercase tracking-[0.3em] mb-1 text-center">Impacto Financiero Blindado</span>
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="text-emerald-500 w-6 h-6" />
                  ${(costoZonas + arrastre).toLocaleString()}
                </div>
             </div>

             <button type="submit" disabled={loading} className="w-full bg-blue-600 border-4 border-black p-5 rounded-2xl font-black text-lg neobrutalism-shadow flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 transition-all">
               {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck />} 
               {initialData ? 'COMPLETAR RENOVACIÓN' : 'REGISTRAR'}
             </button>
          </div>
        </div>
      </div>
    </form>
  );
};
