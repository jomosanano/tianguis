
import React from 'react';
import { Users, DollarSign, TrendingDown, CheckCircle, Clock } from 'lucide-react';
import { Abono, Role } from '../types';

interface DashboardProps {
  stats: {
    total_merchants: number;
    total_debt: number;
    total_balance: number;
    total_collected: number;
  };
  abonos: Abono[];
  userRole?: Role;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, abonos, userRole }) => {
  const percentage = stats?.total_debt > 0 ? (stats.total_collected / stats.total_debt) * 100 : 0;
  const isSecretary = userRole === 'SECRETARY';

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
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard icon={Users} color="bg-blue-600" label="Comerciantes" value={stats?.total_merchants || 0} />
        {!isSecretary && (
          <>
            <StatCard icon={DollarSign} color="bg-emerald-500" label="Recaudado" value={`$${(stats?.total_collected || 0).toLocaleString()}`} />
            <StatCard icon={TrendingDown} color="bg-rose-500" label="Pendiente" value={`$${(stats?.total_balance || 0).toLocaleString()}`} />
            <StatCard icon={CheckCircle} color="bg-violet-600" label="Liquidación" value={`${percentage.toFixed(1)}%`} />
          </>
        )}
      </div>

      {!isSecretary && (
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
    </div>
  );
};
