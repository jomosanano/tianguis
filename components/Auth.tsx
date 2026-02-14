
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { dataService } from '../services/dataService';
import { LogIn, UserPlus, ShieldAlert, Key, ArrowLeft, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';

type AuthView = 'login' | 'forgot';

export const Auth: React.FC = () => {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await dataService.sendAdminPasswordReset(email);
      setSuccess("Se ha enviado un enlace de recuperación a tu correo institucional.");
    } catch (err: any) {
      setError(err.message || "Error al intentar recuperar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-800 border-4 border-black p-8 rounded-[2.5rem] w-full max-w-md neobrutalism-shadow-lg animate-in zoom-in-95">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-blue-600 border-4 border-black rounded-3xl flex items-center justify-center neobrutalism-shadow">
            <span className="text-4xl font-black italic text-white">A</span>
          </div>
        </div>
        
        <h1 className="text-3xl font-black text-center mb-2">
          {view === 'login' ? 'BIENVENIDO A' : 'RECUPERAR'} <span className="text-blue-500">{view === 'login' ? 'ATCEM' : 'ACCESO'}</span>
        </h1>
        <p className="text-slate-400 font-bold text-center mb-8 uppercase text-xs tracking-widest">
          {view === 'login' ? 'Gestión de Comerciantes Senior' : 'Portal Exclusivo para Administradores'}
        </p>

        {view === 'login' ? (
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
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-black uppercase text-slate-500">Contraseña</label>
                <button 
                  type="button" 
                  onClick={() => { setView('forgot'); setError(null); setSuccess(null); }}
                  className="text-[10px] font-black text-blue-500 uppercase tracking-tighter hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border-2 border-black rounded-2xl p-4 pr-12 font-bold outline-none focus:border-blue-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
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
              {loading ? <Loader2 className="animate-spin w-6 h-6" /> : <><LogIn className="w-6 h-6" /> ENTRAR</>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6 animate-in slide-in-from-right-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-500 ml-1">Email de Administrador</label>
              <input 
                type="email" 
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-900 border-2 border-black rounded-2xl p-4 font-bold outline-none focus:border-blue-500"
                placeholder="admin@atcem.com"
              />
            </div>

            {error && (
              <div className="p-4 bg-rose-500/10 border-2 border-rose-500 rounded-2xl flex items-center gap-3 text-rose-500 text-sm font-bold">
                <ShieldAlert className="w-5 h-5" />
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-emerald-500/10 border-2 border-emerald-500 rounded-2xl flex items-center gap-3 text-emerald-500 text-sm font-bold">
                <CheckCircle2 className="w-5 h-5" />
                {success}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button 
                type="submit" 
                disabled={loading || !!success}
                className="w-full bg-blue-600 border-4 border-black p-5 rounded-2xl font-black text-xl neobrutalism-shadow hover:neobrutalism-shadow-active active:neobrutalism-shadow-active transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin w-6 h-6" /> : <><Key className="w-6 h-6" /> RECUPERAR</>}
              </button>
              
              <button 
                type="button" 
                onClick={() => { setView('login'); setError(null); setSuccess(null); }}
                className="w-full bg-slate-700 border-2 border-black p-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Volver al Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
