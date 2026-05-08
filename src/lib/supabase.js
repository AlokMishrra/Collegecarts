import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

// Log for debugging (remove in production)
if (import.meta.env.DEV) {
  console.log('Supabase URL:', supabaseUrl);
  console.log('Anon Key length:', supabaseAnonKey?.length);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
    storageKey: 'sb-collegecart-auth',
    detectSessionInUrl: true,
    flowType: 'pkce',
    lock: false,
  },
  realtime: {
    params: { 
      eventsPerSecond: 10 
    },
    heartbeatIntervalMs: 30000,
    reconnectAfterMs: (tries) => {
      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      return Math.min(1000 * Math.pow(2, tries), 30000);
    },
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-client-info': 'collegecart-web'
    }
  }
});

