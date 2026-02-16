
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Loader2, Edit2, Trash2, X, Receipt, History, IdCard, StickyNote, PackageCheck, Filter, ChevronRight, DollarSign, MapPin, Briefcase, RefreshCw, Archive, Save, ZoomIn, CheckSquare, Square, RotateCw, ShieldCheck, ShieldAlert, BadgeCheck, QrCode, AlertTriangle, PackageOpen, CheckCircle2, MessageCircle, Eye } from 'lucide-react';
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
type FilterType = 'ALL' | 'NO_PAYMENTS' | 'IN_PROGRESS' | 'LIQUIDATED' | 'NO_INE';

export const MerchantList: React.FC<MerchantListProps> = ({ user, onRefresh, onEdit, delegatesCanCollect = false, systemLogo }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [totalCount, setTotalCount] = useState(0);
  
  // Estado para las fotos "volteadas" (IDs que están mostrando el INE)
  const [flippedIneIds, setFlippedIneIds] = useState<Set<string>>(new Set());
  
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoLoading, setAbonoLoading] = useState(false);
  
  // Estado para confirmación de pago exitoso
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    merchant: Merchant;
    amount: number;
    newBalance: number;
  } | null>(null);
  
  const [historyMerchant, setHistoryMerchant] = useState<Merchant | null>(null);
  const [merchantAbonos, setMerchantAbonos] = useState<(Abono & { archived?: boolean })[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const [selectedCredential, setSelectedCredential] = useState<Merchant | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  const [deleteMerchantId, setDeleteMerchantId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados para Cierre de Ciclo
  const [closingCycleMerchant, setClosingCycleMerchant] = useState<Merchant | null>(null);
  const [newCycleDebt, setNewCycleDebt] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);

  const [selectedForDelivery, setSelectedForDelivery] = useState<Set<string>>(new Set());

  const loaderRef = useRef<HTMLDivElement>(null);
  const isSecretary = user?.role === 'SECRETARY';
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
    setFlippedIneIds(new Set()); // Limpiar flips al cambiar filtros
    fetchData(0, debouncedSearch, activeFilter, true);
    if (isAdmin) dataService.getZones().then(setZones);
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
      await supabase.from('abonos').insert({ 
        merchant_id: selectedMerchant.id, 
        amount, 
        recorded_by: authUser?.id
      });
      
      const newBalance = selectedMerchant.balance - amount;
      
      setPaymentSuccessData({
        merchant: selectedMerchant,
        amount: amount,
        newBalance: newBalance
      });

      setSelectedMerchant(null);
      setAbonoAmount('');
      handleManualSync();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setAbonoLoading(false);
    }
  };

  const sendWhatsAppReceipt = () => {
    if (!paymentSuccessData) return;
    const { merchant, amount, newBalance } = paymentSuccessData;
    
    const message = `*RECIBO DE PAGO - ATCEM*\n\n` +
      `Hola *${merchant.first_name} ${merchant.last_name_paterno} ${merchant.last_name_materno}*,\n` +
      `Hemos registrado tu abono exitosamente.\n\n` +
      `*Detalles del Movimiento:*\n` +
      `💰 Cantidad abonada: *$${amount.toLocaleString()}*\n` +
      `📉 Saldo restante: *$${newBalance.toLocaleString()}*\n\n` +
      `¡Muchas gracias por tu pago y puntualidad! Que tengas un excelente día.`;
    
    const encodedMsg = encodeURIComponent(message);
    const cleanPhone = merchant.phone?.replace(/\D/g, '');
    if (cleanPhone) {
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
      window.open(waUrl, '_blank');
    } else {
      alert("El comerciante no tiene un número de teléfono registrado.");
    }
  };

  const handleCloseCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingCycleMerchant || !newCycleDebt) return;
    setClosingLoading(true);
    try {
      await dataService.closeMerchantCycle(closingCycleMerchant.id, parseFloat(newCycleDebt));
      setClosingCycleMerchant(null);
      handleManualSync();
      alert("¡Ciclo cerrado con éxito! Los pagos anteriores se han archivado.");
    } catch (err: any) {
      alert("Error al cerrar ciclo: " + err.message);
    } finally {
      setClosingLoading(false);
    }
  };

  const handleDeleteMerchant = async () => {
    if (!deleteMerchantId) return;
    setIsDeleting(true);
    try {
      await dataService.deleteMerchant(deleteMerchantId);
      setDeleteMerchantId(null);
      handleManualSync();
    } catch (err: any) {
      alert("Error al eliminar comerciante: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const openHistory = async (m: Merchant) => {
    setHistoryMerchant(m);
    setHistoryLoading(true);
    try {
      const { data } = await supabase.from('abonos').select('*').eq('merchant_id', m.id).order('date', { ascending: false });
      setMerchantAbonos(data || []);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedForDelivery);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedForDelivery(next);
  };

  return (
    <div className="space-y-8 pb-32">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 text-white">
        <div className="space-y-2">
          <h2 className="text-4xl font-black uppercase italic tracking-tighter">
            Control de <span className="text-blue-500">Expedientes</span>
          </h2>
          
          <div className="flex flex-wrap items-center gap-3">
             <button 
                onClick={handleManualSync}
                disabled={loading}
                className="bg-blue-600 border-2 border-black px-4 py-1.5 rounded-full flex items-center gap-2 group active:scale-95 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-blue-500 disabled:opacity-50"
             >
                <RotateCw size={14} className={`text-white ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">
                  {loading ? 'Sincronizando...' : 'Sincronizar Ciclo'}
                </span>
             </button>
             <div className="h-1 w-1 bg-slate-700 rounded-full" />
             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
               {totalCount} Registros Totales
             </p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row w-full xl:w-auto gap-4">
          <div className="bg-slate-900 border-2 border-black rounded-2xl p-1 flex overflow-x-auto neobrutalism-shadow custom-scrollbar">
            {(['ALL', 'NO_PAYMENTS', 'IN_PROGRESS', 'LIQUIDATED', 'NO_INE'] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeFilter === f ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'
                }`}
              >
                {f === 'ALL' ? 'Todos' : f === 'NO_PAYMENTS' ? 'Pendientes' : f === 'IN_PROGRESS' ? 'Abonando' : f === 'LIQUIDATED' ? 'Liquidados' : 'Sin ID'}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-96 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Buscar por nombre o giro..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="w-full bg-slate-800 border-4 border-black p-4 pl-12 rounded-2xl font-black outline-none focus:border-blue-500 neobrutalism-shadow" 
              />
            </div>
            
            <button 
              onClick={handleManualSync}
              disabled={loading}
              className="bg-amber-500 border-4 border-black p-4 rounded-2xl neobrutalism-shadow active:scale-95 transition-all group shrink-0"
              title="Actualizar Datos Ahora"
            >
              <RotateCw className={`text-black w-6 h-6 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {merchants.map(m => {
          const balance = Number(m.balance);
          const totalDebt = Number(m.total_debt);
          const isInTransit = m.ready_for_admin && !m.admin_received;
          const isSelected = selectedForDelivery.has(m.id);
          const hasIne = !!m.ine_photo;
          const isIneFlipped = flippedIneIds.has(m.id);
          
          let statusColor = 'border-slate-700';
          let accentText = 'text-slate-400';
          if (totalDebt > 0) {
             if (balance === 0) { statusColor = 'border-blue-600'; accentText = 'text-blue-500'; }
             else if (balance < totalDebt) { statusColor = 'border-amber-500'; accentText = 'text-amber-500'; }
             else { statusColor = 'border-rose-600'; accentText = 'text-rose-500'; }
          }

          return (
            <div key={m.id} className={`merchant-card bg-slate-900/40 border-4 ${statusColor} rounded-[2.5rem] p-5 flex flex-col gap-4 relative neobrutalism-shadow transition-all hover:scale-[1.02] ${isSelected ? 'ring-4 ring-blue-500 ring-offset-4 ring-offset-slate-950' : ''}`}>
              
              {isSecretary && balance === 0 && !isInTransit && (
                <button onClick={() => toggleSelection(m.id)} className="absolute -top-3 -right-3 z-30 p-2 bg-white border-4 border-black rounded-xl">
                  {isSelected ? <CheckSquare className="text-blue-600 w-6 h-6" /> : <Square className="text-slate-400 w-6 h-6" />}
                </button>
              )}

              {isInTransit && (
                <div className="absolute -top-3 -right-3 z-30 px-3 py-1 bg-violet-600 border-2 border-black rounded-xl text-[8px] font-black text-white italic neobrutalism-shadow animate-bounce">
                  EN TRÁNSITO
                </div>
              )}

              <div className="flex gap-4">
                <div className="relative w-16 h-16 flex-shrink-0">
                  {/* Contenedor Doble Cara (Flip) */}
                  <div className="photo-flip-container group/flip">
                    <div className={`photo-flip-inner ${isIneFlipped ? 'is-flipped' : ''}`}>
                      <div className="photo-flip-front">
                        <img 
                          src={m.profile_photo || `https://ui-avatars.com/api/?name=${m.first_name}`} 
                          loading="lazy" 
                          className="w-full h-full border-2 border-black object-cover bg-slate-800" 
                        />
                      </div>
                      <div className="photo-flip-back bg-slate-900 flex items-center justify-center">
                        {hasIne ? (
                          <img src={m.ine_photo} className="w-full h-full object-cover border-2 border-blue-500" />
                        ) : (
                          <div className="text-[8px] font-black text-rose-500 text-center px-1">SIN ID</div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Badge de Verificación y Botón Flip */}
                  {hasIne ? (
                    <button 
                      onClick={() => toggleIneFlip(m.id)}
                      className="absolute -bottom-2 -left-2 p-1.5 rounded-lg border border-black shadow-lg z-20 bg-emerald-500 hover:scale-110 transition-transform active:rotate-180"
                      title="Ver Identificación"
                    >
                      {isIneFlipped ? <IdCard size={10} className="text-white" /> : <ShieldCheck size={10} className="text-white" />}
                    </button>
                  ) : (
                    <div className="absolute -bottom-2 -left-2 p-1 rounded-lg border border-black shadow-lg z-20 bg-slate-700" title="Falta Identificación">
                      <ShieldCheck className="w-3 h-3 text-slate-400" />
                    </div>
                  )}

                  {m.note && (
                    <div className="absolute -top-2 -right-2 bg-amber-500 p-1 rounded-full border border-black cursor-help z-20 group/note" title={m.note}>
                      <StickyNote className="w-3 h-3 text-black" />
                      
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 p-4 bg-slate-900 border-2 border-black rounded-2xl text-[10px] font-bold text-slate-300 neobrutalism-shadow invisible group-hover/note:visible opacity-0 group-hover/note:opacity-100 transition-all duration-300 z-[100] pointer-events-none">
                        <div className="flex items-center gap-2 mb-2 border-b-2 border-slate-800 pb-2">
                           <div className="bg-amber-500 p-1 rounded-lg border border-black">
                              <StickyNote size={12} className="text-black" />
                           </div>
                           <span className="text-amber-500 font-black uppercase tracking-widest italic">Nota de Registro</span>
                        </div>
                        <p className="leading-relaxed text-slate-200">"{m.note}"</p>
                        <div className="absolute top-[calc(100%-8px)] left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 border-r-2 border-b-2 border-black rotate-45" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-[13px] uppercase truncate text-white leading-none">{m.first_name}</h3>
                  <p className="font-bold text-[10px] uppercase truncate text-slate-400 mt-1">{m.last_name_paterno} {m.last_name_materno}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase mt-1 truncate">{m.giro}</p>
                  
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => openHistory(m)} title="Historial" className="p-1.5 bg-slate-800 border border-black rounded-lg text-white hover:bg-slate-700 transition-colors"><History size={12}/></button>
                    <button onClick={() => setSelectedCredential(m)} title="Credencial" className="p-1.5 bg-blue-600 border border-black rounded-lg text-white hover:bg-blue-500 transition-colors"><IdCard size={12}/></button>
                    {isAdmin && (
                      <>
                        <button onClick={() => { setClosingCycleMerchant(m); setNewCycleDebt(m.total_debt.toString()); }} title="Finalizar Ciclo" className="p-1.5 bg-violet-600 border border-black rounded-lg text-white hover:bg-violet-500 transition-colors"><PackageOpen size={12}/></button>
                        <button onClick={() => onEdit(m)} title="Editar" className="p-1.5 bg-slate-700 border border-black rounded-lg text-white hover:bg-blue-600 transition-colors"><Edit2 size={12}/></button>
                        <button onClick={() => setDeleteMerchantId(m.id)} title="Eliminar" className="p-1.5 bg-rose-600 border border-black rounded-lg text-white hover:bg-rose-500 transition-colors"><Trash2 size={12}/></button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-black/30 p-4 rounded-2xl flex justify-between items-center">
                 <div>
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Saldo Pendiente</span>
                    <p className={`text-xl font-black italic tracking-tighter ${accentText}`}>${balance.toLocaleString()}</p>
                 </div>
                 <button 
                  onClick={() => balance > 0 ? setSelectedMerchant(m) : null}
                  className={`px-4 py-2 rounded-xl border-2 border-black font-black text-[9px] uppercase transition-all ${
                    balance > 0 ? 'bg-white text-black hover:bg-slate-200 active:scale-95' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                 >
                   Cobrar
                 </button>
              </div>
            </div>
          );
        })}
      </div>

      <div ref={loaderRef} className="h-40 flex flex-col justify-center items-center gap-4 text-white">
        {loading && (
          <>
            <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em] animate-pulse">Sincronizando Expedientes...</span>
          </>
        )}
      </div>

      {/* MODAL DE ÉXITO DE PAGO / CONFIRMACIÓN */}
      {paymentSuccessData && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[4000] flex items-center justify-center p-4">
          <div className="bg-slate-800 border-4 border-black p-8 sm:p-12 rounded-[3rem] w-full max-w-md neobrutalism-shadow-lg text-white animate-in zoom-in-95 duration-300">
             <div className="bg-emerald-500 w-24 h-24 rounded-[2rem] border-4 border-black flex items-center justify-center mx-auto mb-8 neobrutalism-shadow -rotate-6">
                <CheckCircle2 className="w-12 h-12 text-white" />
             </div>
             
             <h3 className="text-3xl font-black text-center uppercase tracking-tighter italic mb-2">¡Pago Registrado!</h3>
             <p className="text-center font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-10">Comprobante Digital Generado</p>

             <div className="bg-slate-900 border-4 border-black rounded-[2rem] p-6 space-y-4 mb-10">
                <div className="flex flex-col border-b-2 border-slate-800 pb-3">
                   <span className="text-[10px] font-black text-slate-500 uppercase">Comerciante</span>
                   <span className="font-black text-xs uppercase truncate">{paymentSuccessData.merchant.first_name} {paymentSuccessData.merchant.last_name_paterno}</span>
                </div>
                <div className="flex justify-between items-center border-b-2 border-slate-800 pb-3">
                   <span className="text-[10px] font-black text-slate-500 uppercase">Abono Recibido</span>
                   <span className="font-black text-xl italic text-emerald-500 tracking-tighter">${paymentSuccessData.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-[10px] font-black text-slate-500 uppercase">Saldo Actual</span>
                   <span className="font-black text-xl italic text-white tracking-tighter">${paymentSuccessData.newBalance.toLocaleString()}</span>
                </div>
             </div>

             <div className="flex flex-col gap-4">
                <button 
                  onClick={sendWhatsAppReceipt}
                  className="w-full bg-emerald-600 border-4 border-black p-5 rounded-2xl font-black text-white uppercase text-xs neobrutalism-shadow hover:bg-emerald-500 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <MessageCircle className="w-5 h-5" /> Enviar por WhatsApp
                </button>
                <button 
                  onClick={() => setPaymentSuccessData(null)}
                  className="w-full bg-slate-700 border-2 border-black p-4 rounded-2xl font-black text-white uppercase text-[10px] tracking-widest active:scale-95 transition-all"
                >
                  Finalizar Operación
                </button>
             </div>
          </div>
        </div>
      )}

      {/* ... (Resto de los modales permanecen igual) */}
    </div>
  );
};
