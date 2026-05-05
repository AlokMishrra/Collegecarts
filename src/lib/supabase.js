import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
    storageKey: 'sb-collegecart-auth',
    detectSessionInUrl: true,
    flowType: 'pkce',
    lock: false, // Disable navigator.locks to prevent lock timeout warnings
  },
  realtime: {
    params: { eventsPerSecond: 10 }
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

