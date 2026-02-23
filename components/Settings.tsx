
import React, { useState, useRef } from 'react';
import { Save, Loader2, Image as ImageIcon, CheckCircle2, DollarSign, FileSpreadsheet, ShieldCheck, Database, RefreshCw, FileJson, Download, UploadCloud, AlertTriangle } from 'lucide-react';
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
      link.setAttribute('download', `ATCEM_SNAPSHOT_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Error crítico al generar el respaldo JSON.");
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleRestoreClick = () => {
    if (window.confirm("⚠️ ADVERTENCIA DE SEGURIDAD ⚠️\n\nEstás a punto de restaurar la base de datos completa desde un archivo JSON.\n\nEste proceso sobrescribirá los datos actuales si hay conflictos de ID. Se recomienda generar un Snapshot antes de proceder.\n\n¿Deseas continuar?")) {
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
          
          if (!snapshot.version || !snapshot.data) {
            throw new Error("El archivo seleccionado no es un formato de Snapshot ATCEM válido.");
          }

          await dataService.restoreSnapshot(snapshot);
          alert("✅ RESTAURACIÓN EXITOSA\n\nLos datos han sido sincronizados. El sistema se reiniciará para aplicar los cambios.");
          window.location.reload(); 
        } catch (err: any) { 
          alert("❌ ERROR DE RESTAURACIÓN: " + err.message); 
        } finally {
          setRestoreLoading(false);
        }
      };
      reader.onerror = () => {
        alert("Error al leer el archivo.");
        setRestoreLoading(false);
      };
      reader.readAsText(file);
    } catch (err) {
      setRestoreLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const merchants = await dataService.getAllMerchantsForExport();
      const headers = ["ID", "Nombre Completo", "Giro", "WhatsApp", "Deuda Total", "Saldo Pendiente", "Estatus"];
      const rows = merchants.map(m => [
        m.id, 
        `"${m.full_name}"`, 
        `"${m.giro}"`, 
        `"${m.phone || 'N/A'}"`, 
        m.total_debt, 
        m.balance, 
        m.status
      ]);
      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `CENSO_ATCEM_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-100 uppercase tracking-tighter italic">Configuración <span className="text-blue-500">Global</span></h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Gestión de identidad y seguridad de datos</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PANEL IZQUIERDO: IDENTIDAD Y PERMISOS */}
        <div className="bg-slate-800 border-4 border-black p-8 rounded-[3rem] neobrutalism-shadow-lg flex flex-col gap-8">
          <div className="space-y-6 pb-6 border-b-2 border-slate-700/50">
            <h3 className="text-xl font-black uppercase flex items-center gap-3 text-emerald-400"><DollarSign /> Permisos de Operación</h3>
            <div 
              onClick={() => setDelegatesCanCollect(!delegatesCanCollect)} 
              className="cursor-pointer group flex items-center justify-between p-6 bg-slate-900 border-2 border-black rounded-2xl hover:border-blue-500 transition-all"
            >
               <div>
                  <p className="font-black text-sm text-white uppercase tracking-tight">Cobranza en Campo</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    {delegatesCanCollect ? 'Los delegados tienen facultad de cobro' : 'Solo administración puede cobrar'}
                  </p>
               </div>
               <div className={`w-14 h-8 rounded-full border-2 border-black p-1 transition-colors ${delegatesCanCollect ? 'bg-emerald-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]' : 'bg-slate-700'}`}>
                  <div className={`w-5 h-5 bg-white border-2 border-black rounded-full transition-transform ${delegatesCanCollect ? 'translate-x-6 shadow-md' : 'translate-x-0'}`} />
               </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-black uppercase flex items-center gap-3 text-blue-400"><ImageIcon /> Identidad del Sistema</h3>
            <div className="flex flex-col items-center gap-4">
              <div className="w-full max-w-[200px]">
                <ImagePicker label="Logo Institucional" onCapture={img => setNewLogo(img)} />
              </div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center italic">El logo aparecerá en el Sidebar y Credenciales</p>
            </div>
          </div>

          <button 
            onClick={handleSave} 
            disabled={loading} 
            className="w-full bg-blue-600 border-4 border-black p-5 rounded-2xl font-black text-xl text-white neobrutalism-shadow active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin w-6 h-6" /> : <Save className="w-6 h-6" />} 
            {success ? '¡CAMBIOS GUARDADOS!' : 'ACTUALIZAR AJUSTES'}
          </button>
        </div>

        {/* PANEL DERECHO: BACKUP Y AUDITORÍA */}
        <div className="space-y-8">
          <div className="bg-slate-800 border-4 border-black p-8 rounded-[3rem] neobrutalism-shadow-lg flex flex-col gap-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5">
                <Database size={120} />
             </div>
             
             <div className="relative z-10">
                <h3 className="text-xl font-black uppercase flex items-center gap-3 text-rose-400"><Database /> Respaldo Maestro (JSON)</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 leading-relaxed">
                  Crea un respaldo completo de comerciantes, zonas y abonos para migración o seguridad externa.
                </p>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                <button 
                  onClick={handleGenerateSnapshot} 
                  disabled={snapshotLoading} 
                  className="bg-slate-900 border-2 border-black p-6 rounded-2xl flex flex-col items-center gap-3 hover:bg-slate-800 transition-all group active:scale-95 disabled:opacity-50"
                >
                  <div className="p-3 bg-blue-600/10 border border-blue-600/30 rounded-xl group-hover:scale-110 transition-transform">
                    {snapshotLoading ? <Loader2 className="animate-spin text-blue-500" /> : <Download className="text-blue-500" />}
                  </div>
                  <div className="text-center">
                    <span className="text-[11px] font-black uppercase text-white tracking-widest block">GENERAR SNAPSHOT</span>
                    <span className="text-[8px] font-bold text-slate-500 uppercase">Descargar JSON</span>
                  </div>
                </button>

                <button 
                  onClick={handleRestoreClick} 
                  disabled={restoreLoading} 
                  className="bg-slate-900 border-2 border-black p-6 rounded-2xl flex flex-col items-center gap-3 hover:bg-slate-800 transition-all group active:scale-95 disabled:opacity-50"
                >
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl group-hover:scale-110 transition-transform">
                    {restoreLoading ? <Loader2 className="animate-spin text-emerald-500" /> : <UploadCloud className="text-emerald-500" />}
                  </div>
                  <div className="text-center">
                    <span className="text-[11px] font-black uppercase text-white tracking-widest block">RESTAURAR BASE</span>
                    <span className="text-[8px] font-bold text-slate-500 uppercase">Cargar archivo</span>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".json" 
                    onChange={handleFileChange} 
                  />
                </button>
             </div>
             
             <div className="p-4 bg-rose-900/10 border border-rose-500/20 rounded-2xl flex items-start gap-4">
                <AlertTriangle className="text-rose-500 flex-shrink-0 mt-0.5" size={16} />
                <p className="text-[9px] font-black text-rose-500 uppercase italic tracking-wider leading-relaxed">
                  Utilice la restauración con extrema precaución. Este proceso es atómico e irreversible una vez confirmado.
                </p>
             </div>
          </div>

          <div className="bg-slate-800 border-4 border-black p-8 rounded-[3rem] neobrutalism-shadow-lg flex flex-col gap-6">
             <h3 className="text-xl font-black uppercase flex items-center gap-3 text-violet-400"><ShieldCheck /> Auditoría Externa</h3>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                Genera un reporte detallado en formato CSV compatible con Excel para revisiones contables de fin de ciclo.
             </p>
             <button 
               onClick={handleExportCSV} 
               disabled={exportLoading} 
               className="w-full bg-emerald-500 border-4 border-black p-5 rounded-2xl font-black text-lg text-white neobrutalism-shadow active:scale-95 flex items-center justify-center gap-4 transition-all disabled:opacity-50"
             >
               {exportLoading ? <Loader2 className="animate-spin w-6 h-6" /> : <FileSpreadsheet className="w-6 h-6" />}
               EXPORTAR CENSO (.CSV)
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
