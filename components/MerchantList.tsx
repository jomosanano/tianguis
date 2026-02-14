
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Loader2, Filter, Edit2, Trash2, X, Receipt, FilePlus2, ArrowRight, History, MapPin, DollarSign, User, AlertCircle, ChevronRight, AlertTriangle, ShieldAlert, IdCard, QrCode as QrIcon, CheckCircle2, Signature } from 'lucide-react';
import { supabase } from '../services/supabase';
import { dataService } from '../services/dataService';
import { Merchant, Abono, User as UserType } from '../types';

interface MerchantListProps {
  user: UserType | null;
  systemLogo?: string | null;
  onRefresh: (silent?: boolean) => void;
  onEdit: (merchant: Merchant) => void;
  delegatesCanCollect?: boolean;
}

const PAGE_SIZE = 12;
type FilterType = 'ALL' | 'NO_PAYMENTS' | 'IN_PROGRESS' | 'LIQUIDATED';

export const MerchantList: React.FC<MerchantListProps> = ({ user, onRefresh, onEdit, delegatesCanCollect = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoLoading, setAbonoLoading] = useState(false);
  
  const [historyMerchant, setHistoryMerchant] = useState<Merchant | null>(null);
  const [merchantAbonos, setMerchantAbonos] = useState<Abono[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const [showCredential, setShowCredential] = useState<Merchant | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setMerchants([]);
    setPage(0);
    setHasMore(true);
    fetchData(0, debouncedSearch, true);
  }, [debouncedSearch, user]);

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

  const handleAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchant || !abonoAmount) return;
    const amount = parseFloat(abonoAmount);
    setAbonoLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { error } = await supabase.from('abonos').insert({ 
        merchant_id: selectedMerchant.id, 
        amount, 
        recorded_by: authUser?.id 
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

  const fetchHistory = async (merchant: Merchant) => {
    setHistoryMerchant(merchant);
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('abonos')
        .select('*')
        .eq('merchant_id', merchant.id)
        .eq('archived', false)
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

  return (
    <div className="space-y-8 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Directorio <span className="text-blue-500">ATCEM</span></h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Gestión de Expedientes y Cobranza</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder="Buscar por nombre o giro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-800 border-4 border-black p-4 pl-12 rounded-2xl font-black outline-none focus:border-blue-500 neobrutalism-shadow" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMerchants.map(m => (
          <div key={m.id} className="bg-[#2a1b15] border-2 border-[#eab308] rounded-[2.5rem] p-6 flex flex-col gap-6 relative group neobrutalism-shadow transition-transform hover:scale-[1.01]">
            <div className="flex gap-4">
              <div className="w-20 h-20 rounded-2xl border-2 border-black overflow-hidden bg-white shadow-inner flex-shrink-0">
                <img src={m.profile_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.first_name)}`} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0 pr-8">
                <h3 className="font-black uppercase truncate text-xl text-white tracking-tighter">{m.first_name} {m.last_name_paterno}</h3>
                <div className="mt-1 flex items-center gap-2">
                   <div className="bg-[#1e293b] px-2 py-0.5 rounded-lg border border-slate-700">
                     <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{m.giro}</p>
                   </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => setShowCredential(m)} className="p-2 bg-blue-600 border-2 border-black rounded-xl text-white active:scale-90" title="Ver Credencial"><IdCard size={14}/></button>
                  <button onClick={() => fetchHistory(m)} className="p-2 bg-slate-800 border-2 border-black rounded-xl text-white active:scale-90" title="Ver Historial"><Receipt size={14}/></button>
                  <button onClick={() => onEdit(m)} className="p-2 bg-slate-800 border-2 border-black rounded-xl text-white active:scale-90" title="Renovar"><Edit2 size={14}/></button>
                  <button onClick={() => setDeleteConfirmId(m.id)} className="p-2 bg-slate-800 border-2 border-black rounded-xl text-white active:scale-90" title="Eliminar"><Trash2 size={14}/></button>
                </div>
              </div>
            </div>

            <div className="bg-[#1e293b]/50 border-2 border-slate-700 p-6 rounded-[2rem] flex justify-between items-center relative overflow-hidden">
               <span className="text-xs font-black text-slate-400 uppercase tracking-widest z-10">Saldo Actual</span>
               <p className="text-3xl font-black text-rose-500 italic tracking-tighter z-10">${Number(m.balance || 0).toLocaleString()}</p>
               <div className="absolute right-0 top-0 bottom-0 w-24 bg-rose-500/5 blur-xl -mr-12" />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setSelectedMerchant(m)} 
                disabled={m.balance <= 0} 
                className="flex-1 bg-blue-600 border-4 border-black p-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white neobrutalism-shadow active:scale-95 disabled:opacity-50"
              >
                COBRAR ABONO
              </button>
              <button 
                onClick={() => fetchHistory(m)}
                className="p-4 bg-slate-800 border-4 border-black rounded-2xl text-white neobrutalism-shadow active:scale-95"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div ref={loaderRef} className="h-20 flex justify-center items-center">{loading && <Loader2 className="animate-spin text-blue-500" />}</div>

      {/* MODAL CREDENCIAL 3D */}
      {showCredential && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[500] flex items-center justify-center p-4">
           <div className="w-full max-w-[400px] flex flex-col items-center gap-6">
              <div className="flex justify-between w-full px-4 items-center">
                 <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700">
                    <History size={12} className="text-blue-400 animate-pulse" />
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Toca para girar credencial</p>
                 </div>
                 <button onClick={() => { setShowCredential(null); setIsFlipped(false); }} className="p-2 bg-rose-600 border-2 border-black rounded-xl text-white active:scale-90 hover:bg-rose-500 transition-colors shadow-lg"><X /></button>
              </div>

              <div 
                className="credential-container aspect-[5/8] w-full" 
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <div className={`credential-inner ${isFlipped ? 'flipped' : ''}`}>
                  {/* FRENTE */}
                  <div className="credential-front bg-slate-800 border-4 border-black p-6 flex flex-col items-center shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-security-grid pointer-events-none opacity-20"></div>
                    <div className="w-full flex justify-between items-start mb-6 z-10">
                       <div className="bg-blue-600 p-2.5 rounded-xl border-2 border-black shadow-lg">
                          <span className="text-white font-black italic text-2xl leading-none">A</span>
                       </div>
                       <div className="text-right">
                          <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Gobernación Territorial</p>
                          <p className="text-[12px] font-black text-white uppercase italic tracking-tighter">ATCEM SYSTEMS</p>
                       </div>
                    </div>

                    <div className="w-48 h-48 rounded-full p-1.5 bg-gradient-to-tr from-blue-600 via-slate-700 to-blue-400 border-4 border-black mb-6 neobrutalism-shadow overflow-hidden z-10">
                       <img src={showCredential.profile_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(showCredential.first_name)}&background=020617&color=fff`} className="w-full h-full object-cover rounded-full" />
                    </div>

                    <div className="z-10 text-center w-full">
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-tight mb-2">
                         {showCredential.first_name}<br/>{showCredential.last_name_paterno}
                      </h2>
                      <div className="inline-block bg-slate-900/80 backdrop-blur-sm border-2 border-black px-4 py-1.5 rounded-xl mb-6 shadow-inner">
                         <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">{showCredential.giro}</p>
                      </div>
                    </div>

                    <div className="mt-auto w-full p-4 bg-slate-900 border-2 border-black rounded-2xl flex items-center justify-between z-10 neobrutalism-shadow">
                       <div className="flex flex-col">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Estatus de Registro</span>
                          <span className={`text-[11px] font-black uppercase tracking-tighter ${showCredential.balance <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                             {showCredential.balance <= 0 ? '✓ AL CORRIENTE' : '⚠ PAGO PENDIENTE'}
                          </span>
                       </div>
                       <CheckCircle2 className={showCredential.balance <= 0 ? 'text-emerald-500' : 'text-slate-800'} size={24} />
                    </div>
                    
                    <div className="mt-4 text-[7px] font-black text-slate-600 uppercase text-center w-full tracking-[0.3em] z-10">
                       ID-REF: {showCredential.id.slice(0, 18)} | 2026-A
                    </div>
                  </div>

                  {/* VUELTA */}
                  <div className="credential-back bg-slate-900 border-4 border-black p-6 flex flex-col items-center shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-guilloche pointer-events-none opacity-10"></div>
                    
                    <div className="w-full text-center z-10 mb-6">
                       <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.4em] mb-4">VALIDACIÓN DE AUDITORÍA</p>
                       <div className="bg-white p-3 rounded-2xl border-4 border-black mx-auto inline-block neobrutalism-shadow">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=ATCEM-ID-${showCredential.id}&bgcolor=ffffff&color=000000&margin=1`} 
                            className="w-32 h-32" 
                          />
                       </div>
                    </div>

                    <div className="w-full space-y-3 z-10 flex-1 overflow-hidden">
                       <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800 pb-2">
                          <MapPin size={12} className="text-orange-500" /> Zonas y Metraje
                       </h4>
                       <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                          {showCredential.assignments.map((a, i) => (
                            <div key={i} className="bg-slate-800/50 border border-slate-700 p-2.5 rounded-xl flex justify-between items-center group">
                               <div className="flex flex-col">
                                 <span className="text-[10px] font-black text-white uppercase tracking-tighter truncate max-w-[120px]">{(a as any).zones?.name || 'Zona General'}</span>
                                 <span className="text-[8px] font-bold text-slate-500">{a.work_day}</span>
                               </div>
                               <div className="bg-blue-600 px-2 py-1 rounded-lg border border-black shadow-sm">
                                 <span className="text-[9px] font-black text-white">{a.meters} mts</span>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="w-full mt-6 space-y-2 z-10">
                       <div className="flex justify-between items-end mb-1 px-1">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Firma Autorizada ATCEM</span>
                          <Signature size={12} className="text-slate-600" />
                       </div>
                       <div className="w-full h-16 bg-white border-4 border-black rounded-xl flex items-end justify-center pb-2 relative shadow-inner">
                          <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center italic text-black font-black text-[10px] uppercase tracking-[0.2em]">VALIDADO POR ADMINISTRACIÓN</div>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] relative z-10">Sello Digital ATCEM</span>
                       </div>
                    </div>

                    <div className="w-full mt-4 pt-3 border-t border-slate-800 flex flex-col items-center z-10">
                       <p className="text-[7px] font-black text-slate-600 text-center leading-relaxed tracking-wider">
                          DOCUMENTO OFICIAL DEL DEPARTAMENTO DE GOBERNACIÓN. <br/>
                          TODO USO INDEBIDO SERÁ SANCIONADO CONFORME A LA LEY.
                       </p>
                    </div>
                  </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL COBRO */}
      {selectedMerchant && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <form onSubmit={handleAbono} className="bg-slate-800 border-4 border-black p-8 rounded-[3rem] w-full max-w-md neobrutalism-shadow-lg animate-in zoom-in-95">
            <h3 className="text-2xl font-black uppercase italic mb-8 tracking-tighter text-white">Registrar <span className="text-blue-500">Cobro</span></h3>
            <div className="p-4 bg-slate-900 border-2 border-black rounded-2xl mb-6 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Comerciante</p>
                <p className="font-black text-white uppercase italic text-sm">{selectedMerchant.full_name}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Adeudo</p>
                <p className="font-black text-rose-500">${selectedMerchant.balance.toLocaleString()}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1 tracking-widest">Monto a abonar</label>
              <input type="number" step="1" required autoFocus value={abonoAmount} onChange={e => setAbonoAmount(e.target.value)} className="w-full bg-slate-900 border-4 border-black p-5 rounded-2xl font-black text-3xl text-emerald-500 text-center outline-none focus:border-blue-500" placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-8">
              <button type="button" onClick={() => setSelectedMerchant(null)} className="bg-slate-700 border-2 border-black p-4 rounded-2xl font-black uppercase text-xs text-white active:scale-95 transition-all">Cancelar</button>
              <button type="submit" disabled={abonoLoading} className="bg-emerald-500 border-4 border-black p-4 rounded-2xl font-black text-white uppercase text-xs neobrutalism-shadow active:scale-95 flex items-center justify-center gap-2">
                {abonoLoading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Confirmar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL HISTORIAL */}
      {historyMerchant && (() => {
        const totalAbonadoCiclo = merchantAbonos.reduce((s, a) => s + Number(a.amount), 0);
        
        return (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[300] flex items-center justify-center p-4">
            <div className="bg-slate-800 border-4 border-black p-8 rounded-[3rem] w-full max-w-2xl max-h-[90vh] flex flex-col neobrutalism-shadow-lg animate-in slide-in-from-bottom-8">
               <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Pagos del <span className="text-blue-500">Expediente</span></h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{historyMerchant.full_name}</p>
                  </div>
                  <button onClick={() => setHistoryMerchant(null)} className="p-3 bg-rose-600 border-2 border-black rounded-2xl text-white active:scale-90 shadow-lg"><X /></button>
               </div>

               <div className="grid grid-cols-3 gap-4 mb-8 text-center">
                  <div className="bg-blue-600/10 border-2 border-blue-600/30 p-4 rounded-2xl"><p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">TOTAL DEUDA</p><p className="text-xl font-black text-blue-400">${historyMerchant.total_debt.toLocaleString()}</p></div>
                  <div className="bg-emerald-500/10 border-2 border-emerald-500/30 p-4 rounded-2xl"><p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">ABONADO CICLO</p><p className="text-xl font-black text-emerald-500">${totalAbonadoCiclo.toLocaleString()}</p></div>
                  <div className="bg-rose-500/10 border-2 border-rose-500/30 p-4 rounded-2xl"><p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1">SALDO ACTUAL</p><p className="text-xl font-black text-rose-500">${historyMerchant.balance.toLocaleString()}</p></div>
               </div>

               <div className="p-4 bg-slate-900 border border-amber-500/30 rounded-2xl mb-4 text-center text-[9px] font-black text-amber-500 uppercase">
                  CICLO ACTUAL - SOLO ABONOS VIGENTES
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                  {merchantAbonos.length > 0 ? merchantAbonos.map(a => (
                    <div key={a.id} className="bg-slate-900 p-5 rounded-2xl border-2 border-slate-700 flex justify-between items-center group">
                       <div className="flex items-center gap-4">
                         <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20"><Receipt className="text-emerald-500 w-5 h-5" /></div>
                         <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{new Date(a.date).toLocaleDateString()}</p><p className="font-black text-sm uppercase tracking-tighter text-white">Abono Recibido</p></div>
                       </div>
                       <p className="text-xl font-black text-emerald-500 italic tracking-tighter">+$ {Number(a.amount).toLocaleString()}</p>
                    </div>
                  )) : (
                    <div className="py-20 text-center border-4 border-dashed border-slate-700 rounded-3xl">
                       <p className="text-xs font-black text-slate-500 uppercase tracking-widest italic">Sin abonos en el ciclo actual.</p>
                    </div>
                  )}
               </div>

               <div className="mt-8 pt-6 border-t-2 border-slate-700 flex flex-col sm:flex-row gap-4 items-center">
                  <p className="text-[9px] font-black text-slate-500 uppercase max-w-xs leading-relaxed">Abonos anteriores archivados para no afectar el nuevo saldo.</p>
                  <button onClick={() => { onEdit(historyMerchant); setHistoryMerchant(null); }} className="w-full sm:w-auto bg-emerald-500 border-4 border-black px-6 py-4 rounded-2xl font-black text-white text-xs uppercase neobrutalism-shadow flex items-center justify-center gap-3 active:scale-95 transition-all">
                    <FilePlus2 className="w-5 h-5" /> RENOVAR EXPEDIENTE <ArrowRight className="w-4 h-4" />
                  </button>
               </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE ELIMINACIÓN */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-[#1e1b1b] border-8 border-rose-600 p-10 rounded-[3.5rem] w-full max-w-md text-center neobrutalism-shadow-lg animate-in zoom-in-95">
            <ShieldAlert className="text-rose-600 w-14 h-14 mx-auto mb-8 animate-bounce" />
            <h3 className="text-4xl font-black uppercase mb-4 italic tracking-tighter text-white">¡ALTO!</h3>
            <p className="font-bold text-slate-300 text-sm uppercase mb-10 tracking-widest leading-relaxed">¿Estás seguro de eliminar este registro?</p>
            <div className="grid grid-cols-2 gap-6">
              <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-700 border-4 border-black p-5 rounded-2xl font-black uppercase text-xs text-white active:scale-95">No</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="bg-rose-600 border-4 border-black p-5 rounded-2xl font-black uppercase text-xs text-white neobrutalism-shadow active:scale-95">Sí, Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
