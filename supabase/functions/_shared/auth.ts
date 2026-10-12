/**
 * CollegeCart — Edge Function auth helpers
 *
 * Shared contract for every Supabase Edge Function in this project.
 * Rules enforced:
 *   * No privileged database operation without an authenticated caller.
 *   * Service-role client is used for the privileged write, then dropped.
 *   * No secret, token, hash or OTP ever appears in a response body or log.
 *
 * Deployed alongside the functions; not a browser module.
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Response with CORS + JSON, and an explicit no-store on sensitive payloads. */
export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      // Anything returning authentication, payment or personal data must never
      // be cached by an intermediary.
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...extraHeaders,
    },
  });
}

/**
 * Resolve the calling user from the incoming request's Authorization header.
 * Returns null when the caller is not an authenticated Supabase Auth user.
 */
export async function requireUser(req: Request) {
  const header = req.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('VITE_SUPABASE_ANON_KEY');
  if (!url || !anon || !header) return null;

  const client = createAnonClient(header, url, anon);
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  return { user: data.user, client };
}

function createAnonClient(header: string, url: string, anon: string) {
  // Imported lazily so this module stays importable in tests.
  return edgeCreateClient(url, anon, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false },
  });
}

// Indirection keeps the esm.sh import in exactly one place.
import { createClient as edgeCreateClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Service-role client. Use ONLY for writes RLS must not constrain. */
export function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  return edgeCreateClient(url, key, { auth: { persistSession: false } });
}

/** True when the given Supabase user has role=admin in public.users. */
export async function isAdmin(userId: string): Promise<boolean> {
  const db = serviceClient();
  const { data } = await db.from('users').select('role').eq('id', userId).maybeSingle();
  return data?.role === 'admin';
}

/**
 * Constant-time string comparison for signature checks.
 * `!==` on hex strings leaks match length via timing.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** HMAC-SHA256 hex, matching Razorpay's signature scheme. */
export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Redact a value for logs. Never logs raw OTPs, tokens, passwords or secrets.
 */
export function redact(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  const s = String(v);
  if (s.length <= 4) return '****';
  return `${s.slice(0, 2)}***${s.slice(-2)}`;
}
