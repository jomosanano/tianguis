
import React, { useState, useEffect } from 'react';
import { FileText, Calendar, User, DollarSign, Search, Download, Loader2, ArrowRight, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { dataService } from '../services/dataService';

export const CollectionsReport: React.FC = () => {
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDelegate, setSelectedDelegate] = useState<string>('ALL');
  const [delegates, setDelegates] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await dataService.getCollectionsReport(
        `${startDate}T00:00:00Z`,
        `${endDate}T23:59:59Z`
      );
      setReportData(data);
      
      // Extraer delegados únicos de los datos
      const uniqueDelegates = Array.from(new Set(data.map((item: any) => item.recorded_by)))
        .map(id => {
          const item = data.find((i: any) => i.recorded_by === id);
          return { id, name: item?.profiles?.full_name || 'Desconocido' };
        });
      setDelegates(uniqueDelegates);
    } catch (err) {
      console.error("Error fetching report:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = selectedDelegate === 'ALL' 
    ? reportData 
    : reportData.filter(item => item.recorded_by === selectedDelegate);

  const totalCollected = filteredData.reduce((sum, item) => sum + Number(item.amount), 0);

  const exportToCSV = () => {
    const headers = ['Fecha', 'Delegado', 'Comerciante', 'Monto'];
    const rows = filteredData.map(item => [
      new Date(item.date).toLocaleString(),
      item.profiles?.full_name || 'Desconocido',
      `${item.merchants?.first_name} ${item.merchants?.last_name_paterno}`,
      item.amount
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_cobros_${startDate}_a_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-100 uppercase tracking-tighter">
            Reporte de <span className="text-blue-500">Cobranza</span>
          </h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Auditoría detallada de recaudación por delegado</p>
        </div>
        <button 
          onClick={exportToCSV}
          className="flex items-center gap-3 bg-emerald-600 border-4 border-black px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest neobrutalism-shadow active:scale-95 transition-all"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* FILTROS */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-800 border-4 border-black p-6 rounded-[2rem] neobrutalism-shadow">
            <h3 className="text-sm font-black uppercase text-blue-400 mb-6 flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filtros
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2 tracking-widest">Desde</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-900 border-2 border-black p-3 rounded-xl text-white font-bold text-sm focus:border-blue-500 outline-none"
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2 tracking-widest">Hasta</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-900 border-2 border-black p-3 rounded-xl text-white font-bold text-sm focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2 tracking-widest">Delegado</label>
                <select 
                  value={selectedDelegate}
                  onChange={(e) => setSelectedDelegate(e.target.value)}
                  className="w-full bg-slate-900 border-2 border-black p-3 rounded-xl text-white font-bold text-sm focus:border-blue-500 outline-none appearance-none"
                >
                  <option value="ALL">TODOS LOS DELEGADOS</option>
                  {delegates.map(d => (
                    <option key={d.id} value={d.id}>{d.name.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-blue-600 border-4 border-black p-6 rounded-[2rem] neobrutalism-shadow">
            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest block mb-1">Total Recaudado</span>
            <p className="text-4xl font-black text-white italic tracking-tighter">${totalCollected.toLocaleString()}</p>
            <div className="mt-4 pt-4 border-t border-white/20">
              <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest">
                {filteredData.length} transacciones registradas
              </p>
            </div>
          </div>
        </div>

        {/* TABLA DE RESULTADOS */}
        <div className="lg:col-span-3">
          <div className="bg-slate-900 border-4 border-black rounded-[2.5rem] overflow-hidden neobrutalism-shadow min-h-[400px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-[400px]">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                <p className="mt-4 font-black uppercase tracking-widest text-slate-500">Generando Reporte...</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-center p-8">
                <FileText className="w-16 h-16 text-slate-800 mb-4" />
                <h3 className="text-xl font-black uppercase text-slate-600">Sin movimientos</h3>
                <p className="text-sm font-bold text-slate-700 uppercase tracking-widest mt-2">No se encontraron cobros en el rango seleccionado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800 border-b-4 border-black">
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha / Hora</th>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Delegado</th>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Comerciante</th>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-black">
                    {filteredData.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/50 transition-colors group">
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-800 border border-black rounded-lg text-slate-500 group-hover:text-blue-400 transition-colors">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-black text-white uppercase tracking-tight">
                                {new Date(item.date).toLocaleDateString()}
                              </p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase">
                                {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-violet-500 border-2 border-black flex items-center justify-center text-[10px] font-black text-white">
                              {item.profiles?.full_name?.charAt(0) || 'D'}
                            </div>
                            <span className="text-xs font-black text-slate-300 uppercase tracking-tight">
                              {item.profiles?.full_name || 'Desconocido'}
                            </span>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-800 border border-black rounded-lg text-slate-500">
                              <User className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest truncate max-w-[150px]">
                              {item.merchants?.first_name} {item.merchants?.last_name_paterno}
                            </span>
                          </div>
                        </td>
                        <td className="p-6 text-right">
                          <span className="text-lg font-black text-emerald-500 italic tracking-tighter">
                            +${Number(item.amount).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
