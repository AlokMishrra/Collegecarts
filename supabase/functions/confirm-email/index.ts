/**
 * confirm-email — Admin-confirm a user's email after custom OTP verification
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, password, full_name } = await req.json();
    if (!email || !password) {
      return Response.json({ error: 'Email and password required' }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // List users with high perPage, find by email
    let foundUser = null;
    let page = 1;
    const perPage = 1000;

    while (!foundUser && page <= 10) {
      const listRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
        {
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
          },
        }
      );
      const listData = await listRes.json();
      const users = listData?.users || [];
      if (users.length === 0) break;
      foundUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!foundUser && users.length < perPage) break;
      page++;
    }

    if (!foundUser) {
      // User doesn't exist — create with admin API
      const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name || '' },
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        return Response.json({ error: createData.msg || 'Failed to create user' }, { status: 500, headers: corsHeaders });
      }
      return Response.json({ success: true, created: true }, { headers: corsHeaders });
    }

    // User exists — update password and confirm email
    const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${foundUser.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || foundUser.user_metadata?.full_name || '' },
      }),
    });
    const updateData = await updateRes.json();
    if (!updateRes.ok) {
      return Response.json({ error: updateData.msg || 'Failed to update user' }, { status: 500, headers: corsHeaders });
    }

    return Response.json({ success: true, created: false }, { headers: corsHeaders });
  } catch (err) {
    console.error('confirm-email error:', err);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
});
