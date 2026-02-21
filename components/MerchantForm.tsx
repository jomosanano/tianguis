
import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Loader2, User as UserIcon, MapPin, ShieldCheck, ArrowUpRight, RotateCw, FileText, Download, Briefcase, Phone, StickyNote, QrCode, ShieldAlert, FileDown } from 'lucide-react';
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
  const [exporting, setExporting] = useState(false);
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
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const getValidationClass = (field: string, value: string, isRequired: boolean = false) => {
    const baseClass = "w-full bg-slate-900 border-2 rounded-xl p-4 font-bold outline-none text-white transition-colors duration-300";
    const isTouched = touched[field];
    
    if (isRequired && isTouched && !value.trim()) {
      return `${baseClass} border-rose-500/50 focus:border-rose-500`; // Soft invalid
    }
    
    if (value.trim().length > 0) {
      if (field === 'phone') {
        // Validación específica para teléfono (exactamente 10 dígitos)
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(value.trim())) {
          return isTouched ? `${baseClass} border-amber-500/50 focus:border-amber-500` : `${baseClass} border-black focus:border-blue-500`;
        }
      }
      return `${baseClass} border-emerald-500/50 focus:border-emerald-500`; // Soft valid
    }
    return `${baseClass} border-black focus:border-blue-500`; // Default
  };

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

  const handleExportPDF = () => {
    if (!initialData) return;
    
    setExporting(true);
    
    // Guardamos el título original de la pestaña
    const originalTitle = document.title;
    
    // El navegador usa document.title como el nombre del archivo PDF al guardar
    const fileName = `Ficha_${formData.first_name}_${formData.last_name_paterno}`.replace(/\s+/g, '_');
    document.title = fileName;

    // Pequeño retardo para asegurar que el DOM de la ficha se renderice
    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        console.error("Error al disparar impresión:", e);
      } finally {
        setExporting(false);
        // Restauramos el título original
        document.title = originalTitle;
      }
    }, 800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus(null);
    
    // Validación de teléfono antes de enviar
    if (formData.phone && !/^\d{10}$/.test(formData.phone.trim())) {
      setErrorStatus("El número de teléfono debe tener exactamente 10 dígitos.");
      setTouched(prev => ({ ...prev, phone: true }));
      return;
    }
    
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
    <div className="max-w-7xl mx-auto pb-20">
      {/* FORMULARIO DE UI WEB */}
      <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-500 text-white no-print">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter">
              {initialData ? 'Editar' : 'Nuevo'} <span className="text-blue-500">Expediente</span>
            </h2>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            {initialData && (
              <button 
                type="button" 
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex-1 sm:flex-none px-6 py-3 bg-slate-900 border-2 border-blue-500 text-blue-500 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-blue-500 hover:text-white transition-all disabled:opacity-50"
              >
                {exporting ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
                {exporting ? 'Generando PDF...' : 'Exportar Ficha'}
              </button>
            )}
            <button type="button" onClick={onCancel} className="flex-1 sm:flex-none px-6 py-3 bg-slate-800 border-2 border-black rounded-2xl font-black uppercase text-xs neobrutalism-shadow active:scale-95 transition-all">Cancelar</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-8 bg-slate-800 p-8 rounded-[2.5rem] border-4 border-black neobrutalism-shadow">
            <h3 className="text-xl font-black uppercase flex items-center gap-3 text-blue-400"><UserIcon /> Datos Personales</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input type="text" required placeholder="Nombres" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} onBlur={() => handleBlur('first_name')} className={getValidationClass('first_name', formData.first_name, true)} />
              <input type="text" required placeholder="Ap. Paterno" value={formData.last_name_paterno} onChange={e => setFormData({ ...formData, last_name_paterno: e.target.value })} onBlur={() => handleBlur('last_name_paterno')} className={getValidationClass('last_name_paterno', formData.last_name_paterno, true)} />
              <input type="text" placeholder="Ap. Materno" value={formData.last_name_materno} onChange={e => setFormData({ ...formData, last_name_materno: e.target.value })} onBlur={() => handleBlur('last_name_materno')} className={getValidationClass('last_name_materno', formData.last_name_materno, false)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="text" required placeholder="Giro Comercial" value={formData.giro} onChange={e => setFormData({ ...formData, giro: e.target.value })} onBlur={() => handleBlur('giro')} className={getValidationClass('giro', formData.giro, true)} />
              <div className="relative">
                <input type="tel" placeholder="WhatsApp / Tel. (10 dígitos)" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} onBlur={() => handleBlur('phone')} className={getValidationClass('phone', formData.phone, false)} />
                {touched.phone && formData.phone.length > 0 && formData.phone.length < 10 && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-500 uppercase">
                    {formData.phone.length}/10
                  </span>
                )}
              </div>
            </div>
            <textarea placeholder="Notas u observaciones del expediente..." value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} onBlur={() => handleBlur('note')} className={`${getValidationClass('note', formData.note, false)} h-24`} />
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
                    <input type="number" step="0.1" value={Number.isNaN(Number(a.meters)) ? '' : a.meters} onChange={e => updateAssignment(i, 'meters', e.target.value === '' ? '' : parseFloat(e.target.value))} className="w-full bg-slate-800 p-2 rounded-xl text-xs font-bold outline-none text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={a.work_day} onChange={e => updateAssignment(i, 'work_day', e.target.value)} className="w-full bg-slate-800 p-2 rounded-xl text-xs font-bold outline-none text-white">{WORK_DAYS.map(d => <option key={d} value={d}>{d}</option>)}</select>
                    <input type="number" value={Number.isNaN(Number(a.calculated_cost)) ? '' : a.calculated_cost} onChange={e => updateAssignment(i, 'calculated_cost', e.target.value === '' ? '' : parseFloat(e.target.value))} className="w-full bg-slate-800 p-2 rounded-xl text-xs font-black text-blue-400 outline-none" placeholder="Costo" />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-8 pt-6 border-t-2 border-slate-700 space-y-4">
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

               {errorStatus && (
                 <div className="bg-rose-500/10 border-2 border-rose-500 p-4 rounded-xl flex items-center gap-3 text-rose-400">
                   <ShieldAlert size={20} />
                   <p className="text-xs font-bold uppercase">{errorStatus}</p>
                 </div>
               )}

               <button type="submit" disabled={loading} className="w-full bg-blue-600 border-4 border-black p-5 rounded-2xl font-black text-lg text-white neobrutalism-shadow flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 transition-all">
                 {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck />} 
                 {initialData ? 'GUARDAR CAMBIOS' : 'REGISTRAR COMERCIANTE'}
               </button>
            </div>
          </div>
        </div>
      </form>

      {/* PLANTILLA DE FICHA TÉCNICA (MODO IMPRESIÓN/PDF) */}
      {initialData && (
        <div className="printable-ficha bg-white">
           {/* Contenedor con padding para simular márgenes de hoja */}
           <div className="p-12">
              <header className="flex justify-between items-center border-b-8 border-black pb-8 mb-10">
                 <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-black text-white flex items-center justify-center font-black text-5xl italic border-4 border-black neobrutalism-shadow">A</div>
                    <div>
                       <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">ATCEM</h1>
                       <h2 className="text-xl font-black uppercase tracking-[0.2em] text-slate-600">FICHA DE REGISTRO</h2>
                       <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Expediente Oficial de Comercio y Vía Pública</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400">Folio del Expediente</p>
                    <p className="text-2xl font-black italic">#{initialData.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-[10px] font-bold mt-1 uppercase italic bg-black text-white px-2 py-0.5 inline-block">Fecha: {new Date().toLocaleDateString()}</p>
                 </div>
              </header>

              <div className="grid grid-cols-12 gap-12 mb-12">
                 <div className="col-span-8 space-y-8">
                    <div>
                       <h3 className="text-[10px] font-black uppercase text-slate-400 border-b-2 border-slate-100 pb-1 mb-3 tracking-widest">Nombre Completo del Comerciante</h3>
                       <p className="text-4xl font-black uppercase leading-tight">{initialData.first_name} {initialData.last_name_paterno} {initialData.last_name_materno}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-10">
                       <div>
                          <h3 className="text-[10px] font-black uppercase text-slate-400 border-b-2 border-slate-100 pb-1 mb-3 tracking-widest">Giro Comercial</h3>
                          <p className="text-xl font-black uppercase flex items-center gap-3"><Briefcase size={20} className="text-slate-400"/> {initialData.giro}</p>
                       </div>
                       <div>
                          <h3 className="text-[10px] font-black uppercase text-slate-400 border-b-2 border-slate-100 pb-1 mb-3 tracking-widest">Teléfono / WhatsApp</h3>
                          <p className="text-xl font-black flex items-center gap-3"><Phone size={20} className="text-slate-400"/> {initialData.phone || 'NO REGISTRADO'}</p>
                       </div>
                    </div>

                    <div>
                       <h3 className="text-[10px] font-black uppercase text-slate-400 border-b-2 border-slate-100 pb-1 mb-3 tracking-widest">Observaciones y Notas</h3>
                       <div className="p-4 bg-slate-50 border-l-4 border-black italic font-bold text-slate-700 leading-relaxed">
                          "{initialData.note || 'El comerciante no presenta observaciones adicionales en su expediente digital.'}"
                       </div>
                    </div>
                 </div>

                 <div className="col-span-4 flex flex-col items-center">
                    <div className="w-56 h-56 border-8 border-black rounded-[2.5rem] overflow-hidden mb-4 neobrutalism-shadow">
                       <img 
                        src={initialData.profile_photo || `https://ui-avatars.com/api/?name=${initialData.first_name}`} 
                        className="w-full h-full object-cover" 
                        crossOrigin="anonymous"
                       />
                    </div>
                    <p className="text-[10px] font-black uppercase italic tracking-widest text-center">FOTOGRAFÍA DE CONTROL<br/>VIGENTE v2.5</p>
                 </div>
              </div>

              <div className="mb-12">
                 <div className="flex items-center gap-4 mb-6">
                    <h3 className="text-sm font-black uppercase text-white bg-black px-6 py-2 rounded-xl tracking-[0.3em]">ASIGNACIONES TERRITORIALES</h3>
                    <div className="flex-1 border-b-4 border-black border-dotted"></div>
                 </div>
                 <table className="w-full border-collapse">
                    <thead>
                       <tr className="bg-slate-100">
                          <th className="border-4 border-black p-4 text-left text-[11px] font-black uppercase tracking-widest">Zona de Operación</th>
                          <th className="border-4 border-black p-4 text-center text-[11px] font-black uppercase tracking-widest">Mts. Asignados</th>
                          <th className="border-4 border-black p-4 text-center text-[11px] font-black uppercase tracking-widest">Día de Trabajo</th>
                          <th className="border-4 border-black p-4 text-right text-[11px] font-black uppercase tracking-widest">Costo por Ciclo</th>
                       </tr>
                    </thead>
                    <tbody>
                       {initialData.assignments.map((a, i) => (
                         <tr key={i}>
                            <td className="border-4 border-black p-4 font-black text-sm uppercase italic">{(a as any).zones?.name || 'ZONA GENERAL'}</td>
                            <td className="border-4 border-black p-4 text-center font-black text-sm">{a.meters}m lineales</td>
                            <td className="border-4 border-black p-4 text-center font-bold text-sm uppercase">{a.work_day}</td>
                            <td className="border-4 border-black p-4 text-right font-black text-sm italic">${Number(a.calculated_cost).toLocaleString()}</td>
                         </tr>
                       ))}
                       <tr className="bg-slate-50">
                          <td colSpan={3} className="border-4 border-black p-4 text-right font-black uppercase text-sm tracking-widest">Monto Total a Liquidar:</td>
                          <td className="border-4 border-black p-4 text-right font-black text-2xl italic tracking-tighter">${costoZonas.toLocaleString()}</td>
                       </tr>
                    </tbody>
                 </table>
              </div>

              <div className="mb-12 page-break-avoid">
                 <h3 className="text-sm font-black uppercase text-white bg-black px-6 py-2 rounded-xl tracking-[0.3em] mb-6 inline-block">IDENTIFICACIÓN DIGITALIZADA</h3>
                 <div className="w-full h-[450px] border-8 border-dashed border-black rounded-[3.5rem] flex items-center justify-center p-6 bg-slate-50 overflow-hidden neobrutalism-shadow">
                    {initialData.ine_photo ? (
                      <img 
                        src={initialData.ine_photo} 
                        className="max-w-full max-h-full object-contain" 
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="text-center text-slate-300">
                         <ShieldAlert size={80} className="mx-auto mb-4 opacity-20" />
                         <p className="font-black uppercase text-lg tracking-widest italic">Documento No Digitalizado</p>
                      </div>
                    )}
                 </div>
              </div>

              <footer className="mt-20 pt-10 border-t-8 border-black flex justify-between items-end">
                 <div className="flex items-center gap-8">
                    <div className="p-2 border-4 border-black bg-white neobrutalism-shadow">
                       <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=ATCEM-ID-${initialData.id}`} 
                          className="w-28 h-28"
                          crossOrigin="anonymous"
                       />
                    </div>
                    <div className="max-w-[250px]">
                       <p className="text-[10px] font-black uppercase leading-tight italic mb-2 tracking-tight">
                          SISTEMA ATCEM CLOUD v2.5 / CORPORATIVO
                       </p>
                       <p className="text-[8px] font-bold text-slate-500 leading-relaxed uppercase">
                          Cualquier alteración física o digital invalidará este documento. La vigencia de este registro está sujeta al cumplimiento de los abonos correspondientes.
                       </p>
                    </div>
                 </div>
                 
                 <div className="flex gap-16">
                    <div className="text-center">
                       <div className="w-56 border-b-4 border-black mb-3"></div>
                       <p className="text-[11px] font-black uppercase italic tracking-widest">Firma del Titular</p>
                    </div>
                    <div className="text-center">
                       <div className="w-56 border-b-4 border-black mb-3"></div>
                       <p className="text-[11px] font-black uppercase italic tracking-widest">Coordinación ATCEM</p>
                    </div>
                 </div>
              </footer>
           </div>
        </div>
      )}
    </div>
  );
};
