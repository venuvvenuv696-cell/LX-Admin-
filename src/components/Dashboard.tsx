import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Settings as SettingsIcon, 
  LogOut,
  Package,
  ChevronRight,
  X,
  User,
  MapPin,
  CheckCircle2,
  Boxes,
  Moon,
  Sun,
  FileText,
  Upload,
  Database,
  Wifi,
  WifiOff
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, Product, OrderStatus, AppSettings } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import { uploadFileWithFallback } from '../lib/imageUtils';

import Stats from './Stats';
import Orders from './Orders';
import Products from './Products';
import Settings from './Settings';
import CustomOrders from './CustomOrders';
import { CustomOrder } from '../types';

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-500/10 dark:text-neutral-500',
  processing: 'bg-premium-gold/10 text-premium-gold border-premium-gold/20',
  shipping: 'bg-premium-gold text-white border-premium-gold',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-500',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-500',
};

interface DashboardProps {
  initialSettings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

export default function Dashboard({ initialSettings: settings, onUpdateSettings: updateSettings }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'products' | 'custom-orders' | 'settings'>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLogoZoomed, setIsLogoZoomed] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [seenFileUrls, setSeenFileUrls] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('seen_files');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem('seen_files');
        setSeenFileUrls(saved ? JSON.parse(saved) : []);
      } catch {}
    };
    window.addEventListener('file-notifications-updated', handleSync);
    return () => window.removeEventListener('file-notifications-updated', handleSync);
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Standard signOut failed, falling back to local signOut:', e);
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (err) {
        console.error('Local signOut failed:', err);
      }
      // Clean local storage keys
      if (typeof window !== 'undefined') {
        try {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sb-') || key.includes('auth-token') || key.includes('supabase.auth'))) {
              localStorage.removeItem(key);
            }
          }
        } catch (clsErr) {
          console.warn('LocalStorage cleanup warning:', clsErr);
        }
      }
    }
  };

  // ✅ SAFE FETCH
  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const [ordersRes, productsRes, customOrdersRes] = await Promise.allSettled([
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('custom_orders').select('*').order('created_at', { ascending: false })
      ]);

      let networkErrorDetected = false;
      let tableNotFoundErrorDetected = '';

      // Check results for network fetch issues or missing relations
      [ordersRes, productsRes, customOrdersRes].forEach((res, idx) => {
        const name = ['orders', 'products', 'custom_orders'][idx];
        if (res.status === 'rejected') {
          const reason = res.reason?.message || String(res.reason);
          console.error(`Fetch rejected for ${name}:`, reason);
          if (reason.toLowerCase().includes('failed to fetch') || reason.toLowerCase().includes('fetch')) {
            networkErrorDetected = true;
          }
        } else if (res.status === 'fulfilled' && res.value.error) {
          const errorMsg = res.value.error.message || '';
          const errorCode = res.value.error.code || '';
          console.warn(`Query finished with error for ${name}:`, errorMsg, errorCode);
          if (errorMsg.toLowerCase().includes('failed to fetch') || errorMsg.toLowerCase().includes('fetch')) {
            networkErrorDetected = true;
          } else if (errorCode === 'PGRST116' || errorMsg.toLowerCase().includes('not found') || errorMsg.toLowerCase().includes('relation')) {
            tableNotFoundErrorDetected = name;
          }
        }
      });

      if (networkErrorDetected) {
        console.warn('Network connection to Cloud DB failed. Showing transient warning.');
        toast.error('Unable to reach Supabase Cloud database. Please ensure your project is active and wake it up from Supabase Panel if paused.', { icon: '⚠️', duration: 4000 });
        return;
      }

      if (tableNotFoundErrorDetected) {
        setError(
          `The table '${tableNotFoundErrorDetected}' was not found in Supabase.\n\n` +
          "💡 Solution: Run the SQL structure definitions in 'supabase-setup.sql' via your Supabase SQL Editor to spawn the tables."
        );
        return;
      }

      // Populate if fulfilled successfully
      if (ordersRes.status === 'fulfilled' && !ordersRes.value.error) {
        setOrders(ordersRes.value.data || []);
      }
      if (productsRes.status === 'fulfilled' && !productsRes.value.error) {
        setProducts(productsRes.value.data || []);
      }
      if (customOrdersRes.status === 'fulfilled' && !customOrdersRes.value.error) {
        setCustomOrders(customOrdersRes.value.data || []);
      }

      setError(null);

    } catch (err: any) {
      console.error('General fetch error:', err?.message || err);
      setError(err?.message || String(err));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // ✅ REALTIME (ENHANCED)
  useEffect(() => {
    fetchData();

    const channel = supabase.channel("realtime-dashboard");

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          toast.success(`New order from ${payload.new.customer_name}!`, {
            icon: '🛍️',
            duration: 6000,
            position: 'top-right'
          });
          fetchData(true);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "custom_orders" },
        (payload) => {
          toast.success(`New design request from ${payload.new.full_name || payload.new.customer_name}!`, {
            icon: '🎨',
            duration: 6000,
            position: 'top-right'
          });
          fetchData(true);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public" },
        () => {
          fetchData(true);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public" },
        () => {
          fetchData(true);
        }
      )
      .subscribe();

    const onOfflineUpdate = () => {
      fetchData(true);
    };

    window.addEventListener('offline-realtime-update', onOfflineUpdate);
    window.addEventListener('sandbox-mode-changed', onOfflineUpdate);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('offline-realtime-update', onOfflineUpdate);
      window.removeEventListener('sandbox-mode-changed', onOfflineUpdate);
    };
  }, []);

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    const tId = toast.loading('Uploading brand logo...');
    
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `brand_logo_${Date.now()}.${fileExt}`;
      const uploadedUrl = await uploadFileWithFallback(file, 'system', fileName);

      updateSettings({ ...settings, logoUrl: uploadedUrl });
      toast.success('Logo updated successfully', { id: tId });
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`, { id: tId });
    } finally {
      setUploadingLogo(false);
    }
  };

  const totalUnseenFiles = customOrders.reduce((sum, order) => {
    if (!order.file_url) return sum;
    try {
      let assets: string[] = [];
      const rawUrl = order.file_url.trim();
      if (rawUrl) {
        if (rawUrl.startsWith('[') && rawUrl.endsWith(']')) {
          const parsed = JSON.parse(rawUrl);
          assets = parsed.map((item: any) => {
            if (typeof item === 'string') return item;
            return item.url;
          });
        } else {
          assets = [rawUrl];
        }
      }
      const unseenAssetsCount = assets.filter(url => url && !seenFileUrls.includes(url)).length;
      return sum + unseenAssetsCount;
    } catch {
      return sum + (seenFileUrls.includes(order.file_url) ? 0 : 1);
    }
  }, 0);

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipping: orders.filter(o => o.status === 'shipping').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    totalProducts: products.length,
    lowStock: products.filter(p => p.stock <= 5).length,
    customRequests: customOrders.filter(o => o.status === 'pending' || o.status === 'reviewing').length + totalUnseenFiles
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-apple-gray-100 dark:bg-dark-bg p-6">
        <div className="bg-white dark:bg-dark-card p-10 rounded-3xl border border-apple-gray-200 dark:border-dark-border shadow-2xl max-w-md text-center space-y-6">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
            <X className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black tracking-tight dark:text-white uppercase">Critical Error</h3>
            <p className="text-neutral-500 text-sm font-medium leading-relaxed">{error}</p>
          </div>
          <button 
            onClick={() => fetchData()}
            className="w-full py-4 bg-premium-gold text-white rounded-2xl font-bold active:scale-95 transition-all shadow-lg shadow-premium-gold/20"
          >
            Attempt Reconnection
          </button>
        </div>
      </div>
    );
  }

  const overviewContent = (
    <div className="space-y-8">
      <Stats stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-dark-card rounded-3xl border border-apple-gray-200 dark:border-dark-border overflow-hidden shadow-sm">
          <div className="p-6 border-b border-apple-gray-100 dark:border-dark-border flex justify-between items-center">
            <h3 className="font-bold text-lg dark:text-white">Recent Orders</h3>
            <button 
              onClick={() => setActiveTab('orders')}
              className="text-premium-gold text-sm font-semibold hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-apple-gray-50 dark:bg-apple-gray-900/10 text-neutral-500 font-medium font-mono text-[10px] uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4 text-center">Qty</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-apple-gray-100 dark:divide-dark-border">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-neutral-400 font-medium">No recent orders found</td>
                  </tr>
                ) : (
                  orders.slice(0, 5).map((order) => (
                    <tr 
                      key={order.id} 
                      className="hover:bg-apple-gray-50 dark:hover:bg-apple-gray-900/5 transition-colors cursor-pointer group"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold dark:text-white group-hover:text-premium-gold transition-colors">{order.customer_name}</div>
                        <div className="text-[10px] text-neutral-400 font-mono uppercase truncate max-w-[120px]">{order.city}</div>
                      </td>
                      <td className="px-6 py-4 text-center font-mono opacity-50 dark:text-neutral-400">{order.quantity}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border whitespace-nowrap", STATUS_COLORS[order.status])}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-neutral-400 text-xs">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card rounded-3xl border border-apple-gray-200 dark:border-dark-border p-6 shadow-sm flex flex-col gap-6">
          <h3 className="font-bold text-lg dark:text-white">Low Stock Alerts</h3>
          <div className="space-y-4">
             {products.filter(p => p.stock <= 5).slice(0, 4).length === 0 ? (
               <div className="p-8 text-center bg-apple-gray-50 dark:bg-dark-bg rounded-2xl border border-dashed border-apple-gray-200 dark:border-dark-border">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-neutral-500">All products are healthy</p>
               </div>
             ) : (
               products.filter(p => p.stock <= 5).slice(0, 4).map(product => (
                 <div key={product.id} className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-500/10 rounded-2xl border border-rose-100 dark:border-rose-500/20">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-white dark:bg-dark-card rounded-xl flex items-center justify-center shadow-sm overflow-hidden border border-rose-100 dark:border-rose-500/20">
                          {product.image_url ? (
                            <img 
                              src={product.image_url.startsWith('[') ? JSON.parse(product.image_url)[0] : product.image_url} 
                              alt="" 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover" 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=IMG';
                              }}
                            />
                          ) : (
                            <Package className="w-5 h-5 text-rose-300" />
                          )}
                       </div>
                       <div>
                          <p className="text-sm font-bold truncate max-w-[120px] dark:text-white">{product.name}</p>
                          <p className="text-[10px] text-rose-500 font-bold uppercase">{product.stock} Remaining</p>
                       </div>
                    </div>
                    <button 
                      onClick={() => setActiveTab('products')}
                      className="p-2 bg-white dark:bg-dark-card text-neutral-900 dark:text-white rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95"
                    >
                       <ChevronRight className="w-4 h-4" />
                    </button>
                 </div>
               ))
             )}
          </div>
          <button 
            onClick={() => setActiveTab('products')}
            className="w-full py-3 bg-apple-gray-100 dark:bg-apple-gray-900/40 rounded-2xl text-xs font-bold hover:bg-apple-gray-200 dark:hover:bg-dark-border transition-all dark:text-white"
          >
            Visit Inventory
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn("flex h-screen w-full overflow-hidden relative", settings.theme)}>
      {/* Sidebar - Desktop */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 w-72 glass border-r bg-white/50 h-full flex flex-col p-6 space-y-8 z-40 transition-all duration-300 dark:bg-dark-card/50",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div 
                onClick={() => setIsLogoZoomed(true)}
                className="w-12 h-12 bg-white dark:bg-dark-card rounded-2xl flex items-center justify-center shadow-lg shadow-premium-gold/10 cursor-pointer overflow-hidden border border-apple-gray-100 dark:border-dark-border group relative transition-all hover:scale-105 active:scale-95"
              >
                 {settings.logoUrl ? (
                   <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform" />
                 ) : (
                   <Package className="text-premium-gold w-6 h-6" />
                 )}
                 <div className="absolute inset-0 bg-premium-gold/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="min-w-0">
                <span className="font-black text-xl tracking-tighter uppercase dark:text-white block truncate">
                  {settings.appName.split(' ')[0]}<span className="text-premium-gold font-light ml-0.5">{settings.appName.split(' ').slice(1).join(' ') || 'Admin'}</span>
                </span>
                <div className="flex items-center gap-1">
                   <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Production Mode</span>
                </div>
              </div>
           </div>
           <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-apple-gray-100 rounded-xl">
             <X className="w-5 h-5" />
           </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
            { id: 'orders', icon: ShoppingBag, label: 'Manage Orders', badge: stats.pending },
            { id: 'custom-orders', icon: FileText, label: 'Custom Designs', badge: stats.customRequests },
            { id: 'products', icon: Boxes, label: 'My Products' },
            { id: 'settings', icon: SettingsIcon, label: 'Settings' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setIsSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group", 
                activeTab === tab.id 
                  ? "bg-white dark:bg-dark-card text-premium-gold border border-premium-gold/20 dark:border-premium-gold/20 shadow-2xl shadow-premium-gold/5" 
                  : "text-neutral-500 hover:bg-apple-gray-100 dark:hover:bg-dark-bg"
              )}
            >
              <tab.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", activeTab === tab.id && "animate-pulse")} />
              <span className="font-bold text-sm tracking-tight">{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={cn(
                  "ml-auto w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-lg",
                  tab.id === 'orders' ? "bg-rose-500 text-white" : "bg-premium-gold text-white"
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="pt-6 border-t border-apple-gray-200 dark:border-dark-border space-y-2">
           <div className="p-4 bg-apple-gray-100 dark:bg-dark-bg rounded-2xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-premium-gold/10 flex items-center justify-center">
                 <User className="w-4 h-4 text-premium-gold" />
              </div>
              <div className="flex-1 overflow-hidden text-left">
                <p className="text-xs font-black truncate dark:text-white">Administrator</p>
                <div className="flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                   <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Online</span>
                </div>
              </div>
           </div>
           
           <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all font-bold text-sm"
           >
             <LogOut className="w-5 h-5" />
             <span>Sign Out</span>
           </button>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 w-full min-w-0 overflow-y-auto bg-apple-gray-100 dark:bg-dark-bg relative transition-colors duration-300 no-scrollbar">
        {localStorage.getItem('delivery_store_sandbox') === 'true' && (
          <div className="bg-gradient-to-r from-amber-500/10 via-premium-gold/10 to-amber-500/10 border-b border-premium-gold/10 px-4 md:px-10 py-3 flex items-center justify-between gap-3 text-amber-700 dark:text-premium-gold text-[10px] md:text-xs font-black uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-premium-gold"></span>
              </span>
              <span>Running Offline Sandbox because the Supabase cloud is paused or offline. Changes persist here.</span>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('delivery_store_sandbox');
                window.dispatchEvent(new Event('sandbox-mode-changed'));
              }}
              className="px-3 py-1 bg-white dark:bg-dark-card border border-premium-gold/30 hover:border-premium-gold rounded-xl font-bold transition-all active:scale-[0.97] text-[10px] text-neutral-800 dark:text-white"
            >
              Recheck Cloud
            </button>
          </div>
        )}

        <header className="sticky top-0 z-20 px-4 md:px-10 py-6 md:py-8 bg-apple-gray-100/80 dark:bg-dark-bg/80 backdrop-blur-md flex items-center justify-between gap-2 overflow-hidden">
           <div className="flex items-center gap-3 min-w-0">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden shrink-0 p-2 bg-white dark:bg-dark-card border border-apple-gray-200 dark:border-dark-border rounded-xl shadow-sm"
              >
                <LayoutDashboard className="w-5 h-5 text-premium-gold" />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg md:text-3xl font-black tracking-tight capitalize dark:text-white truncate">
                  {activeTab === 'overview' ? `Welcome Back` : activeTab.replace('-', ' ')}
                </h2>
                <p className="hidden md:block text-sm text-neutral-500 font-medium truncate">
                  {activeTab === 'overview' ? 'Here is what is happening with your store today.' : `Manage your ${activeTab} data.`}
                </p>
              </div>
           </div>
           
           <div className="flex items-center gap-2 md:gap-4 shrink-0">
               {/* Database Status Swapper */}
               <button 
                 onClick={() => {
                   const wasSandbox = localStorage.getItem('delivery_store_sandbox') === 'true';
                   if (wasSandbox) {
                     localStorage.removeItem('delivery_store_sandbox');
                     toast.success("Reconnecting to Supabase Cloud...", { icon: '☁️' });
                   } else {
                     localStorage.setItem('delivery_store_sandbox', 'true');
                     toast.success("Switched to Local Sandbox Database", { icon: '💾' });
                   }
                   window.dispatchEvent(new Event('sandbox-mode-changed'));
                 }}
                 className={cn(
                   "h-10 md:h-12 px-3 md:px-4 border rounded-xl md:rounded-2xl flex items-center gap-2 shadow-sm transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest",
                   localStorage.getItem('delivery_store_sandbox') === 'true'
                     ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-premium-gold hover:bg-amber-500/20"
                     : "bg-white dark:bg-dark-card border-apple-gray-200 dark:border-dark-border text-neutral-600 dark:text-neutral-300 hover:bg-apple-gray-50 dark:hover:bg-dark-bg"
                 )}
                 title={localStorage.getItem('delivery_store_sandbox') === 'true' ? "Running Offline Sandbox (Click to try Cloud DB)" : "Running Cloud DB (Click to use Sandbox)"}
               >
                 {localStorage.getItem('delivery_store_sandbox') === 'true' ? (
                   <>
                     <WifiOff className="w-4 h-4 text-amber-500" />
                     <span className="hidden md:inline">Sandbox Mode</span>
                   </>
                 ) : (
                   <>
                     <Wifi className="w-4 h-4 text-emerald-500" />
                     <span className="hidden md:inline">Cloud active</span>
                   </>
                 )}
               </button>

              <button 
                onClick={() => updateSettings({ ...settings, theme: settings.theme === 'light' ? 'dark' : 'light' })}
                className="w-10 h-10 md:w-12 md:h-12 bg-white dark:bg-dark-card border border-apple-gray-200 dark:border-dark-border rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                {settings.theme === 'light' ? <Moon className="w-5 h-5 text-neutral-600" /> : <Sun className="w-5 h-5 text-amber-400" />}
              </button>
              <div className="h-10 md:h-12 px-3 md:px-6 bg-white dark:bg-dark-card border border-apple-gray-200 dark:border-dark-border rounded-xl md:rounded-2xl flex items-center gap-2 md:gap-3 shadow-sm">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="hidden sm:inline text-[8px] md:text-[10px] font-black uppercase tracking-widest text-neutral-400">System Live</span>
              </div>
           </div>
        </header>

        <div className="px-4 md:px-10 pb-12">
          {loading ? (
            <div className="h-[60vh] w-full flex items-center justify-center">
               <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-premium-gold border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Syncing with Cloud...</p>
               </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'overview' && overviewContent}
                {activeTab === 'orders' && <Orders orders={orders} products={products} onRefresh={fetchData} onViewDetails={setSelectedOrder} />}
                {activeTab === 'custom-orders' && <CustomOrders onRefresh={fetchData} />}
                {activeTab === 'products' && <Products products={products} onRefresh={fetchData} />}
                {activeTab === 'settings' && <Settings settings={settings} onUpdateSettings={updateSettings} onLogout={handleLogout} />}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Order Detail Side Drawer */}
      <AnimatePresence>
        {selectedOrder && (
          <>
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setSelectedOrder(null)}
               className="fixed inset-0 bg-neutral-950/20 backdrop-blur-sm z-40"
            />
            <motion.div 
               initial={{ x: '100%' }}
               animate={{ x: 0 }}
               exit={{ x: '100%' }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white dark:bg-dark-card shadow-2xl z-50 overflow-y-auto no-scrollbar border-l border-apple-gray-200 dark:border-dark-border"
            >
               <div className="p-10 space-y-10">
                  <div className="flex justify-between items-center">
                     <span className="text-[10px] font-black text-neutral-400 tracking-widest uppercase">Inspect Record</span>
                     <button 
                        onClick={() => setSelectedOrder(null)}
                        className="p-2 hover:bg-apple-gray-100 dark:hover:bg-dark-border rounded-full transition-colors"
                     >
                        <X className="w-6 h-6 dark:text-white" />
                     </button>
                  </div>

                  <div className="space-y-4">
                     <div>
                       <h2 className="text-4xl font-black tracking-tight dark:text-white">{selectedOrder.customer_name}</h2>
                       <p className="text-xs font-mono text-neutral-400 mt-1 uppercase tracking-widest">Order Reference: {selectedOrder.id}</p>
                     </div>
                     <div className="flex items-center gap-3">
                        <span className={cn("px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border", STATUS_COLORS[selectedOrder.status])}>
                           {selectedOrder.status}
                        </span>
                        <div className="h-4 w-px bg-apple-gray-200 dark:bg-dark-border mx-1" />
                        <span className="text-neutral-400 text-xs font-bold italic tracking-tight">Placed on {new Date(selectedOrder.created_at).toLocaleString()}</span>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 gap-10">
                     <div className="space-y-6">
                        <div className="flex items-start gap-4">
                           <div className="p-3 bg-apple-gray-100 dark:bg-dark-bg rounded-2xl">
                              <User className="w-6 h-6 text-neutral-500" />
                           </div>
                           <div>
                              <p className="text-[10px] uppercase font-black tracking-widest text-neutral-400 mb-1">Customer Logistics</p>
                              <p className="font-bold text-lg dark:text-white">{selectedOrder.email}</p>
                              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{selectedOrder.phone}</p>
                           </div>
                        </div>

                        <div className="flex items-start gap-4">
                           <div className="p-3 bg-apple-gray-100 dark:bg-dark-bg rounded-2xl">
                              <MapPin className="w-6 h-6 text-neutral-500" />
                           </div>
                           <div>
                              <p className="text-[10px] uppercase font-black tracking-widest text-neutral-400 mb-1">Shipping Terminal</p>
                              <p className="font-bold text-lg dark:text-white">{selectedOrder.city}</p>
                              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-[300px]">{selectedOrder.address}</p>
                           </div>
                        </div>

                        <div className="flex items-start gap-4">
                           <div className="p-3 bg-apple-gray-100 dark:bg-dark-bg rounded-2xl">
                              <Package className="w-6 h-6 text-neutral-500" />
                           </div>
                           <div>
                              <p className="text-[10px] uppercase font-black tracking-widest text-neutral-400 mb-1">Inventory Manifest</p>
                              <p className="font-bold text-lg dark:text-white">{selectedOrder.product_variant}</p>
                              <p className="text-sm font-black text-premium-gold uppercase tracking-widest">Quantity: {selectedOrder.quantity} Units</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="pt-10 border-t border-apple-gray-100 dark:border-dark-border">
                     <div className="bg-neutral-950 rounded-3xl p-8 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                           <p className="text-[10px] uppercase font-black tracking-widest opacity-40 mb-1">Transaction Value</p>
                           <p className="text-5xl font-black">${(selectedOrder.total_price || 0).toFixed(2)}</p>
                           <p className="text-[10px] font-bold opacity-30 mt-4 uppercase tracking-[0.2em]">Verified Secure Payment</p>
                        </div>
                        <ShoppingBag className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5 group-hover:scale-110 transition-transform duration-700" />
                     </div>
                  </div>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Logo Zoom Overlay */}
      <AnimatePresence>
        {isLogoZoomed && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsLogoZoomed(false)}
            className="fixed inset-0 bg-neutral-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-10 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative max-w-sm w-full aspect-square bg-white dark:bg-dark-card rounded-[3rem] p-12 shadow-2xl flex flex-col items-center justify-center border border-white/10 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <input 
                type="file"
                ref={logoInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    const file = e.target.files[0];
                    if (!file.type.startsWith('image/')) {
                      toast.error('Please select an image file (PNG, JPG, etc)');
                      return;
                    }
                    handleLogoUpload(file);
                  }
                }}
              />

              {/* Decorative background for logo */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.05)_0%,transparent_70%)]" />
              
              <div className="relative z-10 w-full h-full flex flex-col items-center justify-center gap-6">
                <div className="relative group/logo w-full h-48 flex items-center justify-center">
                  {settings.logoUrl ? (
                    <img 
                      src={settings.logoUrl} 
                      alt="Logo Enlarged" 
                      className="w-full h-full object-contain filter drop-shadow-2xl" 
                    />
                  ) : (
                    <Package className="w-32 h-32 text-premium-gold" />
                  )}
                  
                  <button 
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm opacity-0 group-hover/logo:opacity-100 transition-opacity rounded-3xl"
                  >
                    <div className="bg-white text-neutral-900 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
                       {uploadingLogo ? 'Processing...' : 'Upload New'}
                       <Upload className="w-4 h-4 text-premium-gold" />
                    </div>
                  </button>
                </div>

                <div className="text-center space-y-4">
                  <div>
                    <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight uppercase line-clamp-1">{settings.appName}</h2>
                    <div className="h-[1px] w-8 bg-premium-gold mx-auto my-3" />
                    <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em]">Official Brand Asset</p>
                  </div>
                  
                  {!settings.logoUrl && (
                    <button 
                      onClick={() => logoInputRef.current?.click()}
                      className="px-8 py-3 bg-premium-gold text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-premium-gold/20 hover:scale-105 active:scale-95 transition-all"
                    >
                      Initialize Logo
                    </button>
                  )}
                </div>
              </div>
              
              <button 
                onClick={() => setIsLogoZoomed(false)}
                className="absolute top-6 right-6 w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}