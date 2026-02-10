
import React, { useState } from 'react';
import { Search, ChevronRight, User, DollarSign, CreditCard } from 'lucide-react';
import { storage } from '../services/storage';
import { Merchant, Abono, Role } from '../types';

interface MerchantListProps {
  role: Role;
  onRefresh: () => void;
}

export const MerchantList: React.FC<MerchantListProps> = ({ role, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [abonoAmount, setAbonoAmount] = useState('');
  const merchants = storage.getMerchants();

  const filtered = merchants.filter(m => 
    m.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAbono = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchant || !abonoAmount) return;

    const amount = parseFloat(abonoAmount);
    if (amount <= 0 || amount > selectedMerchant.balance) {
      alert("Monto inválido");
      return;
    }

    const newAbono: Abono = {
      id: crypto.randomUUID(),
      merchant_id: selectedMerchant.id,
      amount,
      date: new Date().toISOString(),
      recorded_by: storage.getCurrentUser().name
    };

    // Update merchant balance
    const updatedMerchants = merchants.map(m => {
      if (m.id === selectedMerchant.id) {
        const newBalance = m.balance - amount;
        return { 
          ...m, 
          balance: newBalance,
          status: newBalance === 0 ? 'PAID' : 'PARTIAL' as any
        };
      }
      return m;
    });

    storage.saveMerchants(updatedMerchants);
    storage.saveAbonos([...storage.getAbonos(), newAbono]);
    
    setAbonoAmount('');
    setSelectedMerchant(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-3xl font-black text-slate-100">Directorio <span className="text-blue-500">ATCEM</span></h2>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text"
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border-2 border-black neobrutalism-shadow rounded-xl p-4 pl-12 font-bold outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(merchant => (
          <div key={merchant.id} className="bg-slate-800 border-2 border-black rounded-[2rem] p-6 neobrutalism-shadow flex flex-col gap-4">
            <div className="flex items-center gap-4">
              {merchant.profile_photo ? (
                <img src={merchant.profile_photo} className="w-16 h-16 rounded-2xl border-2 border-black object-cover" alt="Profile" />
              ) : (
                <div className="w-16 h-16 bg-blue-600 rounded-2xl border-2 border-black flex items-center justify-center">
                  <User className="text-white w-8 h-8" />
                </div>
              )}
              <div>
                <h3 className="text-xl font-black leading-tight">{merchant.full_name}</h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black inline-block mt-1 ${
                  merchant.balance === 0 ? 'bg-emerald-500' : 'bg-amber-500'
                }`}>
                  {merchant.balance === 0 ? 'Liquidado' : 'Pendiente'}
                </span>
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl p-4 border-2 border-slate-700">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400 font-bold">DEUDA TOTAL:</span>
                <span className="font-black">${merchant.total_debt.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-slate-400 font-bold uppercase text-xs">Saldo:</span>
                <span className="font-black text-rose-500">${merchant.balance.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-auto pt-4 flex gap-2">
              <button 
                onClick={() => setSelectedMerchant(merchant)}
                className="flex-1 bg-blue-600 border-2 border-black p-3 rounded-xl font-black text-sm neobrutalism-shadow hover:neobrutalism-shadow-active transition-all flex items-center justify-center gap-2"
              >
                <DollarSign className="w-4 h-4" />
                ABONAR
              </button>
              <button 
                className="p-3 bg-slate-700 border-2 border-black rounded-xl neobrutalism-shadow hover:neobrutalism-shadow-active"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Abono Modal */}
      {selectedMerchant && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border-4 border-black p-8 rounded-[2.5rem] w-full max-w-md neobrutalism-shadow-lg animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black mb-2 uppercase">Registrar Abono</h3>
            <p className="text-slate-400 font-bold mb-6">Para: {selectedMerchant.full_name}</p>
            
            <form onSubmit={handleAbono} className="space-y-6">
              <div className="p-4 bg-slate-900 border-2 border-slate-700 rounded-2xl">
                <div className="flex justify-between mb-4">
                  <span className="text-xs font-bold text-slate-400">SALDO ACTUAL</span>
                  <span className="font-black text-rose-500">${selectedMerchant.balance.toLocaleString()}</span>
                </div>
                <div className="relative">
                  <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="number"
                    step="0.01"
                    required
                    autoFocus
                    placeholder="Monto a pagar"
                    value={abonoAmount}
                    onChange={e => setAbonoAmount(e.target.value)}
                    className="w-full bg-slate-800 border-2 border-black rounded-xl p-4 pl-12 font-black text-xl outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setSelectedMerchant(null)}
                  className="flex-1 bg-slate-700 border-2 border-black p-4 rounded-2xl font-black"
                >
                  CANCELAR
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-emerald-500 border-2 border-black p-4 rounded-2xl font-black neobrutalism-shadow hover:neobrutalism-shadow-active transition-all"
                >
                  CONFIRMAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
