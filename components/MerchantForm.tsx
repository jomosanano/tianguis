
import React, { useState } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { CameraCapture } from './CameraCapture';
import { storage } from '../services/storage';
import { Zone, ZoneAssignment, Merchant } from '../types';

interface MerchantFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const MerchantForm: React.FC<MerchantFormProps> = ({ onSuccess, onCancel }) => {
  const zones = storage.getZones();
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    profile_photo: '',
    ine_photo: ''
  });
  const [assignments, setAssignments] = useState<ZoneAssignment[]>([]);

  const addAssignment = () => {
    setAssignments([...assignments, { zone_id: zones[0].id, meters: 1, calculated_cost: zones[0].cost_per_meter }]);
  };

  const removeAssignment = (index: number) => {
    setAssignments(assignments.filter((_, i) => i !== index));
  };

  const updateAssignment = (index: number, field: keyof ZoneAssignment, value: any) => {
    const newAssignments = [...assignments];
    const item = { ...newAssignments[index], [field]: value };
    
    if (field === 'zone_id' || field === 'meters') {
      const zone = zones.find(z => z.id === (field === 'zone_id' ? value : item.zone_id));
      if (zone) {
        item.calculated_cost = zone.cost_per_meter * (field === 'meters' ? value : item.meters);
      }
    }
    
    newAssignments[index] = item;
    setAssignments(newAssignments);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || assignments.length === 0) {
      alert("Por favor complete el nombre y asigne al menos una zona.");
      return;
    }

    const total_debt = assignments.reduce((sum, a) => sum + a.calculated_cost, 0);
    const newMerchant: Merchant = {
      id: crypto.randomUUID(),
      ...formData,
      total_debt,
      balance: total_debt,
      status: 'PENDING',
      assignments,
      created_at: new Date().toISOString()
    };

    const current = storage.getMerchants();
    storage.saveMerchants([...current, newMerchant]);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-100">Registro de <span className="text-blue-500">Comerciante</span></h2>
        <button 
          type="button" 
          onClick={onCancel}
          className="px-6 py-2 bg-slate-800 border-2 border-black rounded-xl font-bold hover:bg-slate-700 transition-all"
        >
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Basic Info & Photos */}
        <div className="space-y-6 bg-slate-800 p-8 rounded-[2rem] border-2 border-black neobrutalism-shadow">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400 uppercase">Nombre Completo</label>
            <input 
              type="text" 
              required
              value={formData.full_name}
              onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full bg-slate-900 border-2 border-slate-700 focus:border-blue-500 rounded-2xl p-4 font-bold outline-none"
              placeholder="Ej. Juan Pérez López"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400 uppercase">Teléfono</label>
            <input 
              type="tel"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-slate-900 border-2 border-slate-700 focus:border-blue-500 rounded-2xl p-4 font-bold outline-none"
              placeholder="10 dígitos"
            />
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            <CameraCapture 
              label="Foto de Perfil" 
              onCapture={img => setFormData({ ...formData, profile_photo: img })} 
            />
            <CameraCapture 
              label="Foto INE / ID" 
              onCapture={img => setFormData({ ...formData, ine_photo: img })} 
            />
          </div>
        </div>

        {/* Right Column: Zone Assignments */}
        <div className="space-y-6 bg-slate-800 p-8 rounded-[2rem] border-2 border-black neobrutalism-shadow">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black">Asignación de Zonas</h3>
            <button 
              type="button"
              onClick={addAssignment}
              className="p-2 bg-blue-600 border-2 border-black rounded-lg neobrutalism-shadow hover:neobrutalism-shadow-active transition-all"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {assignments.map((a, index) => (
              <div key={index} className="p-4 bg-slate-900 border-2 border-slate-700 rounded-2xl space-y-4 relative">
                <button 
                  type="button"
                  onClick={() => removeAssignment(index)}
                  className="absolute -top-2 -right-2 p-1.5 bg-rose-600 border border-black rounded-lg"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">Zona</label>
                    <select 
                      value={a.zone_id}
                      onChange={e => updateAssignment(index, 'zone_id', e.target.value)}
                      className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-2 text-sm font-bold"
                    >
                      {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">Mts²</label>
                    <input 
                      type="number"
                      min="1"
                      value={a.meters}
                      onChange={e => updateAssignment(index, 'meters', parseFloat(e.target.value))}
                      className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-2 text-sm font-bold"
                    />
                  </div>
                </div>
                <div className="text-right text-blue-500 font-black">
                  Costo: ${a.calculated_cost.toLocaleString()}
                </div>
              </div>
            ))}
            {assignments.length === 0 && (
              <div className="text-center py-12 text-slate-500 italic font-bold">
                No hay zonas asignadas aún.
              </div>
            )}
          </div>

          <div className="pt-6 border-t-2 border-slate-700 mt-auto">
            <div className="flex justify-between items-center mb-6">
              <span className="text-lg font-bold text-slate-400">TOTAL INICIAL:</span>
              <span className="text-3xl font-black text-emerald-500">
                ${assignments.reduce((sum, a) => sum + a.calculated_cost, 0).toLocaleString()}
              </span>
            </div>
            <button 
              type="submit"
              className="w-full py-4 bg-blue-600 border-2 border-black rounded-2xl neobrutalism-shadow hover:neobrutalism-shadow-active transition-all text-white font-black text-xl flex items-center justify-center gap-3"
            >
              <Save className="w-6 h-6" />
              GUARDAR REGISTRO
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
