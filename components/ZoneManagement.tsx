
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, MapPin, Loader2, AlertTriangle } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Zone } from '../types';

export const ZoneManagement: React.FC = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '' });

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    setLoading(true);
    try {
      const data = await dataService.getZones();
      setZones(data);
    } catch (error) {
      console.error("Error fetching zones:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    
    setSaveLoading(true);
    try {
      if (editingId) {
        await dataService.updateZone(editingId, formData);
      } else {
        await dataService.createZone({ name: formData.name, cost_per_meter: 0 });
      }
      
      setFormData({ name: '' });
      setEditingId(null);
      setIsAdding(false);
      await fetchZones();
    } catch (error: any) {
      console.error("Full error object:", error);
      alert("Error al guardar zona: " + (error.message || "Verifica los permisos de la base de datos (RLS)"));
    } finally {
      setSaveLoading(false);
    }
  };

  const handleEdit = (zone: Zone) => {
    setEditingId(zone.id);
    setFormData({ name: zone.name });
    setIsAdding(true);
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    
    setLoading(true);
    try {
      await dataService.deleteZone(deleteConfirmId);
      await fetchZones();
    } catch (error: any) {
      alert("Error al eliminar: " + error.message);
    } finally {
      setDeleteConfirmId(null);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-100">Gestión de <span className="text-blue-500">Zonas</span></h2>
          <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-1">Configuración de ubicaciones territoriales</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 border-2 border-black p-4 rounded-2xl font-black flex items-center gap-2 neobrutalism-shadow hover:neobrutalism-shadow-active transition-all active:scale-95"
          >
            <Plus className="w-6 h-6" /> NUEVA ZONA
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleSave} className="bg-slate-800 border-4 border-black p-8 rounded-[2.5rem] neobrutalism-shadow-lg animate-in zoom-in-95">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black uppercase">{editingId ? 'Editar Zona' : 'Registrar Nueva Zona'}</h3>
            <button type="button" onClick={() => { setIsAdding(false); setEditingId(null); setFormData({name:''}); }} className="p-2 hover:bg-slate-700 rounded-full">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-6 mb-8">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-500 ml-1">Nombre de la Zona</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input 
                  type="text" required value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-900 border-2 border-black rounded-2xl p-4 pl-12 font-bold outline-none focus:border-blue-500"
                  placeholder="Ej. Sector Comercial A"
                  disabled={saveLoading}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              type="submit" disabled={saveLoading}
              className="flex-1 bg-emerald-500 border-2 border-black p-4 rounded-2xl font-black text-xl neobrutalism-shadow hover:neobrutalism-shadow-active transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
            >
              {saveLoading ? <Loader2 className="animate-spin" /> : <Save className="w-6 h-6" />} {editingId ? 'ACTUALIZAR' : 'GUARDAR'} ZONA
            </button>
          </div>
        </form>
      )}

      {loading && !deleteConfirmId ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {zones.map(zone => (
            <div key={zone.id} className="bg-slate-800 border-2 border-black rounded-[2rem] p-6 neobrutalism-shadow group hover:border-blue-500 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-slate-900 border-2 border-black rounded-2xl flex items-center justify-center">
                  <MapPin className="text-blue-500 w-6 h-6" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(zone)} className="p-2 bg-slate-700 border-2 border-black rounded-xl hover:bg-blue-600 transition-colors active:scale-90">
                    <Edit2 className="w-4 h-4 text-white" />
                  </button>
                  <button onClick={() => setDeleteConfirmId(zone.id)} className="p-2 bg-slate-700 border-2 border-black rounded-xl hover:bg-rose-600 transition-colors active:scale-90">
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
              
              <h3 className="text-xl font-black mb-1 truncate uppercase">{zone.name}</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ubicación Registrada</p>
            </div>
          ))}
          {zones.length === 0 && !loading && (
            <div className="col-span-full py-20 text-center bg-slate-900 border-2 border-dashed border-slate-700 rounded-[2.5rem]">
              <p className="font-bold text-slate-500 italic">No hay zonas configuradas todavía.</p>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 border-4 border-black p-8 sm:p-12 rounded-[3rem] w-full max-w-md neobrutalism-shadow-lg animate-in zoom-in-90 text-center">
            <div className="bg-rose-500 w-20 h-20 rounded-3xl border-4 border-black flex items-center justify-center mx-auto mb-8 neobrutalism-shadow -rotate-6">
              <AlertTriangle className="w-10 h-10 text-white" />
            </div>
            
            <h3 className="text-3xl font-black mb-4 uppercase tracking-tighter">¿Eliminar Zona?</h3>
            <p className="font-bold text-slate-400 text-sm uppercase leading-relaxed mb-10">
              Esta acción es irreversible y podría afectar a los comerciantes asignados a esta ubicación territorial.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setDeleteConfirmId(null)} 
                className="bg-slate-700 border-4 border-black p-5 rounded-2xl font-black uppercase text-xs active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={executeDelete} 
                disabled={loading}
                className="bg-rose-600 border-4 border-black p-5 rounded-2xl font-black uppercase text-xs text-white neobrutalism-shadow hover:neobrutalism-shadow-active transition-all flex items-center justify-center disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
