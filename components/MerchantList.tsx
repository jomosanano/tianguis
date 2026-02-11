
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, ChevronRight, User, DollarSign, Loader2, Briefcase, Filter, ArrowUp, Edit2, Trash2, Calendar, Clock, AlertTriangle, X, Send, CheckCircle2, Receipt, IdCard, RefreshCw, MapPin, ShieldCheck, Shield } from 'lucide-react';
import { supabase } from '../services/supabase';
import { dataService } from '../services/dataService';
import { Merchant, Abono, Role, User as UserType } from '../types';

interface MerchantListProps {
  user: UserType | null;
  systemLogo?: string | null;
  onRefresh: (silent?: boolean) => void;
  onEdit: (merchant: Merchant) => void;
}

const PAGE_SIZE = 12;

export const MerchantList: React.FC<MerchantListProps> = ({ user, systemLogo, onRefresh, onEdit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<{ amount: number; newBalance: number; date: string; time: string } | null>(null);
  
  const [historyMerchant, setHistoryMerchant] = useState<Merchant | null>(null);
  const [merchantAbonos, setMerchantAbonos] = useState<Abono[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [credentialMerchant, setCredentialMerchant] = useState<Merchant | null>(null);
  const [isCredentialFlipped, setIsCredentialFlipped] = useState(false);

  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoLoading, setAbonoLoading] = useState(false);

  const loaderRef = useRef<HTMLDivElement>(null);
  
  const isSecretary = user?.role === 'SECRETARY';

  const canModify = (merchant: Merchant) => {
    if (user?.role === 'ADMIN') return true;
    if (user?.role === 'DELEGATE') return true;
    return false;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
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
      const { data, totalCount } = await dataService.getMerchantsPaginated(pageNum, PAGE_SIZE, search, user);
      setMerchants(prev => isNew ? data : [...prev, ...data]);
      setTotalRecords(totalCount);
      setHasMore(data.length === PAGE_SIZE);
    } catch (error) {
      console.error("Error fetching merchants:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore && !loading) {
      setPage(prev => {
        const next = prev + 1;
        fetchData(next, debouncedSearch);
        return next;
      });
    }
  }, [hasMore, loading, debouncedSearch, user]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, { threshold: 0 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  const fetchHistory = async (merchant: Merchant) => {
    if (isSecretary) return; 
    setHistoryMerchant(merchant);
    setHistoryLoading(true);
    try {
      const history = await dataService.getMerchantAbonos(merchant.id);
      setMerchantAbonos(history);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchant || !abonoAmount) return;

    const amount = parseFloat(abonoAmount);
    if (amount <= 0 || amount > selectedMerchant.balance) {
      alert("Monto inválido");
      return;
    }

    setAbonoLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { error } = await supabase.from('abonos').insert({
        merchant_id: selectedMerchant.id,
        amount,
        recorded_by: authUser?.id
      });

      if (error) throw error;
      
      const now = new Date();
      const newBalance = selectedMerchant.balance - amount;
      
      setPaymentSuccess({ 
        amount, 
        newBalance,
        date: now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        time: now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      });
      
      setAbonoAmount('');
      onRefresh(true);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setAbonoLoading(false);
    }
  };

  const handleDeleteMerchant = async () => {
    if (!deleteConfirmId) return;
    setDeleteLoading(true);
    try {
      await dataService.deleteMerchant(deleteConfirmId);
      setDeleteConfirmId(null);
      onRefresh();
    } catch (err) {
      alert("Error al eliminar registro");
    } finally {
      setDeleteLoading(false);
    }
  };

  const openCredential = (merchant: Merchant) => {
    setCredentialMerchant(merchant);
    setIsCredentialFlipped(false);
  };

  return (
    <div className="space-y-8 sm:space-y-12 pb-32">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-100 leading-none tracking-tighter">
            Directorio <span className="text-blue-500">ATCEM</span>
          </h2>
          <div className="flex items-center gap-2 mt-3">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
               {isSecretary ? 'VISTA ADMINISTRATIVA: ' : user?.role === 'DELEGATE' ? 'Vigilancia Zona: ' : 'Censo Total: '} {totalRecords} registros
             </span>
             {loading && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
          </div>
        </div>
        
        <div className="relative w-full md:w-[400px] group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" placeholder="Buscar por nombre o giro..." 
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border-2 border-black neobrutalism-shadow rounded-2xl p-5 pl-14 font-bold outline-none focus:border-blue-500 text-base"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {merchants.map(merchant => {
          const totalDebt = Number(merchant.total_debt);
          const balance = Number(merchant.balance);
          const isLiquidated = totalDebt > 0 && balance <= 0;
          const hasPayments = balance > 0 && balance < totalDebt;

          const cardStyleClass = isLiquidated 
            ? 'bg-blue-900/40 border-blue-500 hover:border-blue-400' 
            : hasPayments 
              ? 'bg-amber-900/40 border-amber-500 hover:border-amber-400' 
              : 'bg-rose-900/40 border-rose-500 hover:border-rose-400';

          const canEdit = canModify(merchant);

          return (
            <div key={merchant.id} className={`${cardStyleClass} backdrop-blur-sm border-2 rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-8 neobrutalism-shadow flex flex-col gap-5 group transition-all duration-300 animate-in fade-in slide-in-from-bottom-2`}>
              
              <div className="flex items-start justify-between gap-3 overflow-hidden">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="relative flex-shrink-0">
                    <img 
                      src={merchant.profile_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(merchant.full_name)}&background=2563eb&color=fff&bold=true`} 
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] sm:rounded-[2rem] border-2 border-black object-cover bg-slate-900" 
                      alt={merchant.full_name} 
                    />
                    {!isSecretary && (
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-4 border-slate-800 ${
                        isLiquidated ? 'bg-emerald-500' : hasPayments ? 'bg-amber-500' : 'bg-rose-500'
                      }`} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-black leading-tight truncate uppercase tracking-tighter text-white">
                      {merchant.full_name}
                    </h3>
                    <div className="bg-slate-900/80 border border-slate-700 px-3 py-1 rounded-xl flex items-center gap-2 mt-2 w-fit">
                      <Briefcase className="w-3 h-3 text-blue-400" />
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest truncate max-w-[120px]">
                        {merchant.giro}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button onClick={() => openCredential(merchant)} className="p-2 bg-slate-900 border-2 border-black rounded-xl hover:bg-emerald-600 transition-colors shadow-sm">
                    <IdCard className="w-4 h-4 text-white" />
                  </button>
                  {canEdit && (
                    <button onClick={() => onEdit(merchant)} className="p-2 bg-slate-900 border-2 border-black rounded-xl hover:bg-blue-600 transition-colors shadow-sm">
                      <Edit2 className="w-4 h-4 text-white" />
                    </button>
                  )}
                  {user?.role === 'ADMIN' && (
                    <button onClick={() => setDeleteConfirmId(merchant.id)} className="p-2 bg-slate-900 border-2 border-black rounded-xl hover:bg-rose-600 transition-colors shadow-sm">
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>
              </div>

              {!isSecretary && (
                <div className="bg-slate-900/60 rounded-[2rem] p-5 sm:p-6 border-2 border-slate-700/50 space-y-4 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saldo Actual</span>
                    <span className={`font-black text-2xl sm:text-3xl tracking-tighter ${isLiquidated ? 'text-emerald-500' : 'text-rose-500'}`}>
                      ${balance.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-auto flex gap-3 sm:gap-4">
                <button 
                  onClick={() => !isSecretary && setSelectedMerchant(merchant)}
                  disabled={isSecretary || (user?.role === 'DELEGATE' && isLiquidated) || merchant.balance <= 0}
                  className="flex-[4] bg-blue-600 border-2 border-black py-4 sm:py-5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-[0.15em] text-white neobrutalism-shadow hover:neobrutalism-shadow-active transition-all disabled:opacity-30 active:scale-95"
                >
                  {isSecretary ? 'VISTA SOLO LECTURA' : isLiquidated ? 'VERIFICADO' : 'COBRAR ABONO'}
                </button>
                {!isSecretary && (
                  <button 
                    onClick={() => fetchHistory(merchant)}
                    className="flex-1 bg-slate-700 border-2 border-black rounded-2xl flex items-center justify-center text-white neobrutalism-shadow hover:neobrutalism-shadow-active active:scale-90 transition-all"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={loaderRef} className="py-20 flex flex-col items-center justify-center gap-4">
        {hasMore ? <Loader2 className="w-10 h-10 text-blue-500 animate-spin" /> : <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Fin de Directorio</p>}
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-slate-800 border-4 border-black p-10 rounded-[3rem] w-full max-md text-center">
            <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-6" />
            <h3 className="text-2xl font-black uppercase mb-4 tracking-tighter">¿Eliminar Registro?</h3>
            <p className="font-bold text-slate-400 text-sm mb-8 uppercase tracking-widest leading-relaxed">Se perderán todos los datos financieros y expedientes del comerciante.</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-700 border-2 border-black p-4 rounded-2xl font-black">CANCELAR</button>
              <button onClick={handleDeleteMerchant} disabled={deleteLoading} className="bg-rose-600 border-2 border-black p-4 rounded-2xl font-black text-white">
                {deleteLoading ? <Loader2 className="animate-spin mx-auto" /> : 'ELIMINAR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {credentialMerchant && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex flex-col items-center justify-start p-2 overflow-y-auto">
          {/* Header del Modal - REDUCIDO AL MÁXIMO */}
          <div className="w-full max-w-sm pt-2 mb-2 flex justify-between items-center px-4">
             <h3 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Credencial <span className="text-blue-500">Oficial</span></h3>
             <button onClick={() => setCredentialMerchant(null)} className="p-2 bg-rose-600 border-2 border-black rounded-xl text-white shadow-lg active:scale-90 transition-all leading-none"><X size={20}/></button>
          </div>
          
          {/* Contenedor de la Credencial - ALINEACIÓN TOTAL */}
          <div className="credential-container w-full max-w-[340px] h-[537px] relative">
            <div className={`credential-inner ${isCredentialFlipped ? 'flipped' : ''}`}>
              
              {/* VISTA FRONTAL */}
              <div className="credential-front bg-guilloche text-white border-[1px] border-slate-700 shadow-2xl">
                <div className="absolute inset-0 bg-security-grid pointer-events-none opacity-40"></div>
                
                <div className="w-full bg-slate-900/80 backdrop-blur-md p-6 border-b border-slate-700 flex flex-col items-center gap-1 z-10">
                   <div className="flex items-center gap-2">
                     <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center border border-white/20 overflow-hidden">
                       {systemLogo ? (
                         <img src={systemLogo} className="w-full h-full object-contain p-1" />
                       ) : (
                         <span className="font-black italic text-sm">A</span>
                       )}
                     </div>
                     <span className="font-black text-xl tracking-tighter metallic-silver uppercase italic">ATCEM</span>
                   </div>
                   <p className="text-[8px] font-black tracking-[0.4em] text-blue-400 uppercase mt-1">Identificación de Comerciante</p>
                </div>

                <div className="mt-10 relative z-10 flex flex-col items-center">
                   <div className="w-44 h-44 rounded-full p-1 bg-gradient-to-tr from-blue-900 via-blue-500 to-slate-800 shadow-2xl">
                      <div className="w-full h-full rounded-full border-4 border-slate-900 overflow-hidden bg-slate-950">
                        <img 
                          src={credentialMerchant.profile_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(credentialMerchant.full_name)}&background=1e293b&color=fff&bold=true`} 
                          className="w-full h-full object-cover" 
                          alt="Profile" 
                        />
                      </div>
                   </div>
                   <div className="absolute bottom-2 right-4 bg-emerald-500 p-2 rounded-full border-2 border-slate-900 shadow-xl">
                      <ShieldCheck className="w-4 h-4 text-white" />
                   </div>
                </div>

                <div className="mt-8 px-6 text-center z-10 w-full flex flex-col items-center">
                   <h2 className="text-2xl font-black uppercase tracking-tighter metallic-gold italic leading-none mb-2">
                     {credentialMerchant.full_name}
                   </h2>
                   <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/30 px-4 py-1.5 rounded-full mb-6">
                      <Briefcase className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest">
                        {credentialMerchant.giro}
                      </span>
                   </div>

                   <div className="grid grid-cols-2 gap-4 mt-4 text-left border-t border-slate-800/50 pt-6 w-full">
                      <div className="space-y-0.5">
                         <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Folio Sistema</span>
                         <p className="text-[10px] font-bold metallic-silver">#{credentialMerchant.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                      <div className="space-y-0.5 text-right">
                         <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Estatus Censo</span>
                         <p className="text-[10px] font-bold text-emerald-400 uppercase">Verificado</p>
                      </div>
                   </div>
                </div>

                <div className="mt-auto w-full bg-slate-950/80 p-4 border-t border-slate-800/50 flex items-center justify-between z-10">
                   <span className="text-[7px] font-bold text-slate-600 uppercase italic">Válido para ejercicio fiscal 2025</span>
                   <Shield className="w-3 h-3 text-slate-700" />
                </div>
              </div>

              {/* VISTA TRASERA - REDISEÑADA PARA ALINEACIÓN PERFECTA */}
              <div className="credential-back bg-slate-950 text-white border-[1px] border-slate-800 shadow-2xl">
                 <div className="absolute inset-0 bg-security-grid pointer-events-none opacity-20"></div>
                 
                 {/* Encabezado Espejo (Misma altura que el frontal) */}
                 <div className="w-full bg-slate-900/40 p-6 border-b border-slate-800 flex flex-col items-center gap-1 z-10">
                    <div className="flex items-center gap-2 opacity-50">
                      {systemLogo ? (
                        <img src={systemLogo} className="w-4 h-4 object-contain grayscale" />
                      ) : (
                        <ShieldCheck size={16} className="text-blue-500"/>
                      )}
                      <span className="text-[10px] font-black tracking-widest uppercase">Seguridad ATCEM</span>
                    </div>
                    <p className="text-[8px] font-black tracking-[0.4em] text-slate-600 uppercase mt-1">Reverso Institucional</p>
                 </div>

                 {/* Ajuste pt-10 para alinearse exactamente con el inicio de la foto frontal */}
                 <div className="pt-10 p-8 flex flex-col h-full">
                    <div className="relative z-10">
                       <h4 className="text-sm font-black italic text-blue-400 mb-6 uppercase tracking-widest flex items-center gap-2">
                          <MapPin className="w-4 h-4" /> Jurisdicción Territorial
                       </h4>
                       
                       <div className="space-y-3 mb-8 max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
                          {credentialMerchant.assignments.map((a, i) => (
                            <div key={i} className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between group">
                               <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                  <span className="text-[9px] font-black uppercase text-slate-200">{(a as any).zones?.name}</span>
                               </div>
                               <span className="text-[8px] font-black text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-md">{a.meters}m</span>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="mt-4 mb-8 text-center relative z-10">
                       <div className="w-full border-t border-slate-700 mt-10 mb-2 relative">
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-20 transform -rotate-6">
                             <span className="font-serif italic text-4xl text-blue-500 font-bold">Admin ATCEM</span>
                          </div>
                       </div>
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Firma del Administrador General ATCEM</p>
                    </div>

                    <div className="mt-auto flex flex-col items-center gap-4 relative z-10 pb-6">
                       <div className="p-2 bg-white rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                         <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=ATCEM-ID-${credentialMerchant.id}`} className="w-16 h-16" alt="QR" />
                       </div>
                       <div className="max-w-[200px] text-center">
                          <p className="text-[7px] font-medium text-slate-700 uppercase leading-relaxed tracking-wide">
                             Identificación intransferible. Acredita el uso autorizado de la vía pública bajo términos fiscales 2025.
                          </p>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-[340px] mt-4">
            <button 
              onClick={() => setIsCredentialFlipped(!isCredentialFlipped)} 
              className="w-full bg-slate-900 border-2 border-black p-5 rounded-[2.2rem] font-black text-white flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl hover:bg-slate-800"
            >
              <RefreshCw className={`w-5 h-5 ${isCredentialFlipped ? 'rotate-180 transition-transform' : 'transition-transform'}`} /> 
              {isCredentialFlipped ? 'VER ANVERSO' : 'VER REVERSO'}
            </button>
            <button 
              onClick={() => window.print()} 
              className="w-full bg-white border-2 border-slate-200 p-4 rounded-[2.2rem] font-black text-slate-900 flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl"
            >
              <Send className="w-4 h-4" /> EXPORTAR CREDENCIAL
            </button>
          </div>
        </div>
      )}

      {selectedMerchant && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 border-4 border-black p-8 rounded-[3rem] w-full max-w-lg text-center">
            {!paymentSuccess ? (
              <form onSubmit={handleAbono} className="space-y-6">
                <h3 className="text-3xl font-black uppercase italic">COBRO DE ABONO</h3>
                <div className="p-6 bg-slate-900 border-2 border-slate-700 rounded-[2rem]">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Restante: ${Number(selectedMerchant.balance).toLocaleString()}</p>
                  <input 
                    type="number" step="0.01" required autoFocus placeholder="0.00" 
                    value={abonoAmount} onChange={e => setAbonoAmount(e.target.value)} 
                    className="w-full bg-slate-800 border-4 border-black rounded-2xl p-6 font-black text-4xl outline-none focus:border-emerald-500 text-white text-center" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button type="button" onClick={() => setSelectedMerchant(null)} className="bg-slate-700 border-2 border-black p-5 rounded-2xl font-black">CANCELAR</button>
                  <button type="submit" disabled={abonoLoading} className="bg-emerald-500 border-2 border-black p-5 rounded-2xl font-black">
                    {abonoLoading ? <Loader2 className="animate-spin mx-auto" /> : 'CONFIRMAR'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6 animate-in zoom-in-95">
                <div className="w-20 h-20 bg-emerald-500 border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 className="w-10 h-10 text-white" /></div>
                <h2 className="text-3xl font-black uppercase italic">PAGO RECIBIDO</h2>
                <div className="bg-white text-slate-900 p-6 rounded-[2rem] border-4 border-black text-left">
                  <p className="font-black text-xl mb-2">${paymentSuccess.amount.toLocaleString()}</p>
                  <p className="text-xs font-bold text-slate-500 uppercase">Nuevo Saldo: ${paymentSuccess.newBalance.toLocaleString()}</p>
                </div>
                <button onClick={() => { setSelectedMerchant(null); setPaymentSuccess(null); }} className="w-full bg-slate-900 border-2 border-black p-5 rounded-2xl font-black uppercase">CERRAR</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
