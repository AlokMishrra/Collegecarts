import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function RazorpayPayment({
  amount,
  orderNumber,
  customerName,
  customerEmail,
  customerPhone,
  onSuccess,
  onError
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay script');
      setScriptLoaded(false);
      onError('⚠️ Unable to load payment gateway. Please check your internet connection and refresh the page.');
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handlePayment = async () => {
    if (!scriptLoaded) {
      onError('⚠️ Payment gateway is still loading. Please wait a moment and try again.');
      return;
    }

    if (!window.Razorpay) {
      onError('⚠️ Payment gateway not available. Please refresh the page and try again.');
      return;
    }

    setIsLoading(true);

    try {
      // Create order on backend
      const response = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          currency: 'INR',
          receipt: orderNumber
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create payment order');
      }

      const { order } = await response.json();

      // Razorpay checkout options
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || process.env.REACT_APP_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'CollegeCart',
        description: 'Order Payment',
        image: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6885ba54fc40d82179646aca/56f3d15ef_WhatsAppImage2025-12-13at111830AM.jpeg',
        order_id: order.id,
        handler: async function (response) {
          try {
            // Verify payment on backend
            const verifyResponse = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const result = await verifyResponse.json();
            
            if (result.success) {
              onSuccess(response.razorpay_payment_id);
            } else {
              onError('Payment verification failed. Please contact support.');
            }
          } catch (error) {
            onError('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone
        },
        notes: {
          order_number: orderNumber
        },
        theme: {
          color: '#10b981'
        },
        modal: {
          ondismiss: function() {
            setIsLoading(false);
            onError('Payment cancelled by user');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      
      rzp.on('payment.failed', function (response) {
        setIsLoading(false);
        onError(response.error.description || 'Payment failed. Please try again.');
      });

      rzp.open();
    } catch (error) {
      console.error('Payment error:', error);
      onError(error.message || 'Failed to initiate payment. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={isLoading || !scriptLoaded}
      className="w-full bg-blue-600 hover:bg-blue-700"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Processing...
        </>
      ) : !scriptLoaded ? (
        'Loading Payment Gateway...'
      ) : (
        `Pay ₹${amount} with Razorpay`
      )}
    </Button>
  );
}
