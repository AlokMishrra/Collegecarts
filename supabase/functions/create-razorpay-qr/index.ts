import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;

serve(async (req) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }
    
    console.log("Received request body:", JSON.stringify(body));
    
    const { orderId, amount, customerName, customerPhone } = body;

    if (!orderId || !amount) {
      console.error("Missing fields:", { orderId, amount });
      return new Response(
        JSON.stringify({ error: "Missing required fields: orderId, amount", received: body }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    console.log("Creating Razorpay order for:", { orderId, amount, customerName, customerPhone });

    // Create Razorpay Order for payment tracking
    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    
    const orderPayload = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: "INR",
      receipt: `ord_${orderId}`.substring(0, 40), // Max 40 chars for Razorpay
      notes: {
        order_id: orderId,
        customer_name: customerName || "",
        customer_phone: customerPhone || "",
        purpose: "cod_collection"
      }
    };

    console.log("Razorpay order payload:", JSON.stringify(orderPayload));

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Razorpay order creation failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create payment order", details: errorText }),
        { status: response.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const orderData = await response.json();
    console.log("Razorpay order created:", orderData.id);

    // Create Razorpay Payment Link (handles all payment methods including UPI)
    const paymentLinkPayload = {
      amount: Math.round(amount * 100),
      currency: "INR",
      accept_partial: false,
      description: `Payment for Order ${orderId}`,
      customer: {
        name: customerName || "Customer",
        contact: customerPhone || "",
      },
      notify: {
        sms: false,
        email: false
      },
      reminder_enable: false,
      notes: {
        order_id: orderId,
        razorpay_order_id: orderData.id,
        purpose: "cod_collection"
      },
      callback_url: `https://shop.collegecarts.in/delivery`,
      callback_method: "get"
    };

    console.log("Creating Razorpay payment link...");
    const linkResponse = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentLinkPayload),
    });

    if (!linkResponse.ok) {
      const errorText = await linkResponse.text();
      console.error("Payment link creation failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create payment link", details: errorText }),
        { status: linkResponse.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const linkData = await linkResponse.json();
    console.log("Payment link created:", linkData.id, "URL:", linkData.short_url);

    // Generate QR code from payment link
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&margin=10&data=${encodeURIComponent(linkData.short_url)}`;

    // Store order reference in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("orders").update({
      razorpay_order_id: orderData.id,
      razorpay_payment_link_id: linkData.id,
      razorpay_qr_url: qrImageUrl,
      qr_created_at: new Date().toISOString()
    }).eq("id", orderId);

    console.log("Payment link QR created successfully for order:", orderId);

    return new Response(
      JSON.stringify({
        success: true,
        razorpayOrderId: orderData.id,
        paymentLinkId: linkData.id,
        qrImageUrl: qrImageUrl,
        paymentUrl: linkData.short_url,
        amount: amount
      }),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        } 
      }
    );

  } catch (error) {
    console.error("Error in create-razorpay-qr:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
