
import React, { useState, useEffect } from 'react';
import { Users, DollarSign, TrendingDown, CheckCircle, Clock, PackageCheck, Loader2, X, ClipboardCheck, Briefcase } from 'lucide-react';
import { Abono, Role } from '../types';
import { dataService } from '../services/dataService';

interface DashboardProps {
  stats: {
    total_merchants: number;
    total_debt: number;
    total_balance: number;
    total_collected: number;
  };
  abonos: Abono[];
  userRole?: Role;
  onRefresh?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, abonos, userRole, onRefresh }) => {
  const [pendingLogistics, setPendingLogistics] = useState<any[]>([]);
  const [receivedLogistics, setReceivedLogistics] = useState<any[]>([]);
  const [logisticsLoading, setLogisticsLoading] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  
  const isAdmin = userRole === 'ADMIN';
  const isRestricted = userRole === 'SECRETARY' || userRole === 'DELEGATE';

  useEffect(() => {
    if (isAdmin) {
      fetchLogistics();
      fetchReceivedLogistics();
    }
  }, [isAdmin]);

  const fetchLogistics = async () => {
    try {
      const data = await dataService.getMerchantsReadyForAdmin();
      setPendingLogistics(data);
    } catch (e) { console.error(e); }
  };

  const fetchReceivedLogistics = async () => {
    try {
      const data = await dataService.getReceivedMerchants(5);
      setReceivedLogistics(data);
    } catch (e) { console.error(e); }
  };

  const handleConfirmReceipt = async () => {
    if (pendingLogistics.length === 0) return;
    setLogisticsLoading(true);
    try {
      await dataService.confirmAdminReceipt(pendingLogistics.map(m => m.id));
      setPendingLogistics([]);
      setShowAuditModal(false);
      fetchReceivedLogistics();
      if (onRefresh) onRefresh();
      alert("¡Lote recibido con éxito!");
    } catch (err) {
      alert("Error al confirmar recepción.");
    } finally {
      setLogisticsLoading(false);
    }
  };

  const percentage = stats?.total_debt > 0 ? (stats.total_collected / stats.total_debt) * 100 : 0;

  const StatCard = ({ icon: Icon, color, label, value }: any) => (
    <div className={`${color} p-6 sm:p-8 rounded-[2rem] border-2 border-black neobrutalism-shadow text-white flex flex-col justify-between transition-transform hover:scale-[1.02]`}>
      <div className="flex justify-between items-start mb-6">
        <div className="bg-black/20 p-3 rounded-2xl">
          <Icon className="w-6 h-6 sm:w-8 sm:h-8" />
        </div>
        <span className="bg-black/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Real-time</span>
      </div>
      <div>
        <div className="text-3xl sm:text-4xl font-black mb-1">{value}</div>
        <div className="font-bold opacity-90 uppercase text-[10px] sm:text-xs tracking-[0.2em]">{label}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 lg:space-y-12 pb-12">
      <header>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-100 mb-2 tracking-tighter">
          Panel <span className="text-blue-500">ATCEM</span>
        </h1>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.3em]">Métricas de Escala Masiva</p>
      </header>

      {/* BANNER MORADO LOGÍSTICA (ADMIN) */}
      {isAdmin && pendingLogistics.length > 0 && (
        <div className="bg-violet-600 border-4 border-black p-8 rounded-[2.5rem] neobrutalism-shadow-lg text-white animate-in slide-in-from-top-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="bg-white p-4 rounded-3xl border-2 border-black neobrutalism-shadow rotate-3">
               <PackageCheck className="w-10 h-10 text-violet-600" />
            </div>
            <div>
               <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none">¡Lote en Tránsito!</h2>
               <p className="text-xs font-bold uppercase tracking-widest text-violet-200 mt-2">La secretaría ha enviado <span className="text-white text-lg font-black">{pendingLogistics.length} credenciales</span> para tu revisión física.</p>
            </div>
          </div>
          <button 
            onClick={() => setShowAuditModal(true)}
            className="w-full md:w-auto bg-black border-2 border-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-900 transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            <ClipboardCheck className="w-5 h-5" /> 
            REVISAR DESGLOSE DE LOTE
          </button>
        </div>
      )}

      {/* HISTORIAL DE ENTREGAS (ADMIN) */}
      {isAdmin && receivedLogistics.length > 0 && (
        <div className="bg-slate-800 border-2 border-black p-8 rounded-[2.5rem] neobrutalism-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-violet-600 p-2 rounded-xl">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter">Últimas Credenciales <span className="text-violet-500">Recibidas</span></h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {receivedLogistics.map((m) => (
              <div key={m.id} className="bg-slate-900 border-2 border-black p-4 rounded-2xl flex items-center justify-between group hover:border-violet-500 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-violet-600/20 rounded-xl flex items-center justify-center font-black text-violet-400 border border-violet-500/30">
                    {m.first_name[0]}
                  </div>
                  <div>
                    <p className="font-black text-xs uppercase leading-none">{m.first_name} {m.last_name_paterno}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                      {new Date(m.admin_received_at).toLocaleDateString()} - {new Date(m.admin_received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* MODAL DE AUDITORÍA DETALLADO */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[1000] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-800 border-4 border-black p-8 rounded-[3rem] w-full max-w-2xl neobrutalism-shadow-lg animate-in zoom-in-95 text-white my-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-3xl font-black uppercase italic tracking-tighter text-violet-400">Auditoría de <span className="text-white">Recepción</span></h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Verifica la existencia física de estos documentos</p>
              </div>
              <button onClick={() => setShowAuditModal(false)} className="p-3 bg-slate-700 border-2 border-black rounded-2xl active:scale-90 transition-transform"><X /></button>
            </div>

            <div className="bg-slate-900/50 border-2 border-black p-6 rounded-3xl mb-8">
               <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Lista de Comerciantes</span>
                  <span className="bg-violet-600 px-3 py-1 rounded-full text-[10px] font-black">{pendingLogistics.length} CREDENCIALES</span>
               </div>
               
               <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                  {pendingLogistics.map((m) => (
                    <div key={m.id} className="bg-slate-800 border-2 border-black p-4 rounded-2xl flex items-center justify-between group hover:border-violet-500 transition-colors">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center font-black text-white border border-white/10 group-hover:bg-violet-600 transition-colors">
                             {m.first_name[0]}
                          </div>
                          <div>
                             <p className="font-black text-sm uppercase leading-none">{m.first_name} {m.last_name_paterno}</p>
                             <div className="flex items-center gap-2 mt-1">
                                <Briefcase className="w-3 h-3 text-blue-400" />
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{m.giro}</span>
                             </div>
                          </div>
                       </div>
                       <div className="bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 text-[8px] font-black text-emerald-500 uppercase italic">PENDIENTE FÍSICO</div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="p-6 bg-rose-900/10 border-2 border-rose-500/20 rounded-3xl mb-8 flex items-start gap-4">
               <CheckCircle className="w-6 h-6 text-rose-500 flex-shrink-0" />
               <p className="text-[10px] font-black text-rose-500 uppercase italic leading-relaxed tracking-wider">
                 Al confirmar, el sistema asume que tienes estas credenciales físicamente para su entrega final. Se incrementará el contador de entrega de cada comerciante.
               </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <button onClick={() => setShowAuditModal(false)} className="bg-slate-700 border-2 border-black p-5 rounded-2xl font-black uppercase text-xs active:scale-95 transition-all">Cancelar</button>
               <button 
                onClick={handleConfirmReceipt}
                disabled={logisticsLoading}
                className="bg-emerald-500 border-4 border-black p-5 rounded-2xl font-black text-white uppercase text-xs neobrutalism-shadow active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
               >
                 {logisticsLoading ? <Loader2 className="animate-spin" /> : <ClipboardCheck className="w-5 h-5" />} 
                 CONFIRMAR RECEPCIÓN FÍSICA
               </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard icon={Users} color="bg-blue-600" label="Comerciantes" value={stats?.total_merchants || 0} />
        {!isRestricted && (
          <>
            <StatCard icon={DollarSign} color="bg-emerald-500" label="Recaudado" value={`$${(stats?.total_collected || 0).toLocaleString()}`} />
            <StatCard icon={TrendingDown} color="bg-rose-500" label="Pendiente" value={`$${(stats?.total_balance || 0).toLocaleString()}`} />
            <StatCard icon={CheckCircle} color="bg-violet-600" label="Liquidación" value={`${percentage.toFixed(1)}%`} />
          </>
        )}
      </div>

      {!isRestricted && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 bg-slate-800 p-6 sm:p-10 rounded-[2.5rem] border-2 border-black neobrutalism-shadow">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                <Clock className="w-6 h-6 text-blue-500" /> Abonos Recientes
              </h2>
            </div>
            <div className="space-y-4">
              {abonos.map((abono) => (
                <div key={abono.id} className="flex items-center justify-between p-4 bg-slate-900/50 border-2 border-slate-700 rounded-2xl group transition-all hover:border-emerald-500">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl border-2 border-black flex items-center justify-center font-black text-white flex-shrink-0">
                      ID
                    </div>
                    <div className="min-w-0">
                      <div className="font-black truncate text-sm sm:text-base">Folio: {abono.id.slice(0, 8)}</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{new Date(abono.date).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="text-emerald-500 font-black text-base sm:text-xl ml-4 whitespace-nowrap">
                    +${abono.amount.toLocaleString()}
                  </div>
                </div>
              ))}
              {abonos.length === 0 && (
                <div className="text-center py-20 bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-700 font-bold text-slate-500">
                  SIN ACTIVIDAD RECIENTE
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-800 p-6 sm:p-10 rounded-[2.5rem] border-2 border-black neobrutalism-shadow flex flex-col justify-center gap-8">
            <div className="text-center">
              <div className="inline-flex p-6 bg-slate-900 rounded-full border-4 border-blue-500 mb-6 neobrutalism-shadow">
                 <TrendingDown className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-xl font-black uppercase mb-2">Salud de Cartera</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                Sistema optimizado para manejar más de 5,000 registros con latencia mínima.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {isRestricted && (
        <div className="bg-slate-800 p-10 rounded-[2.5rem] border-2 border-black neobrutalism-shadow flex flex-col items-center justify-center text-center gap-6 mt-8">
          <div className="bg-blue-600/10 p-6 rounded-full border-2 border-blue-500/30">
            <Users className="w-16 h-16 text-blue-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black uppercase mb-2">Estado del Censo</h3>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest leading-relaxed max-w-lg">
              Estás visualizando el conteo general de comerciantes registrados. 
              El detalle financiero está reservado para el área de administración general.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
