import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Each statement is sent individually via the PostgREST SQL endpoint
  const statements = [
    // 1. Add reserved_stock column
    `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reserved_stock integer DEFAULT 0`,

    // 2. reserve_stock
    `CREATE OR REPLACE FUNCTION public.reserve_stock(
       p_product_id TEXT, p_quantity INT, p_hostel TEXT DEFAULT NULL
     ) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $fn$
     DECLARE
       v_total INT; v_reserved INT; v_hostel_stock INT; v_available INT;
     BEGIN
       SELECT stock_quantity, COALESCE(reserved_stock,0)
       INTO v_total, v_reserved
       FROM public.products WHERE id = p_product_id::uuid FOR UPDATE;
       IF v_total IS NULL THEN
         RETURN json_build_object('success',false,'error','Product not found');
       END IF;
       IF p_hostel IS NOT NULL AND p_hostel <> 'Other' THEN
         SELECT COALESCE((hostel_stock->>p_hostel)::int, v_total)
         INTO v_hostel_stock FROM public.products WHERE id = p_product_id::uuid;
         v_available := LEAST(v_total - v_reserved, v_hostel_stock);
       ELSE
         v_available := v_total - v_reserved;
       END IF;
       IF v_available < p_quantity THEN
         RETURN json_build_object('success',false,'error','Insufficient stock','available',v_available);
       END IF;
       UPDATE public.products
       SET reserved_stock = COALESCE(reserved_stock,0) + p_quantity, updated_at = NOW()
       WHERE id = p_product_id::uuid;
       RETURN json_build_object('success',true,'reserved',p_quantity,'available',v_available - p_quantity);
     END; $fn$`,

    // 3. deliver_stock
    `CREATE OR REPLACE FUNCTION public.deliver_stock(
       p_product_id TEXT, p_quantity INT, p_hostel TEXT DEFAULT NULL
     ) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $fn$
     DECLARE
       v_total INT; v_reserved INT; v_new_total INT; v_new_hostel INT; v_hostel_json JSONB;
     BEGIN
       SELECT stock_quantity, COALESCE(reserved_stock,0), hostel_stock
       INTO v_total, v_reserved, v_hostel_json
       FROM public.products WHERE id = p_product_id::uuid FOR UPDATE;
       IF v_total IS NULL THEN
         RETURN json_build_object('success',false,'error','Product not found');
       END IF;
       v_new_total := GREATEST(0, v_total - p_quantity);
       IF p_hostel IS NOT NULL AND p_hostel <> 'Other' AND v_hostel_json IS NOT NULL THEN
         v_new_hostel := GREATEST(0, COALESCE((v_hostel_json->>p_hostel)::int,0) - p_quantity);
         v_hostel_json := jsonb_set(v_hostel_json, ARRAY[p_hostel], to_jsonb(v_new_hostel));
       END IF;
       UPDATE public.products SET
         stock_quantity = v_new_total,
         reserved_stock = GREATEST(0, COALESCE(reserved_stock,0) - p_quantity),
         hostel_stock   = CASE WHEN p_hostel IS NOT NULL AND p_hostel <> 'Other' THEN v_hostel_json ELSE hostel_stock END,
         is_available   = CASE WHEN v_new_total <= 0 THEN false ELSE is_available END,
         updated_at     = NOW()
       WHERE id = p_product_id::uuid;
       RETURN json_build_object('success',true,'new_total_stock',v_new_total);
     END; $fn$`,

    // 4. release_stock
    `CREATE OR REPLACE FUNCTION public.release_stock(
       p_product_id TEXT, p_quantity INT
     ) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $fn$
     BEGIN
       UPDATE public.products SET
         reserved_stock = GREATEST(0, COALESCE(reserved_stock,0) - p_quantity),
         is_available   = CASE WHEN stock_quantity > 0 THEN true ELSE is_available END,
         updated_at     = NOW()
       WHERE id = p_product_id::uuid;
       IF NOT FOUND THEN
         RETURN json_build_object('success',false,'error','Product not found');
       END IF;
       RETURN json_build_object('success',true,'released',p_quantity);
     END; $fn$`,

    // 5. decrement_stock (backward compat)
    `CREATE OR REPLACE FUNCTION public.decrement_stock(
       p_product_id TEXT, p_quantity INT
     ) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $fn$
     BEGIN
       RETURN public.reserve_stock(p_product_id, p_quantity, NULL);
     END; $fn$`,

    // 6. Grants
    `GRANT EXECUTE ON FUNCTION public.reserve_stock(TEXT,INT,TEXT)  TO authenticated, anon`,
    `GRANT EXECUTE ON FUNCTION public.deliver_stock(TEXT,INT,TEXT)  TO authenticated, anon`,
    `GRANT EXECUTE ON FUNCTION public.release_stock(TEXT,INT)       TO authenticated, anon`,
    `GRANT EXECUTE ON FUNCTION public.decrement_stock(TEXT,INT)     TO authenticated, anon`,

    // 7. Reload PostgREST schema cache
    `SELECT pg_notify('pgrst', 'reload schema')`,
  ];

  const results: { sql: string; ok: boolean; error?: string }[] = [];

  for (const sql of statements) {
    // Use the Supabase SQL API (available to service role)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "apikey": SERVICE_KEY,
        "Prefer": "params=single-object",
      },
      body: JSON.stringify({ query: sql }),
    });

    // Try the pg query endpoint instead
    const res2 = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "apikey": SERVICE_KEY,
      },
      body: JSON.stringify({ query: sql }),
    });

    const body2 = await res2.text();
    results.push({ sql: sql.slice(0, 50), ok: res2.ok, error: res2.ok ? undefined : body2 });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
