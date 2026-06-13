/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Toaster } from 'react-hot-toast';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import { Package } from 'lucide-react';
import { AppSettings } from './types';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('appSettings');
    return saved ? JSON.parse(saved) : { 
      appName: 'LX Admin', 
      systemStatus: 'live',
      theme: 'light'
    };
  });

  useEffect(() => {
    // Apply theme
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  const clearSupabaseLocalStorage = () => {
    if (typeof window !== 'undefined') {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('auth-token') || key.includes('supabase.auth'))) {
            localStorage.removeItem(key);
          }
        }
      } catch (e) {
        console.warn('LocalStorage cleanup warning:', e);
      }
    }
  };

  const updateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('appSettings', JSON.stringify(newSettings));
  };

  useEffect(() => {
    const checkUserRole = async (userSession: any) => {
      if (!userSession) {
        setSession(null);
        setLoading(false);
        return;
      }

      const userEmail = userSession.user.email?.toLowerCase();
      const isDesignatedAdmin = userEmail === 'venuvvenuv696@gmail.com' || userEmail === 'madavan696@gmail.com';
      
      // Instant bypass to avoid latency, Supabase API rate limits or network issues
      if (isDesignatedAdmin) {
        setSession(userSession);
        setLoading(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userSession.user.id)
          .single();

        if (error) {
          console.warn('Error fetching profile in checkUserRole:', error.message);
          // Only sign out if we expect the record to be present but the user is definitely not admin (fallback checks)
          if (error.code === 'PGRST116') {
            await supabase.auth.signOut({ scope: 'local' });
            setSession(null);
          } else {
            // Keep the session on transient/network errors to prevent lockouts
            setSession(userSession);
          }
        } else if (profile) {
          const isUserAdmin = profile.role === 'admin';
          if (!isUserAdmin) {
            await supabase.auth.signOut({ scope: 'local' });
            setSession(null);
          } else {
            setSession(userSession);
          }
        } else {
          setSession(userSession);
        }
      } catch (err) {
        console.error('Error in checkUserRole catch block:', err);
        // Fallback: keep session on exception to prevent lock-outs when Supabase tables/profiles are loading slowly
        setSession(userSession);
      } finally {
        setLoading(false);
      }
    };

    // Keep session loaded on start with safe fallback check
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Supabase Session Error:', error.message);
        clearSupabaseLocalStorage();
        supabase.auth.signOut({ scope: 'local' }).then(() => {
          setSession(null);
          setLoading(false);
        }).catch(() => {
          setSession(null);
          setLoading(false);
        });
      } else if (session) {
        checkUserRole(session);
      } else {
        setSession(null);
        setLoading(false);
      }
    }).catch((err) => {
      console.warn('Failed to get Supabase session on init:', err);
      setSession(null);
      setLoading(false);
    });

    // Listen for auth changes and sync session state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      console.log('Auth Event:', _event, newSession?.user?.email);
      
      if (_event === 'SIGNED_IN') {
        if (newSession) {
          checkUserRole(newSession);
        }
      } else if (_event === 'SIGNED_OUT') {
        setSession(null);
        setLoading(false);
      } else if (_event === 'TOKEN_REFRESHED' || _event === 'USER_UPDATED' || _event === 'INITIAL_SESSION') {
        if (newSession) {
          const userEmail = newSession.user.email?.toLowerCase();
          if (userEmail === 'venuvvenuv696@gmail.com' || userEmail === 'madavan696@gmail.com') {
            setSession(newSession);
            setLoading(false);
          } else {
            checkUserRole(newSession);
          }
        } else {
          setSession(null);
          setLoading(false);
        }
      } else {
        if (newSession) {
          setSession(newSession);
        }
        setLoading(false);
      }
    });

    const onSandboxChange = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      });
    };
    window.addEventListener('sandbox-mode-changed', onSandboxChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('sandbox-mode-changed', onSandboxChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-apple-gray-100 dark:bg-dark-bg">
        <div className="flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-premium-gold rounded-[2rem] flex items-center justify-center animate-pulse shadow-2xl shadow-premium-gold/20 overflow-hidden">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-3" />
            ) : (
              <Package className="text-white w-10 h-10" />
            )}
          </div>
          <p className="text-[10px] font-black tracking-[0.3em] uppercase text-neutral-400 animate-pulse">Synchronizing {settings.appName}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '20px',
            background: '#141414',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '600',
            padding: '12px 24px',
          },
        }}
      />
      {!session ? (
        <Auth appName={settings.appName} logoUrl={settings.logoUrl} />
      ) : (
        <Dashboard initialSettings={settings} onUpdateSettings={updateSettings} />
      )}
    </>
  );
}
