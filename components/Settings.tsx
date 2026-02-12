
import React, { useState, useRef } from 'react';
import { Settings as SettingsIcon, Save, Loader2, Image as ImageIcon, CheckCircle2, AlertCircle, DollarSign, Download, FileSpreadsheet, ShieldCheck, Database, Upload, RefreshCw, FileJson } from 'lucide-react';
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
      const dateStr = new Date().toISOString().split('T')[0];
      
      link.setAttribute('href', url);
      link.setAttribute('download', `ATCEM_SNAPSHOT_FULL_${dateStr}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert("¡SNAPSHOT GENERADO!\n\nEste archivo contiene la base de datos completa. Guárdalo en un lugar seguro.");
    } catch (err) {
      console.error(err);
      alert("Error al generar snapshot.");
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleRestoreClick = () => {
    if (window.confirm("¡ALERTA DE SEGURIDAD!\n\nEstás a punto de restaurar datos desde un Snapshot externo. Esto actualizará o creará registros en tu base de datos actual.\n\n¿Deseas continuar?")) {
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
          const content = event.target?.result as string;
          const snapshot = JSON.parse(content);
          
          await dataService.restoreSnapshot(snapshot);
          alert("¡RESTAURACIÓN EXITOSA!\n\nLos datos han sido inyectados y sincronizados correctamente.");
          window.location.reload(); // Recargar para ver los cambios
        } catch (err: any) {
          alert("Error al procesar el archivo: " + err.message);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      alert("Error al leer el archivo.");
    } finally {
      setRestoreLoading(false);
      if (e.target) e.target.value = ''; // Reset input
    }
  };

  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const merchants = await dataService.getAllMerchantsForExport();
      
      const headers = [
        "Folio (ID)",
        "Nombre Completo",
        "Giro Comercial",
        "Telefono",
        "Deuda Total",
        "Saldo Pendiente",
        "Estatus",
        "Zonas Asignadas",
        "Entregado a Admin",
        "Fecha de Registro"
      ];

      const rows = merchants.map(m => {
        const zones = m.zone_assignments?.map((a: any) => `${a.zones?.name || 'Zona'} (${a.meters}m)`).join(' | ') || 'Ninguna';
        const statusLabel = m.status === 'PAID' ? 'LIQUIDADO' : m.status === 'PARTIAL' ? 'CON ABONOS' : 'PENDIENTE';
        
        return [
          m.id,
          m.full_name,
          m.giro,
          m.phone || 'N/A',
          m.total_debt,
          m.balance,
          statusLabel,
          `"${zones}"`,
          m.admin_received ? 'SI' : 'NO',
          new Date(m.created_at).toLocaleDateString()
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      
      link.setAttribute('href', url);
      link.setAttribute('download', `ATCEM_Censo_Comerciantes_${dateStr}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err) {
      console.error(err);
      alert("Error al generar reporte de auditoría.");
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <header>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-100 leading-none tracking-tighter">
          Configuración <span className="text-blue-500">Global</span>
        </h2>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.3em] mt-2">Gestión de Privilegios y Marca</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          {/* PANEL DE CONTROL GENERAL */}
          <div className="bg-slate-800 border-4 border-black p-8 rounded-[2.5rem] neobrutalism-shadow-lg flex flex-col gap-8">
            
            {/* CONTROL DE RECAUDACIÓN */}
            <div className="space-y-6 pb-6 border-b-2 border-slate-700">
              <div className="flex items-center gap-4">
                 <div className="bg-emerald-500 p-3 rounded-2xl border-2 border-black">
                    <DollarSign className="w-8 h-8 text-white" />
                 </div>
                 <div>
                    <h3 className="text-xl font-black uppercase">Permisos de Cobro</h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Delegados de campo</p>
                 </div>
              </div>

              <div 
                onClick={() => setDelegatesCanCollect(!delegatesCanCollect)}
                className="group cursor-pointer flex items-center justify-between p-6 bg-slate-900 border-2 border-black rounded-[2rem] hover:border-blue-500 transition-all"
              >
                 <div className="max-w-[70%]">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Estatus del Permiso</span>
                    <p className="font-bold text-sm text-slate-200">
                      {delegatesCanCollect ? 'Los delegados PUEDEN cobrar abonos en campo.' : 'Los delegados TIENEN RESTRINGIDO el cobro de abonos.'}
                    </p>
                 </div>
                 <div className={`w-14 h-8 rounded-full border-2 border-black p-1 transition-colors ${delegatesCanCollect ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                    <div className={`w-5 h-5 bg-white border-2 border-black rounded-full transition-transform ${delegatesCanCollect ? 'translate-x-6' : 'translate-x-0'}`} />
                 </div>
              </div>
            </div>

            {/* CONTROL DE LOGO */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                 <div className="bg-blue-600 p-3 rounded-2xl border-2 border-black">
                    <ImageIcon className="w-8 h-8 text-white" />
                 </div>
                 <div>
                    <h3 className="text-xl font-black uppercase">Logo Institucional</h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Identidad Visual ATCEM</p>
                 </div>
              </div>
              <div className="max-w-[200px] mx-auto">
                <ImagePicker label="Actualizar Identidad" onCapture={img => setNewLogo(img)} />
              </div>
            </div>

            <div className="mt-auto space-y-4">
              {success && (
                <div className="p-4 bg-emerald-500/10 border-2 border-emerald-500 rounded-2xl flex items-center gap-3 text-emerald-500 font-bold text-sm uppercase animate-in zoom-in-95">
                  <CheckCircle2 className="w-5 h-5" /> Configuración actualizada con éxito
                </div>
              )}
              
              <button 
                disabled={loading}
                onClick={handleSave}
                className="w-full bg-blue-600 border-4 border-black p-5 rounded-2xl font-black text-xl neobrutalism-shadow hover:neobrutalism-shadow-active active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30"
              >
                {loading ? <Loader2 className="animate-spin w-6 h-6" /> : <Save className="w-6 h-6" />}
                GUARDAR CAMBIOS
              </button>
            </div>
          </div>

          {/* PANEL DE SNAPSHOT DE SEGURIDAD */}
          <div className="bg-slate-800 border-4 border-black p-8 rounded-[2.5rem] neobrutalism-shadow-lg flex flex-col gap-6">
             <div className="flex items-center gap-4">
                <div className="bg-rose-600 p-3 rounded-2xl border-2 border-black">
                   <Database className="w-8 h-8 text-white" />
                </div>
                <div>
                   <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-1">Snapshot de Seguridad</h3>
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Respaldo total y portabilidad (.JSON)</p>
                </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={handleGenerateSnapshot}
                  disabled={snapshotLoading}
                  className="bg-slate-900 border-2 border-black p-5 rounded-2xl flex flex-col items-center gap-3 hover:border-blue-500 transition-all active:scale-95 disabled:opacity-50"
                >
                  {snapshotLoading ? <Loader2 className="w-8 h-8 text-blue-500 animate-spin" /> : <FileJson className="w-8 h-8 text-blue-500" />}
                  <div className="text-center">
                    <p className="font-black text-[10px] uppercase tracking-widest text-white">Generar Snapshot</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">Descargar respaldo</p>
                  </div>
                </button>

                <button 
                  onClick={handleRestoreClick}
                  disabled={restoreLoading}
                  className="bg-slate-900 border-2 border-black p-5 rounded-2xl flex flex-col items-center gap-3 hover:border-emerald-500 transition-all active:scale-95 disabled:opacity-50"
                >
                  {restoreLoading ? <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /> : <RefreshCw className="w-8 h-8 text-emerald-500" />}
                  <div className="text-center">
                    <p className="font-black text-[10px] uppercase tracking-widest text-white">Restaurar Datos</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">Cargar Snapshot</p>
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

             <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-700/50">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed text-center italic">
                  * El Snapshot preserva fotos, historial financiero y zonas territoriales. Es la forma más segura de migrar entre bases de datos.
                </p>
             </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* PANEL DE AUDITORÍA CSV */}
          <div className="bg-slate-800 border-4 border-black p-8 rounded-[2.5rem] neobrutalism-shadow-lg flex flex-col gap-6">
             <div className="flex items-center gap-4">
                <div className="bg-purple-600 p-3 rounded-2xl border-2 border-black">
                   <ShieldCheck className="w-8 h-8 text-white" />
                </div>
                <div>
                   <h3 className="text-xl font-black uppercase">Auditoría y Reporte</h3>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Formato de lectura humana (.CSV)</p>
                </div>
             </div>

             <div className="p-6 bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-[2rem] flex flex-col gap-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed text-center">
                  Descarga un archivo compatible con <span className="text-emerald-500">Excel</span> con el censo completo para revisión física.
                </p>
                <button 
                  onClick={handleExportCSV}
                  disabled={exportLoading}
                  className="w-full bg-emerald-500 border-4 border-black p-5 rounded-2xl font-black text-lg neobrutalism-shadow hover:neobrutalism-shadow-active active:scale-95 transition-all flex items-center justify-center gap-3 text-white disabled:opacity-50"
                >
                  {exportLoading ? <Loader2 className="animate-spin w-6 h-6" /> : <FileSpreadsheet className="w-6 h-6" />}
                  EXPORTAR EXCEL (.CSV)
                </button>
             </div>
          </div>

          <div className="bg-slate-900 border-2 border-slate-800 p-8 rounded-[2.5rem] flex flex-col justify-center items-center text-center gap-6">
             <div className="w-40 h-40 bg-slate-800 border-2 border-black rounded-[2rem] flex items-center justify-center overflow-hidden neobrutalism-shadow relative group">
                {currentLogo || newLogo ? (
                  <img src={newLogo || currentLogo!} className="w-full h-full object-contain p-6" alt="Preview" />
                ) : (
                  <span className="text-7xl font-black italic text-slate-500">A</span>
                )}
                <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                   <SettingsIcon className="w-10 h-10 text-white animate-spin-slow" />
                </div>
             </div>
             <div>
                <h4 className="font-black text-2xl uppercase mb-2 tracking-tighter italic">ATCEM <span className="text-blue-500">Preview</span></h4>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] leading-relaxed max-w-xs mx-auto">
                  Las configuraciones de permisos y visuales se propagan instantáneamente a todos los dispositivos móviles vinculados.
                </p>
             </div>
             <div className="mt-8 p-6 bg-slate-800/50 border-2 border-slate-700 rounded-3xl w-full">
                <div className="flex items-center gap-3 mb-4">
                   <Download className="w-4 h-4 text-blue-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Último Respaldo</span>
                </div>
                <p className="text-xs font-black text-slate-500 uppercase italic">Actividad Local: {new Date().toLocaleDateString()}</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
