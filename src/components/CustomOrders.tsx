import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Download, 
  Search, 
  Filter, 
  MoreVertical, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Boxes,
  Plus,
  FolderPlus,
  FileSearch,
  ExternalLink,
  RefreshCcw,
  Package,
  ChevronRight,
  ChevronDown,
  User,
  Mail,
  Phone,
  Calendar,
  Layers,
  Hammer,
  ArrowLeft,
  ArrowRight,
  X,
  FileCode2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CustomOrder, CustomOrderStatus } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

const STATUS_CONFIG: Record<CustomOrderStatus, { label: string, color: string, icon: any }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-500', icon: Clock },
  reviewing: { label: 'Reviewing', color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-500', icon: FileSearch },
  quoted: { label: 'Quoted', color: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-500', icon: FileText },
  in_production: { label: 'In Production', color: 'bg-premium-gold/10 text-premium-gold border-premium-gold/20', icon: CheckCircle2 },
  delivered: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-500', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-500', icon: X },
};

interface CustomOrdersProps {
  onRefresh: () => void;
}

export default function CustomOrders({ onRefresh }: CustomOrdersProps) {
  const [orders, setOrders] = useState<CustomOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomOrderStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<CustomOrder | null>(null);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [seenFileUrls, setSeenFileUrls] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('seen_files');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const prevUnseenRef = React.useRef<number>(-1);

  const playNotificationAlarm = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playChime = (time: number, freq: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gainNode.gain.setValueAtTime(0.2, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration);
        osc.start(time);
        osc.stop(time + duration);
      };
      playChime(audioCtx.currentTime, 587.33, 0.25); // D5
      playChime(audioCtx.currentTime + 0.12, 880, 0.35); // A5
    } catch (e) {
      console.warn('Audio Context failed to play chime:', e);
    }
  };

  const markFilesAsSeen = (urls: string[]) => {
    const validUrls = urls.filter(Boolean);
    if (validUrls.length === 0) return;

    let currentSeen: string[] = [];
    try {
      const saved = localStorage.getItem('seen_files');
      currentSeen = saved ? JSON.parse(saved) : [];
    } catch {}

    const unseen = validUrls.filter(u => !currentSeen.includes(u));
    if (unseen.length === 0) return;

    const updated = [...currentSeen, ...unseen];
    try {
      localStorage.setItem('seen_files', JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }

    setSeenFileUrls(updated);

    // Dispatch the custom event asynchronously outside the React render and commit cycle
    setTimeout(() => {
      window.dispatchEvent(new Event('file-notifications-updated'));
    }, 0);
  };

  const markFileAsSeen = (url: string) => {
    markFilesAsSeen([url]);
  };

  const getAssetCategory = (asset: { name: string; url: string; category?: string }, order: CustomOrder) => {
    if (asset.category === 'additive' || asset.category === 'subtractive') {
      return asset.category;
    }
    
    const lowName = (asset.name || '').toLowerCase();
    
    // High confidence keywords for Additive Manufacturing
    if (
      lowName.includes('additive') || lowName.includes('3d') || lowName.includes('print') ||
      lowName.includes('stl') || lowName.includes('obj') || lowName.includes('gcode') ||
      lowName.includes('pla') || lowName.includes('fiber') || lowName.includes('resin') || 
      lowName.includes('filament') || lowName.includes('fdm') || lowName.includes('sla')
    ) {
      return 'additive';
    }
    
    // High confidence keywords for Subtractive Precision
    if (
      lowName.includes('subtractive') || lowName.includes('vmc') || lowName.includes('cnc') ||
      lowName.includes('machining') || lowName.includes('mill') || lowName.includes('lathe') ||
      lowName.includes('step') || lowName.includes('stp') || lowName.includes('igs') ||
      lowName.includes('iges') || lowName.includes('metal') || lowName.includes('precision') ||
      lowName.includes('machined') || lowName.includes('aluminum') || lowName.includes('bracket')
    ) {
      return 'subtractive';
    }
    
    // Fallback to order details
    const lowProject = (order.project_name || '').toLowerCase();
    const lowDetails = (order.details || '').toLowerCase();
    
    if (
      lowProject.includes('3d') || lowProject.includes('print') || lowProject.includes('additive') ||
      lowDetails.includes('3d') || lowDetails.includes('print') || lowDetails.includes('additive')
    ) {
      return 'additive';
    }
    
    if (
      lowProject.includes('vmc') || lowProject.includes('cnc') || lowProject.includes('machining') || lowProject.includes('subtractive') ||
      lowDetails.includes('vmc') || lowDetails.includes('cnc') || lowDetails.includes('machining') || lowDetails.includes('subtractive')
    ) {
      return 'subtractive';
    }
    
    return 'additive'; // default fallback
  };

  const toggleAssetCategory = async (assetUrl: string) => {
    if (!selectedOrder) return;
    try {
      let currentAssets: any[] = [];
      const raw = selectedOrder.file_url || '';
      if (raw.trim().startsWith('[') && raw.trim().endsWith(']')) {
        currentAssets = JSON.parse(raw);
      } else if (raw.trim() !== '') {
        currentAssets = [{ name: 'Legacy Asset', url: raw }];
      }
      
      const updated = currentAssets.map(asset => {
        if (asset.url === assetUrl) {
          const currentCat = asset.category || getAssetCategory(asset, selectedOrder);
          const nextCat = currentCat === 'additive' ? 'subtractive' : 'additive';
          return { ...asset, category: nextCat };
        }
        return asset;
      });
      
      const updatedDate = new Date().toISOString();
      const json = JSON.stringify(updated);
      
      const { error } = await supabase
        .from('custom_orders')
        .update({ file_url: json, created_at: updatedDate })
        .eq('id', selectedOrder.id);
        
      if (error) {
        await supabase
          .from('customer_orders')
          .update({ file_url: json, created_at: updatedDate })
          .eq('id', selectedOrder.id);
      }
      
      setSelectedOrder({ ...selectedOrder, file_url: json, created_at: updatedDate });
      toast.success('Asset category updated & session date corrected!');
      fetchOrders();
    } catch (err: any) {
      toast.error(`Error updating category: ${err.message}`);
    }
  };

  const updateAssetDetails = async (assetUrl: string, updates: { quantity?: number; filament?: string; material?: string }) => {
    if (!selectedOrder) return;
    try {
      let currentAssets: any[] = [];
      const raw = selectedOrder.file_url || '';
      if (raw.trim().startsWith('[') && raw.trim().endsWith(']')) {
        currentAssets = JSON.parse(raw);
        currentAssets = currentAssets.map((item: any) => {
          if (typeof item === 'string') return { name: item.split('/').pop()?.split('?')[0] || 'Asset', url: item };
          return item;
        });
      } else if (raw.trim() !== '') {
        currentAssets = [{ name: raw.split('/').pop()?.split('?')[0] || 'Design File', url: raw }];
      }
      
      const updated = currentAssets.map(asset => {
        if (asset.url === assetUrl) {
          return { ...asset, ...updates };
        }
        return asset;
      });
      
      const updatedDate = new Date().toISOString();
      const json = JSON.stringify(updated);
      
      const { error } = await supabase
        .from('custom_orders')
        .update({ file_url: json, created_at: updatedDate })
        .eq('id', selectedOrder.id);
        
      if (error) {
        await supabase
          .from('customer_orders')
          .update({ file_url: json, created_at: updatedDate })
          .eq('id', selectedOrder.id);
      }
      
      setSelectedOrder({ ...selectedOrder, file_url: json, created_at: updatedDate });
      toast.success('Asset specifications updated!');
      fetchOrders();
    } catch (err: any) {
      toast.error(`Error updating asset details: ${err.message}`);
    }
  };

  // Automatically mark files as seen when an order is opened/viewed
  useEffect(() => {
    if (selectedOrder) {
      try {
        let assets: string[] = [];
        const rawUrl = selectedOrder.file_url ? selectedOrder.file_url.trim() : '';
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
        markFilesAsSeen(assets);
      } catch (e) {
        console.warn('Error marking files seen:', e);
      }
    }
  }, [selectedOrder]);

  // Unseen file counting helpers
  const countUnseenFiles = (customOrdersList: CustomOrder[]) => {
    return customOrdersList.reduce((sum, order) => {
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
  };

  const totalUnseenFilesCount = countUnseenFiles(orders);

  // Monitor count increases to play audible alarm bell chime automatically!
  useEffect(() => {
    if (loading) return;
    if (prevUnseenRef.current !== -1 && totalUnseenFilesCount > prevUnseenRef.current) {
      playNotificationAlarm();
      toast('Alert: New design files uploaded by customer!', {
        icon: '🔔',
        duration: 5000,
      });
    }
    prevUnseenRef.current = totalUnseenFilesCount;
  }, [totalUnseenFilesCount, loading]);

  const hasUnseenFiles = (order: CustomOrder) => {
    if (!order.file_url) return false;
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
      return assets.some(url => url && !seenFileUrls.includes(url));
    } catch {
      return !seenFileUrls.includes(order.file_url);
    }
  };

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

  const SQL_CODE = `-- Run this in your Supabase SQL Editor:
ALTER TABLE IF EXISTS public."Customer Orders" ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'quoted', 'in_production', 'delivered', 'cancelled'));
ALTER TABLE IF EXISTS public."Customer Orders" ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc'::text, now());
ALTER TABLE IF EXISTS public."Customer Orders" ADD COLUMN IF NOT EXISTS project_name text;
ALTER TABLE IF EXISTS public."Customer Orders" ADD COLUMN IF NOT EXISTS details text;
ALTER TABLE IF EXISTS public."Customer Orders" ADD COLUMN IF NOT EXISTS file_url text;

-- Ensure RLS is configured for visibility
ALTER TABLE public."Customer Orders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access Customer Orders" ON public."Customer Orders";
CREATE POLICY "Public access Customer Orders" ON public."Customer Orders" FOR ALL TO public USING (true) WITH CHECK (true);

-- STORAGE SETUP:
-- 1. Go to "Storage" in Supabase and create a bucket named "custom-orders"
-- 2. Make the bucket "Public"
-- 3. Run these policies to enable external uploads:

DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'custom-orders');

DROP POLICY IF EXISTS "Public View" ON storage.objects;
CREATE POLICY "Public View" ON storage.objects FOR SELECT USING (bucket_id = 'custom-orders');

ALTER PUBLICATION supabase_realtime ADD TABLE public."Customer Orders";`;

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      
      const { data, error } = await supabase
        .from('custom_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // Double check 'customer_orders' just in case the legacy table exists
        const { data: legacyData, error: legacyError } = await supabase
          .from('customer_orders')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (legacyError) throw error;
        const fetchedList = legacyData || [];
        setOrders(fetchedList);
        setSelectedOrder(prev => {
          if (!prev) return null;
          return fetchedList.find(o => o.id === prev.id) || prev;
        });
      } else {
        const fetchedList = data || [];
        setOrders(fetchedList);
        setSelectedOrder(prev => {
          if (!prev) return null;
          return fetchedList.find(o => o.id === prev.id) || prev;
        });
      }
    } catch (error: any) {
      console.error('Error fetching custom orders:', error.message);
      setErrorMsg('Connected to Supabase, but "custom_orders" table is missing or restricted.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchAllBucketFiles(true);
    
    const channel = supabase.channel('custom-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_orders' }, () => {
        fetchOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStatus = async (id: string, status: CustomOrderStatus) => {
    try {
      const { error } = await supabase
        .from('custom_orders')
        .update({ status })
        .eq('id', id);

      if (error) {
        await supabase.from('customer_orders').update({ status }).eq('id', id);
      }
      toast.success(`Order status updated to ${status}`);
      setSelectedOrder(prev => {
        if (prev && prev.id === id) {
          return { ...prev, status };
        }
        return prev;
      });
      onRefresh();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const deleteOrder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this custom order?')) return;
    try {
      const { error } = await supabase
        .from('custom_orders')
        .delete()
        .eq('id', id);

      if (error) {
        await supabase.from('customer_orders').delete().eq('id', id);
      }
      toast.success('Order deleted');
      onRefresh();
      if (selectedOrder?.id === id) setSelectedOrder(null);
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const createSampleOrder = async () => {
    try {
      const payload = {
        full_name: 'Example Customer',
        email_reference: 'customer@example.com',
        secure_line: '9846512543',
        project_name: 'Aerospace Component X-1',
        details: 'Custom VMC machining with 6061 Aluminum. Tolerance +/- 0.05mm.',
        file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        status: 'pending'
      };

      const { error } = await supabase.from('custom_orders').insert(payload);
      if (error) {
        await supabase.from('customer_orders').insert(payload);
      }
      toast.success('Sample request created!');
      fetchOrders();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleDownload = async (url: string, projectName?: string, directoryHandle?: FileSystemDirectoryHandle | null) => {
    if (!url) {
      toast.error('Asset location unknown');
      return;
    }

    const toastId = toast.loading('Retrieving secure asset...');

    try {
      // Decode the URL for the Storage SDK to handle spaces/special characters
      let decodedUrl = url;
      try {
        decodedUrl = decodeURIComponent(url);
      } catch (e) {
        console.warn('URL decoding skipped', e);
      }

      const cleanUrl = decodedUrl.split('?')[0];
      const originalFileName = cleanUrl.split('/').pop()?.split('?')[0] || projectName || 'asset_file';
      
      // Method A: Direct Supabase Storage SDK
      if (cleanUrl.includes('.supabase.co/')) {
        try {
          // Robust path extraction from Supabase URL
          let bucket = '';
          let path = '';
          
          if (cleanUrl.includes('/object/public/')) {
            const parts = cleanUrl.split('/object/public/')[1].split('/');
            bucket = parts[0];
            path = parts.slice(1).join('/');
          } else if (cleanUrl.includes('/object/authenticated/')) {
            const parts = cleanUrl.split('/object/authenticated/')[1].split('/');
            bucket = parts[0];
            path = parts.slice(1).join('/');
          } else if (cleanUrl.includes('/object/')) {
             const segments = cleanUrl.split('/object/')[1].split('/');
             bucket = segments[0];
             path = segments.slice(1).join('/');
          }

          if (bucket && path) {
            const { data, error } = await supabase.storage.from(bucket).download(path);
            if (!error && data) {
              // Priority: Use Directory Handle if provided
              if (directoryHandle) {
                 try {
                   const fileHandle = await directoryHandle.getFileHandle(originalFileName, { create: true });
                   const writable = await fileHandle.createWritable();
                   await writable.write(data);
                   await writable.close();
                   toast.dismiss(toastId);
                   return;
                 } catch (err) {
                   console.error("Directory write error, falling back", err);
                 }
              }

              // Normal browser download
              const blobUrl = window.URL.createObjectURL(data);
              const link = document.createElement('a');
              link.href = blobUrl;
              link.download = originalFileName;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(blobUrl);
              
              toast.dismiss(toastId);
              toast.success('Asset extracted successfully');
              return;
            }
          }
        } catch (sError) {
          console.warn('Storage SDK download failed, using carrier fallback...', sError);
        }
      }

      // Method B: Universal Carrier Fallback
      if (directoryHandle) {
        // We can't easily write to directory handle from a plain URL without fetching it first
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          const fileHandle = await directoryHandle.getFileHandle(originalFileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.dismiss(toastId);
          return;
        } catch (err) {
          console.warn("Fetch fallback for directory handle failed", err);
        }
      }

      toast.loading('Engaging secondary carrier...', { id: toastId });
      
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('download', originalFileName);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => {
        toast.dismiss(toastId);
        toast.success('Asset accessed via carrier');
      }, 1500);

    } catch (error) {
      console.error('Vault extraction failure:', error);
      toast.error('Asset retrieval terminal error');
      window.open(url, '_blank');
    }
  };

  const handleDownloadAll = async (assets: any[]) => {
    if (!assets || assets.length === 0) return;

    // Check for File System Access API
    const isSupported = 'showDirectoryPicker' in window;

    if (isSupported) {
      try {
        const handle = await (window as any).showDirectoryPicker();
        const toastId = toast.loading(`Synchronizing ${assets.length} assets to your selected folder...`);
        
        let successCount = 0;
        for (const asset of assets) {
          try {
            await handleDownload(asset.url || asset, asset.name || 'batch_asset', handle);
            successCount++;
          } catch (err) {
            console.error(`Failed to download ${asset.name}`, err);
          }
        }
        
        toast.dismiss(toastId);
        toast.success(`Successfully archived ${successCount} assets to your local folder`);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          toast.error('Sync cancelled by user');
          return;
        }
        console.error('Directory Picker Error', err);
        // Fallback to standard serial download
        await serialDownload(assets);
      }
    } else {
      await serialDownload(assets);
    }
  };

  const serialDownload = async (assets: any[]) => {
    toast.success('Initiating batch retrieval (standard mode)...');
    for (const asset of assets) {
      await handleDownload(asset.url || asset, asset.name || 'batch_asset');
      // Small delay to prevent browser download congestion
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [allBucketFiles, setAllBucketFiles] = useState<{ name: string; path: string; size: number; url: string; folder: string }[]>([]);
  const [loadingBucketFiles, setLoadingBucketFiles] = useState(false);
  const [isAssetBrowserOpen, setIsAssetBrowserOpen] = useState(false);
  const [assetBrowserSearch, setAssetBrowserSearch] = useState('');

  const saveManualUrl = async (id: string) => {
    try {
      const updatedDate = new Date().toISOString();
      const { error } = await supabase
        .from('custom_orders')
        .update({ file_url: manualUrl, created_at: updatedDate })
        .eq('id', id);

      if (error) {
        // Fallback for column errors or table missing
        const { error: fError } = await supabase
          .from('customer_orders')
          .update({ file_url: manualUrl, created_at: updatedDate })
          .eq('id', id);
        if (fError) throw fError;
      }
      toast.success('Vault link updated');
      setIsEditingUrl(false);
      
      if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder({ ...selectedOrder, file_url: manualUrl, created_at: updatedDate });
      }
      
      fetchOrders();
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`);
    }
  };

  const fetchAllBucketFiles = async (silent = false) => {
    try {
      if (!silent) setLoadingBucketFiles(true);
      const BUCKET = 'custom-orders';
      
      const scanFolder = async (path: string, depth = 0): Promise<{ name: string; path: string; size: number; url: string; folder: string }[]> => {
        if (depth > 4) return [];
        
        const { data: items, error } = await supabase.storage.from(BUCKET).list(path, {
          limit: 100
        });

        if (error || !items) return [];

        let files: { name: string; path: string; size: number; url: string; folder: string }[] = [];

        for (const item of items) {
          if (item.name === '.emptyFolderPlaceholder') continue;
          const currentPath = path ? `${path}/${item.name}` : item.name;
          const isFolder = !item.id && (!item.metadata || Object.keys(item.metadata).length === 0);
          
          if (isFolder) {
            const sub = await scanFolder(currentPath, depth + 1);
            files = [...files, ...sub];
          } else {
            const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(currentPath);
            
            let folderName = 'Root';
            if (currentPath.includes('/')) {
              const parts = currentPath.split('/');
              folderName = parts.slice(0, parts.length - 1).join('/');
            }
            
            files.push({
              name: item.name,
              path: currentPath,
              size: item.metadata?.size || 0,
              url: publicUrl,
              folder: folderName
            });
          }
        }
        return files;
      };

      // Scan root, superset, orders, etc.
      const results = await scanFolder('');
      const supersetResults = await scanFolder('superset');
      const ordersResults = await scanFolder('orders');
      
      const combined = [...results, ...supersetResults, ...ordersResults];
      const unique = combined.filter((item, index, self) => 
        self.findIndex(t => t.url === item.url) === index
      );

      unique.sort((a, b) => a.path.localeCompare(b.path));
      setAllBucketFiles(unique);
      return unique;
    } catch (e) {
      console.error('Error fetching bucket files:', e);
      return [];
    } finally {
      if (!silent) setLoadingBucketFiles(false);
    }
  };

  const linkAssetToOrder = async (fileName: string, fileUrl: string, fileSize: number) => {
    if (!selectedOrder) return;
    try {
      let currentAssets: any[] = [];
      try {
        const raw = selectedOrder.file_url || '';
        if (raw.trim().startsWith('[') && raw.trim().endsWith(']')) {
          currentAssets = JSON.parse(raw);
        } else if (raw.trim() !== '') {
          currentAssets = [{ name: 'Legacy Asset', url: raw }];
        }
      } catch (e) {}

      if (currentAssets.some(a => a.url === fileUrl)) {
        toast.error('This file is already connected to this order!');
        return;
      }

      const updatedDate = new Date().toISOString();
      const updated = [...currentAssets, { name: fileName, size: fileSize, url: fileUrl }];
      const json = JSON.stringify(updated);

      const { error } = await supabase
        .from('custom_orders')
        .update({ file_url: json, created_at: updatedDate })
        .eq('id', selectedOrder.id);

      if (error) {
        await supabase.from('customer_orders').update({ file_url: json, created_at: updatedDate }).eq('id', selectedOrder.id);
      }

      setSelectedOrder({ ...selectedOrder, file_url: json, created_at: updatedDate });
      toast.success(`Successfully connected: ${fileName}`);
      fetchOrders();
    } catch (err: any) {
      toast.error(`Linking error: ${err.message}`);
    }
  };

  const unlinkAssetFromOrder = async (fileUrl: string) => {
    if (!selectedOrder) return;
    try {
      let currentAssets: any[] = [];
      try {
        const raw = selectedOrder.file_url || '';
        if (raw.trim().startsWith('[') && raw.trim().endsWith(']')) {
          currentAssets = JSON.parse(raw);
        } else if (raw.trim() !== '') {
          currentAssets = [{ name: 'Legacy Asset', url: raw }];
        }
      } catch (e) {}

      const updatedDate = new Date().toISOString();
      const updated = currentAssets.filter(a => a.url !== fileUrl);
      const json = updated.length > 0 ? JSON.stringify(updated) : '';

      const { error } = await supabase
        .from('custom_orders')
        .update({ file_url: json, created_at: updatedDate })
        .eq('id', selectedOrder.id);

      if (error) {
        await supabase.from('customer_orders').update({ file_url: json, created_at: updatedDate }).eq('id', selectedOrder.id);
      }

      setSelectedOrder({ ...selectedOrder, file_url: json, created_at: updatedDate });
      toast.success('Asset unlinked from design request');
      fetchOrders();
    } catch (err: any) {
      toast.error(`Unlinking error: ${err.message}`);
    }
  };

  const recoverAssets = async (id: string, fullName: string) => {
    try {
      const toastId = toast.loading('Synchronizing vault data...');
      const cleanName = (fullName || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const emailPrefix = (selectedOrder?.email_reference?.split('@')[0] || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const orderPartialId = id.slice(0, 8).toLowerCase();
      const actualOrderId = selectedOrder?.order_id || '';
      
      const filesInBucket = await fetchAllBucketFiles(true);

      if (filesInBucket.length > 0) {
        // PRECISE FILTERING & KEYWORD MATCHING
        const results = filesInBucket.filter((asset) => {
          const lowName = asset.name.toLowerCase();
          const lowUrl = asset.url.toLowerCase();
          const lowPath = asset.path.toLowerCase();
          
          // Priority 1: Match by actual order_id (from screenshot convention)
          if (actualOrderId && (lowName.includes(actualOrderId.toLowerCase()) || lowPath.includes(actualOrderId.toLowerCase()))) return true;
          
          // Priority 2: Match by UUID partial
          if (lowName.includes(orderPartialId) || lowPath.includes(orderPartialId)) return true;

          // Priority 3: Match by isolation folder check
          if (emailPrefix && (lowUrl.includes(`/${emailPrefix}/`) || lowPath.includes(`/${emailPrefix}/`))) return true;

          // Priority 4: Search for unique customer name in filename if no ID found
          if (lowName.includes(cleanName) || lowPath.includes(cleanName)) return true;

          // Priority 5: Smart keyword-matching for files in the superset folder or containing 'superset'
          if (lowPath.includes('superset')) {
            const projectTitle = (selectedOrder?.project_name || fullName || '').toLowerCase();
            const detailsText = (selectedOrder?.details || '').toLowerCase();
            
            // Minimal stopwords (keeps specific words like bracket, machined, plate, mounting, etc.)
            const stopwords = new Set([
              'project', 'parts', 'part', 'request', 'the', 'and', 'or', 'custom', 
              'of', 'a', 'an', 'for', 'with', 'design', 'prototype', 'model', 
              'file', 'stl', 'step', 'dwg', 'obj', '3ds', '3d', 'sheet', 'spec', 
              'info', 'text', 'specification', 'specifications', 'provided', 
              'additional', 'no', 'this'
            ]);

            const getWords = (text: string) => {
              return text
                .replace(/[^a-z0-9\s-_]/gi, ' ')
                .split(/[\s-_]+/)
                .map(w => w.trim().toLowerCase())
                .filter(w => w.length > 2 && !stopwords.has(w));
            };

            const titleWords = getWords(projectTitle);
            const detailsWords = getWords(detailsText);
            
            const filenameWithoutExt = asset.name.substring(0, asset.name.lastIndexOf('.')).toLowerCase();
            const fileWords = getWords(filenameWithoutExt);

            // True if any significant word of the project title/detail overlaps with the filename/words inside it
            const hasTitleOverlap = titleWords.some(w => filenameWithoutExt.includes(w) || fileWords.includes(w));
            const hasDetailsOverlap = detailsWords.some(w => filenameWithoutExt.includes(w) || fileWords.includes(w));
            
            const cleanFileName = filenameWithoutExt.replace(/[^a-z0-9]/gi, '');
            const cleanTitle = projectTitle.replace(/[^a-z0-9]/gi, '');
            const isDirectMatch = cleanTitle.includes(cleanFileName) || cleanFileName.includes(cleanTitle);

            if (hasTitleOverlap || hasDetailsOverlap || isDirectMatch) return true;
          }
          
          return false;
        });

        const mappedResults = results.map(r => ({
          name: r.name,
          size: r.size,
          url: r.url
        }));

        mappedResults.sort((a, b) => a.name.localeCompare(b.name));
        const json = JSON.stringify(mappedResults);

        const updatedDate = new Date().toISOString();
        const { error } = await supabase
          .from('custom_orders')
          .update({ file_url: json, created_at: updatedDate })
          .eq('id', id);

        if (error) {
           await supabase.from('customer_orders').update({ file_url: json, created_at: updatedDate }).eq('id', id);
        }
        
        if (selectedOrder && selectedOrder.id === id) {
          setSelectedOrder({ ...selectedOrder, file_url: json, created_at: updatedDate });
        }
        
        if (mappedResults.length > 0) {
          toast.success(`Synchronized ${mappedResults.length} matching files from vault & superset`, { id: toastId });
        } else {
          toast.error('Automatic scanner could not find matching templates. Please use System Storage Browser.', { id: toastId });
        }
        fetchOrders();
      } else {
        toast.error('No assets found in system storage explorer', { id: toastId });
      }
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`);
    }
  };
  const [isCreating, setIsCreating] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [newOrder, setNewOrder] = useState({
    full_name: '',
    email_reference: '',
    secure_line: '',
    project_name: '',
    details: '',
    file_url: ''
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(log(bytes) / log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const log = Math.log;

   const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const toastId = toast.loading('Synchronizing vault data...');
      
      const assets: any[] = [];
      const generatedOrderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Add text URL if provided as a manual asset
      if (newOrder.file_url) {
        assets.push({ 
          name: 'External Reference', 
          size: 0, 
          url: newOrder.file_url
        });
      }

      // Handle multiple file uploads
      if (uploadingFiles.length > 0) {
        for (const file of uploadingFiles) {
          const emailPrefix = (newOrder.email_reference || 'anonymous').split('@')[0].replace(/[^a-z0-9]/gi, '_').toLowerCase();
          // Precise naming convention: ORD_ID - ORIGINAL_NAME
          const fileName = `${generatedOrderId}-${(file.name || '').replace(/[^a-z0-9.]/gi, '_')}`;
          // Best isolation: orders/email_prefix/order_id-filename
          const filePath = `orders/${emailPrefix}/${fileName}`;

          const { error: uploadError } = await supabase.storage
             .from('custom-orders')
             .upload(filePath, file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            toast.error(`Transfer failed for: ${file.name}`);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('custom-orders')
            .getPublicUrl(filePath);
          
          assets.push({
            name: file.name,
            size: file.size,
            url: publicUrl
          });
        }
      }

      const finalFileUrl = assets.length > 0 
        ? JSON.stringify(assets) 
        : '';

      const payload = { 
        full_name: newOrder.full_name,
        email_reference: newOrder.email_reference,
        secure_line: newOrder.secure_line,
        project_name: newOrder.project_name,
        details: newOrder.details,
        file_url: finalFileUrl,
        order_id: generatedOrderId,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('custom_orders').insert([payload]);

      if (error) {
        // Fallback insert
        const { error: fError } = await supabase.from('customer_orders').insert([payload]);
        if (fError) throw fError;
      }
      
      toast.dismiss(toastId);
      toast.success('Successfully logged and organized assets');
      setIsCreating(false);
      setUploadingFiles([]);
      setNewOrder({
        full_name: '',
        email_reference: '',
        secure_line: '',
        project_name: '',
        details: '',
        file_url: ''
      });
      fetchOrders();
    } catch (error: any) {
      toast.error(`Vault sync failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (customerName: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [customerName]: !prev[customerName]
    }));
  };

  useEffect(() => {
    if (selectedOrder && (!selectedOrder.file_url || selectedOrder.file_url === '')) {
      // Auto-synchronize vault files if record is empty
      // Support 'name' or 'full_name' column
      const displayName = selectedOrder.full_name || (selectedOrder as any).name || 'Unknown';
      recoverAssets(selectedOrder.id, displayName);
    }
  }, [selectedOrder?.id]);

  const filteredOrders = orders.filter(order => {
    const query = searchQuery.toLowerCase();
    const displayName = order.full_name || (order as any).name || '';
    const matchesSearch = 
      displayName.toLowerCase().includes(query) ||
      order.email_reference?.toLowerCase().includes(query) ||
      order.secure_line?.toLowerCase().includes(query) ||
      order.project_name?.toLowerCase().includes(query);
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Grouping Logic: Customer -> Date -> Entries
  const groupedOrders = filteredOrders.reduce((acc, order) => {
    const customer = order.full_name || (order as any).name || 'Untitled Customer';
    if (!acc[customer]) acc[customer] = {};
    
    const date = order.created_at ? new Date(order.created_at).toLocaleDateString() : 'Permanent Vault';
    if (!acc[customer][date]) acc[customer][date] = [];
    
    acc[customer][date].push(order);
    return acc;
  }, {} as Record<string, Record<string, CustomOrder[]>>);

  const customerNames = Object.keys(groupedOrders).sort();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Premium Header Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white/50 dark:bg-dark-card/50 backdrop-blur-xl p-4 rounded-[2rem] border border-apple-gray-200 dark:border-dark-border shadow-sm ring-1 ring-black/[0.02]">
        <div className="relative w-full lg:max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-premium-gold transition-colors" />
          <input 
            type="text" 
            placeholder="Filter requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-xl focus:bg-white dark:focus:bg-dark-card focus:border-premium-gold/30 outline-none transition-all text-sm font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-apple-gray-100/50 dark:bg-dark-bg/50 rounded-2xl overflow-x-auto no-scrollbar whitespace-nowrap w-full lg:w-auto">
          <button 
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all bg-premium-gold text-white shadow-lg shadow-premium-gold/20 hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            New Request
          </button>
          <div className="w-px h-3 bg-apple-gray-200 dark:bg-dark-border mx-1" />
          <button 
            onClick={createSampleOrder}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-transparent hover:border-premium-gold/20 hover:bg-white dark:hover:bg-dark-card text-neutral-500 hover:text-premium-gold"
          >
            Sample
          </button>
          <div className="w-px h-3 bg-apple-gray-200 dark:bg-dark-border mx-1" />
          <button 
            onClick={() => setStatusFilter('all')}
            className={cn(
              "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
              statusFilter === 'all' 
                ? "bg-white dark:bg-dark-card text-premium-gold shadow-sm ring-1 ring-black/5" 
                : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            )}
          >
            All
          </button>
          {(Object.keys(STATUS_CONFIG) as CustomOrderStatus[]).map((status) => (
            <button 
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                statusFilter === status 
                  ? "bg-white dark:bg-dark-card text-premium-gold shadow-sm ring-1 ring-black/5" 
                  : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              )}
            >
              {STATUS_CONFIG[status].label}
            </button>
          ))}
        </div>
      </div>

      {totalUnseenFilesCount > 0 && (
        <div className="bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-rose-500/10 border border-rose-500/25 p-5 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3.5">
            <span className="relative flex h-3.5 w-3.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
            </span>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-500">New Customer Material Uploads</h4>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-bold uppercase mt-1 leading-snug">
                Detecting {totalUnseenFilesCount} fresh design assets uploaded by clients that haven't been opened yet.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              type="button"
              onClick={playNotificationAlarm}
              className="px-4 py-2 bg-white dark:bg-dark-card border border-rose-500/30 text-rose-500 hover:bg-rose-50 dark:hover:bg-dark-bg rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm"
            >
              Test Notification Sound
            </button>
            <button 
              type="button"
              onClick={() => {
                const allUrls: string[] = [];
                orders.forEach(order => {
                  if (!order.file_url) return;
                  try {
                    if (order.file_url.startsWith('[') && order.file_url.endsWith(']')) {
                      const parsed = JSON.parse(order.file_url);
                      parsed.forEach((p: any) => {
                        const u = typeof p === 'string' ? p : p.url;
                        if (u) allUrls.push(u);
                      });
                    } else {
                      allUrls.push(order.file_url);
                    }
                  } catch {
                    allUrls.push(order.file_url);
                  }
                });
                setSeenFileUrls(allUrls);
                localStorage.setItem('seen_files', JSON.stringify(allUrls));
                toast.success("All file alerts turned off", { icon: '🔕' });
                window.dispatchEvent(new Event('file-notifications-updated'));
              }}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-md shadow-rose-500/15"
            >
              Turn Off Notifications
            </button>
          </div>
        </div>
      )}

      {errorMsg ? (
        <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 lg:p-12 border border-apple-gray-200 dark:border-dark-border space-y-6">
          <div className="flex items-center gap-4 text-amber-600">
            <AlertTriangle className="w-8 h-8" />
            <h3 className="text-xl font-black uppercase tracking-tight">Database Setup Required</h3>
          </div>
          <p className="text-neutral-500 font-medium text-sm leading-relaxed">
            The system detected that the <code className="bg-neutral-100 dark:bg-dark-bg px-2 py-0.5 rounded font-bold text-neutral-900 dark:text-white">custom_orders</code> table is not fully configured.
          </p>
          <div className="space-y-4">
             <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Copy and run this in your Supabase SQL Editor:</p>
             <div className="relative">
               <pre className="bg-neutral-950 text-neutral-300 p-6 rounded-2xl text-[11px] font-mono overflow-x-auto border border-white/10 shadow-2xl">
                 {SQL_CODE}
               </pre>
               <button 
                 onClick={() => {
                   navigator.clipboard.writeText(SQL_CODE);
                   toast.success('SQL Code copied!');
                 }}
                 className="absolute top-4 right-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
               >
                 Copy Code
               </button>
             </div>
          </div>
          <button 
            onClick={fetchOrders}
            className="w-full py-4 bg-premium-gold text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-premium-gold/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            I've run the code, Refresh System
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-64 bg-white dark:bg-dark-card rounded-3xl border border-apple-gray-200 dark:border-dark-border animate-pulse" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-20 text-center border border-apple-gray-200 dark:border-dark-border space-y-4">
          <div className="w-20 h-20 bg-apple-gray-100 dark:bg-dark-bg rounded-3xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-neutral-300" />
          </div>
          <h3 className="text-2xl font-black tracking-tight dark:text-white uppercase">No Custom Design Orders</h3>
          <p className="text-neutral-500 max-w-xs mx-auto text-sm font-medium">We couldn't find any customized orders matching your current filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {customerNames.map((customer) => {
            const dateGroups = groupedOrders[customer];
            const dates = Object.keys(dateGroups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
            const isExpanded = expandedFolders[customer] || searchQuery.length > 0;
            const totalFiles = Object.values(dateGroups).flat().length;
            const ordersList = Object.values(dateGroups).flat() as CustomOrder[];
            const latestOrder = ordersList[0];

            return (
              <div key={customer} className="group/folder">
                {/* Customer Folder Header */}
                <div 
                  onClick={() => toggleFolder(customer)}
                  className={cn(
                    "w-full bg-white dark:bg-dark-card border border-apple-gray-200 dark:border-dark-border p-5 lg:p-6 rounded-[2rem] flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer transition-all hover:bg-apple-gray-50/50 dark:hover:bg-dark-bg/50 hover:shadow-xl hover:border-premium-gold/30",
                    isExpanded ? "ring-1 ring-premium-gold/20 shadow-sm mb-4" : "shadow-sm"
                  )}
                >
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                      isExpanded ? "bg-premium-gold text-white rotate-6" : "bg-apple-gray-100 dark:bg-dark-bg text-neutral-400 group-hover/folder:bg-premium-gold/10 group-hover/folder:text-premium-gold"
                    )}>
                      <FolderPlus className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tighter dark:text-white leading-none mb-1">
                        {customer}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 opacity-60">
                         <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
                            <Mail className="w-3 h-3 text-premium-gold" />
                            <span>{latestOrder.email_reference}</span>
                         </div>
                         <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
                            <Phone className="w-3 h-3 text-premium-gold" />
                            <span>{latestOrder.secure_line}</span>
                         </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-6 border-t lg:border-t-0 pt-4 lg:pt-0">
                    <div className="text-right">
                       <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">Secure Vault</p>
                       <p className="text-sm font-black text-premium-gold">{totalFiles} {totalFiles === 1 ? 'Design Asset' : 'Design Assets'}</p>
                    </div>
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border border-apple-gray-200 dark:border-dark-border transition-all",
                      isExpanded ? "bg-premium-gold border-premium-gold text-white rotate-90" : "text-neutral-300"
                    )}>
                       <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Expanded Content: Grouped by Date */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-7 lg:ml-12 pl-7 lg:pl-12 border-l-2 border-apple-gray-100 dark:border-dark-border space-y-10 pb-10">
                        {dates.map((date) => (
                           <div key={date} className="relative">
                              {/* Date Marker */}
                              <div className="absolute -left-[37px] lg:-left-[57px] top-0 w-4 h-4 rounded-full bg-white dark:bg-dark-card border-2 border-premium-gold p-0.5 flex items-center justify-center">
                                 <div className="w-full h-full bg-premium-gold rounded-full" />
                              </div>
                              <div className="mb-4 flex items-center gap-3">
                                <span className="bg-apple-gray-100 dark:bg-dark-bg text-neutral-400 dark:text-neutral-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border border-apple-gray-200 dark:border-dark-border">
                                   Archive Session: {date}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {dateGroups[date].map((order) => (
                                  <motion.div
                                    layout
                                    key={order.id}
                                    onClick={() => setSelectedOrder(order)}
                                    className="group/card bg-white dark:bg-dark-card rounded-2xl border border-apple-gray-200 dark:border-dark-border p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-premium-gold/40 transition-all cursor-pointer relative overflow-hidden flex flex-col h-full"
                                  >
                                    <div className="flex justify-between items-center mb-4">
                                      <span className="text-[9px] font-mono text-neutral-400 tracking-tighter uppercase shrink-0">
                                        {order.order_id || `#${order.id.slice(0, 8)}`}
                                      </span>
                                      <span className={cn(
                                        "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border truncate ml-2",
                                        STATUS_CONFIG[order.status].color
                                      )}>
                                        {STATUS_CONFIG[order.status].label}
                                      </span>
                                    </div>

                                    <div className="space-y-3 flex-grow">
                                      <h4 className="font-black text-lg tracking-tight dark:text-white group-hover/card:text-premium-gold transition-colors leading-tight flex items-center justify-between gap-2">
                                        <span>{order.project_name || 'Design Request'}</span>
                                        {hasUnseenFiles(order) && (
                                          <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-500 text-white rounded text-[8px] font-black uppercase tracking-wider animate-pulse">
                                            <span className="w-1 h-1 rounded-full bg-white" />
                                            New File
                                          </span>
                                        )}
                                      </h4>

                                      {/* SPEC OVERVIEW IN CARD GRID */}
                                      {/* FILE GRID PREVIEW ON CARDS */}
                                      {(() => {
                                        let assets: any[] = [];
                                        try {
                                          const raw = order.file_url ? order.file_url.trim() : '';
                                          if (raw) {
                                            if (raw.startsWith('[') && raw.endsWith(']')) {
                                              assets = JSON.parse(raw);
                                            } else {
                                              assets = [{ name: 'Customer Blueprint', url: raw }];
                                            }
                                          }
                                        } catch (e) {}

                                        if (assets.length === 0) return null;

                                        return (
                                          <div className="mt-3.5 space-y-1.5 pb-1">
                                            {assets.map((asset, index) => {
                                              const nameText = asset.name || 'Blueprint file';
                                              const ext = nameText.split('.').pop()?.toUpperCase() || 'FILE';
                                              return (
                                                <div key={asset.url || index} className="bg-apple-gray-50/70 dark:bg-dark-bg/60 p-2.5 rounded-xl border border-apple-gray-200/40 dark:border-dark-border/40 flex items-center justify-between gap-3 text-left">
                                                  <div className="min-w-0 flex-1 flex items-center gap-2">
                                                    <span className="shrink-0 text-[8px] font-black tracking-widest uppercase bg-premium-gold/10 text-premium-gold px-1.5 py-0.5 rounded">
                                                      {ext}
                                                    </span>
                                                    <span className="text-[11px] font-bold dark:text-neutral-350 truncate max-w-[130px] block text-neutral-600">
                                                      {nameText}
                                                    </span>
                                                  </div>
                                                  {asset.size && (
                                                    <span className="text-[8.5px] font-mono font-bold text-neutral-400 shrink-0">
                                                      {formatFileSize(asset.size)}
                                                    </span>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        );
                                      })()}
                                    </div>

                      <div className="mt-5 pt-3 border-t border-apple-gray-100 dark:border-dark-border flex items-center justify-between">
                                      {order.file_url ? (
                                        <div className="flex flex-col gap-1">
                                          <button 
                                            onClick={(e) => { 
                                              e.stopPropagation(); 
                                              try {
                                                if (order.file_url?.startsWith('[') && order.file_url?.endsWith(']')) {
                                                  const assets = JSON.parse(order.file_url);
                                                  const first = assets[0];
                                                  handleDownload(first.url || first, first.name || order.project_name);
                                                  return;
                                                }
                                              } catch(e) {}
                                              handleDownload(order.file_url!, order.project_name); 
                                            }}
                                            className="flex items-center gap-2 text-emerald-500 hover:text-emerald-600 font-black text-[9px] uppercase tracking-widest transition-all group/dl"
                                          >
                                            <Download className="w-3.5 h-3.5 group-hover/dl:translate-y-0.5 transition-transform" />
                                            {order.file_url.startsWith('[') ? 'Extract Primary Asset' : 'Download Asset'}
                                          </button>
                                          {order.file_url.startsWith('[') && (
                                            <span className="text-[8px] font-bold text-neutral-400 uppercase ml-5">
                                              {(() => {
                                                try {
                                                  const assets = JSON.parse(order.file_url);
                                                  return assets.length > 1 ? `+${assets.length - 1} more assets` : '1 asset secured';
                                                } catch(e) { return ''; }
                                              })()}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2 text-neutral-400 font-bold text-[9px] uppercase tracking-widest italic opacity-50">
                                          <FileText className="w-3.5 h-3.5" />
                                          Legacy Log
                                        </div>
                                      )}
                                      
                                      <div className="flex items-center gap-1">
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); deleteOrder(order.id); }}
                                          className="p-1.5 opacity-0 group-hover/card:opacity-100 hover:bg-rose-500 hover:text-white text-neutral-300 rounded-lg transition-all"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                        <div className="p-1.5 text-neutral-300 group-hover/card:text-premium-gold transition-colors">
                                           <ChevronRight className="w-4 h-4" />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-12 h-12 bg-premium-gold/5 blur-2xl rounded-full" />
                                  </motion.div>
                                ))}
                              </div>
                           </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-neutral-950/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl bg-white dark:bg-dark-card rounded-[2.5rem] shadow-2xl border border-apple-gray-200 dark:border-dark-border max-h-[92vh] overflow-y-auto print:p-0 print:border-0 print:shadow-none custom-scrollbar"
            >
              <div className="p-8 lg:p-12 space-y-8 print:p-4">
                {/* Modal Header */}
                <div className="flex justify-between items-start">
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-2",
                        STATUS_CONFIG[selectedOrder.status].color
                      )}>
                        {React.createElement(STATUS_CONFIG[selectedOrder.status].icon, { className: 'w-3 h-3' })}
                        {STATUS_CONFIG[selectedOrder.status].label}
                      </span>
                      <span className="px-3 py-1 bg-neutral-100 dark:bg-dark-bg text-neutral-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-apple-gray-200 dark:border-dark-border">
                        ID: {selectedOrder.order_id || selectedOrder.id.slice(0, 12)}
                      </span>
                    </div>
                    <h2 className="text-4xl lg:text-5xl font-black tracking-tighter dark:text-white uppercase leading-none max-w-xl">
                      {selectedOrder.project_name || 'Design Request'}
                    </h2>
                  </div>
                  <div className="flex gap-2 print:hidden">
                    <button 
                      onClick={() => window.print()}
                      className="p-3 bg-neutral-100 dark:bg-dark-bg rounded-2xl hover:bg-premium-gold/10 hover:text-premium-gold transition-all group"
                      title="Print Order"
                    >
                      <ExternalLink className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    </button>
                    <button 
                      onClick={() => setSelectedOrder(null)}
                      className="p-3 bg-apple-gray-100 dark:bg-dark-bg rounded-2xl hover:bg-rose-500 hover:text-white transition-all group"
                    >
                      <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                    </button>
                  </div>
                </div>

                 {/* GIANT SECURE BLUEPRINT ACCESS PORTAL */}
                {(() => {
                  let assets: any[] = [];
                  try {
                    const rawUrl = selectedOrder.file_url ? selectedOrder.file_url.trim() : '';
                    if (rawUrl) {
                      if (rawUrl.startsWith('[') && rawUrl.endsWith(']')) {
                        assets = JSON.parse(rawUrl);
                      } else {
                        assets = [{ name: 'Customer Design File', url: rawUrl }];
                      }
                    }
                  } catch (e) {}

                  if (assets.length === 0) return null;

                  return (
                    <div className="bg-neutral-950 dark:bg-neutral-900 text-white p-6 lg:p-8 rounded-[2.5rem] border border-premium-gold/30 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-96 h-96 bg-premium-gold/5 blur-[120px] rounded-full pointer-events-none" />
                      
                      <div className="flex justify-between items-center pb-4 border-b border-white/10 mb-6">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-premium-gold leading-none mb-1">
                            SECURE VAULT DISPATCH
                          </p>
                          <h3 className="text-xl font-black uppercase text-white tracking-tight">
                            Design Blueprint & Attachment Archive
                          </h3>
                        </div>
                        <span className="px-3.5 py-1.5 bg-premium-gold/15 border border-premium-gold/30 text-premium-gold rounded-full text-[9px] font-black uppercase tracking-widest leading-none">
                          {assets.length} {assets.length === 1 ? 'FILE SECURED' : 'FILES SECURED'}
                        </span>
                      </div>

                      <div className="space-y-4">
                        {assets.map((asset, index) => {
                          const nameText = asset.name || 'Blueprint File';
                          const fileExt = nameText.split('.').pop()?.toUpperCase() || 'FILE';
                          const isNew = asset.url && !seenFileUrls.includes(asset.url);
                          
                          return (
                            <div 
                              key={asset.url || index} 
                              className="group/blueprint p-6 lg:p-8 bg-neutral-900/40 dark:bg-neutral-950/40 border border-white/5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-premium-gold/5 transition-all text-left relative"
                            >
                              <div className="flex items-center gap-5 min-w-0">
                                {/* Big Visual Icon Container */}
                                <div className="w-16 h-16 rounded-2xl bg-premium-gold/10 text-premium-gold border border-premium-gold/20 flex flex-col items-center justify-center relative shrink-0 group-hover/blueprint:scale-105 transition-transform">
                                  <FileCode2 className="w-7 h-7" />
                                  <span className="text-[8px] font-black tracking-widest uppercase mt-1 leading-none">{fileExt}</span>
                                  {isNew && (
                                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-neutral-900 animate-ping" />
                                  )}
                                </div>
                                
                                <div className="min-w-0">
                                  <h4 className="text-lg sm:text-xl font-black text-white group-hover/blueprint:text-premium-gold transition-colors truncate max-w-md sm:max-w-xl leading-snug" title={nameText}>
                                    {nameText}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1 py-0.5">
                                    <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded">
                                      {asset.size ? formatFileSize(asset.size) : 'VERIFIED VAULT STATUS'}
                                    </span>
                                    <span className="text-neutral-750">•</span>
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">
                                      Secure Design Link
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-start md:self-auto w-full md:w-auto">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (asset.url) markFileAsSeen(asset.url);
                                    handleDownload(asset.url, nameText);
                                  }}
                                  className="flex-1 md:flex-initial flex items-center justify-center gap-2.5 px-6 py-4 bg-premium-gold hover:bg-premium-gold/90 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all scale-100 hover:scale-105 active:scale-95 shadow-lg shadow-premium-gold/10"
                                >
                                  <Download className="w-4 h-4" />
                                  <span>DOWNLOAD FILE</span>
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(asset.url);
                                    toast.success('File URL copied to clipboard');
                                  }}
                                  className="p-4 bg-white/5 hover:bg-white/10 dark:bg-neutral-900 border border-white/5 rounded-2xl text-neutral-300 hover:text-white transition-all hover:scale-105 active:scale-95 museum-icon-btn"
                                  title="Copy Secure Direct Link"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
                  {/* Left Column: Customer Info */}
                  <div className="md:col-span-2 space-y-8">
                    <div>
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-5 border-b border-apple-gray-100 dark:border-dark-border pb-2">Customer Entity</p>
                      <div className="space-y-5">
                        <div className="group/info">
                          <p className="text-[9px] font-black text-premium-gold uppercase tracking-widest mb-1">Full Name</p>
                          <p className="font-bold text-lg dark:text-white">{selectedOrder.full_name || (selectedOrder as any).name}</p>
                        </div>
                        <div className="group/info">
                          <p className="text-[9px] font-black text-premium-gold uppercase tracking-widest mb-1">Email Address</p>
                          <p className="font-bold dark:text-white">{selectedOrder.email_reference || 'N/A'}</p>
                        </div>
                        <div className="group/info">
                          <p className="text-[9px] font-black text-premium-gold uppercase tracking-widest mb-1">Secure Line</p>
                          <p className="font-bold dark:text-white">{selectedOrder.secure_line || (selectedOrder as any).phone || (selectedOrder as any).secure_line || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="print:hidden">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-4">Request Lifecycle</p>
                      <div className="relative">
                         <div className="absolute left-4 top-0 bottom-0 w-px bg-apple-gray-100 dark:bg-dark-border" />
                         <div className="space-y-4 relative">
                            <div className="flex items-center gap-4">
                               <div className="w-8 h-8 rounded-full bg-premium-gold/10 border border-premium-gold/20 flex items-center justify-center relative z-10">
                                  <Clock className="w-3.5 h-3.5 text-premium-gold" />
                               </div>
                               <div>
                                  <p className="text-[10px] font-black uppercase text-neutral-500">Received</p>
                                  <p className="text-[11px] font-medium text-neutral-400">{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString() : 'N/A'}</p>
                               </div>
                            </div>
                            <div className="flex items-center gap-4">
                               <div className="w-8 h-8 rounded-full bg-apple-gray-100 dark:bg-dark-bg border border-apple-gray-200 dark:border-dark-border flex items-center justify-center relative z-10">
                                  <FileSearch className="w-3.5 h-3.5 text-neutral-400" />
                               </div>
                               <div>
                                  <p className="text-[10px] font-black uppercase text-neutral-500">Current Phase</p>
                                  <p className="text-[11px] font-medium text-neutral-400 capitalize">{(selectedOrder.status || 'pending').replace('_', ' ')}</p>
                               </div>
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Spec and Files */}
                  <div className="md:col-span-3 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-5 border-b border-apple-gray-100 dark:border-dark-border pb-2">Project Specifications</p>
                      <div className="p-8 bg-apple-gray-50/50 dark:bg-dark-bg/50 rounded-[2rem] border border-apple-gray-200 dark:border-dark-border relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                          <FileText className="w-12 h-12" />
                        </div>
                        <p className="text-sm lg:text-base text-neutral-700 dark:text-neutral-300 font-medium leading-relaxed italic relative z-10">
                          "{selectedOrder.details || 'No additional specifications provided for this request.'}"
                        </p>
                      </div>
                    </div>

                    {/* Operations Status Selector */}
                    <div className="mt-6 bg-apple-gray-50/50 dark:bg-dark-bg/30 p-6 rounded-3xl border border-apple-gray-200 dark:border-dark-border/45 relative select-none">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-3.5">Operations Status</p>
                      
                      {/* Custom dropdown trigger */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                          className="w-full px-5 py-4 bg-white dark:bg-dark-bg border border-apple-gray-200 dark:border-dark-border rounded-[1.25rem] focus:border-premium-gold hover:border-premium-gold/50 outline-none transition-all dark:text-white font-black text-[11px] uppercase tracking-widest shadow-sm cursor-pointer flex justify-between items-center"
                        >
                          <span className="flex items-center gap-2.5">
                            <span className={cn("w-2 h-2 rounded-full", STATUS_CONFIG[selectedOrder.status].color.split(" ")[0])} />
                            {STATUS_CONFIG[selectedOrder.status].label}
                          </span>
                          <ChevronDown className="w-4 h-4 text-neutral-400 transition-transform duration-200" style={{ transform: isStatusDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                        </button>

                        {/* Custom dropdown list */}
                        {isStatusDropdownOpen && (
                          <>
                            <div 
                              className="fixed inset-0 z-[100]" 
                              onClick={() => setIsStatusDropdownOpen(false)} 
                            />
                            <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-neutral-900 border border-apple-gray-200 dark:border-neutral-800 rounded-2xl shadow-xl z-[101] overflow-hidden py-1 max-h-[220px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-150">
                              {(Object.keys(STATUS_CONFIG) as CustomOrderStatus[]).map(s => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => {
                                    updateStatus(selectedOrder.id, s);
                                    setIsStatusDropdownOpen(false);
                                  }}
                                  className={cn(
                                    "w-full px-5 py-3 text-left font-bold text-[11px] uppercase tracking-wider flex items-center gap-2.5 transition-colors",
                                    selectedOrder.status === s 
                                      ? "bg-premium-gold/10 text-premium-gold font-extrabold" 
                                      : "text-neutral-700 dark:text-neutral-200 hover:bg-apple-gray-50 dark:hover:bg-neutral-800/80"
                                  )}
                                >
                                  <span className={cn("w-2.5 h-2.5 rounded-full", STATUS_CONFIG[s].color.split(" ")[0] || "bg-emerald-500")} />
                                  <span>{STATUS_CONFIG[s].label}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Full Width Section below: Side-by-side Bento Assets Vault */}
                <div className="border-t border-apple-gray-100 dark:border-dark-border pt-8 mt-8">
                  <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
                    <div>
                      <p className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Secure Vault Assets</p>
                      <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mt-1">Organized by processing requirements</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => recoverAssets(selectedOrder.id, selectedOrder.full_name)}
                        className="text-emerald-500 hover:text-emerald-400 text-[10px] bg-emerald-500/5 px-3 py-1.5 rounded-xl border border-emerald-500/10 font-bold uppercase tracking-widest inline-flex items-center gap-1.5 transition-all active:scale-95"
                        title="Force scan vault for files"
                      >
                        <RefreshCcw className="w-3 h-3" />
                        Re-Sync Vault
                      </button>
                      {(() => {
                         try {
                           if (selectedOrder.file_url?.startsWith('[') && selectedOrder.file_url?.endsWith(']')) {
                             const assets = JSON.parse(selectedOrder.file_url);
                             if (assets.length > 1) {
                               return (
                                 <button 
                                   onClick={() => handleDownloadAll(assets)}
                                   className="text-premium-gold hover:text-premium-gold/80 hover:bg-premium-gold/5 border border-premium-gold/20 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-sm hover:scale-105 active:scale-95"
                                 >
                                   <Download className="w-3 h-3" />
                                   Download All
                                 </button>
                               );
                             }
                           }
                         } catch (e) {}
                         return null;
                      })()}
                    </div>
                  </div>

                  {/* Split Columns Grid: Additive vs Subtractive */}
                  {(() => {
                    let assets: { name: string, size?: number, url: string, category?: string }[] = [];
                    try {
                      const rawUrl = selectedOrder.file_url ? selectedOrder.file_url.trim() : '';
                      if (rawUrl) {
                        if (rawUrl.startsWith('[') && rawUrl.endsWith(']')) {
                          const parsed = JSON.parse(rawUrl);
                          assets = parsed.map((item: any) => {
                            if (typeof item === 'string') return { name: item.split('/').pop()?.split('?')[0] || 'Asset', url: item };
                            return item;
                          });
                        } else {
                          assets = [{ 
                            name: rawUrl.split('/').pop()?.split('?')[0] || 'Design File', 
                            url: rawUrl 
                          }];
                        }
                      }
                    } catch (e) {
                      if (selectedOrder.file_url) assets = [{ name: 'Recovered Asset', url: selectedOrder.file_url }];
                    }
                    assets = assets.filter(a => a.url && a.url.length > 0);

                    const additiveAssets = assets.filter(a => getAssetCategory(a, selectedOrder) === 'additive');
                    const subtractiveAssets = assets.filter(a => getAssetCategory(a, selectedOrder) === 'subtractive');

                    const renderAssetItem = (asset: any, category: 'additive' | 'subtractive') => {
                      return (
                        <div key={asset.url} className="group/file flex items-center justify-between p-3.5 bg-apple-gray-50/40 dark:bg-dark-bg/40 border border-apple-gray-100 dark:border-dark-border rounded-2xl hover:border-premium-gold/30 hover:bg-white dark:hover:bg-dark-card transition-all shadow-sm">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className={cn(
                              "w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                              category === 'additive' 
                                ? "bg-indigo-500/5 text-indigo-500 dark:text-indigo-400 group-hover/file:bg-indigo-500/10" 
                                : "bg-amber-500/5 text-amber-500 dark:text-amber-400 group-hover/file:bg-amber-500/10"
                            )}>
                              {category === 'additive' ? <Layers className="w-4 h-4" /> : <Hammer className="w-4 h-4" />}
                            </div>
                            <div className="overflow-hidden text-left">
                              <p className="text-[11px] font-black dark:text-white truncate tracking-tight flex items-center gap-1.5 leading-tight">
                                <span className="truncate max-w-[130px] sm:max-w-[200px]" title={asset.name}>{asset.name}</span>
                                {asset.url && !seenFileUrls.includes(asset.url) && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 animate-ping opacity-90" title="Unseen file" />
                                )}
                              </p>
                              <div className="flex items-center gap-1.5 text-[8px] font-bold text-neutral-400 uppercase tracking-widest leading-none mt-1">
                                <span>{asset.size ? formatFileSize(asset.size) : 'SECURE'}</span>
                                <span className="text-neutral-300 dark:text-neutral-700">•</span>
                                <span className={category === 'additive' ? "text-indigo-500 dark:text-indigo-400 font-extrabold" : "text-amber-500 dark:text-amber-400 font-extrabold"}>
                                  {category === 'additive' ? 'Additive' : 'Subtractive'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {/* Toggle Category Button */}
                            <button
                              type="button"
                              onClick={() => toggleAssetCategory(asset.url)}
                              className={cn(
                                "w-7.5 h-7.5 rounded-lg flex items-center justify-center transition-all border border-transparent shadow-sm",
                                category === 'additive'
                                  ? "bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-500 hover:bg-amber-500 hover:text-white"
                                  : "bg-amber-50/50 dark:bg-amber-950/20 text-amber-500 hover:bg-indigo-500 hover:text-white"
                              )}
                              title={category === 'additive' ? "Route to Subtractive column (Right)" : "Route to Additive column (Left)"}
                            >
                              {category === 'additive' ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                if (asset.url) markFileAsSeen(asset.url);
                                handleDownload(asset.url, asset.name);
                              }}
                              className="w-7.5 h-7.5 rounded-lg bg-black dark:bg-apple-gray-800 text-white flex items-center justify-center hover:bg-emerald-500 hover:scale-105 transition-all shadow-md"
                              title="Download Asset"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              type="button"
                              onClick={() => unlinkAssetFromOrder(asset.url)}
                              className="w-7.5 h-7.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center border border-rose-100 dark:border-rose-900/40 transition-all"
                              title="Unlink File"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div className="space-y-6">
                        {assets.length > 0 ? (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left: Additive Column */}
                            <div className="bg-indigo-50/10 dark:bg-indigo-950/5 p-5 rounded-3xl border border-indigo-100/10 dark:border-indigo-950/20 flex flex-col min-h-[160px] relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                                <Layers className="w-16 h-16 text-indigo-500" />
                              </div>
                              <div className="flex items-center gap-2 mb-4">
                                 <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                 <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                   Additive Manufacturing (Left Side)
                                 </p>
                                 <span className="ml-auto bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full px-2 py-0.5 text-[8px] font-bold">
                                   {additiveAssets.length} {additiveAssets.length === 1 ? 'file' : 'files'}
                                 </span>
                              </div>
                              
                              <div className="space-y-2.5 flex-1 max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar">
                                {additiveAssets.length > 0 ? (
                                   additiveAssets.map(a => renderAssetItem(a, 'additive'))
                                ) : (
                                   <div className="flex-1 flex flex-col items-center justify-center py-6 text-center border-2 border-dashed border-indigo-200/20 dark:border-indigo-900/10 rounded-2xl bg-white/20 dark:bg-transparent">
                                     <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400">No Additive Files</p>
                                     <p className="text-[7.5px] font-bold text-neutral-300 mt-0.5 uppercase">Use arrow toggle to move files here</p>
                                   </div>
                                )}
                              </div>
                            </div>

                            {/* Right: Subtractive Column */}
                            <div className="bg-amber-50/10 dark:bg-amber-950/5 p-5 rounded-3xl border border-amber-100/10 dark:border-amber-950/20 flex flex-col min-h-[160px] relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                                <Hammer className="w-16 h-16 text-amber-500" />
                              </div>
                              <div className="flex items-center gap-2 mb-4">
                                 <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                 <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                                   Subtractive Manufacturing (Right Side)
                                 </p>
                                 <span className="ml-auto bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-full px-2 py-0.5 text-[8px] font-bold">
                                   {subtractiveAssets.length} {subtractiveAssets.length === 1 ? 'file' : 'files'}
                                 </span>
                              </div>

                              <div className="space-y-2.5 flex-1 max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar">
                                {subtractiveAssets.length > 0 ? (
                                   subtractiveAssets.map(a => renderAssetItem(a, 'subtractive'))
                                ) : (
                                   <div className="flex-1 flex flex-col items-center justify-center py-6 text-center border-2 border-dashed border-amber-200/20 dark:border-amber-900/10 rounded-2xl bg-white/20 dark:bg-transparent">
                                     <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400">No Subtractive Files</p>
                                     <p className="text-[7.5px] font-bold text-neutral-300 mt-0.5 uppercase">Use arrow toggle to move files here</p>
                                   </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full py-10 bg-neutral-50 dark:bg-dark-bg/30 border border-dashed border-apple-gray-200 dark:border-dark-border rounded-3xl flex flex-col items-center justify-center gap-2.5">
                            <Search className="w-8 h-8 text-neutral-300 animate-pulse" />
                            <div className="text-center">
                              <p className="text-[10px] font-italic uppercase tracking-widest text-neutral-400">Vault Empty</p>
                              <p className="text-[8px] font-bold text-neutral-300 uppercase mt-0.5 mb-2.5">No files currently linked to this design order</p>
                              <button 
                                type="button"
                                onClick={() => recoverAssets(selectedOrder.id, selectedOrder.full_name)}
                                className="px-4 py-2 bg-white dark:bg-dark-card border border-apple-gray-200 dark:border-dark-border rounded-xl text-[9px] font-black uppercase tracking-widest hover:border-premium-gold hover:text-premium-gold transition-all"
                              >
                                Scan Storage for Files
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Storage Sub-operations panel */}
                        <div className="pt-4 flex items-center justify-between border-t border-dashed border-apple-gray-100 dark:border-dark-border/40">
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingUrl(!isEditingUrl);
                              if (!isEditingUrl) {
                                setManualUrl(selectedOrder.file_url || '');
                              }
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-premium-gold transition-colors inline-flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {isEditingUrl ? 'Cancel Link Edit' : 'Edit Link / Manual URL String'}
                          </button>
                          
                          <button
                            type="button"
                            onClick={async () => {
                              setIsAssetBrowserOpen(true);
                              await fetchAllBucketFiles();
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-premium-gold hover:underline inline-flex items-center gap-1.5"
                          >
                            <Search className="w-3.5 h-3.5" />
                            Browse Storage ({allBucketFiles.length || 'Scan'})
                          </button>
                        </div>

                        {/* Link edit input */}
                        {isEditingUrl && (
                          <div className="p-4 bg-apple-gray-50/55 dark:bg-dark-bg/20 rounded-2xl border border-apple-gray-200 dark:border-dark-border space-y-2 animate-in slide-in-from-top-2 duration-300">
                            <p className="text-[8.5px] font-black uppercase tracking-widest text-neutral-400">Target File URL or JSON array</p>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="https://... or SQL array text"
                                value={manualUrl}
                                onChange={(e) => setManualUrl(e.target.value)}
                                className="flex-1 px-4 py-2 bg-white dark:bg-dark-card border border-apple-gray-200 dark:border-dark-border rounded-xl text-xs outline-none focus:border-premium-gold text-neutral-800 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() => saveManualUrl(selectedOrder.id)}
                                className="px-4 py-2 bg-premium-gold text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:opacity-90 transition-all"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                                {/* Embedded File Browser Overlay Dialog */}
                                {isAssetBrowserOpen && (
                                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                                    <div 
                                      onClick={() => setIsAssetBrowserOpen(false)} 
                                      className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm"
                                    />
                                    <div className="relative w-full max-w-xl bg-white dark:bg-dark-card rounded-2xl border border-apple-gray-200 dark:border-dark-border shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
                                      {/* Header */}
                                      <div className="p-4 border-b border-apple-gray-100 dark:border-dark-border flex items-center justify-between">
                                        <div>
                                          <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-white">Workspace Storage Browser</h4>
                                          <p className="text-[9px] font-bold uppercase text-neutral-400">Select file to link to order #{selectedOrder.id.slice(0, 8)}</p>
                                        </div>
                                        <button 
                                          type="button"
                                          onClick={() => setIsAssetBrowserOpen(false)}
                                          className="p-1 px-2.5 rounded-lg bg-apple-gray-100 dark:bg-dark-bg text-neutral-400 hover:text-rose-500 font-bold uppercase text-[10px] tracking-wider transition-colors"
                                        >
                                          Close
                                        </button>
                                      </div>

                                      {/* Search Bar */}
                                      <div className="p-3 bg-apple-gray-50 dark:bg-dark-bg/30 border-b border-apple-gray-100 dark:border-dark-border flex gap-3 items-center">
                                        <input
                                          type="text"
                                          placeholder="Filter files by name, type (e.g. stl, step) or path..."
                                          value={assetBrowserSearch}
                                          onChange={(e) => setAssetBrowserSearch(e.target.value)}
                                          className="flex-1 px-3 py-1.5 bg-white dark:bg-dark-card border border-apple-gray-200 dark:border-dark-border rounded-lg text-xs outline-none focus:border-premium-gold text-neutral-800 dark:text-white"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => fetchAllBucketFiles()}
                                          className="px-3 py-1.5 bg-black dark:bg-apple-gray-800 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-premium-gold transition-colors shrink-0 inline-flex items-center gap-1"
                                          disabled={loadingBucketFiles}
                                        >
                                          <RefreshCcw className={`w-3 h-3 ${loadingBucketFiles ? 'animate-spin' : ''}`} />
                                          Refresh
                                        </button>
                                      </div>

                                      {/* File list container */}
                                      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar min-h-[250px]">
                                        {loadingBucketFiles ? (
                                          <div className="space-y-2 py-8 text-center animate-pulse">
                                            <Search className="w-8 h-8 text-neutral-300 mx-auto animate-spin" />
                                            <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Scanning buckets and storage repositories...</p>
                                          </div>
                                        ) : (() => {
                                          const filtered = allBucketFiles.filter(f => 
                                            f.name.toLowerCase().includes(assetBrowserSearch.toLowerCase()) ||
                                            f.folder.toLowerCase().includes(assetBrowserSearch.toLowerCase()) ||
                                            f.path.toLowerCase().includes(assetBrowserSearch.toLowerCase())
                                          );

                                          if (filtered.length === 0) {
                                            return (
                                              <div className="py-12 text-center text-neutral-400 space-y-1">
                                                <Package className="w-8 h-8 text-neutral-200 mx-auto" />
                                                <p className="text-[10px] font-black uppercase tracking-wider">No matching files found as system assets</p>
                                                <p className="text-[8px] font-bold text-neutral-300 uppercase">Ensure files exist in custom-orders/superset folder</p>
                                              </div>
                                            );
                                          }

                                          // Group by folder
                                          const groups: { [key: string]: typeof allBucketFiles } = {};
                                          filtered.forEach(f => {
                                            if (!groups[f.folder]) groups[f.folder] = [];
                                            groups[f.folder].push(f);
                                          });

                                          return Object.keys(groups).map(folder => (
                                            <div key={folder} className="space-y-1.5">
                                              <div className="flex items-center justify-between pb-1 border-b border-apple-gray-100 dark:border-dark-border/40">
                                                <span className="text-[9px] font-black tracking-widest text-premium-gold uppercase">FOLDER: /{folder}</span>
                                                <span className="text-[8px] font-mono text-neutral-400 uppercase">{groups[folder].length} assets</span>
                                              </div>
                                              <div className="space-y-1">
                                                {groups[folder].map((file, idx) => {
                                                  let currentAssetsList: any[] = [];
                                                  try {
                                                    const raw = selectedOrder.file_url || '';
                                                    if (raw.trim().startsWith('[')) {
                                                      currentAssetsList = JSON.parse(raw);
                                                    } else if (raw) {
                                                      currentAssetsList = [{ name: 'Customer Plan Design', url: raw, size: 0 }];
                                                    }
                                                  } catch (e) {}
                                                  const isAlreadyLinked = currentAssetsList.some((a: any) => a.url === file.url);
                                                  return (
                                                    <div 
                                                      key={idx} 
                                                      className="flex items-center justify-between p-2 rounded-lg bg-apple-gray-50/50 dark:bg-dark-bg/20 border border-apple-gray-100/50 dark:border-dark-border/20 text-xs hover:border-premium-gold/30 transition-all"
                                                    >
                                                      <div className="min-w-0 pr-3">
                                                        <p className="font-bold text-[11px] truncate text-neutral-800 dark:text-neutral-100">{file.name}</p>
                                                        <p className="text-[8px] text-neutral-400 uppercase tracking-wider font-mono">Size: {formatFileSize(file.size)}</p>
                                                      </div>
                                                      <button
                                                        type="button"
                                                        onClick={() => linkAssetToOrder(file.name, file.url, file.size)}
                                                        disabled={isAlreadyLinked}
                                                        className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all shadow-sm shrink-0 ${
                                                          isAlreadyLinked 
                                                            ? 'bg-neutral-200 text-neutral-400 pointer-events-none'
                                                            : 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95'
                                                        }`}
                                                      >
                                                        {isAlreadyLinked ? 'Connected' : 'Connect Link'}
                                                      </button>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          ));
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div className="pt-8 border-t border-apple-gray-100 dark:border-dark-border flex items-center justify-between print:hidden">
                    <div className="flex items-center gap-2 text-neutral-400">
                       <Clock className="w-4 h-4" />
                       <span className="text-[10px] font-bold uppercase tracking-widest">
                         Review Session Active
                       </span>
                    </div>
                    <button 
                       onClick={() => setSelectedOrder(null)}
                       className="px-10 py-4 bg-neutral-950 dark:bg-white dark:text-neutral-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:opacity-80 transition-all active:scale-95 shadow-xl"
                    >
                       Done
                    </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Request Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreating(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white dark:bg-dark-card rounded-[2.5rem] shadow-2xl border border-apple-gray-200 dark:border-dark-border overflow-hidden"
            >
              <form onSubmit={handleCreateOrder} className="p-8 lg:p-10 space-y-6">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-premium-gold/10 rounded-2xl flex items-center justify-center">
                       <FolderPlus className="w-5 h-5 text-premium-gold" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter dark:text-white">New Request</h2>
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Add customer to secure vault</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="p-2 hover:bg-rose-50 text-neutral-400 hover:text-rose-500 rounded-xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Customer Name</label>
                    <input 
                      required
                      type="text"
                      placeholder="e.g. John Smith"
                      value={newOrder.full_name}
                      onChange={(e) => setNewOrder({...newOrder, full_name: e.target.value})}
                      className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all dark:text-white font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Project Identifier</label>
                    <input 
                      type="text"
                      placeholder="e.g. Prototype X-9"
                      value={newOrder.project_name}
                      onChange={(e) => setNewOrder({...newOrder, project_name: e.target.value})}
                      className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all dark:text-white font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Email Reference</label>
                    <input 
                      required
                      type="email"
                      placeholder="customer@vault.com"
                      value={newOrder.email_reference}
                      onChange={(e) => setNewOrder({...newOrder, email_reference: e.target.value})}
                      className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all dark:text-white font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Secure Line (Phone)</label>
                    <input 
                      required
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={newOrder.secure_line}
                      onChange={(e) => setNewOrder({...newOrder, secure_line: e.target.value})}
                      className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all dark:text-white font-bold text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Upload Design Assets (Multiple STL/STEP Supported)</label>
                    <div className="relative group">
                      <input 
                        type="file"
                        multiple
                        onChange={(e) => {
                           const files = Array.from(e.target.files || []);
                           setUploadingFiles(prev => [...prev, ...files]);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className={cn(
                        "w-full px-4 py-8 bg-apple-gray-100 dark:bg-dark-bg border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 transition-all",
                        uploadingFiles.length > 0 
                          ? "border-premium-gold bg-premium-gold/[0.02]" 
                          : "border-apple-gray-200 dark:border-dark-border group-hover:border-premium-gold/50"
                      )}>
                        {uploadingFiles.length > 0 ? (
                          <div className="text-center">
                            <Plus className="w-6 h-6 text-premium-gold mx-auto mb-2" />
                            <p className="text-[10px] font-black text-premium-gold uppercase tracking-widest">{uploadingFiles.length} Design Files Selected</p>
                            <div className="flex flex-wrap justify-center gap-1 mt-2">
                               {uploadingFiles.slice(0, 3).map((f, i) => (
                                 <span key={i} className="px-1.5 py-0.5 bg-white dark:bg-dark-card rounded text-[8px] font-mono border border-apple-gray-200">{f.name.slice(-10)}</span>
                               ))}
                               {uploadingFiles.length > 3 && <span className="text-[8px] font-black">+ {uploadingFiles.length - 3} more</span>}
                            </div>
                          </div>
                        ) : (
                          <>
                            <FolderPlus className="w-8 h-8 text-neutral-300" />
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Select multiple files for batch processing</p>
                          </>
                        )}
                      </div>
                    </div>
                    {uploadingFiles.length > 0 && (
                      <button 
                        type="button"
                        onClick={() => setUploadingFiles([])}
                        className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                      >
                         Clear Selected Files
                      </button>
                    )}
                  </div>

                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-apple-gray-100 dark:border-dark-border"></div>
                    </div>
                    <span className="relative bg-white dark:bg-dark-card px-2 text-[8px] font-black text-neutral-300 uppercase tracking-widest">OR USE EXTERNAL URL</span>
                  </div>

                  <div className="space-y-1.5">
                    <input 
                      type="url"
                      placeholder="https://external-storage.link/asset.step"
                      value={newOrder.file_url}
                      onChange={(e) => setNewOrder({...newOrder, file_url: e.target.value})}
                      className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all dark:text-white font-medium text-[11px]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Technical Specifications</label>
                  <textarea 
                    rows={3}
                    placeholder="Describe material, tolerances, or machining instructions..."
                    value={newOrder.details}
                    onChange={(e) => setNewOrder({...newOrder, details: e.target.value})}
                    className="w-full px-4 py-3 bg-apple-gray-100 dark:bg-dark-bg border border-transparent rounded-2xl focus:bg-white focus:border-premium-gold outline-none transition-all dark:text-white font-medium text-sm no-scrollbar"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 py-4 bg-apple-gray-100 dark:bg-dark-bg text-neutral-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-apple-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-[2] py-4 bg-premium-gold text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-premium-gold/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Logging Request...' : 'Log Design Request'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
