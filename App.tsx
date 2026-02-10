
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, UserPlus, LogOut, Menu, X, ShieldCheck } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { MerchantForm } from './components/MerchantForm';
import { MerchantList } from './components/MerchantList';
import { storage } from './services/storage';
import { User, Merchant, Abono } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'directory' | 'register'>('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [abonos, setAbonos] = useState<Abono[]>([]);

  useEffect(() => {
    setCurrentUser(storage.getCurrentUser());
    refreshData();
  }, []);

  const refreshData = () => {
    setMerchants(storage.getMerchants());
    setAbonos(storage.getAbonos());
  };

  const logout = () => {
    // In a real app, clear tokens
    window.location.reload();
  };

  const NavItem = ({ id, icon: Icon, label }: { id: any, icon: any, label: string }) => (
    <button
      onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }}
      className={`flex items-center gap-4 w-full p-4 rounded-2xl border-2 transition-all font-black text-left ${
        activeTab === id 
          ? 'bg-blue-600 border-black text-white neobrutalism-shadow' 
          : 'bg-transparent border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800'
      }`}
    >
      <Icon className="w-6 h-6" />
      <span className="hidden lg:inline uppercase text-sm tracking-widest">{label}</span>
      <span className="lg:hidden">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">
      {/* Mobile Top Bar */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-slate-900 border-b-2 border-black">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 border-2 border-black rounded-xl flex items-center justify-center">
            <span className="font-black text-xl italic text-white">A</span>
          </div>
          <span className="font-black text-xl tracking-tighter">ATCEM</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar (Desktop) / Overlay (Mobile) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-full lg:w-72 bg-slate-900 border-r-4 border-black flex flex-col p-6 transition-transform lg:relative lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="hidden lg:flex items-center gap-3 mb-12">
          <div className="w-12 h-12 bg-blue-600 border-2 border-black rounded-2xl flex items-center justify-center neobrutalism-shadow">
            <span className="font-black text-2xl italic text-white">A</span>
          </div>
          <div>
            <h1 className="font-black text-2xl tracking-tighter leading-none">ATCEM</h1>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Management v1.0</p>
          </div>
        </div>

        <nav className="flex-1 space-y-4">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem id="directory" icon={Users} label="Directorio" />
          {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SECRETARY') && (
            <NavItem id="register" icon={UserPlus} label="Registrar" />
          )}
        </nav>

        <div className="mt-auto pt-6 border-t-2 border-slate-800">
          <div className="flex items-center gap-3 mb-6 p-4 bg-slate-800 border-2 border-black rounded-2xl neobrutalism-shadow">
            <div className="w-10 h-10 bg-amber-500 rounded-full border-2 border-black flex items-center justify-center font-black">
              {currentUser?.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="font-black truncate">{currentUser?.name}</p>
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <p className="text-[10px] font-bold text-slate-400 uppercase">{currentUser?.role}</p>
              </div>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-rose-500 text-rose-500 font-black uppercase tracking-widest text-sm hover:bg-rose-500 hover:text-white transition-all"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-12 overflow-y-auto max-h-screen">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard merchants={merchants} abonos={abonos} />}
          {activeTab === 'directory' && <MerchantList role={currentUser?.role || 'DELEGATE'} onRefresh={refreshData} />}
          {activeTab === 'register' && <MerchantForm onSuccess={() => { setActiveTab('directory'); refreshData(); }} onCancel={() => setActiveTab('dashboard')} />}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-4 left-4 right-4 bg-slate-900 border-2 border-black rounded-2xl flex justify-around p-2 neobrutalism-shadow z-40">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`p-3 rounded-xl ${activeTab === 'dashboard' ? 'bg-blue-600 text-white border border-black' : 'text-slate-400'}`}
        >
          <LayoutDashboard className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setActiveTab('directory')}
          className={`p-3 rounded-xl ${activeTab === 'directory' ? 'bg-blue-600 text-white border border-black' : 'text-slate-400'}`}
        >
          <Users className="w-6 h-6" />
        </button>
        {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SECRETARY') && (
          <button 
            onClick={() => setActiveTab('register')}
            className={`p-3 rounded-xl ${activeTab === 'register' ? 'bg-blue-600 text-white border border-black' : 'text-slate-400'}`}
          >
            <UserPlus className="w-6 h-6" />
          </button>
        )}
      </nav>
    </div>
  );
};

export default App;
