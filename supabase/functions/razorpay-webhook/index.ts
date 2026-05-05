import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");

serve(async (req) => {
  console.log("=== Razorpay Webhook Received ===");
  console.log("Method:", req.method);
  console.log("Headers:", Object.fromEntries(req.headers.entries()));
  
  try {
    const signature = req.headers.get("x-razorpay-signature");
    const body = await req.text();
    
    console.log("Body length:", body.length);
    console.log("Signature:", signature);
    console.log("Webhook secret configured:", !!RAZORPAY_WEBHOOK_SECRET);

    // Verify webhook signature only if secret is configured
    if (RAZORPAY_WEBHOOK_SECRET && signature) {
      const expectedSignature = createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest("hex");

      console.log("Expected signature:", expectedSignature);
      console.log("Received signature:", signature);

      if (signature !== expectedSignature) {
        console.error("❌ Invalid signature - signatures don't match");
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
      }

      console.log("✅ Signature verified");
    } else {
      console.log("⚠️ Webhook signature verification skipped (no secret configured)");
    }

    const event = JSON.parse(body);
    console.log("📦 Event type:", event.event);
    console.log("📦 Event payload:", JSON.stringify(event.payload, null, 2));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle payment via Razorpay Payment Link
    if (event.event === "payment.captured" || event.event === "order.paid" || event.event === "payment_link.paid") {
      const payment = event.payload.payment?.entity || event.payload.order?.entity || event.payload.payment_link?.entity;
      
      // Extract order ID from notes or receipt
      let orderId = payment.notes?.order_id;
      
      // If not in notes, try to extract from receipt
      if (!orderId && payment.receipt) {
        const match = payment.receipt.match(/ord_(.+)/);
        if (match) orderId = match[1];
      }
      
      const razorpayOrderId = payment.order_id || payment.id;
      const paymentMethod = payment.method || "upi";
      const paymentId = payment.id;
      const paymentAmount = payment.amount / 100; // Convert from paise to rupees

      console.log("✅ UPI Payment captured:", {
        event: event.event,
        orderId,
        razorpayOrderId,
        paymentMethod,
        amount: paymentAmount,
        paymentId,
        vpa: payment.vpa || "N/A"
      });

      if (!orderId) {
        console.error("No order_id found in payment");
        return new Response(JSON.stringify({ error: "No order_id" }), { status: 400 });
      }

      // Get order details
      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("*, delivery_person_id")
        .eq("id", orderId)
        .single();

      if (fetchError || !order) {
        console.error("Order not found:", orderId, fetchError);
        return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
      }

      // Mark order as paid
      await supabase.from("orders").update({
        is_paid: true,
        payment_method: "online",
        payment_id: paymentId,
        cod_collected: true,
        cod_collection_method: "qr_upi",
        cod_collected_at: new Date().toISOString(),
        razorpay_order_id: razorpayOrderId
      }).eq("id", orderId);

      console.log("✅ Order marked as paid:", orderId);

      // Credit delivery person wallet
      if (order.delivery_person_id) {
        const { data: deliveryPerson } = await supabase
          .from("delivery_persons")
          .select("wallet_balance")
          .eq("id", order.delivery_person_id)
          .single();

        if (deliveryPerson) {
          const newBalance = (deliveryPerson.wallet_balance || 0) + paymentAmount;

          await supabase.from("delivery_persons").update({
            wallet_balance: newBalance
          }).eq("id", order.delivery_person_id);

          await supabase.from("wallet_transactions").insert({
            delivery_person_id: order.delivery_person_id,
            amount: paymentAmount,
            type: "cod_collection",
            description: `UPI QR Payment for Order #${order.order_number} - ₹${paymentAmount.toFixed(2)}`,
            order_id: orderId,
            payment_id: paymentId
          });

          console.log(`✅ Wallet credited: ₹${paymentAmount} to delivery person ${order.delivery_person_id}`);
        }

        // Send notification to delivery person
        await supabase.from("notifications").insert({
          user_id: order.delivery_person_id,
          title: "💰 Payment Received!",
          message: `Customer paid ₹${paymentAmount.toFixed(2)} via UPI QR for Order #${order.order_number}. Amount credited to your wallet.`,
          type: "success",
          is_read: false
        });
      }

      console.log("✅ UPI QR Payment processed successfully for order:", orderId);
    }

    // Handle payment failed event
    if (event.event === "payment.failed" || event.event === "payment_link.cancelled") {
      const payment = event.payload.payment?.entity || event.payload.payment_link?.entity;
      
      let orderId = payment.notes?.order_id;
      if (!orderId && payment.receipt) {
        const match = payment.receipt.match(/ord_(.+)/);
        if (match) orderId = match[1];
      }

      console.log("❌ Payment failed:", {
        event: event.event,
        orderId,
        reason: payment.error_description || payment.error_reason || "Unknown",
        paymentId: payment.id
      });

      if (orderId) {
        // Get order details
        const { data: order } = await supabase
          .from("orders")
          .select("delivery_person_id, order_number")
          .eq("id", orderId)
          .single();

        // Send notification to delivery person about failed payment
        if (order?.delivery_person_id) {
          await supabase.from("notifications").insert({
            user_id: order.delivery_person_id,
            title: "❌ Payment Failed",
            message: `Payment failed for Order #${order.order_number}. Customer needs to try again.`,
            type: "error",
            is_read: false
          });
        }
      }

      console.log("❌ Payment failure recorded for order:", orderId);
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
