
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, ChevronRight, User, DollarSign, Loader2, Briefcase, Filter, ArrowUp, Edit2, Trash2, Calendar, Clock, AlertTriangle, X, Send, CheckCircle2, Receipt, IdCard, RefreshCw, MapPin, ShieldCheck, Shield, CheckSquare, Square, PackageCheck, History, TrendingUp, MessageSquare, Ban, PieChart, Download } from 'lucide-react';
import { supabase } from '../services/supabase';
import { dataService } from '../services/dataService';
import { Merchant, Abono, Role, User as UserType } from '../types';

interface MerchantListProps {
  user: UserType | null;
  systemLogo?: string | null;
  onRefresh: (silent?: boolean) => void;
  onEdit: (merchant: Merchant) => void;
  delegatesCanCollect?: boolean;
}

const PAGE_SIZE = 12;

type FilterType = 'ALL' | 'NO_PAYMENTS' | 'IN_PROGRESS' | 'LIQUIDATED' | 'DELIVERED';

export const MerchantList: React.FC<MerchantListProps> = ({ user, systemLogo, onRefresh, onEdit, delegatesCanCollect = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  
  // Estados para Selección Masiva
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [logisticsLoading, setLogisticsLoading] = useState(false);
  const [reDeliveryConfirmMerchant, setReDeliveryConfirmMerchant] = useState<Merchant | null>(null);

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
  const isAdmin = user?.role === 'ADMIN';
  const isDelegate = user?.role === 'DELEGATE';

  const canModify = (merchant: Merchant) => {
    if (user?.role === 'ADMIN') return true;
    return false;
  };

  // Ajustar filtro por defecto para secretaria
  useEffect(() => {
    if (isSecretary) {
      setActiveFilter('LIQUIDATED');
    } else {
      setActiveFilter('ALL');
    }
  }, [isSecretary]);

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

  // Lógica de Filtrado Local para la vista Bento
  const filteredMerchants = useMemo(() => {
    return merchants.filter(m => {
      const balance = Number(m.balance);
      const totalDebt = Number(m.total_debt);
      
      switch (activeFilter) {
        case 'NO_PAYMENTS': return balance === totalDebt && totalDebt > 0;
        case 'IN_PROGRESS': return balance < totalDebt && balance > 0;
        case 'LIQUIDATED': return totalDebt > 0 && balance === 0;
        case 'DELIVERED': return m.admin_received === true;
        default: return true;
      }
    });
  }, [merchants, activeFilter]);

  // Contadores para los badges de los filtros
  const filterStats = useMemo(() => {
    return {
      ALL: merchants.length,
      NO_PAYMENTS: merchants.filter(m => Number(m.balance) === Number(m.total_debt) && Number(m.total_debt) > 0).length,
      IN_PROGRESS: merchants.filter(m => Number(m.balance) < Number(m.total_debt) && Number(m.balance) > 0).length,
      LIQUIDATED: merchants.filter(m => Number(m.total_debt) > 0 && Number(m.balance) === 0).length,
      DELIVERED: merchants.filter(m => m.admin_received).length
    };
  }, [merchants]);

  const toggleSelection = (merchant: Merchant) => {
    const id = merchant.id;
    const newSelected = new Set(selectedIds);
    
    if (newSelected.has(id)) {
      newSelected.delete(id);
      setSelectedIds(newSelected);
    } else {
      // Advertencia de Re-entrega para Secretaria
      if (isSecretary && merchant.admin_received) {
        setReDeliveryConfirmMerchant(merchant);
      } else {
        newSelected.add(id);
        setSelectedIds(newSelected);
      }
    }
  };

  const handleConfirmReDelivery = () => {
    if (reDeliveryConfirmMerchant) {
      const newSelected = new Set(selectedIds);
      newSelected.add(reDeliveryConfirmMerchant.id);
      setSelectedIds(newSelected);
      setReDeliveryConfirmMerchant(null);
    }
  };

  const handleBatchLogistics = async () => {
    if (selectedIds.size === 0) return;
    setLogisticsLoading(true);
    try {
      await dataService.batchUpdateMerchantsLogistics(Array.from(selectedIds), true);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      onRefresh();
    } catch (err) {
      alert("Error al procesar entrega masiva");
    } finally {
      setLogisticsLoading(false);
    }
  };

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

  const handleDownloadPhoto = async (merchant: Merchant) => {
    const imageUrl = merchant.profile_photo;
    if (!imageUrl) {
      alert("No hay foto disponible para descargar.");
      return;
    }
    
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Reemplazar espacios por guiones bajos para el nombre del archivo
      const safeName = merchant.full_name.replace(/\s+/g, '_').toUpperCase();
      link.download = `FOTO_${safeName}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al descargar la imagen:", error);
      // Fallback simple por si falla el fetch (CORS u otros)
      window.open(imageUrl, '_blank');
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

  const sendWhatsAppReceipt = () => {
    if (!selectedMerchant || !paymentSuccess) return;
    
    const phone = selectedMerchant.phone.replace(/\D/g, '');
    if (!phone) {
      alert("El comerciante no tiene un número telefónico registrado.");
      return;
    }

    const message = `*COMPROBANTE DE PAGO ATCEM* 📑%0A%0A¡Hola *${selectedMerchant.full_name}*! 👋%0A%0ALe informamos que su pago ha sido procesado exitosamente:%0A%0A💰 *Monto Abonado:* $${paymentSuccess.amount.toLocaleString()}%0A🗓️ *Fecha:* ${paymentSuccess.date}%0A⏰ *Hora:* ${paymentSuccess.time}%0A%0A📉 *Saldo Pendiente:* $${paymentSuccess.newBalance.toLocaleString()}%0A%0A¡Gracias por su cumplimiento y por contribuir al orden de nuestro municipio! ✅%0A%0A_Este es un recibo digital oficial de ATCEM._`;
    
    const whatsappUrl = `https://wa.me/${phone.length === 10 ? '52' + phone : phone}?text=${message}`;
    window.open(whatsappUrl, '_blank');
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

  const FilterCard = ({ type, icon: Icon, color, label, count }: { type: FilterType, icon: any, color: string, label: string, count: number }) => (
    <button 
      onClick={() => setActiveFilter(type)}
      className={`flex-1 min-w-[140px] p-4 rounded-3xl border-2 border-black transition-all flex flex-col gap-2 text-left relative overflow-hidden group ${
        activeFilter === type 
          ? `${color} text-white neobrutalism-shadow scale-105 z-10` 
          : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
      }`}
    >
      <div className={`p-2 rounded-xl border-2 border-black w-fit transition-transform group-hover:scale-110 ${activeFilter === type ? 'bg-black/20' : 'bg-slate-900'}`}>
        <Icon size={18} className={activeFilter === type ? 'text-white' : 'text-slate-500'} />
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest opacity-80">{label}</p>
        <p className="text-xl font-black italic leading-none mt-1">{count}</p>
      </div>
      {activeFilter === type && (
        <div className="absolute -right-2 -bottom-2 opacity-10 rotate-12 transition-transform group-hover:scale-125">
          <Icon size={64} />
        </div>
      )}
    </button>
  );

  return (
    <div className="space-y-8 sm:space-y-12 pb-32">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-100 leading-none tracking-tighter">
            Directorio <span className="text-blue-500">ATCEM</span>
          </h2>
          <div className="flex items-center gap-4 mt-3">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
               {isSecretary ? 'AUDITORÍA DE PAGOS' : user?.role === 'DELEGATE' ? 'Vigilancia Zona' : 'Censo Total'}
             </span>
             {isSecretary && (
               <button 
                 onClick={() => setIsSelectionMode(!isSelectionMode)}
                 className={`px-4 py-1.5 rounded-full border-2 border-black font-black text-[10px] uppercase tracking-widest transition-all ${isSelectionMode ? 'bg-purple-600 text-white neobrutalism-shadow' : 'bg-slate-800 text-slate-400'}`}
               >
                 {isSelectionMode ? 'CANCELAR SELECCIÓN' : 'DESPACHO MASIVO'}
               </button>
             )}
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

      {/* BARRA DE FILTROS BENTO - Condicionada por Rol de Secretaria */}
      <div className="flex overflow-x-auto pb-4 gap-4 custom-scrollbar snap-x scroll-pl-4">
        {!isSecretary && (
          <>
            <FilterCard type="ALL" icon={PieChart} color="bg-blue-600" label="Ver Todos" count={filterStats.ALL} />
            <FilterCard type="NO_PAYMENTS" icon={Ban} color="bg-rose-600" label="Sin Abonos" count={filterStats.NO_PAYMENTS} />
            <FilterCard type="IN_PROGRESS" icon={TrendingUp} color="bg-amber-500" label="En Proceso" count={filterStats.IN_PROGRESS} />
          </>
        )}
        <FilterCard type="LIQUIDATED" icon={CheckCircle2} color="bg-emerald-500" label="Liquidados" count={filterStats.LIQUIDATED} />
        <FilterCard type="DELIVERED" icon={PackageCheck} color="bg-purple-600" label="Entregados" count={filterStats.DELIVERED} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {filteredMerchants.map(merchant => {
          const totalDebt = Number(merchant.total_debt);
          const balance = Number(merchant.balance);
          const isLiquidated = totalDebt > 0 && balance <= 0;
          const hasPayments = balance > 0 && balance < totalDebt;
          const isReceivedByAdmin = merchant.admin_received;
          const deliveryCount = Number(merchant.delivery_count || 0);

          const cardStyleClass = isReceivedByAdmin && isAdmin
            ? 'bg-purple-900/40 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
            : isLiquidated 
              ? 'bg-blue-900/40 border-blue-500 hover:border-blue-400' 
              : hasPayments 
                ? 'bg-amber-900/40 border-amber-500 hover:border-amber-400' 
                : 'bg-rose-900/40 border-rose-500 hover:border-rose-400';

          const isSelected = selectedIds.has(merchant.id);
          const isCollectDisabledForDelegate = isDelegate && !delegatesCanCollect;
          const mainButtonDisabled = isSecretary || isCollectDisabledForDelegate || isLiquidated || balance <= 0;

          return (
            <div 
              key={merchant.id} 
              onClick={() => isSelectionMode && toggleSelection(merchant)}
              className={`${cardStyleClass} backdrop-blur-sm border-2 rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-8 neobrutalism-shadow flex flex-col gap-5 group transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 relative snap-start ${isSelectionMode ? 'cursor-pointer' : ''}`}
            >
              {isSelectionMode && (
                <div className="absolute top-4 left-4 z-10 scale-125">
                   {isSelected ? (
                     <div className="bg-purple-600 border-2 border-black p-1 rounded-lg">
                        <CheckSquare className="w-6 h-6 text-white" />
                     </div>
                   ) : (
                     <div className="bg-slate-900 border-2 border-black p-1 rounded-lg">
                        <Square className="w-6 h-6 text-slate-700" />
                     </div>
                   )}
                </div>
              )}

              {/* Distintivo de RE-ENTREGADO para el Admin */}
              {isAdmin && deliveryCount > 1 && (
                <div className="absolute -top-3 -right-3 bg-violet-600 border-2 border-black px-4 py-1.5 rounded-full flex items-center gap-2 neobrutalism-shadow z-20 animate-bounce">
                   <History className="w-3.5 h-3.5 text-white" />
                   <span className="text-[9px] font-black uppercase tracking-widest text-white">RE-ENTREGADO ({deliveryCount})</span>
                </div>
              )}

              {isReceivedByAdmin && isAdmin && deliveryCount === 1 && (
                <div className="absolute top-8 right-8 bg-purple-600 border-2 border-black px-3 py-1 rounded-full flex items-center gap-2 neobrutalism-shadow z-10 animate-pulse">
                   <PackageCheck className="w-3 h-3 text-white" />
                   <span className="text-[8px] font-black uppercase tracking-widest text-white">RECIBIDA POR ADMIN</span>
                </div>
              )}

              <div className="flex items-start justify-between gap-3 overflow-hidden">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="relative flex-shrink-0">
                    <img 
                      src={merchant.profile_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(merchant.full_name)}&background=2563eb&color=fff&bold=true`} 
                      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] sm:rounded-[2rem] border-2 border-black object-cover bg-slate-900 transition-all ${isSelected ? 'scale-90 border-purple-500' : ''}`} 
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

                {!isSelectionMode && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button onClick={() => openCredential(merchant)} className="p-2 bg-slate-900 border-2 border-black rounded-xl hover:bg-emerald-600 transition-colors shadow-sm">
                      <IdCard className="w-4 h-4 text-white" />
                    </button>
                    {isSecretary && (
                      <button 
                        onClick={() => handleDownloadPhoto(merchant)} 
                        title="Descargar Foto"
                        className="p-2 bg-emerald-600 border-2 border-black rounded-xl hover:bg-emerald-500 transition-colors shadow-sm"
                      >
                        <Download className="w-4 h-4 text-white" />
                      </button>
                    )}
                    {canModify(merchant) && (
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
                )}
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

              {!isSelectionMode && (
                <div className="mt-auto flex gap-3 sm:gap-4">
                  <button 
                    onClick={() => !mainButtonDisabled && setSelectedMerchant(merchant)}
                    disabled={mainButtonDisabled}
                    className="flex-[4] bg-blue-600 border-2 border-black py-4 sm:py-5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-[0.15em] text-white neobrutalism-shadow hover:neobrutalism-shadow-active transition-all disabled:opacity-30 active:scale-95"
                  >
                    {isSecretary 
                      ? (isReceivedByAdmin ? 'ENTREGADA A ADMIN' : 'LIQUIDADO - SIN ENTREGAR') 
                      : isCollectDisabledForDelegate 
                        ? (isLiquidated ? 'LIQUIDADO' : 'COBRO DESACTIVADO')
                        : (isLiquidated ? 'VERIFICADO' : 'COBRAR ABONO')}
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
              )}
            </div>
          );
        })}
        {filteredMerchants.length === 0 && !loading && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center border-4 border-dashed border-slate-800 rounded-[3rem] bg-slate-900/20 text-center px-4">
            <Filter className="w-16 h-16 text-slate-700 mb-6" />
            <h4 className="text-xl font-black uppercase text-slate-500 italic">No se encontraron resultados</h4>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mt-2">Intenta ajustar los filtros de búsqueda o categoría.</p>
            <button onClick={() => { setActiveFilter(isSecretary ? 'LIQUIDATED' : 'ALL'); setSearchTerm(''); }} className="mt-8 px-8 py-3 bg-slate-800 border-2 border-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-700 transition-colors">LIMPIAR FILTROS</button>
          </div>
        )}
      </div>

      <div ref={loaderRef} className="py-20 flex flex-col items-center justify-center gap-4">
        {hasMore ? <Loader2 className="w-10 h-10 text-blue-500 animate-spin" /> : <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Fin de Directorio</p>}
      </div>

      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl z-[150] animate-in slide-in-from-bottom-10">
           <div className="bg-slate-900 border-4 border-black p-6 rounded-[2.5rem] neobrutalism-shadow-lg flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-purple-600 border-2 border-black rounded-2xl flex items-center justify-center neobrutalism-shadow">
                    <span className="font-black text-2xl text-white">{selectedIds.size}</span>
                 </div>
                 <div>
                    <h4 className="font-black uppercase text-sm tracking-tight italic">Registros Listos</h4>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Para entrega física al administrador</p>
                 </div>
              </div>
              <button 
                onClick={handleBatchLogistics}
                disabled={logisticsLoading}
                className="bg-purple-600 border-2 border-black px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white neobrutalism-shadow hover:neobrutalism-shadow-active active:scale-95 flex items-center gap-3 transition-all disabled:opacity-50"
              >
                {logisticsLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <PackageCheck className="w-5 h-5" />}
                ENTREGAR A ADMINISTRACIÓN
              </button>
           </div>
        </div>
      )}

      {/* MODAL DE ADVERTENCIA DE RE-ENTREGA (SECRETARIA) */}
      {reDeliveryConfirmMerchant && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[250] flex items-center justify-center p-4">
           <div className="bg-amber-400 border-4 border-black p-8 rounded-[2.5rem] w-full max-w-md neobrutalism-shadow-lg text-slate-900 animate-in zoom-in-95">
              <div className="bg-black w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
                 <AlertTriangle className="w-10 h-10 text-amber-400" />
              </div>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-4 leading-none">ALERTA DE AUDITORÍA</h3>
              <p className="font-bold text-sm uppercase tracking-widest mb-8 leading-relaxed">
                El comerciante <span className="underline decoration-4">{reDeliveryConfirmMerchant.full_name}</span> ya fue marcado como <span className="font-black">ENTREGADO</span> anteriormente.
                <br /><br />
                ¿Estás segura de que deseas incluirlo en un nuevo despacho masivo?
              </p>
              <div className="grid grid-cols-1 gap-3">
                 <button 
                  onClick={handleConfirmReDelivery}
                  className="bg-black border-2 border-black p-5 rounded-2xl font-black text-white uppercase tracking-widest hover:bg-slate-900 active:scale-95 transition-all"
                 >
                   SÍ, RE-ENVIAR CREDENCIAL
                 </button>
                 <button 
                  onClick={() => setReDeliveryConfirmMerchant(null)}
                  className="bg-transparent border-2 border-black p-4 rounded-2xl font-black text-black uppercase tracking-widest hover:bg-amber-500 active:scale-95 transition-all"
                 >
                   CANCELAR
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Modal de Historial de Abonos */}
      {historyMerchant && (() => {
        const totalInitial = Number(historyMerchant.total_debt);
        const totalAbonado = merchantAbonos.reduce((sum, a) => sum + Number(a.amount), 0);
        const totalRestante = Number(historyMerchant.balance);
        const coveragePercent = totalInitial > 0 ? (totalAbonado / totalInitial) * 100 : 0;

        return (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-slate-800 border-4 border-black p-6 sm:p-8 rounded-[3rem] w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col neobrutalism-shadow-lg">
               <div className="flex justify-between items-center mb-6">
                  <div>
                     <h3 className="text-2xl font-black uppercase italic tracking-tighter">Estado de <span className="text-blue-500">Cuenta</span></h3>
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{historyMerchant.full_name}</p>
                  </div>
                  <button onClick={() => setHistoryMerchant(null)} className="p-3 bg-rose-600 border-2 border-black rounded-2xl text-white shadow-lg active:scale-90 transition-all">
                     <X size={20} />
                  </button>
               </div>

               <div className="space-y-6 mb-8">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     <div className="bg-blue-600 border-2 border-black p-4 rounded-[1.5rem] neobrutalism-shadow flex flex-col items-center justify-center text-center animate-in slide-in-from-left-4">
                        <span className="text-[8px] font-black text-white/70 uppercase tracking-widest mb-1">DEUDA TOTAL</span>
                        <span className="text-xl sm:text-2xl font-black text-white italic tracking-tighter">${totalInitial.toLocaleString()}</span>
                     </div>
                     <div className="bg-emerald-500 border-2 border-black p-4 rounded-[1.5rem] neobrutalism-shadow flex flex-col items-center justify-center text-center animate-in zoom-in-95 delay-75">
                        <span className="text-[8px] font-black text-white/70 uppercase tracking-widest mb-1">TOTAL ABONADO</span>
                        <span className="text-xl sm:text-2xl font-black text-white italic tracking-tighter">${totalAbonado.toLocaleString()}</span>
                     </div>
                     <div className="bg-rose-500 border-2 border-black p-4 rounded-[1.5rem] neobrutalism-shadow flex flex-col items-center justify-center text-center animate-in slide-in-from-right-4 delay-150">
                        <span className="text-[8px] font-black text-white/70 uppercase tracking-widest mb-1">RESTANTE</span>
                        <span className="text-xl sm:text-2xl font-black text-white italic tracking-tighter">${totalRestante.toLocaleString()}</span>
                     </div>
                  </div>

                  <div className="bg-slate-900/80 border-2 border-slate-700 p-5 rounded-[2rem]">
                     <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                           <TrendingUp className="w-3 h-3 text-emerald-400" />
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cobertura Financiera</span>
                        </div>
                        <span className="text-sm font-black text-emerald-400 italic">{coveragePercent.toFixed(1)}% Cubierto</span>
                     </div>
                     <div className="w-full h-4 bg-slate-950 border-2 border-black rounded-full overflow-hidden p-0.5">
                        <div 
                           className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                           style={{ width: `${Math.min(coveragePercent, 100)}%` }}
                        />
                     </div>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                  {historyLoading ? (
                     <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Recuperando abonos...</p>
                     </div>
                  ) : merchantAbonos.length > 0 ? (
                     merchantAbonos.map((abono) => (
                        <div key={abono.id} className="bg-slate-900/40 border-2 border-slate-700 p-5 rounded-[1.8rem] flex items-center justify-between group hover:border-emerald-500 transition-colors">
                           <div className="flex items-center gap-4">
                              <div className="w-11 h-11 bg-slate-800 border-2 border-black rounded-xl flex items-center justify-center shadow-sm">
                                 <Receipt className="w-5 h-5 text-blue-400" />
                              </div>
                              <div>
                                 <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{new Date(abono.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                 <p className="font-bold text-slate-300 text-xs">Abono Folio <span className="text-blue-400 font-mono">#{abono.id.slice(0, 8).toUpperCase()}</span></p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-xl font-black text-emerald-500 tracking-tighter italic">+${Number(abono.amount).toLocaleString()}</p>
                              <div className="flex items-center gap-1 justify-end">
                                 <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                 <span className="text-[7px] font-bold text-slate-600 uppercase">Validado</span>
                              </div>
                           </div>
                        </div>
                     ))
                  ) : (
                     <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-700 rounded-[2.5rem] bg-slate-900/30">
                        <DollarSign className="w-12 h-12 text-slate-700 mb-4 opacity-20" />
                        <p className="font-black text-slate-600 uppercase tracking-widest text-[10px] italic">Sin historial de pagos</p>
                     </div>
                  )}
               </div>

               <div className="mt-8 pt-6 border-t-2 border-slate-700 flex justify-between items-center">
                  <button 
                    onClick={() => setHistoryMerchant(null)}
                    className="bg-slate-700 border-2 border-black px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all text-white hover:bg-slate-600 shadow-lg"
                  >
                    Cerrar Auditoría
                  </button>
               </div>
            </div>
          </div>
        );
      })()}

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
          <div className="w-full max-w-sm pt-2 mb-2 flex justify-between items-center px-4">
             <h3 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Credencial <span className="text-blue-500">Oficial</span></h3>
             <button onClick={() => setCredentialMerchant(null)} className="p-2 bg-rose-600 border-2 border-black rounded-xl text-white shadow-lg active:scale-90 transition-all leading-none"><X size={20}/></button>
          </div>
          
          <div className="credential-container w-full max-w-[340px] h-[537px] relative">
            <div className={`credential-inner ${isCredentialFlipped ? 'flipped' : ''}`}>
              <div className="credential-front bg-guilloche text-white border-[1px] border-slate-700 shadow-2xl">
                <div className="absolute inset-0 bg-security-grid pointer-events-none opacity-40"></div>
                <div className="w-full bg-slate-900/80 backdrop-blur-md p-6 border-b border-slate-700 flex flex-col items-center gap-1 z-10">
                   <div className="flex items-center gap-2">
                     <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center border border-white/20 overflow-hidden">
                       {systemLogo ? <img src={systemLogo} className="w-full h-full object-contain p-1" /> : <span className="font-black italic text-sm">A</span>}
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
                   <h2 className="text-2xl font-black uppercase tracking-tighter metallic-gold italic leading-none mb-2">{credentialMerchant.full_name}</h2>
                   <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/30 px-4 py-1.5 rounded-full mb-6">
                      <Briefcase className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest">{credentialMerchant.giro}</span>
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
              <div className="credential-back bg-slate-950 text-white border-[1px] border-slate-800 shadow-2xl">
                 <div className="absolute inset-0 bg-security-grid pointer-events-none opacity-20"></div>
                 <div className="w-full bg-slate-900/40 p-6 border-b border-slate-800 flex flex-col items-center gap-1 z-10">
                    <div className="flex items-center gap-2 opacity-50">
                      {systemLogo ? <img src={systemLogo} className="w-4 h-4 object-contain grayscale" /> : <ShieldCheck size={16} className="text-blue-500"/>}
                      <span className="text-[10px] font-black tracking-widest uppercase">Seguridad ATCEM</span>
                    </div>
                    <p className="text-[8px] font-black tracking-[0.4em] text-slate-600 uppercase mt-1">Reverso Institucional</p>
                 </div>
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
                          <p className="text-[7px] font-medium text-slate-700 uppercase leading-relaxed tracking-wide">Identificación intransferible. Acredita el uso autorizado de la vía pública bajo términos fiscales 2025.</p>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-[340px] mt-4">
            <button onClick={() => setIsCredentialFlipped(!isCredentialFlipped)} className="w-full bg-slate-900 border-2 border-black p-5 rounded-[2.2rem] font-black text-white flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl hover:bg-slate-800">
              <RefreshCw className={`w-5 h-5 ${isCredentialFlipped ? 'rotate-180 transition-transform' : 'transition-transform'}`} /> 
              {isCredentialFlipped ? 'VER ANVERSO' : 'VER REVERSO'}
            </button>
            <button onClick={() => window.print()} className="w-full bg-white border-2 border-slate-200 p-4 rounded-[2.2rem] font-black text-slate-900 flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl">
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
                  <input type="number" step="0.01" required autoFocus placeholder="0.00" value={abonoAmount} onChange={e => setAbonoAmount(e.target.value)} className="w-full bg-slate-800 border-4 border-black rounded-2xl p-6 font-black text-4xl outline-none focus:border-emerald-500 text-white text-center" />
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
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Monto Abonado</span>
                        <p className="font-black text-3xl text-emerald-600 italic tracking-tighter">${paymentSuccess.amount.toLocaleString()}</p>
                     </div>
                     <div className="text-right">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Saldo Nuevo</span>
                        <p className="font-bold text-sm text-slate-600">${paymentSuccess.newBalance.toLocaleString()}</p>
                     </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase">
                     <span>{paymentSuccess.date}</span>
                     <span>{paymentSuccess.time}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={sendWhatsAppReceipt}
                    className="w-full bg-emerald-500 border-2 border-black p-5 rounded-2xl font-black uppercase text-white neobrutalism-shadow hover:neobrutalism-shadow-active transition-all flex items-center justify-center gap-3 active:scale-95"
                  >
                    <MessageSquare className="w-5 h-5" /> ENVIAR COMPROBANTE WHATSAPP
                  </button>
                  <button 
                    onClick={() => { setSelectedMerchant(null); setPaymentSuccess(null); }} 
                    className="w-full bg-slate-900 border-2 border-black p-5 rounded-2xl font-black uppercase text-white hover:bg-slate-800 transition-colors"
                  >
                    FINALIZAR
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
