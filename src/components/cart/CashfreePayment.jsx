import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Shield, CheckCircle } from "lucide-react";
import { toast } from "sonner";

// Call a base44/Supabase edge function with the user's auth token
async function callFunction(fnName, payload) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text }; }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export default function CashfreePayment({ 
  amount, 
  onSuccess, 
  onError, 
  orderNumber,
  customerName,
  customerPhone,
  customerEmail 
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);

  useEffect(() => {
    if (window.Cashfree) { setSdkReady(true); return; }

    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => onError('Payment system failed to load. Please refresh.');
    document.head.appendChild(script);
  }, []);

  const handlePayment = async () => {
    if (!sdkReady || !window.Cashfree) {
      toast.error('Payment system not ready. Please wait a moment.');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create Cashfree order via edge function
      const orderData = await callFunction('create-cashfree-order', {
        amount,
        orderNumber,
        customerName,
        customerPhone,
        customerEmail
      });

      if (!orderData?.paymentSessionId) {
        throw new Error('Could not create payment session. Please try again.');
      }

      // Step 2: Open Cashfree checkout
      // _modal requires HTTPS — use _blank on localhost, _modal on production
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const redirectTarget = isLocalhost ? '_blank' : '_modal';

      const cashfree = window.Cashfree({ mode: "production" });

      const result = await cashfree.checkout({
        paymentSessionId: orderData.paymentSessionId,
        redirectTarget
      });

      if (result.error) {
        throw new Error(result.error.message || 'Payment failed.');
      }

      if (result.redirect) {
        // Redirect flow (localhost _blank or production redirect)
        // Payment is happening in new tab / redirect — poll for completion
        setIsLoading(false);
        toast.info('Complete payment in the opened tab. This page will update automatically.');

        // Poll every 3 seconds for up to 5 minutes
        let attempts = 0;
        const maxAttempts = 100;
        const poll = setInterval(async () => {
          attempts++;
          try {
            const verifyData = await callFunction('verify-cashfree-payment', {
              orderId: orderData.orderId
            });
            if (verifyData?.success) {
              clearInterval(poll);
              setPaymentDone(true);
              onSuccess(orderData.orderId);
            } else if (attempts >= maxAttempts) {
              clearInterval(poll);
              toast.error('Payment timed out. If you paid, contact support.');
            }
          } catch { /* keep polling */ }
        }, 3000);
        return;
      }

      if (result.paymentDetails) {
        // Modal flow — verify immediately
        const verifyData = await callFunction('verify-cashfree-payment', {
          orderId: orderData.orderId
        });

        if (verifyData?.success) {
          setIsLoading(false);
          setPaymentDone(true);
          onSuccess(orderData.orderId);
        } else {
          throw new Error('Payment verification failed. Contact support if amount was deducted.');
        }
      } else {
        // Modal closed without paying
        setIsLoading(false);
      }

    } catch (error) {
      setIsLoading(false);
      onError(error.message || 'Payment failed. Please try again.');
    }
  };

  // Success state — clean confirmation
  if (paymentDone) {
    return (
      <div className="w-full bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
        <div>
          <p className="font-semibold text-green-800 text-sm">Payment Successful</p>
          <p className="text-xs text-green-600">Processing your order...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center flex-shrink-0 border border-emerald-100">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6885ba54fc40d82179646aca/56f3d15ef_WhatsAppImage2025-12-13at111830AM.jpeg"
            alt="CollegeCart"
            className="w-6 h-6 object-contain"
          />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Secure Online Payment</p>
          <p className="text-xs text-gray-500">Cards · UPI · Wallet</p>
        </div>
      </div>

      {/* Amount */}
      <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 mb-3 border border-emerald-100">
        <span className="text-sm text-gray-600">Amount</span>
        <span className="text-lg font-bold text-emerald-600">₹{amount.toFixed(2)}</span>
      </div>

      {/* Pay button */}
      <Button
        onClick={handlePayment}
        disabled={isLoading || !sdkReady}
        className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm disabled:opacity-50"
      >
        {isLoading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
        ) : !sdkReady ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...</>
        ) : (
          <><CreditCard className="w-4 h-4 mr-2" />Pay ₹{amount.toFixed(2)}</>
        )}
      </Button>

      {/* Secure badge */}
      <div className="flex items-center justify-center gap-1 mt-2">
        <Shield className="w-3 h-3 text-gray-400" />
        <p className="text-[10px] text-gray-400">100% Secure Payment</p>
      </div>
    </div>
  );
}
