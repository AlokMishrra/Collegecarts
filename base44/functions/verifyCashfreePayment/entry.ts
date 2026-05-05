import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await req.json();

    if (!orderId) {
      return Response.json({ error: 'Order ID required' }, { status: 400 });
    }

    // ⚠️ SECURITY: Get credentials from environment variables ONLY
    const appId = Deno.env.get('CASHFREE_APP_ID');
    const secretKey = Deno.env.get('CASHFREE_SECRET_KEY');

    if (!appId || !secretKey) {
      console.error('Missing Cashfree credentials in environment variables');
      return Response.json({ 
        error: 'Payment gateway not configured. Please contact support.'
      }, { status: 500 });
    }

    const response = await fetch(`https://api.cashfree.com/pg/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json'
      }
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Cashfree verification error:', responseText);
      return Response.json({ 
        success: false,
        error: 'Payment verification failed'
      }, { status: 400 });
    }

    const orderDetails = JSON.parse(responseText);

    if (orderDetails.order_status === 'PAID') {
      return Response.json({
        success: true,
        message: 'Payment verified successfully',
        orderId: orderId,
        paymentStatus: orderDetails.order_status
      }, { status: 200 });
    } else {
      return Response.json({
        success: false,
        error: 'Payment not completed',
        paymentStatus: orderDetails.order_status
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error verifying payment:', error.message);
    return Response.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
});
