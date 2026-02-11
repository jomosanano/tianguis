
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, ChevronRight, User, DollarSign, Loader2, Briefcase, Filter, ArrowUp, Edit2, Trash2, Calendar, Clock, AlertTriangle, X, Send, CheckCircle2, Receipt, IdCard, RefreshCw, MapPin, ShieldCheck } from 'lucide-react';
import { supabase } from '../services/supabase';
import { dataService } from '../services/dataService';
import { Merchant, Abono, Role } from '../types';

interface MerchantListProps {
  role: Role;
  onRefresh: (silent?: boolean) => void;
  onEdit: (merchant: Merchant) => void;
}

const PAGE_SIZE = 12;

export const MerchantList: React.FC<MerchantListProps> = ({ role, onRefresh, onEdit }) => {
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

  // Estados para Credencial
  const [credentialMerchant, setCredentialMerchant] = useState<Merchant | null>(null);
  const [isCredentialFlipped, setIsCredentialFlipped] = useState(false);

  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoLoading, setAbonoLoading] = useState(false);

  const loaderRef = useRef<HTMLDivElement>(null);

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
  }, [debouncedSearch]);

  const fetchData = async (pageNum: number, search: string, isNew: boolean = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const { data, totalCount } = await dataService.getMerchantsPaginated(pageNum, PAGE_SIZE, search);
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
  }, [hasMore, loading, debouncedSearch]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, { threshold: 0 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  const fetchHistory = async (merchant: Merchant) => {
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

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleteLoading(true);
    try {
      await dataService.deleteMerchant(deleteConfirmId);
      setMerchants(prev => prev.filter(m => m.id !== deleteConfirmId));
      setDeleteConfirmId(null);
      onRefresh();
    } catch (err) {
      alert("Error al eliminar");
    } finally {
      setDeleteLoading(false);
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
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('abonos').insert({
        merchant_id: selectedMerchant.id,
        amount,
        recorded_by: user?.id
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
      alert("Error al registrar abono: " + err.message);
    } finally {
      setAbonoLoading(false);
    }
  };

  const sendWhatsAppReceipt = () => {
    if (!selectedMerchant || !paymentSuccess) return;
    
    let rawPhone = selectedMerchant.phone?.replace(/\D/g, '') || '';
    if (!rawPhone) {
      alert("El comerciante no tiene teléfono registrado.");
      return;
    }

    const finalPhone = rawPhone.length === 10 ? `52${rawPhone}` : rawPhone;

    const messageText = `*¡Hola ${selectedMerchant.full_name}!* 👋\n\n` +
      `Confirmamos tu abono en *ATCEM*:\n` +
      `💰 *Monto Abonado:* $${paymentSuccess.amount.toLocaleString()}\n` +
      `📅 *Fecha:* ${paymentSuccess.date}\n` +
      `⏰ *Hora:* ${paymentSuccess.time}\n\n` +
      `📉 *Tu saldo pendiente actual:* $${paymentSuccess.newBalance.toLocaleString()}\n\n` +
      `Agradecemos tu cumplimiento y compromiso. ¡Que tengas un excelente día! ✨\n\n` +
      `_Atentamente, Administración ATCEM_`;

    const encodedMessage = encodeURIComponent(messageText);
    const waUrl = `https://wa.me/${finalPhone}?text=${encodedMessage}`;
    
    window.open(waUrl, '_blank');
  };

  const closePaymentModal = () => {
    setSelectedMerchant(null);
    setPaymentSuccess(null);
    fetchData(0, debouncedSearch, true);
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
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Censo Oficial: {totalRecords} registrados</span>
             {loading && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
          </div>
        </div>
        
        <div className="relative w-full md:w-[400px] group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o giro..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border-2 border-black neobrutalism-shadow rounded-2xl p-5 pl-14 font-bold outline-none focus:border-blue-500 text-base"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {merchants.map(merchant => (
          <div key={merchant.id} className="bg-slate-800/80 backdrop-blur-sm border-2 border-black rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-8 neobrutalism-shadow flex flex-col gap-5 group hover:border-blue-600 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
            
            <div className="flex items-start justify-between gap-3 overflow-hidden">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="relative flex-shrink-0">
                  {merchant.profile_photo ? (
                    <img 
                      loading="lazy" 
                      src={merchant.profile_photo} 
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] sm:rounded-[2rem] border-2 border-black object-cover bg-slate-900" 
                      alt={merchant.full_name} 
                      onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(merchant.full_name || 'C')}&background=2563eb&color=fff&bold=true`; }}
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-600 rounded-[1.5rem] sm:rounded-[2rem] border-2 border-black flex items-center justify-center">
                      <User className="text-white w-8 h-8 sm:w-10 sm:h-10" />
                    </div>
                  )}
                  <div className={`absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-4 border-slate-800 flex items-center justify-center ${
                    merchant.balance <= 0 ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}>
                    <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-black/30 rounded-full animate-pulse" />
                  </div>
                </div>
                
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-black leading-tight truncate uppercase tracking-tighter text-white" title={merchant.full_name}>
                    {merchant.full_name}
                  </h3>
                  <div className="bg-slate-900/80 border border-slate-700 px-3 py-1 rounded-xl flex items-center gap-2 mt-2 w-fit">
                    <Briefcase className="w-3 h-3 text-blue-400" />
                    <span className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest truncate max-w-[100px] sm:max-w-[150px]">
                      {merchant.giro}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-shrink-0">
                <button 
                  onClick={() => openCredential(merchant)}
                  className="p-2 bg-slate-900 border-2 border-black rounded-xl hover:bg-emerald-600 transition-colors shadow-sm group/btn relative"
                  title="Credencial"
                >
                  <IdCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </button>
                {(role === 'ADMIN' || role === 'SECRETARY') && (
                  <>
                    <button onClick={() => onEdit(merchant)} className="p-2 bg-slate-900 border-2 border-black rounded-xl hover:bg-blue-600 transition-colors shadow-sm">
                      <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    </button>
                    <button onClick={() => setDeleteConfirmId(merchant.id)} className="p-2 bg-slate-900 border-2 border-black rounded-xl hover:bg-rose-600 transition-colors shadow-sm">
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-[2rem] p-5 sm:p-6 border-2 border-slate-700/50 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest">Compromiso</span>
                <span className="font-black text-slate-200 text-base sm:text-lg">${Number(merchant.total_debt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resta</span>
                <span className="font-black text-rose-500 text-2xl sm:text-3xl tracking-tighter">${Number(merchant.balance).toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-auto flex gap-3 sm:gap-4">
              <button 
                onClick={() => setSelectedMerchant(merchant)}
                disabled={merchant.balance <= 0}
                className="flex-[4] bg-blue-600 border-2 border-black py-4 sm:py-5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-[0.15em] text-white neobrutalism-shadow hover:neobrutalism-shadow-active transition-all flex items-center justify-center gap-2 disabled:opacity-30 active:scale-95"
              >
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
                ABONAR
              </button>
              <button 
                onClick={() => fetchHistory(merchant)}
                className="flex-1 bg-slate-700 border-2 border-black rounded-2xl flex items-center justify-center text-white neobrutalism-shadow hover:neobrutalism-shadow-active active:scale-90 transition-all"
              >
                <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div ref={loaderRef} className="py-20 flex flex-col items-center justify-center gap-4">
        {hasMore ? (
          <>
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cargando censo...</p>
          </>
        ) : merchants.length > 0 && (
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Directorio Completo</p>
        )}
      </div>

      {/* Modal Credencial */}
      {credentialMerchant && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex flex-col items-center p-4 overflow-y-auto custom-scrollbar">
          <div className="w-full max-w-sm mt-4 mb-6 flex justify-between items-center flex-shrink-0">
            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Credencial <span className="text-blue-500">ATCEM</span></h3>
            <button onClick={() => setCredentialMerchant(null)} className="p-3 bg-rose-600 border-2 border-black rounded-2xl text-white neobrutalism-shadow active:scale-90">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="credential-container w-full max-w-[320px] aspect-[1/1.5] mb-8 flex-shrink-0">
            <div className={`credential-inner ${isCredentialFlipped ? 'flipped' : ''}`}>
              
              {/* Parte Frontal */}
              <div className="credential-front bg-white text-slate-900 border-[6px] border-black p-6 sm:p-8 flex flex-col items-center neobrutalism-shadow-lg overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-12 bg-blue-600 border-b-[4px] border-black flex items-center px-6">
                   <div className="font-black text-white italic tracking-tighter">ATCEM</div>
                   <div className="ml-auto flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-white" />
                      <span className="text-[8px] font-black text-white uppercase tracking-widest">Socio Oficial</span>
                   </div>
                </div>

                <div className="mt-12 sm:mt-14 mb-4 sm:mb-6">
                  <div className="w-36 h-36 sm:w-40 sm:h-40 bg-slate-100 border-4 border-black rounded-[2rem] overflow-hidden neobrutalism-shadow">
                    <img 
                      src={credentialMerchant.profile_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(credentialMerchant.full_name)}&background=2563eb&color=fff&bold=true`} 
                      className="w-full h-full object-cover" 
                      alt="Profile" 
                    />
                  </div>
                </div>

                <div className="text-center space-y-1 mb-6 sm:mb-8">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Folio de Registro</p>
                   <h4 className="text-xl font-black tracking-tighter text-blue-600 leading-none mb-4">ATC-{credentialMerchant.id.slice(0, 8).toUpperCase()}</h4>
                   
                   <h2 className="text-xl sm:text-2xl font-black leading-tight uppercase tracking-tighter italic border-t-2 border-slate-100 pt-4">
                     {credentialMerchant.full_name}
                   </h2>
                   
                   <div className="inline-block bg-slate-900 text-white px-4 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest mt-4">
                     {credentialMerchant.giro}
                   </div>
                </div>

                <div className="mt-auto w-full border-t-4 border-black border-dashed pt-4 flex justify-between items-center">
                   <div className="text-left">
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estatus</p>
                     <p className="text-xs font-black text-emerald-600 uppercase">Activo 2024</p>
                   </div>
                   <div className="w-10 h-10 bg-blue-600 border-2 border-black rounded-lg flex items-center justify-center font-black text-white italic">A</div>
                </div>
              </div>

              {/* Parte Trasera */}
              <div className="credential-back bg-slate-900 text-white border-[6px] border-black p-6 sm:p-8 flex flex-col neobrutalism-shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-blue-600" />
                
                <header className="mb-4 sm:mb-6 border-b-2 border-slate-700 pb-4">
                   <h4 className="text-lg font-black italic tracking-tighter uppercase leading-none mb-1 text-blue-400">Permisos de Zona</h4>
                   <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Validación de Ubicación Territorial</p>
                </header>

                <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2 text-left mb-4">
                   {credentialMerchant.assignments.length > 0 ? (
                     credentialMerchant.assignments.map((a, i) => (
                       <div key={i} className="bg-slate-800 border-2 border-slate-700 p-3 rounded-2xl flex items-center gap-3">
                          <MapPin className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <div className="min-w-0">
                             <p className="text-[9px] font-black uppercase text-white truncate">Zona: {a.zone_id}</p>
                             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Espacio: {a.meters}m / {a.work_day}</p>
                          </div>
                       </div>
                     ))
                   ) : (
                     <div className="py-10 text-center opacity-30 italic text-xs">Sin zonas asignadas</div>
                   )}
                </div>

                <div className="mt-auto pt-4 border-t-2 border-slate-800 flex flex-col items-center gap-4">
                  <div className="bg-white p-2 border-4 border-black rounded-2xl neobrutalism-shadow">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=ATCEM-VERIFY-${credentialMerchant.id}&bgcolor=ffffff&color=000000`} 
                      className="w-20 h-20 sm:w-24 sm:h-24" 
                      alt="QR Verification" 
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] max-w-[180px] leading-relaxed">
                      Esta identificación es personal e intransferible. Válida únicamente para actividades comerciales autorizadas por ATCEM.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setIsCredentialFlipped(!isCredentialFlipped)}
            className="w-full max-w-[320px] bg-white border-4 border-black p-5 mb-8 rounded-[2.2rem] font-black text-slate-900 neobrutalism-shadow hover:neobrutalism-shadow-active transition-all flex items-center justify-center gap-3 active:scale-95 flex-shrink-0"
          >
            <RefreshCw className={`w-6 h-6 transition-transform duration-700 ${isCredentialFlipped ? 'rotate-180' : ''}`} />
            GIRAR CREDENCIAL
          </button>
        </div>
      )}

      {selectedMerchant && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 border-4 border-black p-8 rounded-[3rem] w-full max-w-lg neobrutalism-shadow-lg animate-in zoom-in-95">
            {!paymentSuccess ? (
              <>
                <header className="mb-8 text-center">
                  <div className="w-16 h-16 bg-blue-600 border-4 border-black rounded-2xl flex items-center justify-center mx-auto mb-4 neobrutalism-shadow rotate-3">
                    <DollarSign className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-3xl font-black mb-1 uppercase tracking-tighter italic">REGISTRAR PAGO</h3>
                  <p className="font-bold text-slate-400 text-xs uppercase tracking-widest">{selectedMerchant.full_name}</p>
                </header>
                <form onSubmit={handleAbono} className="space-y-6">
                  <div className="p-6 bg-slate-900 border-2 border-slate-700 rounded-[2rem]">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saldo Actual</span>
                      <span className="font-black text-rose-500 text-xl">${Number(selectedMerchant.balance).toLocaleString()}</span>
                    </div>
                    <div className="relative">
                       <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-8 h-8" />
                       <input 
                        type="number" step="0.01" required autoFocus 
                        placeholder="0.00" 
                        value={abonoAmount} 
                        onChange={e => setAbonoAmount(e.target.value)} 
                        className="w-full bg-slate-800 border-4 border-black rounded-2xl p-6 pl-16 font-black text-4xl outline-none focus:border-emerald-500 text-white" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button type="button" onClick={closePaymentModal} className="bg-slate-700 border-2 border-black p-5 rounded-2xl font-black uppercase text-xs">Cerrar</button>
                    <button type="submit" disabled={abonoLoading} className="bg-emerald-500 border-2 border-black p-5 rounded-2xl font-black uppercase text-xs neobrutalism-shadow hover:neobrutalism-shadow-active transition-all">
                      {abonoLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Confirmar Pago'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="relative">
                  <div className="w-24 h-24 bg-emerald-500 border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6 neobrutalism-shadow-lg animate-bounce">
                    <CheckCircle2 className="w-12 h-12 text-white" />
                  </div>
                </div>

                <div className="bg-white text-slate-900 border-4 border-black p-6 rounded-[2rem] neobrutalism-shadow relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
                  
                  <div className="flex justify-between items-start mb-6 border-b-2 border-slate-200 pb-4 border-dashed">
                    <div className="text-left">
                      <h4 className="font-black text-xl leading-tight uppercase tracking-tighter italic">RECIBO DIGITAL</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FOLIO ATC-{Math.random().toString(36).substr(2, 5).toUpperCase()}</p>
                    </div>
                    <Receipt className="w-8 h-8 text-slate-300" />
                  </div>

                  <div className="space-y-4 text-left">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Beneficiario</span>
                      <span className="font-black text-sm uppercase truncate ml-4 max-w-[180px]">{selectedMerchant.full_name}</span>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto Abonado</span>
                        <span className="font-black text-emerald-600 text-2xl tracking-tighter">${paymentSuccess.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Restante</span>
                        <span className="font-black text-rose-600">${paymentSuccess.newBalance.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase text-slate-400 border-t-2 border-slate-100 pt-4">
                      <div><Calendar className="w-3 h-3 inline mb-1 mr-1" /> {paymentSuccess.date}</div>
                      <div className="text-right"><Clock className="w-3 h-3 inline mb-1 mr-1" /> {paymentSuccess.time}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <button 
                    onClick={sendWhatsAppReceipt}
                    className="w-full bg-emerald-600 border-4 border-black p-5 rounded-2xl font-black text-lg text-white neobrutalism-shadow hover:neobrutalism-shadow-active transition-all flex items-center justify-center gap-3 active:scale-95"
                  >
                    <Send className="w-6 h-6" /> ENVIAR COMPROBANTE
                  </button>
                  <button 
                    onClick={closePaymentModal}
                    className="w-full bg-slate-700 border-2 border-black p-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white/70 active:scale-95"
                  >
                    FINALIZAR Y CERRAR
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {historyMerchant && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-slate-800 border-4 border-black rounded-[3rem] w-full max-w-2xl max-h-[85vh] flex flex-col neobrutalism-shadow-lg overflow-hidden animate-in slide-in-from-bottom-8">
            <div className="p-8 border-b-2 border-black bg-slate-900 flex justify-between items-center">
               <div>
                  <h3 className="text-3xl font-black uppercase tracking-tighter italic leading-none">HISTORIAL</h3>
                  <p className="text-blue-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">{historyMerchant.full_name}</p>
               </div>
               <button onClick={() => setHistoryMerchant(null)} className="p-3 bg-slate-800 border-2 border-black rounded-2xl text-white">
                 <X className="w-6 h-6" />
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
               {historyLoading ? (
                 <div className="flex flex-col items-center justify-center py-20 gap-4">
                   <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Auditando transacciones...</span>
                 </div>
               ) : merchantAbonos.length > 0 ? (
                 <div className="space-y-4">
                   {merchantAbonos.map(abono => (
                     <div key={abono.id} className="bg-slate-900 border-2 border-slate-700 p-5 rounded-3xl flex items-center justify-between group hover:border-emerald-500 transition-colors">
                        <div className="flex items-center gap-5">
                           <div className="w-12 h-12 bg-slate-800 border-2 border-black rounded-2xl flex items-center justify-center">
                             <Calendar className="text-blue-500 w-6 h-6" />
                           </div>
                           <div>
                              <div className="font-black text-slate-200">{new Date(abono.date).toLocaleDateString()}</div>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                                <Clock className="w-3 h-3" /> {new Date(abono.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                           </div>
                        </div>
                        <div className="text-right">
                           <div className="text-2xl font-black text-emerald-500 tracking-tighter">+${abono.amount.toLocaleString()}</div>
                           <div className="text-[9px] font-black text-slate-600 uppercase">Abonado</div>
                        </div>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center py-20 opacity-30">
                    <AlertTriangle className="w-16 h-16 mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm">Sin historial de pagos</p>
                 </div>
               )}
            </div>

            <div className="p-8 border-t-2 border-black bg-slate-900 flex justify-between items-center">
               <div className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                  Folios registrados: {merchantAbonos.length}
               </div>
               <div className="text-white font-black">
                  Total Pagado: <span className="text-emerald-500 text-xl tracking-tighter">${merchantAbonos.reduce((s, a) => s + a.amount, 0).toLocaleString()}</span>
               </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-800 border-4 border-black p-10 rounded-[3rem] w-full max-w-md neobrutalism-shadow-lg text-center animate-in zoom-in-95">
             <div className="w-20 h-20 bg-rose-600 border-4 border-black rounded-3xl flex items-center justify-center mx-auto mb-8 neobrutalism-shadow">
                <AlertTriangle className="w-10 h-10 text-white" />
             </div>
             <h3 className="text-3xl font-black mb-4 uppercase tracking-tighter italic">¿BORRAR EXPEDIENTE?</h3>
             <p className="text-slate-400 font-bold text-sm leading-relaxed mb-8 uppercase tracking-tight">
               Esta acción eliminará permanentemente al comerciante y todo su historial financiero de la plataforma ATCEM.
             </p>
             <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-700 border-2 border-black p-5 rounded-2xl font-black uppercase text-xs">Cancelar</button>
                <button onClick={handleDelete} disabled={deleteLoading} className="bg-rose-600 border-2 border-black p-5 rounded-2xl font-black uppercase text-xs neobrutalism-shadow hover:neobrutalism-shadow-active text-white flex items-center justify-center">
                   {deleteLoading ? <Loader2 className="animate-spin" /> : 'CONFIRMAR'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
