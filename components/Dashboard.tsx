
import React, { useMemo } from 'react';
import { Users, DollarSign, TrendingDown, CheckCircle, AlertCircle } from 'lucide-react';
import { Merchant, Abono } from '../types';

interface DashboardProps {
  merchants: Merchant[];
  abonos: Abono[];
}

export const Dashboard: React.FC<DashboardProps> = ({ merchants, abonos }) => {
  const stats = useMemo(() => {
    const totalMerchants = merchants.length;
    const totalDebt = merchants.reduce((sum, m) => sum + m.total_debt, 0);
    const currentBalance = merchants.reduce((sum, m) => sum + m.balance, 0);
    const collected = totalDebt - currentBalance;
    const percentage = totalDebt > 0 ? (collected / totalDebt) * 100 : 0;

    return { totalMerchants, totalDebt, currentBalance, collected, percentage };
  }, [merchants]);

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-black text-slate-100 mb-8">Panel de Control <span className="text-blue-500">ATCEM</span></h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric Cards */}
        <div className="bg-blue-600 p-6 rounded-[2rem] border-2 border-black neobrutalism-shadow text-white">
          <div className="flex justify-between items-start mb-4">
            <Users className="w-8 h-8 opacity-80" />
            <span className="bg-black/20 px-2 py-1 rounded-lg text-xs font-bold uppercase">Total</span>
          </div>
          <div className="text-4xl font-black">{stats.totalMerchants}</div>
          <div className="font-bold opacity-80 uppercase text-xs tracking-wider">Comerciantes Activos</div>
        </div>

        <div className="bg-emerald-500 p-6 rounded-[2rem] border-2 border-black neobrutalism-shadow text-white">
          <div className="flex justify-between items-start mb-4">
            <DollarSign className="w-8 h-8 opacity-80" />
            <span className="bg-black/20 px-2 py-1 rounded-lg text-xs font-bold uppercase">Recaudado</span>
          </div>
          <div className="text-4xl font-black">${stats.collected.toLocaleString()}</div>
          <div className="font-bold opacity-80 uppercase text-xs tracking-wider">Monto Cobrado</div>
        </div>

        <div className="bg-rose-500 p-6 rounded-[2rem] border-2 border-black neobrutalism-shadow text-white">
          <div className="flex justify-between items-start mb-4">
            <TrendingDown className="w-8 h-8 opacity-80" />
            <span className="bg-black/20 px-2 py-1 rounded-lg text-xs font-bold uppercase">Pendiente</span>
          </div>
          <div className="text-4xl font-black">${stats.currentBalance.toLocaleString()}</div>
          <div className="font-bold opacity-80 uppercase text-xs tracking-wider">Deuda por Cobrar</div>
        </div>

        <div className="bg-violet-600 p-6 rounded-[2rem] border-2 border-black neobrutalism-shadow text-white">
          <div className="flex justify-between items-start mb-4">
            <CheckCircle className="w-8 h-8 opacity-80" />
            <span className="bg-black/20 px-2 py-1 rounded-lg text-xs font-bold uppercase">Meta</span>
          </div>
          <div className="text-4xl font-black">{stats.percentage.toFixed(1)}%</div>
          <div className="font-bold opacity-80 uppercase text-xs tracking-wider">Grado de Liquidación</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Recent Activity Card */}
        <div className="md:col-span-2 bg-slate-800 p-8 rounded-[2rem] border-2 border-black neobrutalism-shadow">
          <h2 className="text-2xl font-black mb-6">Últimos Abonos</h2>
          <div className="space-y-4">
            {abonos.slice(-5).reverse().map((abono) => {
              const merchant = merchants.find(m => m.id === abono.merchant_id);
              return (
                <div key={abono.id} className="flex items-center justify-between p-4 bg-slate-900 border-2 border-slate-700 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-full border-2 border-black flex items-center justify-center font-bold">
                      {merchant?.full_name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold">{merchant?.full_name || 'Desconocido'}</div>
                      <div className="text-xs text-slate-500 font-bold uppercase">{new Date(abono.date).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="text-emerald-500 font-black text-lg">
                    +${abono.amount.toLocaleString()}
                  </div>
                </div>
              );
            })}
            {abonos.length === 0 && <div className="text-center py-12 text-slate-500 font-bold italic">No hay actividad reciente.</div>}
          </div>
        </div>

        {/* Status Alerts Card */}
        <div className="bg-slate-800 p-8 rounded-[2rem] border-2 border-black neobrutalism-shadow flex flex-col">
          <h2 className="text-2xl font-black mb-6">Estado Fiscal</h2>
          <div className="flex-1 flex flex-col gap-6 justify-center">
             <div className="flex items-center gap-4 bg-amber-500/10 border-2 border-amber-500 p-4 rounded-2xl">
               <AlertCircle className="w-8 h-8 text-amber-500 flex-shrink-0" />
               <p className="text-sm font-bold text-amber-200">
                {merchants.filter(m => m.balance > 0).length} Comerciantes con deudas pendientes.
               </p>
             </div>
             <div className="flex items-center gap-4 bg-emerald-500/10 border-2 border-emerald-500 p-4 rounded-2xl">
               <CheckCircle className="w-8 h-8 text-emerald-500 flex-shrink-0" />
               <p className="text-sm font-bold text-emerald-200">
                {merchants.filter(m => m.balance === 0 && m.total_debt > 0).length} Comerciantes liquidados este periodo.
               </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
