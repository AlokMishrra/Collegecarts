-- ============================================================
-- FIX COD CASH COLLECTION
-- When delivery person clicks "Got Cash":
-- 1. Deduct FULL order amount from wallet (cash owed to admin)
-- 2. Add 10% commission to earnings (tracked separately)
-- Wallet shows: -₹40 (full amount owed)
-- Earnings show: +₹4 (10% commission)
-- 
-- cod_held_since is ALWAYS updated to NOW() on each collection
-- so the 24-hour window starts from the LATEST collection,
-- giving delivery person full 24 hours from their last COD pickup.
-- ============================================================

CREATE OR REPLACE FUNCTION collect_cod_cash(
  p_partner_id UUID,
  p_order_id UUID,
  p_amount NUMERIC
) RETURNS JSON AS $$
DECLARE
  current_held NUMERIC;
  v_commission NUMERIC;
BEGIN
  -- Calculate 10% commission
  v_commission := ROUND(p_amount * 0.10, 2);

  SELECT cod_held INTO current_held FROM delivery_persons WHERE id = p_partner_id FOR UPDATE;

  -- Deduct FULL COD amount from wallet (this is what they owe admin)
  -- Commission is added to earnings separately, NOT to wallet
  -- Always reset cod_held_since to NOW() — 24hr window restarts from latest collection
  UPDATE delivery_persons SET
    wallet_balance = COALESCE(wallet_balance, 0) - p_amount,
    cod_held = COALESCE(cod_held, 0) + p_amount,
    cod_held_since = NOW(),
    today_earnings = COALESCE(today_earnings, 0) + v_commission,
    total_earnings = COALESCE(total_earnings, 0) + v_commission,
    lifetime_earnings = COALESCE(lifetime_earnings, 0) + v_commission
  WHERE id = p_partner_id;

  -- Mark order as COD collected
  UPDATE orders SET
    cod_collected = TRUE,
    cod_collected_at = NOW(),
    cod_collected_by = p_partner_id,
    cod_collection_method = 'cash'
  WHERE id = p_order_id;

  RETURN json_build_object(
    'success', TRUE,
    'cod_amount', p_amount,
    'commission', v_commission
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
