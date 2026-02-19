
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Loader2, Edit2, Trash2, X, History, IdCard, Filter, DollarSign, MapPin, Briefcase, RotateCw, ShieldCheck, ShieldAlert, QrCode, AlertTriangle, PackageOpen, CheckCircle2, MessageCircle, Ruler, Calendar, Info, StickyNote } from 'lucide-react';
import { supabase } from '../services/supabase';
import { dataService } from '../services/dataService';
import { Merchant, Abono, User as UserType, Zone } from '../types';

interface MerchantListProps {
  user: UserType | null;
  systemLogo?: string | null;
  onRefresh: (silent?: boolean) => void;
  onEdit: (merchant: Merchant) => void;
  delegatesCanCollect?: boolean;
}

const PAGE_SIZE = 12;
type FilterType = 'ALL' | 'NO_PAYMENTS' | 'IN_PROGRESS' | 'LIQUIDATED' | 'NO_INE';

const FILTER_LABELS: Record<FilterType, string> = {
  ALL: 'TODOS',
  NO_PAYMENTS: 'SIN ABONOS',
  IN_PROGRESS: 'EN PROCESO',
  LIQUIDATED: 'LIQUIDADOS',
  NO_INE: 'SIN INE'
};

export const MerchantList: React.FC<MerchantListProps> = ({ user, onRefresh, onEdit, systemLogo }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [totalCount, setTotalCount] = useState(0);
  
  const [flippedIneIds, setFlippedIneIds] = useState<Set<string>>(new Set());
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoLoading, setAbonoLoading] = useState(false);
  
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    merchant: Merchant;
    amount: number;
    newBalance: number;
    date: Date;
  } | null>(null);

  const [historyMerchant, setHistoryMerchant] = useState<Merchant | null>(null);
  const [merchantAbonos, setMerchantAbonos] = useState<Abono[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<Merchant | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [deleteMerchantId, setDeleteMerchantId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [closingCycleMerchant, setClosingCycleMerchant] = useState<Merchant | null>(null);
  const [newCycleDebt, setNewCycleDebt] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);

  const loaderRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchData = useCallback(async (pageNum: number, search: string, filter: FilterType, isNew: boolean = false) => {
    if (loading && !isNew) return;
    setLoading(true);
    try {
      const { data, totalCount: count } = await dataService.getMerchantsPaginated(pageNum, PAGE_SIZE, search, user, filter);
      setMerchants(prev => isNew ? data : [...prev, ...data]);
      setTotalCount(count);
      setHasMore(data.length === PAGE_SIZE);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user, loading]);

  useEffect(() => {
    setMerchants([]);
    setPage(0);
    setHasMore(true);
    fetchData(0, debouncedSearch, activeFilter, true);
  }, [debouncedSearch, activeFilter, user]);

  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        setPage(prev => {
          const next = prev + 1;
          fetchData(next, debouncedSearch, activeFilter);
          return next;
        });
      }
    }, { threshold: 0.1 });
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, debouncedSearch, activeFilter, fetchData]);

  const handleManualSync = () => {
    setMerchants([]);
    setPage(0);
    setHasMore(true);
    fetchData(0, debouncedSearch, activeFilter, true);
    onRefresh(true);
  };

  const toggleIneFlip = (id: string) => {
    const next = new Set(flippedIneIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFlippedIneIds(next);
  };

  const handleAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchant || !abonoAmount) return;
    const amount = parseFloat(abonoAmount);
    setAbonoLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const now = new Date();
      const { error } = await supabase.from('abonos').insert({ 
        merchant_id: selectedMerchant.id, 
        amount, 
        recorded_by: authUser?.id,
        date: now.toISOString()
      });
      if (error) throw error;
      setPaymentSuccessData({ merchant: selectedMerchant, amount, newBalance: selectedMerchant.balance - amount, date: now });
      setSelectedMerchant(null);
      setAbonoAmount('');
      handleManualSync();
    } catch (err: any) { alert(err.message); } finally { setAbonoLoading(false); }
  };

  const handleCloseCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingCycleMerchant || !newCycleDebt) return;
    setClosingLoading(true);
    try {
      await dataService.closeMerchantCycle(closingCycleMerchant.id, parseFloat(newCycleDebt));
      setClosingCycleMerchant(null);
      setNewCycleDebt('');
      handleManualSync();
      alert("✅ Ciclo de pagos cerrado y renovado exitosamente.");
    } catch (err: any) {
      alert("Error al cerrar ciclo: " + err.message);
    } finally {
      setClosingLoading(false);
    }
  };

  const sendWhatsAppReceipt = () => {
    if (!paymentSuccessData) return;
    const { merchant, amount, newBalance, date } = paymentSuccessData;
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullName = `${merchant.first_name} ${merchant.last_name_paterno} ${merchant.last_name_materno || ''}`.trim();
    const message = `*RECIBO DE PAGO OFICIAL - ATCEM*\n\nHola *${fullName}*,\nHemos registrado tu abono exitosamente.\n\n*Detalles del Movimiento:*\n📅 Fecha: ${dateStr}\n⏰ Hora: ${timeStr}\n💰 Cantidad Abonada: *$${amount.toLocaleString()}*\n📉 *Saldo Pendiente: $${newBalance.toLocaleString()}*\n\n¡Muchas gracias por tu pago!\n\n_ATCEM v2.5_`;
    const encodedMsg = encodeURIComponent(message);
    const cleanPhone = merchant.phone?.replace(/\D/g, '');
    if (cleanPhone) window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
    else alert("Sin teléfono registrado.");
  };

  const openHistory = async (m: Merchant) => {
    setHistoryMerchant(m);
    setHistoryLoading(true);
    try {
      const { data } = await supabase.from('abonos').select('*').eq('merchant_id', m.id).order('date', { ascending: false });
      setMerchantAbonos(data || []);
    } finally { setHistoryLoading(false); }
  };

  const handleDeleteMerchant = async () => {
    if (!deleteMerchantId) return;
    setIsDeleting(true);
    try {
      await dataService.deleteMerchant(deleteMerchantId);
      setDeleteMerchantId(null);
      handleManualSync();
    } catch (err: any) { alert(err.message); } finally { setIsDeleting(false); }
  };

  return (
    <div className="space-y-8 pb-32">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 text-white">
        <div className="space-y-2">
          <h2 className="text-4xl font-black uppercase italic tracking-tighter">Control de <span className="text-blue-500">Expedientes</span></h2>
          <div className="flex flex-wrap items-center gap-3">
             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{totalCount} Registros</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row w-full xl:w-auto gap-4 items-center">
          <div className="bg-slate-900 border-2 border-black rounded-2xl p-1 flex overflow-x-auto custom-scrollbar">
            {(['ALL', 'NO_PAYMENTS', 'IN_PROGRESS', 'LIQUIDATED', 'NO_INE'] as FilterType[]).map(f => (
              <button 
                key={f} 
                onClick={() => setActiveFilter(f)} 
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeFilter === f ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
          <div className="flex w-full md:w-auto gap-3 items-center">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="w-full bg-slate-800 border-4 border-black p-4 pl-12 rounded-2xl font-black outline-none focus:border-blue-500" 
              />
            </div>
            <button 
              onClick={handleManualSync} 
              disabled={loading} 
              title="Actualizar Datos"
              className="bg-amber-400 border-2 border-black p-4 rounded-2xl text-black neobrutalism-shadow active:scale-95 transition-all disabled:opacity-50"
            >
              <RotateCw size={24} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {merchants.map(m => {
          const balance = Number(m.balance);
          const totalDebt = Number(m.total_debt);
          const isIneFlipped = flippedIneIds.has(m.id);
          const hasIne = !!m.ine_photo && m.ine_photo.length > 0;
          let statusColor = balance === 0 ? 'border-blue-600' : balance < totalDebt ? 'border-amber-500' : 'border-rose-600';

          return (
            <div key={m.id} className={`bg-slate-900/40 border-4 ${statusColor} rounded-[2.5rem] p-5 flex flex-col gap-4 relative neobrutalism-shadow transition-all hover:scale-[1.02]`}>
              {m.note && (
                <div 
                  className="absolute -top-2 -right-2 bg-yellow-400 border-2 border-black p-1.5 rounded-xl neobrutalism-shadow rotate-12 z-30 group/note cursor-help"
                  title={m.note}
                >
                  <StickyNote size={14} className="text-black" />
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-black border-2 border-white p-2 rounded-xl text-[10px] font-bold text-white opacity-0 group-hover/note:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl">
                    {m.note}
                  </div>
                </div>
              )}
              <div className="flex gap-4">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <div className={`w-full h-full relative transition-transform duration-500 ${isIneFlipped ? '[transform:rotateY(180deg)]' : ''} [transform-style:preserve-3d]`}>
                    <img src={m.profile_photo || `https://ui-avatars.com/api/?name=${m.first_name}`} className="absolute inset-0 w-full h-full border-2 border-black object-cover rounded-xl [backface-visibility:hidden]" />
                    <div className="absolute inset-0 w-full h-full bg-slate-800 rounded-xl [transform:rotateY(180deg)] [backface-visibility:hidden] overflow-hidden border-2 border-blue-500">
                      <img src={m.ine_photo} className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleIneFlip(m.id); }} 
                    title={hasIne ? "Ver Identificación" : "Falta Identificación"}
                    className={`absolute -bottom-2 -left-2 p-1.5 rounded-lg border border-black z-20 hover:scale-110 transition-colors ${hasIne ? 'bg-emerald-500' : 'bg-slate-500'}`}
                  >
                    <IdCard size={10} className="text-white" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-[13px] uppercase truncate text-white leading-none">{m.first_name}</h3>
                  <p className="font-bold text-[10px] uppercase truncate text-slate-400 mt-1">{m.last_name_paterno} {m.last_name_materno}</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={(e) => { e.stopPropagation(); openHistory(m); }} className="p-1.5 bg-slate-800 border border-black rounded-lg text-white hover:bg-slate-700"><History size={12}/></button>
                    <button onClick={(e) => { e.stopPropagation(); setIsFlipped(false); setSelectedCredential(m); }} className="p-1.5 bg-blue-600 border border-black rounded-lg text-white hover:bg-blue-500"><IdCard size={12}/></button>
                    {isAdmin && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setClosingCycleMerchant(m); setNewCycleDebt(m.total_debt?.toString() || '0'); }} className="p-1.5 bg-purple-600 border border-black rounded-lg text-white hover:bg-purple-500"><PackageOpen size={12}/></button>
                        <button onClick={(e) => { e.stopPropagation(); onEdit(m); }} className="p-1.5 bg-slate-700 border border-black rounded-lg text-white hover:bg-blue-600"><Edit2 size={12}/></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteMerchantId(m.id); }} className="p-1.5 bg-rose-600 border border-black rounded-lg text-white hover:bg-rose-500"><Trash2 size={12}/></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-black/30 p-4 rounded-2xl flex justify-between items-center">
                 <div>
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Saldo</span>
                    <p className={`text-xl font-black italic tracking-tighter ${balance === 0 ? 'text-blue-500' : 'text-rose-500'}`}>${balance.toLocaleString()}</p>
                 </div>
                 <button onClick={(e) => { e.stopPropagation(); balance > 0 ? setSelectedMerchant(m) : null; }} className={`px-4 py-2 rounded-xl border-2 border-black font-black text-[9px] uppercase transition-all ${balance > 0 ? 'bg-white text-black hover:bg-slate-200' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>Cobrar</button>
              </div>
            </div>
          );
        })}
      </div>

      <div ref={loaderRef} className="h-20 flex justify-center items-center">
        {loading && <Loader2 className="animate-spin text-blue-500 w-10 h-10" />}
      </div>

      {/* MODAL DE CIERRE DE CICLO */}
      {closingCycleMerchant && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[4000] flex items-center justify-center p-4">
           <div className="bg-slate-800 border-4 border-black p-8 rounded-[3rem] w-full max-w-md neobrutalism-shadow-lg text-white animate-in zoom-in-95">
              <div className="bg-purple-600 w-16 h-16 rounded-2xl border-2 border-black flex items-center justify-center mx-auto mb-6 -rotate-6 shadow-xl"><PackageOpen size={32} /></div>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter text-center mb-2">Finalizar Ciclo</h3>
              <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest mb-8 leading-relaxed px-4">
                 Se archivarán los pagos de *{closingCycleMerchant.first_name} {closingCycleMerchant.last_name_paterno}* y se asignará la deuda para el siguiente periodo.
              </p>
              <form onSubmit={handleCloseCycle} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Nueva Deuda Asignada ($)</label>
                    <input 
                      type="number" required 
                      value={newCycleDebt} 
                      onChange={e => setNewCycleDebt(e.target.value)} 
                      className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-black text-xl text-purple-400 outline-none focus:border-purple-500" 
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <button type="button" onClick={() => setClosingCycleMerchant(null)} className="bg-slate-700 p-4 rounded-xl font-black uppercase text-xs active:scale-95 transition-all">Cancelar</button>
                    <button type="submit" disabled={closingLoading} className="bg-purple-600 border-4 border-black p-4 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 neobrutalism-shadow active:scale-95 transition-all">
                       {closingLoading ? <Loader2 className="animate-spin" /> : <ShieldCheck size={14} />} Confirmar
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* MODAL DE ABONO */}
      {selectedMerchant && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="bg-slate-800 border-4 border-black p-8 rounded-[3rem] w-full max-w-md neobrutalism-shadow-lg text-white">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black uppercase italic text-emerald-400">Registrar <span className="text-white">Abono</span></h3>
              <button onClick={() => setSelectedMerchant(null)} className="p-2 bg-slate-700 rounded-xl"><X /></button>
            </div>
            <form onSubmit={handleAbono} className="space-y-6">
              <div className="p-4 bg-slate-900 border-2 border-black rounded-2xl">
                 <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Comerciante</p>
                 <p className="font-black text-sm uppercase leading-tight">
                   {selectedMerchant.first_name}<br/>
                   <span className="text-slate-400 text-xs">{selectedMerchant.last_name_paterno} {selectedMerchant.last_name_materno}</span>
                 </p>
                 <p className="text-[10px] font-bold text-rose-400 mt-3 uppercase italic">Saldo Actual: ${selectedMerchant.balance.toLocaleString()}</p>
              </div>
              <input type="number" step="0.01" required value={abonoAmount} onChange={e => setAbonoAmount(e.target.value)} className="w-full bg-slate-900 border-2 border-black rounded-xl p-4 font-black text-2xl text-emerald-400 outline-none" placeholder="0.00" />
              <button type="submit" disabled={abonoLoading} className="w-full bg-emerald-500 border-4 border-black p-5 rounded-2xl font-black text-white text-lg neobrutalism-shadow">
                {abonoLoading ? <Loader2 className="animate-spin mx-auto" /> : 'CONFIRMAR PAGO'}
              </button>
            </form>
          </div>
        </div>
      )}

      {paymentSuccessData && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
          <div className="bg-slate-800 border-4 border-black p-10 rounded-[3rem] w-full max-w-sm neobrutalism-shadow-lg text-white text-center">
            <div className="bg-emerald-500 w-20 h-20 rounded-[2rem] border-4 border-black flex items-center justify-center mx-auto mb-6 shadow-xl">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black uppercase italic mb-2">¡Pago Exitoso!</h3>
            <div className="bg-slate-900 p-6 border-2 border-black rounded-3xl mb-8 space-y-3 text-left">
               <div className="flex justify-between items-center py-1">
                  <span className="text-[10px] font-black text-slate-500">Monto</span>
                  <span className="text-xl font-black text-emerald-500">+$ {paymentSuccessData.amount.toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl">
                  <span className="text-[10px] font-black text-slate-500">Saldo Pendiente</span>
                  <span className="text-lg font-black text-blue-400">$ {paymentSuccessData.newBalance.toLocaleString()}</span>
               </div>
            </div>
            <div className="flex flex-col gap-3">
               <button onClick={sendWhatsAppReceipt} className="w-full bg-emerald-600 border-4 border-black p-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3"><MessageCircle size={18} /> ENVIAR RECIBO</button>
               <button onClick={() => setPaymentSuccessData(null)} className="w-full bg-slate-700 border-2 border-black p-4 rounded-2xl font-black uppercase text-xs">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {selectedCredential && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <div className="flex justify-end mb-6">
              <button onClick={() => setSelectedCredential(null)} className="p-4 bg-white border-4 border-black rounded-2xl text-black neobrutalism-shadow active:scale-90 transition-transform"><X size={24} /></button>
            </div>
            <div className="credential-container" onClick={() => setIsFlipped(!isFlipped)}>
               <div className={`credential-inner ${isFlipped ? 'flipped' : ''}`}>
                  <div className="credential-front bg-slate-950 bg-security-grid p-8 flex flex-col items-center">
                    <div className="w-full flex justify-between items-start mb-10">
                       <div className="w-16 h-16 bg-blue-600 rounded-2xl border-2 border-black flex items-center justify-center p-2 neobrutalism-shadow">
                          {systemLogo ? <img src={systemLogo} className="w-full h-full object-contain" /> : <span className="text-2xl font-black italic text-white">A</span>}
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Vigencia 2024-2025</p>
                       </div>
                    </div>
                    <div className="w-44 h-44 rounded-full p-1 bg-gradient-to-tr from-blue-600 to-transparent shadow-2xl photo-glow overflow-hidden mb-8">
                       <img src={selectedCredential.profile_photo} className="w-full h-full object-cover rounded-full" />
                    </div>
                    <div className="text-center mb-8">
                       <h2 className="text-4xl font-black uppercase italic tracking-tighter metallic-gold leading-[0.9]">{selectedCredential.first_name}</h2>
                       <h2 className="text-2xl font-black uppercase italic tracking-tighter metallic-gold mt-2 leading-tight">
                         {selectedCredential.last_name_paterno}<br/>
                         {selectedCredential.last_name_materno}
                       </h2>
                    </div>
                    <div className="bg-black border-2 border-slate-800 px-6 py-2 rounded-full mb-auto shadow-xl">
                       <p className="text-[11px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-2"><Briefcase size={12} className="text-blue-500" /> {selectedCredential.giro}</p>
                    </div>
                    <div className="w-full text-right mt-10">
                       <p className="text-[8px] font-bold text-slate-500 uppercase">Folio</p>
                       <p className="text-xl font-black text-white italic">#{selectedCredential.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="credential-back bg-slate-950 bg-security-grid p-8 flex flex-col items-center">
                     <div className="w-48 h-48 bg-white p-4 rounded-[2.5rem] border-4 border-black mb-6 neobrutalism-shadow">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ATCEM-ID-${selectedCredential.id}`} className="w-full h-full" />
                     </div>
                     <div className="w-full space-y-3">
                        {selectedCredential.assignments.map((a, i) => (
                          <div key={i} className="bg-slate-900 border-2 border-black p-4 rounded-2xl flex justify-between items-center">
                             <p className="font-black text-sm uppercase italic text-white">{(a as any).zones?.name || 'ZONA'}</p>
                             <div className="bg-blue-600 px-3 py-1 rounded-lg border border-black"><p className="text-[9px] font-black text-white">{a.meters} MTS</p></div>
                          </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {historyMerchant && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="bg-slate-800 border-4 border-black p-8 rounded-[3rem] w-full max-w-2xl text-white h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-8">
               <h3 className="text-2xl font-black uppercase italic text-blue-500">Historial de <span className="text-white">Pagos</span></h3>
               <button onClick={() => setHistoryMerchant(null)} className="p-3 bg-slate-700 rounded-2xl"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
               {historyLoading ? <Loader2 className="animate-spin mx-auto mt-20" /> : merchantAbonos.map(a => (
                 <div key={a.id} className="flex justify-between items-center p-4 bg-slate-900 border-2 border-black rounded-2xl">
                    <div><p className="text-[10px] font-black text-slate-500">{new Date(a.date).toLocaleDateString()}</p></div>
                    <p className="text-xl font-black text-emerald-500">+${Number(a.amount).toLocaleString()}</p>
                 </div>
               ))}
            </div>
          </div>
        </div>
      )}

      {deleteMerchantId && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="bg-slate-800 border-4 border-black p-10 rounded-[3rem] w-full max-w-md text-center text-white">
            <AlertTriangle className="w-16 h-16 text-rose-600 mx-auto mb-6" />
            <h3 className="text-2xl font-black uppercase mb-4">¿Eliminar Expediente?</h3>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setDeleteMerchantId(null)} className="bg-slate-700 p-4 rounded-xl font-black uppercase text-xs">Cancelar</button>
              <button onClick={handleDeleteMerchant} disabled={isDeleting} className="bg-rose-600 border-2 border-black p-4 rounded-xl font-black uppercase text-xs">{isDeleting ? 'Borrando...' : 'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
