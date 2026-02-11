
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { LogIn, UserPlus, ShieldAlert } from 'lucide-react';

export const Auth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-800 border-4 border-black p-8 rounded-[2.5rem] w-full max-w-md neobrutalism-shadow-lg">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-blue-600 border-4 border-black rounded-3xl flex items-center justify-center neobrutalism-shadow">
            <span className="text-4xl font-black italic text-white">A</span>
          </div>
        </div>
        
        <h1 className="text-3xl font-black text-center mb-2">BIENVENIDO A <span className="text-blue-500">ATCEM</span></h1>
        <p className="text-slate-400 font-bold text-center mb-8 uppercase text-xs tracking-widest">Gestión de Comerciantes Senior</p>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-500 ml-1">Email Institucional</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-900 border-2 border-black rounded-2xl p-4 font-bold outline-none focus:border-blue-500"
              placeholder="admin@atcem.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-500 ml-1">Contraseña</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-900 border-2 border-black rounded-2xl p-4 font-bold outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border-2 border-rose-500 rounded-2xl flex items-center gap-3 text-rose-500 text-sm font-bold">
              <ShieldAlert className="w-5 h-5" />
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 border-4 border-black p-5 rounded-2xl font-black text-xl neobrutalism-shadow hover:neobrutalism-shadow-active active:neobrutalism-shadow-active transition-all flex items-center justify-center gap-3"
          >
            {loading ? 'CONECTANDO...' : <><LogIn className="w-6 h-6" /> ENTRAR</>}
          </button>
        </form>
      </div>
    </div>
  );
};
