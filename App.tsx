
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, UserPlus, Map, LogOut, Menu, X, ShieldCheck, Loader2, UserCog, Settings as SettingsIcon } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { MerchantForm } from './components/MerchantForm';
import { MerchantList } from './components/MerchantList';
import { ZoneManagement } from './components/ZoneManagement';
import { StaffManagement } from './components/StaffManagement';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { dataService } from './services/dataService';
import { supabase } from './services/supabase';
import { User, Merchant, Abono } from './types';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'directory' | 'register' | 'zones' | 'staff' | 'settings'>('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [recentAbonos, setRecentAbonos] = useState<Abono[]>([]);
  const [systemLogo, setSystemLogo] = useState<string | null>(null);
  const [delegatesCanCollect, setDelegatesCanCollect] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchEssentialData();
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchEssentialData();
      else {
        setLoading(false);
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchEssentialData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [user, stats, abonos, settings] = await Promise.all([
        dataService.getCurrentUser(),
        dataService.getDashboardStats(),
        dataService.getAbonos(10),
        dataService.getSystemSettings()
      ]);
      setCurrentUser(user);
      setDashboardStats(stats);
      setRecentAbonos(abonos);
      setSystemLogo(settings.logo_url);
      setDelegatesCanCollect(settings.delegates_can_collect ?? false);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleEditMerchant = (merchant: Merchant) => {
    setEditingMerchant(merchant);
    setActiveTab('register');
  };

  const handleRegisterSuccess = () => {
    setEditingMerchant(null);
    setActiveTab('directory');
    fetchEssentialData();
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  if (loading && !session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="relative">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center font-black text-xl italic text-white">
            {systemLogo ? <img src={systemLogo} className="w-8 h-8 object-contain" /> : 'A'}
          </div>
        </div>
        <p className="font-black text-slate-500 uppercase tracking-[0.3em] mt-6 animate-pulse text-xs text-center">Iniciando Sistemas ATCEM v2.5...</p>
      </div>
    );
  }

  if (!session) return <Auth />;

  const NavItem = ({ id, icon: Icon, label }: { id: any, icon: any, label: string }) => (
    <button
      onClick={() => { 
        if (id !== 'register') setEditingMerchant(null);
        setActiveTab(id); 
        setIsMobileMenuOpen(false); 
      }}
      className={`flex items-center gap-4 w-full p-4 rounded-2xl border-2 transition-all font-black text-left group ${
        activeTab === id 
          ? 'bg-blue-600 border-black text-white neobrutalism-shadow' 
          : 'bg-transparent border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800'
      }`}
    >
      <Icon className={`w-6 h-6 transition-transform group-hover:scale-110 ${activeTab === id ? 'animate-bounce' : ''}`} />
      <span className="uppercase text-sm tracking-widest">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row overflow-hidden">
      <div className="lg:hidden safe-top flex items-center justify-between p-4 bg-slate-900 border-b-2 border-black z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 border-2 border-black rounded-xl flex items-center justify-center neobrutalism-shadow overflow-hidden p-1.5">
            {systemLogo ? <img src={systemLogo} className="w-full h-full object-contain" /> : <span className="font-black text-xl italic text-white">A</span>}
          </div>
          <span className="font-black text-xl tracking-tighter uppercase">ATCEM</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
          className="p-2 bg-slate-800 border-2 border-black rounded-xl text-white"
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      <aside className={`
        fixed inset-0 z-[60] lg:relative lg:translate-x-0 transition-transform duration-500 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        w-full sm:w-80 lg:w-72 bg-slate-900 border-r-4 border-black flex flex-col p-6
      `}>
        <div className="flex lg:hidden justify-end mb-4">
           <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-rose-600 border-2 border-black rounded-xl">
             <X className="w-6 h-6" />
           </button>
        </div>

        <div className="hidden lg:flex items-center gap-3 mb-10">
          <div className="w-12 h-12 bg-blue-600 border-2 border-black rounded-2xl flex items-center justify-center neobrutalism-shadow overflow-hidden p-2">
            {systemLogo ? <img src={systemLogo} className="w-full h-full object-contain" /> : <span className="font-black text-2xl italic text-white">A</span>}
          </div>
          <div>
            <h1 className="font-black text-2xl tracking-tighter leading-none">ATCEM</h1>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Enterprise Suite</p>
          </div>
        </div>

        <nav className="flex-1 space-y-3">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem id="directory" icon={Users} label="Directorio" />
          
          {currentUser?.role === 'ADMIN' && (
            <NavItem id="staff" icon={UserCog} label="Personal" />
          )}

          {currentUser?.role === 'ADMIN' && (
            <NavItem id="register" icon={UserPlus} label={editingMerchant ? "Editando" : "Registrar"} />
          )}
          
          {currentUser?.role === 'ADMIN' && (
            <>
              <NavItem id="zones" icon={Map} label="Zonas" />
              <NavItem id="settings" icon={SettingsIcon} label="Configuraciones" />
            </>
          )}
        </nav>

        <div className="mt-auto pt-6 border-t-2 border-slate-800 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-slate-800 border-2 border-black rounded-2xl neobrutalism-shadow">
            <div className={`w-10 h-10 rounded-full border-2 border-black flex items-center justify-center font-black flex-shrink-0 shadow-inner ${
              currentUser?.role === 'ADMIN' ? 'bg-amber-500' : currentUser?.role === 'SECRETARY' ? 'bg-purple-600' : 'bg-orange-500'
            }`}>
              {currentUser?.name?.charAt(0) || '?'}
            </div>
            <div className="overflow-hidden">
              <p className="font-black truncate text-sm">{currentUser?.name}</p>
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{currentUser?.role}</p>
              </div>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl border-2 border-rose-500 text-rose-500 font-black uppercase tracking-widest text-xs hover:bg-rose-500 hover:text-white transition-all active:scale-95">
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 relative h-[calc(100vh-4.5rem)] lg:h-screen overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-12 pb-32 lg:pb-12">
        <div className="max-w-7xl mx-auto w-full">
          {!session ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              {activeTab === 'dashboard' && <Dashboard stats={dashboardStats} abonos={recentAbonos} userRole={currentUser?.role} />}
              {activeTab === 'directory' && (
                <MerchantList 
                  user={currentUser} 
                  systemLogo={systemLogo} 
                  onRefresh={(silent) => fetchEssentialData(silent === true)} 
                  onEdit={handleEditMerchant}
                  delegatesCanCollect={delegatesCanCollect}
                />
              )}
              {activeTab === 'register' && (
                <MerchantForm 
                  initialData={editingMerchant}
                  onSuccess={handleRegisterSuccess} 
                  onCancel={() => { setEditingMerchant(null); setActiveTab('directory'); }} 
                />
              )}
              {activeTab === 'zones' && <ZoneManagement />}
              {activeTab === 'staff' && <StaffManagement />}
              {activeTab === 'settings' && (
                <Settings 
                  currentLogo={systemLogo} 
                  onUpdateLogo={(url) => setSystemLogo(url)} 
                  onUpdateCollectSetting={(val) => setDelegatesCanCollect(val)}
                  initialCollectSetting={delegatesCanCollect}
                />
              )}
            </div>
          )}
        </div>
      </main>

      <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-slate-900/90 backdrop-blur-md border-2 border-black rounded-[2rem] flex justify-around items-center p-2 neobrutalism-shadow-lg z-[50] safe-bottom">
        <button onClick={() => setActiveTab('dashboard')} className={`p-4 rounded-2xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white border-2 border-black -translate-y-2' : 'text-slate-400'}`}>
          <LayoutDashboard className="w-6 h-6" />
        </button>
        <button onClick={() => setActiveTab('directory')} className={`p-4 rounded-2xl transition-all ${activeTab === 'directory' ? 'bg-blue-600 text-white border-2 border-black -translate-y-2' : 'text-slate-400'}`}>
          <Users className="w-6 h-6" />
        </button>
        {currentUser?.role === 'ADMIN' && (
          <button onClick={() => setActiveTab('register')} className={`p-4 rounded-2xl transition-all ${activeTab === 'register' ? 'bg-blue-600 text-white border-2 border-black -translate-y-2' : 'text-slate-400'}`}>
            <UserPlus className="w-6 h-6" />
          </button>
        )}
        {currentUser?.role === 'ADMIN' && (
          <button onClick={() => setActiveTab('settings')} className={`p-4 rounded-2xl transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white border-2 border-black -translate-y-2' : 'text-slate-400'}`}>
            <SettingsIcon className="w-6 h-6" />
          </button>
        )}
      </nav>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
    </div>
  );
};

export default App;
