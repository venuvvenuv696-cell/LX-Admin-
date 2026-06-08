import React, { useState } from 'react';
import { 
  supabase, 
  saveCustomSupabaseConfig, 
  clearCustomSupabaseConfig, 
  SUPABASE_URL, 
  SUPABASE_KEY 
} from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  LogIn, 
  Package, 
  Database, 
  Link2, 
  Key, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Sliders, 
  Check, 
  Copy 
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AuthProps {
  appName: string;
  logoUrl?: string;
}

export default function Auth({ appName, logoUrl }: AuthProps) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showConfig, setShowConfig] = useState(false);
  const [dbUrl, setDbUrl] = useState(localStorage.getItem('custom_supabase_url') || '');
  const [dbKey, setDbKey] = useState(localStorage.getItem('custom_supabase_key') || '');
  const [testStatus, setTestStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>(() => {
    const isSandbox = localStorage.getItem('delivery_store_sandbox') === 'true';
    return isSandbox ? 'error' : 'connected';
  });

  const handleSaveDb = () => {
    if (!dbUrl || !dbKey) {
      toast.error('Please enter both Supabase URL and Anon Key');
      return;
    }
    
    if (!dbUrl.startsWith('https://')) {
      toast.error('Supabase URL must start with https://');
      return;
    }

    saveCustomSupabaseConfig(dbUrl, dbKey);
    toast.success('Credentials saved! Reconnecting...', { icon: '⚙️' });
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  const handleClearDb = () => {
    clearCustomSupabaseConfig();
    toast.success('Reset to default database!', { icon: '🔄' });
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  const handleTestConnection = async () => {
    setTestStatus('checking');
    try {
      const targetUrl = dbUrl.trim() || SUPABASE_URL;
      const targetKey = dbKey.trim() || SUPABASE_KEY;
      
      const res = await fetch(`${targetUrl}/rest/v1/?apikey=${targetKey}`, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (res.ok) {
        setTestStatus('connected');
        toast.success('Successfully reached Supabase!', { icon: '⚡' });
      } else {
        setTestStatus('error');
        toast.error(`Response error: ${res.status}`);
      }
    } catch (err: any) {
      setTestStatus('error');
      toast.error(`Failed to connect: ${err.message || err}`);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        // Check if user is admin either by role or specifically by designated admin email addresses
        const isUserAdmin = 
          profile?.role === 'admin' || 
          data.user.email?.toLowerCase() === 'venuvvenuv696@gmail.com' ||
          data.user.email?.toLowerCase() === 'madavan696@gmail.com';
        
        // Even if there's a status column in the DB, we want to allow the admin
        // We'll ignore status checks for both primary admin emails
        const isPassListAdmin = data.user.email?.toLowerCase() === 'venuvvenuv696@gmail.com' || data.user.email?.toLowerCase() === 'madavan696@gmail.com';
        const isActive = isPassListAdmin || (profile && 'status' in profile ? profile.status === 'active' || profile.status === true : true);

        if (!isUserAdmin || !isActive) {
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch (e) {
            console.warn('Local signOut failed:', e);
          }
          toast.error('Unauthorized Access: Only active admin accounts can enter this portal.');
          setLoading(false);
          return;
        }
      }

      toast.success('Welcome back, Admin');
    } catch (err: any) {
      console.error('Login error:', err);
      const errStr = err?.message || String(err);
      if (errStr.includes('Failed to fetch') || errStr.includes('fetch')) {
        toast.error('Connection Error: Failed to reach Supabase. Check if your database project is paused or offline. Try waking it up from the Supabase Panel!', { duration: 8000 });
      } else {
        toast.error('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-10 shadow-2xl border border-apple-gray-200 dark:border-dark-border">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-20 h-20 bg-premium-gold rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl shadow-premium-gold/30 overflow-hidden">
               {logoUrl ? (
                 <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-3" />
               ) : (
                 <LogIn className="text-white w-8 h-8" />
               )}
            </div>
            <h1 className="text-3xl font-black tracking-tighter dark:text-white uppercase">{appName}</h1>
            <p className="text-neutral-500 text-[10px] mt-3 font-black uppercase tracking-[0.3em] leading-relaxed opacity-60">
               Official Brand Management Portal
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2 px-1">
                Identification Contact
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="venuvvenuv696@gmail.com"
                required
                className="w-full px-5 py-4 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white dark:focus:bg-dark-card focus:border-premium-gold outline-none transition-all duration-300 shadow-inner dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2 px-1">
                Security Key
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-5 py-4 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white dark:focus:bg-dark-card focus:border-premium-gold outline-none transition-all duration-300 shadow-inner dark:text-white"
              />
            </div>
            <button
              disabled={loading}
              className="w-full bg-neutral-950 dark:bg-premium-gold text-white rounded-2xl py-5 font-black uppercase tracking-widest text-xs hover:bg-neutral-800 dark:hover:bg-premium-gold-light disabled:opacity-50 transition-all active:scale-[0.98] shadow-xl shadow-black/10"
            >
              {loading ? 'Verifying Terminal...' : 'Continue Account'}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-apple-gray-100 dark:border-dark-border text-center space-y-4">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-405 hover:text-premium-gold dark:hover:text-premium-gold transition-colors duration-200 outline-none"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{showConfig ? 'Hide' : 'Configure'} Cloud Database</span>
              <Sliders className="w-3 h-3 opacity-60" />
            </button>

            {showConfig && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-left space-y-4 pt-4 border-t border-dashed border-apple-gray-200 dark:border-dark-border"
              >
                <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200">
                  <Database className="w-4 h-4 text-premium-gold" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Dynamic Database Link</span>
                </div>
                
                {/* URL */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest px-0.5">Project URL</label>
                  <div className="relative font-mono">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-neutral-400">
                      <Link2 className="w-3.5 h-3.5" />
                    </div>
                    <input 
                      type="url"
                      placeholder="https://your-proj.supabase.co"
                      value={dbUrl}
                      onChange={(e) => setDbUrl(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-xl focus:bg-white dark:focus:bg-dark-card focus:border-premium-gold outline-none transition-all shadow-inner text-[11px] dark:text-white"
                    />
                  </div>
                </div>

                {/* ANON KEY */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest px-0.5">Anon Public Key</label>
                  <div className="relative font-mono">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-neutral-400">
                      <Key className="w-3.5 h-3.5" />
                    </div>
                    <input 
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={dbKey}
                      onChange={(e) => setDbKey(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-xl focus:bg-white dark:focus:bg-dark-card focus:border-premium-gold outline-none transition-all shadow-inner text-[11px] dark:text-white"
                    />
                  </div>
                </div>

                {/* STATUS BAR */}
                <div className="flex items-center justify-between p-3 bg-apple-gray-50 dark:bg-dark-bg rounded-xl border border-apple-gray-200 dark:border-dark-border text-[10px]">
                  <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                    {testStatus === 'connected' ? <Wifi className="w-3.5 h-3.5 text-emerald-500" /> : <WifiOff className="w-3.5 h-3.5 text-amber-500" />}
                    <span>{testStatus === 'connected' ? 'Reachable' : 'Connecting/Sandbox'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    className="px-2 py-1 bg-white dark:bg-dark-card border border-apple-gray-200 dark:border-dark-border rounded text-[9px] font-bold uppercase tracking-wider hover:border-premium-gold active:scale-95 flex items-center gap-1 text-neutral-700 dark:text-white"
                  >
                    <RefreshCw className={e => `w-2.5 h-2.5 ${testStatus === 'checking' ? "animate-spin" : ""}`} />
                    Test
                  </button>
                </div>

                {/* ACTIONS */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDb}
                    className="flex-1 py-2.5 bg-neutral-950 dark:bg-premium-gold dark:hover:bg-premium-gold-light hover:bg-neutral-800 text-white dark:text-neutral-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                  >
                    Link Project
                  </button>
                  {localStorage.getItem('custom_supabase_url') && (
                    <button
                      type="button"
                      onClick={handleClearDb}
                      className="px-3 bg-rose-50 dark:bg-rose-500/5 hover:bg-rose-100 dark:hover:bg-rose-500/10 border border-rose-100 dark:border-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </motion.div>
            )}
            
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest opacity-60">
              Secure Terminal Access
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
