/**
 * One-shot edge function that creates the stock RPC functions in Postgres.
 * Call it once via: POST /functions/v1/create-stock-functions
 * Uses the service role key so it can execute DDL.
 * Safe to call multiple times (CREATE OR REPLACE).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // We use the postgres extension to run raw SQL.
  // Each statement is a separate rpc call to avoid transaction issues.
  const statements: { name: string; sql: string }[] = [
    {
      name: "add_reserved_stock_column",
      sql: `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reserved_stock integer DEFAULT 0`,
    },
    {
      name: "create_reserve_stock",
      sql: `
        CREATE OR REPLACE FUNCTION public.reserve_stock(
          p_product_id uuid,
          p_quantity   int,
          p_hostel     text DEFAULT NULL
        ) RETURNS json
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        DECLARE
          v_total        int;
          v_reserved     int;
          v_hostel_avail int;
          v_available    int;
        BEGIN
          -- Lock the row to prevent race conditions
          SELECT stock_quantity, COALESCE(reserved_stock, 0)
          INTO   v_total, v_reserved
          FROM   products
          WHERE  id = p_product_id
          FOR UPDATE;

          IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'error', 'Product not found');
          END IF;

          -- Calculate available stock
          IF p_hostel IS NOT NULL AND p_hostel <> 'Other' THEN
            SELECT COALESCE((hostel_stock ->> p_hostel)::int, v_total)
            INTO   v_hostel_avail
            FROM   products
            WHERE  id = p_product_id;
            v_available := LEAST(v_total - v_reserved, v_hostel_avail);
          ELSE
            v_available := v_total - v_reserved;
          END IF;

          IF v_available < p_quantity THEN
            RETURN json_build_object(
              'success',   false,
              'error',     'Insufficient stock',
              'available', v_available
            );
          END IF;

          -- Reserve (do NOT deduct actual stock yet)
          UPDATE products
          SET    reserved_stock = COALESCE(reserved_stock, 0) + p_quantity,
                 updated_at     = NOW()
          WHERE  id = p_product_id;

          RETURN json_build_object(
            'success',   true,
            'reserved',  p_quantity,
            'available', v_available - p_quantity
          );
        END;
        $$
      `,
    },
    {
      name: "create_confirm_delivery",
      sql: `
        CREATE OR REPLACE FUNCTION public.confirm_delivery(
          p_product_id uuid,
          p_quantity   int,
          p_hostel     text DEFAULT NULL
        ) RETURNS json
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        DECLARE
          v_total       int;
          v_reserved    int;
          v_new_total   int;
          v_new_hostel  int;
          v_hostel_json jsonb;
        BEGIN
          SELECT stock_quantity, COALESCE(reserved_stock, 0), hostel_stock
          INTO   v_total, v_reserved, v_hostel_json
          FROM   products
          WHERE  id = p_product_id
          FOR UPDATE;

          IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'error', 'Product not found');
          END IF;

          v_new_total := GREATEST(0, v_total - p_quantity);

          -- Deduct hostel stock if applicable
          IF p_hostel IS NOT NULL AND p_hostel <> 'Other' AND v_hostel_json IS NOT NULL THEN
            v_new_hostel  := GREATEST(0, COALESCE((v_hostel_json ->> p_hostel)::int, 0) - p_quantity);
            v_hostel_json := jsonb_set(v_hostel_json, ARRAY[p_hostel], to_jsonb(v_new_hostel));
          END IF;

          UPDATE products
          SET
            stock_quantity = v_new_total,
            reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - p_quantity),
            hostel_stock   = CASE
                               WHEN p_hostel IS NOT NULL AND p_hostel <> 'Other'
                               THEN v_hostel_json
                               ELSE hostel_stock
                             END,
            is_available   = CASE WHEN v_new_total <= 0 THEN false ELSE is_available END,
            updated_at     = NOW()
          WHERE id = p_product_id;

          RETURN json_build_object('success', true, 'new_stock', v_new_total);
        END;
        $$
      `,
    },
    {
      name: "create_cancel_order_stock",
      sql: `
        CREATE OR REPLACE FUNCTION public.cancel_order_stock(
          p_product_id uuid,
          p_quantity   int
        ) RETURNS json
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
          -- Only release reservation; do NOT touch actual stock
          UPDATE products
          SET
            reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - p_quantity),
            is_available   = CASE WHEN stock_quantity > 0 THEN true ELSE is_available END,
            updated_at     = NOW()
          WHERE id = p_product_id;

          IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'error', 'Product not found');
          END IF;

          RETURN json_build_object('success', true, 'released', p_quantity);
        END;
        $$
      `,
    },
    {
      name: "grant_permissions",
      sql: `
        GRANT EXECUTE ON FUNCTION public.reserve_stock(uuid, int, text)    TO authenticated, anon;
        GRANT EXECUTE ON FUNCTION public.confirm_delivery(uuid, int, text) TO authenticated, anon;
        GRANT EXECUTE ON FUNCTION public.cancel_order_stock(uuid, int)     TO authenticated, anon;
      `,
    },
    {
      name: "reload_schema",
      sql: `SELECT pg_notify('pgrst', 'reload schema')`,
    },
  ];

  const results: Record<string, string> = {};

  for (const { name, sql } of statements) {
    // Use the pg extension via supabase-js to run raw SQL
    const { error } = await supabase.rpc("exec_sql", { query: sql }).catch(() => ({
      error: { message: "exec_sql not available" },
    }));

    if (error?.message === "exec_sql not available" || error?.code === "42883") {
      // exec_sql doesn't exist — use the postgres REST endpoint directly
      const res = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/exec_sql`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          },
          body: JSON.stringify({ query: sql }),
        }
      );
      results[name] = res.ok ? "ok" : `${res.status}: ${await res.text()}`;
    } else {
      results[name] = error ? `error: ${error.message}` : "ok";
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
