import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // Force PostgREST to reload its schema cache so new functions are visible
  const { error } = await supabase.rpc('pg_notify', {
    channel: 'pgrst',
    payload: 'reload schema'
  }).catch(() => ({ error: null }));

  // Also try direct SQL
  await supabase.from('_pgrst_reserved').select('*').limit(1).catch(() => {});

  return new Response(JSON.stringify({ ok: true, error: error?.message ?? null }), {
    headers: { "Content-Type": "application/json" }
  });
});
