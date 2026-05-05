import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const attempts = new Map<string, number[]>()

// Cleanup old attempts every 5 minutes
setInterval(() => {
  const now = Date.now()
  const windowMs = 60000
  
  for (const [userId, userAttempts] of attempts.entries()) {
    const validAttempts = userAttempts.filter(t => now - t < windowMs)
    if (validAttempts.length === 0) {
      attempts.delete(userId)
    } else {
      attempts.set(userId, validAttempts)
    }
  }
}, 5 * 60 * 1000)

serve(async (req) => {
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Max-Age': '86400',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  }

  const userId = user.id
  const now = Date.now()
  const windowMs = 60000 // 60 seconds
  const maxAttempts = 5

  // Get user's recent attempts within the time window
  const userAttempts = (attempts.get(userId) || []).filter(t => now - t < windowMs)

  if (userAttempts.length >= maxAttempts) {
    const oldest = Math.min(...userAttempts)
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000)
    
    return new Response(JSON.stringify({
      error: 'Too many orders',
      message: `Please wait ${retryAfter} seconds before placing another order.`,
      retryAfter
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        ...corsHeaders
      }
    })
  }

  // Add current attempt
  userAttempts.push(now)
  attempts.set(userId, userAttempts)

  return new Response(JSON.stringify({ allowed: true }), {
    status: 200,
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  })
})
