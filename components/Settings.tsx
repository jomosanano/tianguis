
import React, { useState, useRef } from 'react';
import { Save, Loader2, Image as ImageIcon, CheckCircle2, DollarSign, FileSpreadsheet, ShieldCheck, Database, RefreshCw, FileJson } from 'lucide-react';
import { ImagePicker } from './ImagePicker';
import { uploadImage } from '../services/supabase';
import { dataService } from '../services/dataService';

interface SettingsProps {
  onUpdateLogo: (url: string) => void;
  currentLogo?: string | null;
  onUpdateCollectSetting: (val: boolean) => void;
  initialCollectSetting: boolean;
}

export const Settings: React.FC<SettingsProps> = ({ onUpdateLogo, currentLogo, onUpdateCollectSetting, initialCollectSetting }) => {
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [newLogo, setNewLogo] = useState<string | null>(null);
  const [delegatesCanCollect, setDelegatesCanCollect] = useState(initialCollectSetting);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setLoading(true);
    try {
      let finalLogoUrl = currentLogo;
      if (newLogo) {
        const publicUrl = await uploadImage(newLogo, 'system');
        if (publicUrl) {
          finalLogoUrl = publicUrl;
          onUpdateLogo(publicUrl);
        }
      }
      await dataService.updateSystemSettings({ 
        logo_url: finalLogoUrl || null,
        delegates_can_collect: delegatesCanCollect
      });
      onUpdateCollectSetting(delegatesCanCollect);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert("Error al guardar configuraciones");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSnapshot = async () => {
    setSnapshotLoading(true);
    try {
      const snapshot = await dataService.getSnapshotData();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ATCEM_BACKUP_${new Date().toISOString().split('T')[0]}.json`);
      link.click();
    } catch (err) {
      alert("Error al generar snapshot.");
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleRestoreClick = () => {
    if (window.confirm("¡ALERTA!\n¿Restaurar base de datos completa? Los datos actuales serán sobrescritos.")) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const snapshot = JSON.parse(event.target?.result as string);
          await dataService.restoreSnapshot(snapshot);
          alert("¡Restauración exitosa!");
          window.location.reload(); 
        } catch (err: any) { alert("Error: " + err.message); }
      };
      reader.readAsText(file);
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const merchants = await dataService.getAllMerchantsForExport();
      const headers = ["Folio", "Nombre", "Giro", "Telefono", "Deuda", "Saldo", "Estatus"];
      const rows = merchants.map(m => [m.id, m.full_name, m.giro, m.phone || 'N/A', m.total_debt, m.balance, m.status]);
      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Censo_ATCEM.csv`);
      link.click();
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <header>
        <h2 className="text-4xl font-black text-slate-100 uppercase tracking-tighter">Configuración <span className="text-blue-500">Global</span></h2>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-800 border-4 border-black p-8 rounded-[2.5rem] neobrutalism-shadow-lg flex flex-col gap-8">
          <div className="space-y-6 pb-6 border-b-2 border-slate-700">
            <h3 className="text-xl font-black uppercase flex items-center gap-3"><DollarSign className="text-emerald-500" /> Permisos de Cobro</h3>
            <div onClick={() => setDelegatesCanCollect(!delegatesCanCollect)} className="cursor-pointer flex items-center justify-between p-6 bg-slate-900 border-2 border-black rounded-[2rem]">
               <p className="font-bold text-sm text-slate-200">{delegatesCanCollect ? 'Delegados PUEDEN cobrar.' : 'Delegados RESTRINGIDOS.'}</p>
               <div className={`w-14 h-8 rounded-full border-2 border-black p-1 transition-colors ${delegatesCanCollect ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <div className={`w-5 h-5 bg-white border-2 border-black rounded-full transition-transform ${delegatesCanCollect ? 'translate-x-6' : 'translate-x-0'}`} />
               </div>
            </div>
          </div>
          <div className="space-y-6">
            <h3 className="text-xl font-black uppercase flex items-center gap-3"><ImageIcon className="text-blue-500" /> Logo Institucional</h3>
            <div className="max-w-[200px] mx-auto"><ImagePicker label="Identidad" onCapture={img => setNewLogo(img)} /></div>
          </div>
          <button onClick={handleSave} disabled={loading} className="w-full bg-blue-600 border-4 border-black p-5 rounded-2xl font-black text-xl neobrutalism-shadow active:scale-95 transition-all flex items-center justify-center gap-3">
            {loading ? <Loader2 className="animate-spin" /> : <Save />} GUARDAR CAMBIOS
          </button>
          {success && <div className="text-center text-emerald-500 font-black">¡GUARDADO!</div>}
        </div>

        <div className="space-y-8">
          <div className="bg-slate-800 border-4 border-black p-8 rounded-[2.5rem] neobrutalism-shadow-lg flex flex-col gap-6">
             <h3 className="text-xl font-black uppercase flex items-center gap-3"><Database className="text-rose-500" /> Backup del Sistema</h3>
             <div className="grid grid-cols-2 gap-4">
                <button onClick={handleGenerateSnapshot} disabled={snapshotLoading} className="bg-slate-900 border-2 border-black p-5 rounded-2xl flex flex-col items-center gap-2">
                  <FileJson className="text-blue-500" /> <span className="text-[10px] font-black uppercase">Snapshot</span>
                </button>
                <button onClick={handleRestoreClick} disabled={restoreLoading} className="bg-slate-900 border-2 border-black p-5 rounded-2xl flex flex-col items-center gap-2">
                  <RefreshCw className="text-emerald-500" /> <span className="text-[10px] font-black uppercase">Restaurar</span>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
                </button>
             </div>
          </div>
          <div className="bg-slate-800 border-4 border-black p-8 rounded-[2.5rem] neobrutalism-shadow-lg flex flex-col gap-6">
             <h3 className="text-xl font-black uppercase flex items-center gap-3"><ShieldCheck className="text-purple-500" /> Reporte de Auditoría</h3>
             <button onClick={handleExportCSV} disabled={exportLoading} className="w-full bg-emerald-500 border-4 border-black p-5 rounded-2xl font-black text-lg neobrutalism-shadow active:scale-95 flex items-center justify-center gap-3">
               <FileSpreadsheet /> EXPORTAR EXCEL (.CSV)
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
