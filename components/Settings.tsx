
import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Loader2, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { ImagePicker } from './ImagePicker';
import { uploadImage } from '../services/supabase';
import { dataService } from '../services/dataService';

interface SettingsProps {
  onUpdateLogo: (url: string) => void;
  currentLogo?: string | null;
}

export const Settings: React.FC<SettingsProps> = ({ onUpdateLogo, currentLogo }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [newLogo, setNewLogo] = useState<string | null>(null);

  const handleSave = async () => {
    if (!newLogo) return;
    setLoading(true);
    try {
      const publicUrl = await uploadImage(newLogo, 'system');
      if (publicUrl) {
        await dataService.updateSystemSettings({ logo_url: publicUrl });
        onUpdateLogo(publicUrl);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      alert("Error al guardar logo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <header>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-100 leading-none tracking-tighter">
          Configuración <span className="text-blue-500">Global</span>
        </h2>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.3em] mt-2">Identidad Visual del Sistema</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-800 border-4 border-black p-8 rounded-[2.5rem] neobrutalism-shadow-lg flex flex-col gap-8">
          <div className="flex items-center gap-4">
             <div className="bg-blue-600 p-3 rounded-2xl border-2 border-black">
                <ImageIcon className="w-8 h-8 text-white" />
             </div>
             <div>
                <h3 className="text-xl font-black uppercase">Logo Institucional</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Este logo aparecerá en el sidebar y credenciales</p>
             </div>
          </div>

          <div className="max-w-xs mx-auto w-full">
            <ImagePicker label="Sube el nuevo logo" onCapture={img => setNewLogo(img)} />
          </div>

          <div className="mt-auto space-y-4">
            {success && (
              <div className="p-4 bg-emerald-500/10 border-2 border-emerald-500 rounded-2xl flex items-center gap-3 text-emerald-500 font-bold text-sm uppercase animate-in zoom-in-95">
                <CheckCircle2 className="w-5 h-5" /> Configuración actualizada con éxito
              </div>
            )}
            
            <button 
              disabled={loading || !newLogo}
              onClick={handleSave}
              className="w-full bg-blue-600 border-4 border-black p-5 rounded-2xl font-black text-xl neobrutalism-shadow hover:neobrutalism-shadow-active active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30"
            >
              {loading ? <Loader2 className="animate-spin w-6 h-6" /> : <Save className="w-6 h-6" />}
              GUARDAR CAMBIOS
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border-2 border-slate-800 p-8 rounded-[2.5rem] flex flex-col justify-center items-center text-center gap-6">
           <div className="w-32 h-32 bg-slate-800 border-2 border-black rounded-[2rem] flex items-center justify-center overflow-hidden neobrutalism-shadow">
              {currentLogo || newLogo ? (
                <img src={newLogo || currentLogo!} className="w-full h-full object-contain p-4" alt="Preview" />
              ) : (
                <span className="text-5xl font-black italic text-slate-500">A</span>
              )}
           </div>
           <div>
              <h4 className="font-black text-lg uppercase mb-1 tracking-tighter">Vista Previa Actual</h4>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] leading-relaxed">
                El logo será optimizado automáticamente para impresión de credenciales en alta resolución.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};
