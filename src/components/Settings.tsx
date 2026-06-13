import React from 'react';
import { 
  User, 
  Bell, 
  Shield, 
  Moon, 
  Sun, 
  Globe, 
  Settings as SettingsIcon,
  CheckCircle2,
  AlertTriangle,
  Package,
  Upload,
  X,
  Database,
  Wifi,
  WifiOff,
  RefreshCw,
  Key,
  Link2,
  Copy,
  Check
} from 'lucide-react';
import { AppSettings } from '../types';
import { cn } from '../lib/utils';
import { uploadFileWithFallback } from '../lib/imageUtils';
import { 
  supabase, 
  saveCustomSupabaseConfig, 
  clearCustomSupabaseConfig, 
  SUPABASE_URL, 
  SUPABASE_KEY 
} from '../lib/supabase';
import toast from 'react-hot-toast';

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onLogout: () => void;
}

export default function Settings({ settings, onUpdateSettings, onLogout }: SettingsProps) {
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [dbUrl, setDbUrl] = React.useState(localStorage.getItem('custom_supabase_url') || '');
  const [dbKey, setDbKey] = React.useState(localStorage.getItem('custom_supabase_key') || '');
  const [showSql, setShowSql] = React.useState(false);
  const [copiedSql, setCopiedSql] = React.useState(false);
  const [testStatus, setTestStatus] = React.useState<'idle' | 'checking' | 'connected' | 'error'>(() => {
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
    toast.success('Credentials saved! Reconnecting to database...', { icon: '⚙️' });
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  const handleClearDb = () => {
    clearCustomSupabaseConfig();
    toast.success('Reset to default trial database!', { icon: '🔄' });
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
        toast.success('Successfully connected to Supabase!', { icon: '⚡' });
      } else {
        setTestStatus('error');
        toast.error(`Error connecting to Supabase: ${res.status}`);
      }
    } catch (err: any) {
      setTestStatus('error');
      toast.error(`Failed to connect: ${err.message || err}`);
    }
  };

  const toggleTheme = () => {
    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
    onUpdateSettings({ ...settings, theme: newTheme });
  };

  const toggleStatus = () => {
    const newStatus = settings.systemStatus === 'live' ? 'maintenance' : 'live';
    onUpdateSettings({ ...settings, systemStatus: newStatus });
  };

  return (
    <div className="max-w-4xl space-y-8 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="col-span-1 space-y-2">
           <h3 className="text-xl font-bold tracking-tight">Appearance</h3>
           <p className="text-sm text-neutral-500">Customize how the dashboard looks for you.</p>
        </div>
        <div className="col-span-1 md:col-span-2">
           <div className="bg-white dark:bg-dark-card rounded-3xl border border-apple-gray-200 dark:border-dark-border p-6 shadow-sm">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-apple-gray-100 dark:bg-dark-bg rounded-2xl">
                       {settings.theme === 'light' ? <Sun className="w-6 h-6 text-amber-500" /> : <Moon className="w-6 h-6 text-indigo-400" />}
                    </div>
                    <div>
                       <p className="font-bold">Color Theme</p>
                       <p className="text-xs text-neutral-500">Toggle between Light and Dark mode</p>
                    </div>
                 </div>
                 <button 
                  onClick={toggleTheme}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors relative",
                    settings.theme === 'dark' ? "bg-premium-gold" : "bg-apple-gray-300"
                  )}
                 >
                    <div className={cn(
                      "w-6 h-6 bg-white rounded-full transition-transform",
                      settings.theme === 'dark' ? "translate-x-6" : "translate-x-0"
                    )} />
                 </button>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-apple-gray-100 dark:border-dark-border">
        <div className="col-span-1 space-y-2">
           <h3 className="text-xl font-bold tracking-tight">System Configuration</h3>
           <p className="text-sm text-neutral-500">Global settings for your application.</p>
        </div>
        <div className="col-span-1 md:col-span-2 space-y-6">
           <div className="bg-white dark:bg-dark-card rounded-3xl border border-apple-gray-200 dark:border-dark-border p-6 shadow-sm space-y-6">
              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 px-1">Application Name</label>
                <input 
                  type="text"
                  value={settings.appName}
                  onChange={(e) => onUpdateSettings({ ...settings, appName: e.target.value })}
                  className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all shadow-inner"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 px-1">Application Logo</label>
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                    <div 
                      className="relative w-24 h-24 bg-apple-gray-100 dark:bg-dark-bg rounded-[2rem] flex items-center justify-center overflow-hidden border border-apple-gray-200 dark:border-dark-border shadow-inner group"
                    >
                      {settings.logoUrl ? (
                         <>
                           <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                           <button 
                             onClick={() => onUpdateSettings({ ...settings, logoUrl: '' })}
                             className="absolute inset-0 bg-rose-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                           >
                             <X className="w-6 h-6" />
                           </button>
                         </>
                      ) : (
                         <Package className="w-10 h-10 text-neutral-300" />
                      )}
                      {uploading && (
                        <div className="absolute inset-0 bg-white/80 dark:bg-dark-card/80 flex items-center justify-center">
                           <div className="w-6 h-6 border-2 border-premium-gold border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-3 w-full">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="flex-1 px-6 py-3 bg-white dark:bg-dark-card border border-apple-gray-200 dark:border-dark-border rounded-2xl text-xs font-bold hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          {uploading ? 'Uploading...' : 'Upload Logo'}
                        </button>
                        <input 
                          type="file"
                          ref={fileInputRef}
                          onChange={async (e) => {
                            if (e.target.files?.[0]) {
                              const file = e.target.files[0];
                              if (!file.type.startsWith('image/')) {
                                toast.error('Please select an image file');
                                return;
                              }
                              setUploading(true);
                              const tId = toast.loading('Uploading logo...');
                              
                              try {
                                const fileExt = file.name.split('.').pop() || 'jpg';
                                const fileName = `brand_logo_${Date.now()}.${fileExt}`;
                                const publicUrl = await uploadFileWithFallback(file, 'system', fileName);
                                onUpdateSettings({ ...settings, logoUrl: publicUrl });
                                toast.success('Logo updated successfully', { id: tId });
                              } catch (err: any) {
                                toast.error(`Logo upload failed: ${err.message}`, { id: tId });
                              } finally {
                                setUploading(false);
                              }
                            }
                          }}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>
                      
                      <div className="relative">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                          <Globe className="w-3 h-3 text-neutral-400" />
                        </div>
                        <input 
                          type="url"
                          placeholder="Or paste image URL here..."
                          value={settings.logoUrl || ''}
                          onChange={(e) => onUpdateSettings({ ...settings, logoUrl: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all shadow-inner text-xs"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-neutral-500 font-medium px-1 uppercase tracking-wider">Recommended: PNG / SVG with transparent background</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-apple-gray-50 dark:bg-dark-bg rounded-2xl border border-apple-gray-100 dark:border-dark-border">
                <div className="flex items-center gap-4">
                    <div className={cn(
                       "p-3 rounded-2xl",
                       settings.systemStatus === 'live' ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600" : "bg-amber-100 dark:bg-amber-500/10 text-amber-600"
                    )}>
                       {settings.systemStatus === 'live' ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                    </div>
                    <div>
                       <p className="font-bold capitalize">{settings.systemStatus} Mode</p>
                       <p className="text-xs text-neutral-500">Public visibility status</p>
                    </div>
                 </div>
                 <button 
                  onClick={toggleStatus}
                  className="px-4 py-2 bg-white dark:bg-dark-card border border-apple-gray-200 dark:border-dark-border rounded-xl text-xs font-bold hover:shadow-md transition-all active:scale-[0.98]"
                 >
                   Switch to {settings.systemStatus === 'live' ? 'Maintenance' : 'Live'}
                 </button>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-apple-gray-100 dark:border-dark-border">
        <div className="col-span-1 space-y-2">
           <h3 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">Database Connection</h3>
           <p className="text-sm text-neutral-500">Connect the admin panel directly to your personal live Supabase project.</p>
        </div>
        <div className="col-span-1 md:col-span-2 space-y-6">
           <div className="bg-white dark:bg-dark-card rounded-3xl border border-apple-gray-200 dark:border-dark-border p-6 shadow-sm space-y-6">
              
              <div className="p-4 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 rounded-2xl flex items-start gap-3">
                <Database className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-extrabold text-amber-800 dark:text-premium-gold uppercase tracking-wider">How to connect your own Supabase project</p>
                  <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed font-sans">
                    You can copy your <b>Project URL</b> and <b>Anon Public API Key</b> from your <b>Supabase Dashboard &rarr; Project Settings &rarr; API</b> and paste them below. This lets you use your own database completely live in your browser window!
                  </p>
                </div>
              </div>

              {/* URL */}
              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 px-1">Supabase Project URL</label>
                <div className="relative font-mono">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-neutral-400">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <input 
                    type="url"
                    placeholder="https://your-project-id.supabase.co"
                    value={dbUrl}
                    onChange={(e) => setDbUrl(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white dark:focus:bg-dark-card focus:border-premium-gold outline-none transition-all shadow-inner text-xs dark:text-white"
                  />
                </div>
              </div>

              {/* ANON KEY */}
              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 px-1">Supabase Anon Key</label>
                <div className="relative font-mono">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-neutral-400">
                    <Key className="w-4 h-4" />
                  </div>
                  <input 
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={dbKey}
                    onChange={(e) => setDbKey(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white dark:focus:bg-dark-card focus:border-premium-gold outline-none transition-all shadow-inner text-xs dark:text-white"
                  />
                </div>
              </div>

              {/* DIAGNOSTICS */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-apple-gray-50 dark:bg-dark-bg rounded-2xl border border-apple-gray-100 dark:border-dark-border">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-xl",
                    testStatus === 'connected' ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600" :
                    testStatus === 'checking' ? "bg-blue-100 dark:bg-blue-500/10 text-blue-600 animate-pulse" :
                    "bg-amber-100 dark:bg-amber-500/10 text-amber-600"
                  )}>
                    {testStatus === 'connected' ? <Wifi className="w-5 h-5 text-emerald-500" /> : <WifiOff className="w-5 h-5 text-amber-500" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-none dark:text-white">
                      {testStatus === 'connected' ? 'Connected Live to Supabase Project' :
                       testStatus === 'checking' ? 'Testing cloud database access...' :
                       'Offline or Fallback Sandbox Database Mode Active'}
                    </p>
                    <p className="text-[10px] text-neutral-500 mt-1 font-medium">
                      {localStorage.getItem('custom_supabase_url') ? 'Using your custom project credentials' : 'Using free shared default trial project'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus === 'checking'}
                  className="px-4 py-2 bg-white dark:bg-dark-card border border-apple-gray-200 dark:border-dark-border hover:border-premium-gold rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 text-neutral-700 dark:text-white"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5 text-neutral-500", testStatus === 'checking' && "animate-spin")} />
                  Test Access
                </button>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleSaveDb}
                  className="flex-1 py-3.5 bg-neutral-950 dark:bg-premium-gold dark:hover:bg-premium-gold-light hover:bg-neutral-800 text-white dark:text-neutral-900 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-black/10 transition-all active:scale-[0.98]"
                >
                  Save Connection &amp; Refresh
                </button>
                {localStorage.getItem('custom_supabase_url') && (
                  <button
                    type="button"
                    onClick={handleClearDb}
                    className="px-6 py-3.5 bg-rose-50 dark:bg-rose-500/5 hover:bg-rose-100 border border-rose-100 dark:border-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98]"
                  >
                    Clear Connection
                  </button>
                )}
              </div>

              {/* COPY SQL SCHEMA */}
              <div className="pt-4 border-t border-apple-gray-100 dark:border-dark-border">
                <button
                  type="button"
                  onClick={() => setShowSql(!showSql)}
                  className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-premium-gold dark:hover:text-premium-gold font-bold flex items-center gap-2 outline-none animate-none"
                >
                  <span>{showSql ? 'Hide' : 'Show'} Database SQL Table Schema</span>
                </button>

                {showSql && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] text-neutral-500 font-medium">
                      Copy and run this SQL inside your <b>Supabase SQL Editor</b> to automatically build all required tables with full matching column structures:
                    </p>
                    <div className="relative">
                      <pre className="p-4 bg-neutral-900 text-neutral-200 rounded-2xl text-[10px] font-mono overflow-x-auto max-h-52 leading-relaxed whitespace-pre Scrollbar text-left">
{`CREATE TABLE IF NOT EXISTS public.products (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    price numeric NOT NULL,
    stock integer NOT NULL DEFAULT 0,
    delivery_charge numeric DEFAULT 0,
    image_url text,
    category text NOT NULL,
    status text NOT NULL DEFAULT 'available',
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    city text NOT NULL,
    address text NOT NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    product_variant text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    total_price numeric NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY,
    email text UNIQUE NOT NULL,
    full_name text,
    avatar_url text,
    role text DEFAULT 'member',
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.custom_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name text NOT NULL,
    email_reference text NOT NULL,
    secure_line text,
    project_name text,
    details text,
    file_url text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'quoted', 'in_production', 'delivered', 'cancelled')),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`}
                      </pre>
                      <button
                        type="button"
                        onClick={() => {
                          const sqlCode = `CREATE TABLE IF NOT EXISTS public.products (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    price numeric NOT NULL,
    stock integer NOT NULL DEFAULT 0,
    delivery_charge numeric DEFAULT 0,
    image_url text,
    category text NOT NULL,
    status text NOT NULL DEFAULT 'available',
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    city text NOT NULL,
    address text NOT NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    product_variant text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    total_price numeric NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY,
    email text UNIQUE NOT NULL,
    full_name text,
    avatar_url text,
    role text DEFAULT 'member',
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.custom_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name text NOT NULL,
    email_reference text NOT NULL,
    secure_line text,
    project_name text,
    details text,
    file_url text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'quoted', 'in_production', 'delivered', 'cancelled')),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`;
                          navigator.clipboard.writeText(sqlCode);
                          setCopiedSql(true);
                          toast.success('SQL schema copied to clipboard!');
                          setTimeout(() => setCopiedSql(false), 2000);
                        }}
                        className="absolute top-3 right-3 p-2 bg-neutral-805 dark:bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg hover:text-white transition-colors"
                        title="Copy SQL Schema"
                      >
                        {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-apple-gray-100 dark:border-dark-border">
         <div className="col-span-1 space-y-2">
            <h3 className="text-xl font-bold tracking-tight">Maintenance & Support</h3>
            <p className="text-sm text-neutral-500">Technical actions and logouts.</p>
         </div>
         <div className="col-span-1 md:col-span-2 space-y-4">
            <button 
             onClick={onLogout}
             className="w-full py-4 bg-rose-55 dark:bg-rose-500/10 dark:text-rose-400 text-rose-600 font-bold rounded-2xl hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all border border-rose-100 dark:border-rose-500/20"
            >
               Secure Sign Out
            </button>
         </div>
      </div>
    </div>
  );
}
