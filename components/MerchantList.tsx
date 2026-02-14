
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Loader2, Edit2, Trash2, X, Receipt, FilePlus2, ArrowRight, History, MapPin, User, ShieldAlert, IdCard, StickyNote, MessageSquareText, PlusCircle, DollarSign, BadgePercent, Ruler, Plus, Calculator, Settings2, Archive, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { dataService } from '../services/dataService';
import { Merchant, Abono, User as UserType, Zone, ZoneAssignment } from '../types';

interface MerchantListProps {
  user: UserType | null;
  systemLogo?: string | null;
  onRefresh: (silent?: boolean) => void;
  onEdit: (merchant: Merchant) => void;
  delegatesCanCollect?: boolean;
}

const PAGE_SIZE = 12;
type FilterType = 'ALL' | 'NO_PAYMENTS' | 'IN_PROGRESS' | 'LIQUIDATED';
const WORK_DAYS = ['Diario', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Fines de Semana'];

export const MerchantList: React.FC<MerchantListProps> = ({ user, onRefresh, onEdit, delegatesCanCollect = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoLoading, setAbonoLoading] = useState(false);
  
  const [historyMerchant, setHistoryMerchant] = useState<Merchant | null>(null);
  const [merchantAbonos, setMerchantAbonos] = useState<(Abono & { archived?: boolean })[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [adjustmentMerchant, setAdjustmentMerchant] = useState<Merchant | null>(null);
  const [showSyncWarning, setShowSyncWarning] = useState(false);
  const [adjAssignments, setAdjAssignments] = useState<ZoneAssignment[]>([]);
  const [adjLoading, setAdjLoading] = useState(false);
  
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);

  const isDelegate = user?.role === 'DELEGATE';
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setMerchants([]);
    setPage(0);
    setHasMore(true);
    fetchData(0, debouncedSearch, true);
    if (isAdmin) fetchZones();
  }, [debouncedSearch, user]);

  const fetchZones = async () => {
    try {
      const data = await dataService.getZones();
      setZones(data);
    } catch (e) { console.error(e); }
  };

  const fetchData = async (pageNum: number, search: string, isNew: boolean = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await dataService.getMerchantsPaginated(pageNum, PAGE_SIZE, search, user);
      setMerchants(prev => isNew ? data : [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && hasMore && !loading) {
      setPage(prev => {
        const next = prev + 1;
        fetchData(next, debouncedSearch);
        return next;
      });
    }
  }, [hasMore, loading, debouncedSearch]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, { threshold: 0 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  const filteredMerchants = useMemo(() => {
    return merchants.filter(m => {
      const balance = Number(m.balance);
      const totalDebt = Number(m.total_debt);
      switch (activeFilter) {
        case 'NO_PAYMENTS': return balance === totalDebt && totalDebt > 0;
        case 'IN_PROGRESS': return balance < totalDebt && balance > 0;
        case 'LIQUIDATED': return totalDebt > 0 && balance === 0;
        default: return true;
      }
    });
  }, [merchants, activeFilter]);

  const handleOpenAdjustment = (m: Merchant) => {
    if (m.balance > 0) {
      setAdjustmentMerchant(m);
      setShowSyncWarning(true);
    } else {
      setAdjustmentMerchant(m);
      setAdjAssignments(m.assignments.map(a => ({ ...a })));
      setShowSyncWarning(false);
    }
  };

  const confirmSyncWarning = () => {
    if (adjustmentMerchant) {
      setAdjAssignments(adjustmentMerchant.assignments.map(a => ({ ...a })));
      setShowSyncWarning(false);
    }
  };

  const addAdjAssignment = () => {
    if (zones.length === 0) return;
    setAdjAssignments([...adjAssignments, { zone_id: zones[0].id, meters: 1, calculated_cost: 0, work_day: 'Diario' }]);
  };

  const removeAdjAssignment = (index: number) => {
    setAdjAssignments(adjAssignments.filter((_, i) => i !== index));
  };

  const updateAdjAssignment = (index: number, field: keyof ZoneAssignment, value: any) => {
    const newArr = [...adjAssignments];
    newArr[index] = { ...newArr[index], [field]: value };
    setAdjAssignments(newArr);
  };

  const saveManualAdjustment = async () => {
    if (!adjustmentMerchant) return;
    setAdjLoading(true);
    
    try {
      const prevBalance = Number(adjustmentMerchant.balance);
      const nuevaDeudaTotal = adjAssignments.reduce((sum, a) => sum + (Number(a.calculated_cost) || 0), 0);
      
      // 1. Archivar abonos anteriores
      const { error: archiveError } = await supabase
        .from('abonos')
        .update({ archived: true })
        .eq('merchant_id', adjustmentMerchant.id);
      
      if (archiveError) throw archiveError;

      // 2. Preparar nota automática si había saldo vivo
      let newNote = adjustmentMerchant.note || '';
      if (prevBalance > 0) {
        const syncNote = `[Sincronización manual - Fecha: ${new Date().toLocaleDateString()} - Deuda pendiente anterior: $${prevBalance.toLocaleString()}]`;
        newNote = newNote ? `${newNote}\n${syncNote}` : syncNote;
      }

      // 3. Reset y Sincronización
      const now = new Date().toISOString();
      const { error: resetError } = await supabase
        .from('merchants')
        .update({ 
          balance_reset_at: now,
          total_debt: nuevaDeudaTotal,
          balance: nuevaDeudaTotal,
          note: newNote
        })
        .eq('id', adjustmentMerchant.id);
      
      if (resetError) throw resetError;

      // 4. Actualizar asignaciones
      await supabase.from('zone_assignments').delete().eq('merchant_id', adjustmentMerchant.id);
      
      if (adjAssignments.length > 0) {
        const cleaned = adjAssignments.map(a => ({
          merchant_id: adjustmentMerchant.id,
          zone_id: a.zone_id,
          meters: a.meters || 0,
          calculated_cost: a.calculated_cost || 0,
          work_day: a.work_day || 'Ciclo Nuevo'
        }));
        const { error: insertError } = await supabase.from('zone_assignments').insert(cleaned);
        if (insertError) throw insertError;
      }

      setAdjustmentMerchant(null);
      onRefresh(true);
      alert("¡SINCRONIZACIÓN EXITOSA!\n\nLos abonos anteriores han sido archivados. El comerciante inicia este nuevo ciclo con saldo limpio.");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setAdjLoading(false);
    }
  };

  const handleAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchant || !abonoAmount) return;
    const amount = parseFloat(abonoAmount);
    
    if (amount > selectedMerchant.balance) {
      alert("El monto supera el saldo pendiente.");
      return;
    }

    setAbonoLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { error } = await supabase.from('abonos').insert({ 
        merchant_id: selectedMerchant.id, 
        amount, 
        recorded_by: authUser?.id,
        archived: false
      });
      if (error) throw error;
      
      setAbonoAmount('');
      setSelectedMerchant(null);
      onRefresh(true);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setAbonoLoading(false);
    }
  };

  const openHistory = async (merchant: Merchant) => {
    setMerchantAbonos([]);
    setHistoryMerchant(merchant);
    setHistoryLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('abonos')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('date', { ascending: false });
      
      if (error) throw error;
      setMerchantAbonos(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleteLoading(true);
    try {
      await dataService.deleteMerchant(deleteConfirmId);
      setDeleteConfirmId(null);
      onRefresh();
    } finally {
      setDeleteLoading(false);
    }
  };

  const loaderRef = useRef<HTMLDivElement>(null);
  const totalAbonadoActivo = merchantAbonos.filter(a => !a.archived).reduce((s, a) => s + Number(a.amount), 0);
  const totalNuevaDeuda = adjAssignments.reduce((sum, a) => sum + (Number(a.calculated_cost) || 0), 0);

  return (
    <div className="space-y-8 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-white">
        <div>
          <h2 className="text-4xl font-black uppercase italic tracking-tighter">
            {isDelegate ? 'Mi Zona' : 'Directorio'} <span className="text-blue-500">ATCEM</span>
          </h2>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder="Nombre o giro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-800 border-4 border-black p-4 pl-12 rounded-2xl font-black outline-none focus:border-blue-500 neobrutalism-shadow" />
        </div>
      </div>

      {/* Grid de Comerciantes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMerchants.map(m => {
          const isTooltipActive = activeTooltipId === m.id;
          const balance = Number(m.balance);
          const totalDebt = Number(m.total_debt);
          
          // Lógica de semaforización
          let statusBorderClass = 'border-slate-700';
          let statusLabel = 'SIN DEUDA';
          let accentColorClass = 'text-slate-400';

          if (totalDebt > 0) {
            if (balance === 0) {
              statusBorderClass = 'border-blue-600';
              statusLabel = 'LIQUIDADO';
              accentColorClass = 'text-blue-500';
            } else if (balance < totalDebt) {
              statusBorderClass = 'border-amber-500';
              statusLabel = 'EN PROCESO';
              accentColorClass = 'text-amber-500';
            } else {
              statusBorderClass = 'border-rose-600';
              statusLabel = 'PENDIENTE';
              accentColorClass = 'text-rose-500';
            }
          }

          return (
            <div key={m.id} className={`bg-[#1e1b1b] border-4 ${statusBorderClass} rounded-[2.5rem] p-6 flex flex-col gap-6 relative neobrutalism-shadow transition-all hover:scale-[1.01]`}>
              <div className="flex gap-4">
                <div className="relative w-20 h-20 flex-shrink-0">
                  <div className="w-full h-full rounded-2xl border-2 border-black overflow-hidden bg-white">
                    <img src={m.profile_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.first_name)}`} className="w-full h-full object-cover" />
                  </div>
                  
                  {/* Icono de Nota Interactiva */}
                  {m.note && (
                    <div 
                      className="absolute -top-2 -right-2 bg-amber-500 p-1.5 rounded-full border-2 border-black shadow-lg animate-subtle-blink cursor-help z-20"
                      onMouseEnter={() => setActiveTooltipId(m.id)}
                      onMouseLeave={() => setActiveTooltipId(null)}
                      onClick={() => setActiveTooltipId(activeTooltipId === m.id ? null : m.id)}
                    >
                      <StickyNote className="w-4 h-4 text-black" />
                      
                      {/* Tooltip de Nota */}
                      {isTooltipActive && (
                        <div className="absolute left-full top-0 ml-4 w-56 bg-amber-400 border-4 border-black p-4 rounded-2xl neobrutalism-shadow-lg z-50 animate-in zoom-in-95 pointer-events-none sm:pointer-events-auto">
                           <div className="flex items-center gap-2 mb-2 border-b-2 border-black/20 pb-1">
                              <StickyNote size={14} className="text-black" />
                              <span className="text-[10px] font-black uppercase text-black">Expediente</span>
                           </div>
                           <p className="text-[11px] font-bold text-black leading-tight whitespace-pre-line">
                              {m.note}
                           </p>
                           {/* Flecha del tooltip */}
                           <div className="absolute top-4 -left-3 w-0 h-0 border-t-[8px] border-t-transparent border-r-[12px] border-r-black border-b-[8px] border-b-transparent"></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black uppercase truncate text-xl text-white tracking-tighter leading-tight">
                        {m.first_name}<br/>
                        <span className="text-slate-400 text-sm font-bold">{m.last_name_paterno}</span>
                      </h3>
                    </div>
                    <div className={`px-2 py-0.5 rounded-lg border-2 border-black text-[8px] font-black uppercase tracking-tighter bg-black/40 ${accentColorClass}`}>
                       {statusLabel}
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-2">
                    <div className="bg-slate-800 border border-slate-700 px-3 py-1 rounded-lg">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{m.giro}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => openHistory(m)} title="Historial" className="p-2 bg-slate-800 border-2 border-black rounded-xl text-white active:scale-90 shadow-sm"><History size={14}/></button>
                    {isAdmin && (
                      <>
                        <button onClick={() => handleOpenAdjustment(m)} title="Sincronizar Ciclo" className="p-2 bg-violet-600 border-2 border-black rounded-xl text-white active:scale-90 shadow-sm"><Archive size={14}/></button>
                        <button onClick={() => onEdit(m)} title="Editar" className="p-2 bg-emerald-600 border-2 border-black rounded-xl text-white active:scale-90 shadow-sm"><Edit2 size={14}/></button>
                        <button onClick={() => setDeleteConfirmId(m.id)} title="Borrar" className="p-2 bg-rose-800 border-2 border-black rounded-xl text-white active:scale-90 shadow-sm"><Trash2 size={14}/></button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className={`bg-[#000]/30 border-2 ${statusBorderClass.replace('border-', 'border-opacity-30 border-')} p-6 rounded-[2rem] flex justify-between items-center relative overflow-hidden`}>
                 <div className="relative z-10">
                   <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Saldo Vivo</span>
                   <p className={`text-3xl font-black italic tracking-tighter ${accentColorClass}`}>
                     ${Number(m.balance || 0).toLocaleString()}
                   </p>
                 </div>
                 <div className="opacity-5 absolute -right-2 -bottom-2">
                    <DollarSign size={80} />
                 </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => m.balance > 0 ? setSelectedMerchant(m) : openHistory(m)} 
                  className={`flex-1 border-4 border-black p-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white neobrutalism-shadow active:scale-95 transition-colors ${
                    balance === 0 ? 'bg-blue-600' : balance < totalDebt ? 'bg-amber-500' : 'bg-rose-600'
                  }`}
                >
                  {balance === 0 ? 'LIQUIDADO' : balance < totalDebt ? 'CONTINUAR ABONO' : 'COBRAR ABONO'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div ref={loaderRef} className="h-20 flex justify-center items-center">{loading && <Loader2 className="animate-spin text-blue-500" />}</div>

      {/* Modal de Advertencia por Saldo Vivo */}
      {showSyncWarning && adjustmentMerchant && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[600] flex items-center justify-center p-4">
          <div className="bg-slate-800 border-4 border-black p-10 rounded-[3rem] w-full max-w-md neobrutalism-shadow-lg text-center animate-in zoom-in-95">
            <div className="bg-amber-500 w-20 h-20 rounded-3xl border-4 border-black flex items-center justify-center mx-auto mb-8 neobrutalism-shadow -rotate-6">
              <AlertTriangle className="w-10 h-10 text-black" />
            </div>
            
            <h3 className="text-3xl font-black mb-4 uppercase tracking-tighter text-amber-500 italic">¡Atención! Saldo Vivo</h3>
            <p className="font-bold text-slate-400 text-sm uppercase leading-relaxed mb-4">
              El comerciante aún tiene un saldo pendiente de <span className="text-white text-lg">${Number(adjustmentMerchant.balance).toLocaleString()}</span>.
            </p>
            <p className="font-bold text-slate-500 text-[10px] uppercase tracking-widest mb-10">
              Si continúa, este saldo se archivará y se creará una nota informativa automática en su expediente.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => { setAdjustmentMerchant(null); setShowSyncWarning(false); }} 
                className="bg-slate-700 border-4 border-black p-5 rounded-2xl font-black uppercase text-xs active:scale-95"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmSyncWarning}
                className="bg-amber-500 border-4 border-black p-5 rounded-2xl font-black uppercase text-xs text-black neobrutalism-shadow active:scale-95"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sincronización (Archivo Lógico) */}
      {adjustmentMerchant && !showSyncWarning && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[550] flex items-center justify-center p-4">
           <div className="bg-slate-800 border-4 border-black p-8 rounded-[3rem] w-full max-w-lg neobrutalism-shadow-lg animate-in zoom-in-95 text-white flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none text-violet-400">Archivar y <span className="text-white">Reiniciar</span></h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Los abonos previos pasarán al historial histórico</p>
                </div>
                <button type="button" onClick={() => setAdjustmentMerchant(null)} className="p-3 bg-slate-700 border-2 border-black rounded-2xl active:scale-90 transition-transform"><X size={20}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar mb-6">
                {adjAssignments.map((a, i) => (
                  <div key={i} className="bg-slate-900/50 border-2 border-black p-4 rounded-3xl relative">
                    <button onClick={() => removeAdjAssignment(i)} className="absolute -top-2 -right-2 p-1.5 bg-rose-600 border-2 border-black rounded-xl text-white active:scale-75"><Trash2 size={12}/></button>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <select value={a.zone_id} onChange={e => updateAdjAssignment(i, 'zone_id', e.target.value)} className="bg-slate-800 border-2 border-black rounded-xl p-2.5 font-bold text-xs outline-none">
                        {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                      </select>
                      <select value={a.work_day} onChange={e => updateAdjAssignment(i, 'work_day', e.target.value)} className="bg-slate-800 border-2 border-black rounded-xl p-2.5 font-bold text-xs outline-none">
                        {WORK_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" step="0.1" value={a.meters} onChange={e => updateAdjAssignment(i, 'meters', parseFloat(e.target.value))} className="bg-slate-800 border-2 border-black rounded-xl p-2.5 font-black text-sm outline-none" placeholder="MTS" />
                      <input type="number" value={a.calculated_cost} onChange={e => updateAdjAssignment(i, 'calculated_cost', parseFloat(e.target.value))} className="bg-slate-800 border-2 border-violet-500/50 rounded-xl p-2.5 font-black text-sm text-violet-400 outline-none" placeholder="COSTO" />
                    </div>
                  </div>
                ))}
                
                <button onClick={addAdjAssignment} className="w-full border-4 border-dashed border-slate-700 p-4 rounded-3xl flex items-center justify-center gap-2 font-black text-[10px] uppercase text-slate-500 hover:text-violet-500 transition-all">
                  <Plus size={16}/> Nueva Asignación
                </button>
              </div>

              <div className="pt-6 border-t-2 border-slate-700 space-y-6">
                <div className="flex justify-between items-center bg-slate-900 p-6 rounded-3xl border-4 border-black">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Nuevo Saldo Inicial</p>
                    <p className="text-3xl font-black italic tracking-tighter text-white">${totalNuevaDeuda.toLocaleString()}</p>
                  </div>
                  <Archive className="text-violet-500 w-8 h-8 opacity-50" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setAdjustmentMerchant(null)} className="bg-slate-700 border-2 border-black p-4 rounded-2xl font-black uppercase text-xs active:scale-95">Descartar</button>
                  <button 
                    onClick={saveManualAdjustment} 
                    disabled={adjLoading} 
                    className="bg-violet-600 border-4 border-black p-4 rounded-2xl font-black text-white uppercase text-xs neobrutalism-shadow active:scale-95 flex items-center justify-center gap-2"
                  >
                    {adjLoading ? <Loader2 className="animate-spin w-5 h-5" /> : 'ARCHIVAR Y RESETEAR'}
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Historial con Archivados */}
      {historyMerchant && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-slate-800 border-4 border-black p-8 rounded-[3rem] w-full max-w-2xl max-h-[90vh] flex flex-col neobrutalism-shadow-lg text-white">
             <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">Historial de <span className="text-blue-500">Pagos</span></h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{historyMerchant.full_name}</p>
                </div>
                <button onClick={() => setHistoryMerchant(null)} className="p-3 bg-rose-600 border-2 border-black rounded-2xl text-white active:scale-90"><X /></button>
             </div>

             <div className="grid grid-cols-2 gap-4 mb-8 text-center text-xs">
                <div className="bg-emerald-500/10 border-2 border-emerald-500/30 p-4 rounded-2xl">
                  <p className="font-black text-emerald-500">RECAUDADO VIVO</p>
                  <p className="text-xl font-black">${totalAbonadoActivo.toLocaleString()}</p>
                </div>
                <div className="bg-rose-500/10 border-2 border-rose-500/30 p-4 rounded-2xl">
                  <p className="font-black text-rose-500">SALDO PENDIENTE</p>
                  <p className="text-xl font-black">${Number(historyMerchant.balance).toLocaleString()}</p>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 mb-6">
                {historyLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
                ) : merchantAbonos.length > 0 ? merchantAbonos.map(a => (
                  <div key={a.id} className={`p-5 rounded-2xl border-2 flex justify-between items-center transition-all ${a.archived ? 'bg-slate-900/40 border-slate-800 opacity-60 grayscale' : 'bg-slate-900 border-slate-700 shadow-sm'}`}>
                     <div>
                       <div className="flex items-center gap-2">
                         <p className="text-[10px] font-black text-slate-500 uppercase">{new Date(a.date).toLocaleDateString()}</p>
                         {a.archived && <span className="bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full text-[8px] font-black uppercase border border-slate-700 tracking-tighter">Histórico</span>}
                       </div>
                       <p className={`font-black text-sm uppercase ${a.archived ? 'text-slate-600' : 'text-white'}`}>Abono Recibido</p>
                     </div>
                     <p className={`text-xl font-black ${a.archived ? 'text-slate-600' : 'text-emerald-500'}`}>
                        {a.archived ? '' : '+'} $ {Number(a.amount).toLocaleString()}
                     </p>
                  </div>
                )) : (
                  <div className="py-12 text-center border-4 border-dashed border-slate-700 rounded-3xl text-slate-500">No hay pagos registrados.</div>
                )}
             </div>

             <button onClick={() => setHistoryMerchant(null)} className="w-full bg-slate-700 border-2 border-black p-4 rounded-2xl font-black text-white uppercase text-xs active:scale-95">Cerrar</button>
          </div>
        </div>
      )}

      {selectedMerchant && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <form onSubmit={handleAbono} className="bg-slate-800 border-4 border-black p-8 rounded-[3rem] w-full max-w-md neobrutalism-shadow-lg animate-in zoom-in-95 text-white">
            <h3 className="text-2xl font-black uppercase italic mb-8 tracking-tighter">Registrar <span className="text-blue-500">Cobro</span></h3>
            <input type="number" step="1" min="1" max={selectedMerchant.balance} required autoFocus value={abonoAmount} onChange={e => setAbonoAmount(e.target.value)} className="w-full bg-slate-900 border-4 border-black p-5 rounded-2xl font-black text-3xl text-emerald-500 text-center outline-none focus:border-blue-500 mb-8" placeholder="0" />
            <div className="grid grid-cols-2 gap-4">
              <button type="button" onClick={() => setSelectedMerchant(null)} className="bg-slate-700 border-2 border-black p-4 rounded-2xl font-black uppercase text-xs active:scale-95">Cancelar</button>
              <button type="submit" disabled={abonoLoading} className="bg-emerald-500 border-4 border-black p-4 rounded-2xl font-black text-white uppercase text-xs neobrutalism-shadow active:scale-95">
                {abonoLoading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Confirmar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
