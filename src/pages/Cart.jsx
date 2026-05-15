import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { CartItem } from "@/entities/CartItem";
import { Product } from "@/entities/Product";
import { base44 } from "@/api/base44Client";
  import { User } from "@/entities/User";
  import { Order } from "@/entities/Order";
  import { Notification } from "@/entities/Notification";
  import { DeliveryPerson } from "@/entities/DeliveryPerson";
import { supabase } from "@/lib/supabase";
import { notifyCartUpdate } from "@/utils/cartEvents";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import DeliveryProgressBar from "../components/cart/DeliveryProgressBar";
import RecommendedProducts from "../components/cart/RecommendedProducts";
import { ProductImage } from "@/components/ui/product-image";
import { useDialog } from "@/components/ui/alert-dialog-custom";
import { BackButton } from "@/components/ui/back-button";
import { withRetry, generateIdempotencyKey, checkDuplicateOrder } from "@/utils/orderUtils";
import { logErrorToDB } from "@/utils/supabaseWithLogging";
import { releaseStockOnCancel } from "@/utils/inventoryService";
import { toast } from "sonner";
import { useCheckoutCharges } from "@/hooks/useCheckoutCharges";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Cart() {
  const { warning, error: showError } = useDialog();
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState([]);
  const [products, setProducts] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
        const [settings, setSettings] = useState(null);
        const [isFirstOrder, setIsFirstOrder] = useState(false);
        const [retryAttempt, setRetryAttempt] = useState(0);
        const [retryMessage, setRetryMessage] = useState("");
        const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
        const idempotencyKeyRef = useRef(generateIdempotencyKey());
        
        // Payment timeout states
        const [paymentTimeLeft, setPaymentTimeLeft] = useState(null);
        const [pendingOrderId, setPendingOrderId] = useState(null);
        const paymentTimerRef = useRef(null);

        const [customerName, setCustomerName] = useState("");
        const [selectedHostel, setSelectedHostel] = useState("");
        const [roomNumber, setRoomNumber] = useState("");
        const [phoneNumber, setPhoneNumber] = useState("");
        const [deliveryNotes, setDeliveryNotes] = useState("");
        const [customAddress, setCustomAddress] = useState("");
        const [paymentMethod, setPaymentMethod] = useState("cash");
        const [loyaltyPoints, setLoyaltyPoints] = useState(0);
        const [pointsToRedeem, setPointsToRedeem] = useState(0);
        const [discountCode, setDiscountCode] = useState("");
        const [appliedCampaign, setAppliedCampaign] = useState(null);
        const [isPremiumUser, setIsPremiumUser] = useState(false);
        const [codeError, setCodeError] = useState("");
        
        // Scheduled order states
        const [isScheduledOrder, setIsScheduledOrder] = useState(false);
        const [scheduledDate, setScheduledDate] = useState("");
        const [scheduledTime, setScheduledTime] = useState("");
        
        // Field error states
        const [fieldErrors, setFieldErrors] = useState({
          name: "",
          phone: "",
          hostel: "",
          room: "",
          address: "",
          scheduledTime: ""
        });
        const [selectedDhaba, setSelectedDhaba] = useState({});
  const [currentSubtotal, setCurrentSubtotal] = useState(0);

  // Helper function to get product price (needs to be defined before calculateSubtotal)
  const getProductPrice = useCallback((product) => {
    if (!product) return 0;
    
    // Check if product has dhaba options and a dhaba is selected
    if (product.dhaba_options?.length > 0) {
      const selectedDhabaForProduct = selectedDhaba[product.id];
      if (selectedDhabaForProduct) {
        const dhabaOption = product.dhaba_options.find(
          opt => opt.dhaba_name === selectedDhabaForProduct
        );
        if (dhabaOption) {
          return dhabaOption.price;
        }
      }
    }
    
    // Return regular price
    return product.price || 0;
  }, [selectedDhaba]);

  // Calculate subtotal for checkout charges
  const calculateSubtotal = useCallback(() => {
    return cartItems.reduce((total, item) => {
      const product = products[item.product_id];
      const price = getProductPrice(product);
      return total + (product ? price * item.quantity : 0);
    }, 0);
  }, [cartItems, products, getProductPrice]);

  // Update subtotal when cart changes
  useEffect(() => {
    setCurrentSubtotal(calculateSubtotal());
  }, [calculateSubtotal]);

  // Checkout charges hook
  const { charges: checkoutCharges, loading: loadingCharges } = useCheckoutCharges(currentSubtotal);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  
  // Rate limit countdown effect
  useEffect(() => {
    if (rateLimitCountdown > 0) {
      const timer = setInterval(() => {
        setRateLimitCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [rateLimitCountdown]);

  // Payment timeout countdown effect
  useEffect(() => {
    if (paymentTimeLeft !== null && paymentTimeLeft > 0) {
      paymentTimerRef.current = setInterval(() => {
        setPaymentTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(paymentTimerRef.current);
            if (pendingOrderId) {
              handlePaymentTimeout(pendingOrderId);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (paymentTimerRef.current) {
          clearInterval(paymentTimerRef.current);
        }
      };
    }
  }, [paymentTimeLeft, pendingOrderId]);

  // Cleanup payment timer on unmount
  useEffect(() => {
    return () => {
      if (paymentTimerRef.current) {
        clearInterval(paymentTimerRef.current);
      }
    };
  }, []);

  // Start payment timer
  const startPaymentTimer = (orderId) => {
    setPendingOrderId(orderId);
    setPaymentTimeLeft(300); // 5 minutes = 300 seconds
  };

  // Handle payment timeout
  const handlePaymentTimeout = async (orderId) => {
    try {
      // Fetch the order to get items for stock release
      const orders = await Order.filter({ id: orderId });
      const order = orders[0];

      await Order.update(orderId, { status: 'cancelled' });

      // Release any reserved stock
      if (order) {
        releaseStockOnCancel(order).catch(err => {
          console.error('[Cart] Stock release on payment timeout failed:', err);
        });
      }

      await Notification.create({
        user_id: user.id,
        title: "Payment Expired",
        message: "Payment window expired. Your order has been cancelled.",
        type: "error"
      });
      setPaymentTimeLeft(null);
      setPendingOrderId(null);
    } catch (err) {
      console.error("Failed to cancel timed-out order:", err);
    }
  };

  // Handle payment success
  const handlePaymentSuccess = (paymentId) => {
    if (paymentTimerRef.current) {
      clearInterval(paymentTimerRef.current);
    }
    setPaymentTimeLeft(null);
    setPendingOrderId(null);
    // Continue with existing payment success logic
  };

  const loadCart = useCallback(async (userId) => {
    setIsLoading(true);
    try {
      const items = await CartItem.filter({ user_id: userId }, '-created_date', 50).catch(() => []);
      setCartItems(items);

      if (items.length === 0) {
        setProducts({});
        setIsLoading(false);
        return;
      }

      const productIds = [...new Set(items.map(item => item.product_id))].slice(0, 50);
      const productPromises = productIds.map(id => 
        Product.filter({ id }).then(results => results[0]).catch(() => null)
      );
      const productsData = await Promise.all(productPromises);
      
      const productsMap = {};
      productsData.forEach(product => {
        if (product) productsMap[product.id] = product;
      });
      setProducts(productsMap);
    } catch (error) {
      console.error("Error loading cart:", error);
      setCartItems([]);
      setProducts({});
    }
    setIsLoading(false);
  }, []); // Dependencies: empty as state setters and static imports are stable.

  const loadSettings = useCallback(async () => {
    try {
      const allSettings = await base44.entities.Settings.list();
      if (allSettings.length > 0) {
        setSettings(allSettings[0]);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }, []);

  const checkFirstOrder = useCallback(async (userId) => {
    try {
      const userOrders = await Order.filter({ user_id: userId });
      setIsFirstOrder(userOrders.length === 0);
    } catch (error) {
      console.error("Error checking orders:", error);
    }
  }, []);

  const checkPremiumStatus = useCallback(async (userId) => {
    try {
      const now = new Date();
      const subs = await base44.entities.Subscription.filter({ user_id: userId, status: "active" }).catch(() => []);
      const active = subs.some(s => !s.end_date || new Date(s.end_date) > now);
      setIsPremiumUser(active);
    } catch {}
  }, []);

  const loadLoyaltyPoints = useCallback(async (userId) => {
    try {
      const transactions = await base44.entities.LoyaltyTransaction.filter({ user_id: userId });
      const balance = transactions.reduce((sum, t) => sum + t.points, 0);
      setLoyaltyPoints(balance);
    } catch (error) {
      console.error("Error loading loyalty points:", error);
    }
  }, []);

  const checkUser = useCallback(async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      loadCart(currentUser.id);
      loadSettings();
      checkFirstOrder(currentUser.id);
      loadLoyaltyPoints(currentUser.id);
      checkPremiumStatus(currentUser.id);
      setCustomerName(currentUser.full_name || "");
      setPhoneNumber(currentUser.phone_number || "");
      // Automatically set delivery location from user's selected hostel
      setSelectedHostel(currentUser.selected_hostel || "");
    } catch (error) {
      navigate(createPageUrl('Shop'));
    }
  }, [navigate, loadCart, loadSettings, checkFirstOrder, loadLoyaltyPoints, checkPremiumStatus]);

  useEffect(() => {
    checkUser();
  }, [checkUser]); // Dependency: checkUser

  // Re-load cart when navigating back to this page (tab switch, browser back, etc.)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        loadCart(user.id);
      }
    };

    // Re-load when cart is updated from another page (e.g., Shop → add to cart)
    const handleCartUpdate = () => {
      if (user) {
        loadCart(user.id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('cartUpdated', handleCartUpdate);
    
    // Also reload on window focus (covers tab switches in SPA)
    window.addEventListener('focus', handleCartUpdate);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('cartUpdated', handleCartUpdate);
      window.removeEventListener('focus', handleCartUpdate);
    };
  }, [user, loadCart]);

  const updateQuantity = async (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      await removeItem(itemId);
      return;
    }

    // Optimistic UI update - update local state immediately
    setCartItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, quantity: newQuantity } : item
    ));
    
    // Notify cart update immediately for instant UI feedback
    notifyCartUpdate();

    try {
      await CartItem.update(itemId, { quantity: newQuantity });
      // Reload cart to ensure consistency
      loadCart(user.id);
    } catch (error) {
      console.error("Error updating quantity:", error);
      // Revert on error
      loadCart(user.id);
      toast.error("Failed to update quantity");
    }
  };

  const removeItem = async (itemId) => {
    // Optimistic UI update - remove from local state immediately
    setCartItems(prev => prev.filter(item => item.id !== itemId));
    
    // Notify cart update immediately for instant UI feedback
    notifyCartUpdate();

    try {
      await CartItem.delete(itemId);
      toast.success("Item removed from cart");
      // Reload cart to ensure consistency
      loadCart(user.id);
    } catch (error) {
      console.error("Error removing item:", error);
      // Revert on error
      loadCart(user.id);
      toast.error("Failed to remove item");
    }
  };

  const hasDhabaProducts = () => {
    return cartItems.some(item => {
      const product = products[item.product_id];
      return product?.dhaba_options?.length > 0;
    });
  };

  const calculateShippingCharge = () => {
    if (!settings) return 0;
    // Premium users always get free delivery
    if (isPremiumUser) return 0;
    const subtotal = calculateSubtotal();
    const threshold = isFirstOrder ? settings.first_order_threshold : settings.free_delivery_above;

    if (subtotal >= threshold) return 0;

    // Calculate delivery charge based on total quantity of items
    // Each item adds ₹5 to delivery charge (or product-specific delivery_charge if set)
    const baseDeliveryChargePerItem = settings.shipping_charge || 5;
    
    let totalDeliveryCharge = 0;
    cartItems.forEach(item => {
      const product = products[item.product_id];
      if (product) {
        // Use product-specific delivery charge if available, otherwise use base charge
        const chargePerItem = product.delivery_charge || baseDeliveryChargePerItem;
        // Multiply by quantity to charge for each item
        totalDeliveryCharge += chargePerItem * item.quantity;
      }
    });

    return totalDeliveryCharge;
  };

  const calculatePointsDiscount = () => {
    return pointsToRedeem / 10;
  };

  const calculateCampaignDiscount = () => {
    if (!appliedCampaign) return 0;
    const subtotal = calculateSubtotal();
    if (appliedCampaign.discount_type === 'percentage') {
      return subtotal * (appliedCampaign.discount_value / 100);
    } else if (appliedCampaign.discount_type === 'fixed') {
      return Math.min(appliedCampaign.discount_value, subtotal);
    }
    return 0;
  };

  const calculateTotal = () => {
    let shipping = calculateShippingCharge();
    const isFreeDelivery = shipping === 0;
    
    if (appliedCampaign?.discount_type === 'free_shipping') {
      shipping = 0;
    }
    
    // Add checkout charges (small cart fee + handling fee)
    const smallCartFee = checkoutCharges?.smallCartFee || 0;
    let handlingFee = checkoutCharges?.handlingFee || 0;
    
    // If delivery is free and free delivery handling is enabled, use that fee instead
    if (isFreeDelivery && checkoutCharges?.settings?.free_delivery_handling_enabled) {
      handlingFee = checkoutCharges.settings.free_delivery_handling_fee || 0;
    }
    
    return Math.max(
      0, 
      calculateSubtotal() + 
      shipping + 
      smallCartFee + 
      handlingFee - 
      calculatePointsDiscount() - 
      calculateCampaignDiscount()
    );
  };

  const applyDiscountCode = async () => {
    setCodeError("");
    if (!discountCode.trim()) return;

    try {
      const campaigns = await base44.entities.Campaign.filter({ 
        code: discountCode.toUpperCase(),
        is_active: true 
      });

      if (campaigns.length === 0) {
        setCodeError("Invalid discount code");
        return;
      }

      const campaign = campaigns[0];
      const now = new Date();
      const start = new Date(campaign.start_date);
      const end = new Date(campaign.end_date);

      if (now < start || now > end) {
        setCodeError("This campaign has expired");
        return;
      }

      if (campaign.usage_limit && campaign.usage_count >= campaign.usage_limit) {
        setCodeError("This code has reached its usage limit");
        return;
      }

      if (calculateSubtotal() < campaign.min_order_amount) {
        setCodeError(`Minimum order of ₹${campaign.min_order_amount} required`);
        return;
      }

      // Check user usage
      const userUsage = await base44.entities.CampaignUsage.filter({
        campaign_id: campaign.id,
        user_id: user.id
      });

      if (userUsage.length >= campaign.usage_per_user) {
        setCodeError("You've already used this code");
        return;
      }

      setAppliedCampaign(campaign);
      toast.success(`${campaign.name} discount applied!`);
    } catch (error) {
      console.error("Error applying code:", error);
      setCodeError("Failed to apply code");
    }
  };

  const getCartQuantity = (productId) => {
    const item = cartItems.find(item => item.product_id === productId);
    return item ? item.quantity : 0;
  };

  const addToCart = async (product) => {
    if (!user) {
      await base44.auth.redirectToLogin();
      return;
    }

    try {
      const existingItem = cartItems.find(item => item.product_id === product.id);
      
      if (existingItem) {
        await CartItem.update(existingItem.id, {
          quantity: existingItem.quantity + 1
        });
      } else {
        await CartItem.create({
          product_id: product.id,
          user_id: user.id,
          quantity: 1
        });
      }

      // Notify Layout to update cart count
      notifyCartUpdate();

      // Toast only — no bell notification for cart adds
      toast.success(`${product.name} added to cart`);

      loadCart(user.id);
    } catch (error) {
      console.error("Error adding to cart:", error);
    }
  };

  // Rate limit check function
  const checkRateLimit = async () => {
    try {
      const { supabase: sb } = await import('@/lib/supabase');
      const { data: { session } } = await sb.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rate-limit-orders`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({}),
        }
      );

      if (res.status === 429) {
        let retryAfter = 60;
        try {
          const body = await res.json();
          retryAfter = body?.retryAfter || 60;
          toast.error(body?.message || 'Too many orders. Please wait.');
        } catch {
          toast.error('Too many orders. Please wait.');
        }
        setRateLimitCountdown(retryAfter);
        return false;
      }
      return true;
    } catch {
      // If rate limit check fails, allow order to proceed
      return true;
    }
  };

  // Razorpay Payment Handler
  const handleRazorpayPayment = async () => {
    // Validate all fields first
    if (!customerName.trim()) {
      setFieldErrors(prev => ({ ...prev, name: "Please enter your name" }));
      document.getElementById('customer-name')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Validate phone number - must be 10 digits starting with 6-9
    const cleanedPhone = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
    
    if (!cleanedPhone) {
      setFieldErrors(prev => ({ ...prev, phone: "Please enter your phone number" }));
      document.getElementById('phone-number')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    if (cleanedPhone.length !== 10) {
      setFieldErrors(prev => ({ ...prev, phone: "Invalid mobile number" }));
      document.getElementById('phone-number')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    if (!/^[6-9]/.test(cleanedPhone)) {
      setFieldErrors(prev => ({ ...prev, phone: "Invalid mobile number" }));
      document.getElementById('phone-number')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    // Check for sequential numbers
    if (/^(0123456789|1234567890|9876543210|0987654321)$/.test(cleanedPhone)) {
      setFieldErrors(prev => ({ ...prev, phone: "Invalid mobile number" }));
      document.getElementById('phone-number')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    // Check for all same digits
    if (/^(\d)\1{9}$/.test(cleanedPhone)) {
      setFieldErrors(prev => ({ ...prev, phone: "Invalid mobile number" }));
      document.getElementById('phone-number')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    // Check for repeating patterns
    if (/^(\d{2,4})\1+$/.test(cleanedPhone)) {
      setFieldErrors(prev => ({ ...prev, phone: "Invalid mobile number" }));
      document.getElementById('phone-number')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!selectedHostel) {
      setFieldErrors(prev => ({ ...prev, hostel: "Please select your delivery location" }));
      document.getElementById('hostel-select')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (selectedHostel === "Other" && !customAddress.trim()) {
      setFieldErrors(prev => ({ ...prev, address: "Please enter your complete delivery address" }));
      document.getElementById('custom-address')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (selectedHostel !== "Other" && !roomNumber.trim()) {
      setFieldErrors(prev => ({ ...prev, room: "Please enter your room number" }));
      document.getElementById('room-number')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsPlacingOrder(true);

    try {
      // Create Razorpay order
      const orderNumber = `CC${Date.now()}`;
      const amount = calculateTotal();

      const { data, error } = await supabase.functions.invoke('create-razorpay-cod-order', {
        body: {
          orderId: orderNumber,
          amount: amount,
          customerName: customerName,
          customerPhone: phoneNumber,
          customerEmail: user?.email || 'customer@collegecart.in'
        }
      });

      if (error || !data?.razorpayOrderId) {
        throw new Error('Failed to create payment order');
      }

      // Open Razorpay checkout
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'CollegeCart',
        description: `Order #${orderNumber}`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: customerName,
          contact: phoneNumber,
          email: user?.email || 'customer@collegecart.in'
        },
        handler: async function (response) {
          try {
            // Verify payment
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              }
            });

            if (verifyError || !verifyData?.success) {
              throw new Error('Payment verification failed');
            }

            // Payment verified - now place the order
            await placeOrder(response.razorpay_payment_id);
          } catch (err) {
            console.error('Payment verification error:', err);
            toast.error('Payment verification failed. Contact support if amount was deducted.');
            setIsPlacingOrder(false);
          }
        },
        modal: {
          ondismiss: function() {
            setIsPlacingOrder(false);
            toast.info('Payment cancelled. Your cart is still saved.');
          }
        },
        theme: {
          color: '#10b981'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('Payment error:', err);
      toast.error('Failed to open payment gateway. Please try again.');
      setIsPlacingOrder(false);
    }
  };

  const placeOrder = async (paymentId = null) => {
      // ⚡ STEP 1: IMMEDIATE VALIDATION (synchronous checks first)
      // Clear all errors first
      setFieldErrors({
        name: "",
        phone: "",
        hostel: "",
        room: "",
        address: "",
        scheduledTime: ""
      });

      // Check if cart is empty (instant check)
      if (cartItems.length === 0) {
        await warning("Please add products to your cart before placing an order.", "Cart is Empty");
        return;
      }

      // Check website status (instant check)
      if (settings && settings.is_online === false) {
        toast.error("Service temporarily unavailable. Please try again later.");
        return;
      }

      // Validate required fields BEFORE any async operations
      if (!customerName.trim()) {
        setFieldErrors(prev => ({ ...prev, name: "Please enter your name" }));
        document.getElementById('customer-name')?.focus();
        document.getElementById('customer-name')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // Validate phone number - must be 10 digits starting with 6-9
      const cleanedPhone = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
      
      if (!cleanedPhone) {
        setFieldErrors(prev => ({ ...prev, phone: "Please enter your phone number" }));
        document.getElementById('phone-number')?.focus();
        document.getElementById('phone-number')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // Validate phone number format
      if (cleanedPhone.length !== 10) {
        setFieldErrors(prev => ({ ...prev, phone: "Invalid mobile number" }));
        document.getElementById('phone-number')?.focus();
        document.getElementById('phone-number')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      
      if (!/^[6-9]/.test(cleanedPhone)) {
        setFieldErrors(prev => ({ ...prev, phone: "Invalid mobile number" }));
        document.getElementById('phone-number')?.focus();
        document.getElementById('phone-number')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      
      // Check for sequential numbers
      if (/^(0123456789|1234567890|9876543210|0987654321)$/.test(cleanedPhone)) {
        setFieldErrors(prev => ({ ...prev, phone: "Invalid mobile number" }));
        document.getElementById('phone-number')?.focus();
        document.getElementById('phone-number')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      
      // Check for all same digits
      if (/^(\d)\1{9}$/.test(cleanedPhone)) {
        setFieldErrors(prev => ({ ...prev, phone: "Invalid mobile number" }));
        document.getElementById('phone-number')?.focus();
        document.getElementById('phone-number')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      
      // Check for repeating patterns
      if (/^(\d{2,4})\1+$/.test(cleanedPhone)) {
        setFieldErrors(prev => ({ ...prev, phone: "Invalid mobile number" }));
        document.getElementById('phone-number')?.focus();
        document.getElementById('phone-number')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // Validate scheduled order fields
      if (isScheduledOrder) {
        // Auto-set date to today
        const todayDate = new Date().toISOString().split('T')[0];
        setScheduledDate(todayDate);

        if (!scheduledTime) {
          setFieldErrors(prev => ({ ...prev, scheduledTime: "Please select a time" }));
          document.getElementById('scheduled-time')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        // Validate scheduled time is in the future (using today's date)
        const scheduledDateTime = new Date(`${todayDate}T${scheduledTime}`);
        const now = new Date();
        
        if (scheduledDateTime <= now) {
          setFieldErrors(prev => ({ ...prev, scheduledTime: "Scheduled time must be in the future" }));
          document.getElementById('scheduled-time')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        // Validate scheduled time is within 30 minutes from now
        const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
        if (scheduledDateTime > thirtyMinutesFromNow) {
          setFieldErrors(prev => ({ ...prev, scheduledTime: "You can only schedule within 30 minutes from now" }));
          document.getElementById('scheduled-time')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        // Validate scheduled time is at least 10 minutes from now (minimum preparation time)
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
        if (scheduledDateTime < tenMinutesFromNow) {
          setFieldErrors(prev => ({ ...prev, scheduledTime: "Please schedule at least 10 minutes in advance" }));
          document.getElementById('scheduled-time')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }

      if (!selectedHostel) {
        setFieldErrors(prev => ({ ...prev, hostel: "Please select your delivery location" }));
        document.getElementById('hostel-select')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (selectedHostel === "Other") {
        if (!customAddress.trim()) {
          setFieldErrors(prev => ({ ...prev, address: "Please enter your complete delivery address" }));
          document.getElementById('custom-address')?.focus();
          document.getElementById('custom-address')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      } else {
        // For hostel delivery, room number is required
        if (!roomNumber.trim()) {
          setFieldErrors(prev => ({ ...prev, room: `Please enter your room number` }));
          document.getElementById('room-number')?.focus();
          document.getElementById('room-number')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }

      if (paymentMethod === "online" && !paymentId) {
        toast.info("Please complete the payment using the Razorpay button below.");
        return;
      }

      if (paymentMethod === "razorpay" && !paymentId) {
        toast.info("Please complete the payment using the button below.");
        return;
      }

      // ⚡ STEP 2: SET LOADING STATE (after all validations pass)
      setIsPlacingOrder(true);
      
      // Show immediate feedback toast
      const loadingToast = toast.loading("Processing your order...", { id: 'order-processing' });

      try {
        // ⚡ STEP 3: PARALLEL ASYNC CHECKS (run simultaneously for speed)
        const [rateLimitOk, recentOrders] = await Promise.all([
          checkRateLimit(),
          Order.filter({ user_id: user.id }, '-created_at', 10)
        ]);

        if (!rateLimitOk) {
          setIsPlacingOrder(false);
          toast.dismiss(loadingToast);
          return;
        }

        // Check for duplicate orders
        const isDuplicate = checkDuplicateOrder(recentOrders, user.id);
        if (isDuplicate) {
          toast.error("You already placed an order recently. Please wait 60 seconds.");
          setIsPlacingOrder(false);
          toast.dismiss(loadingToast);
          return;
        }

        // ⚡ STEP 4: Check delivery availability (optional check, don't block on failure)
        try {
          const hostelToCheck = selectedHostel === "Other" ? null : selectedHostel;
          
          if (hostelToCheck) {
            const activePartners = await DeliveryPerson.filter({ 
              is_available: true,
              assigned_hostel: hostelToCheck 
            });
            
            if (!activePartners || activePartners.length === 0) {
              await warning(
                `No delivery partners are currently available for ${hostelToCheck} hostel. Please try again in a few minutes or contact support.`,
                "No Delivery Partners Available"
              );
              setIsPlacingOrder(false);
              toast.dismiss(loadingToast);
              return;
            }
          } else {
            const activePartners = await DeliveryPerson.filter({ is_available: true });
            if (!activePartners || activePartners.length === 0) {
              await warning(
                "No delivery partners are currently available. Please try again in a few minutes or contact support.",
                "No Delivery Partners Available"
              );
              setIsPlacingOrder(false);
              toast.dismiss(loadingToast);
              return;
            }
          }
        } catch (e) {
          // Silently fail delivery check
        }

        // Update toast for payment confirmation
        if (paymentMethod === "razorpay" && paymentId) {
          toast.loading("Payment confirmed! Creating your order...", { id: 'order-processing' });
        }

      // ⚡ STEP 5: Stock availability check
      // Uses direct SELECT — safe, no RPC dependency.
      // Once sql/RUN_THIS_IN_SUPABASE_SQL_EDITOR.sql is run in Supabase Dashboard,
      // this will automatically upgrade to atomic RPC (reserve_stock).
      const hostelForReservation = selectedHostel === "Other" ? null : selectedHostel;

      const productIds = cartItems.map(i => i.product_id);
      const { data: stockData, error: stockFetchErr } = await supabase
        .from('products')
        .select('id, stock_quantity, hostel_stock')
        .in('id', productIds);

      if (stockFetchErr) throw new Error('Failed to check stock: ' + stockFetchErr.message);

      const failedItems = cartItems.filter(item => {
        const prod = (stockData || []).find(p => p.id === item.product_id);
        if (!prod) return true;
        let available = prod.stock_quantity || 0;
        if (hostelForReservation && prod.hostel_stock &&
            typeof prod.hostel_stock[hostelForReservation] === 'number') {
          available = prod.hostel_stock[hostelForReservation];
        }
        return available < item.quantity;
      });

      if (failedItems.length > 0) {
        const failedIds = failedItems.map(f => f.product_id);
        setCartItems(prev => prev.filter(i => !failedIds.includes(i.product_id)));
        const names = failedItems.map(f => f.product_name).join(', ');
        toast.error(`${names} went out of stock and was removed from your cart.`);
        setIsPlacingOrder(false);
        toast.dismiss(loadingToast);
        return;
      }

      // ⚡ STEP 6: Prepare order data (synchronous operations)
      const orderNumber = `CC${Date.now()}`;
      const orderItems = cartItems.map(item => {
        const product = products[item.product_id];
        const dhabaName = selectedDhaba[item.product_id];
        return {
          product_id:   item.product_id,
          product_name: product?.name || "",
          price:        getProductPrice(product) || 0,
          quantity:     item.quantity,
          dhaba_name:   dhabaName || null,
          hostel:       selectedHostel === "Other" ? null : selectedHostel
        };
      });
      
      const fullAddress = selectedHostel === "Other" 
        ? customAddress 
        : `${selectedHostel} Hostel, Room No: ${roomNumber}`;

      const finalAmount = calculateTotal();
      
      // Generate 4-digit delivery OTP
      const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));

      // Prepare scheduled time if order is scheduled
      let scheduledDateTime = null;
      let orderStatus = "confirmed";
      
      if (isScheduledOrder) {
        scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        orderStatus = "scheduled";
      }

      // ⚡ STEP 7: Create order with retry logic
      const newOrder = await withRetry(
        async () => {
          return await Order.create({
            user_id: user.id,
            order_number: orderNumber,
            customer_name: customerName,
            items: orderItems,
            hostel_id: selectedHostel === "Other" ? null : selectedHostel,
            total_amount: finalAmount,
            subtotal_before_fees: calculateSubtotal(),
            small_cart_fee: checkoutCharges?.smallCartFee || 0,
            handling_fee: checkoutCharges?.handlingFee || 0,
            delivery_fee: calculateShippingCharge(),
            delivery_address: fullAddress,
            phone_number: phoneNumber,
            delivery_notes: deliveryNotes,
            status: orderStatus,
            payment_method: paymentMethod,
            is_paid: paymentMethod === "razorpay" ? true : false,
            payment_id: paymentId || null,
            delivery_otp: deliveryOtp,
            is_scheduled: isScheduledOrder,
            scheduled_time: scheduledDateTime ? scheduledDateTime.toISOString() : null
          });
        },
        3,
        [1000, 2000, 4000],
        (attempt) => setRetryMessage(`Retrying... (attempt ${attempt} of 3)`)
      );

      // Clear retry message on success
      setRetryMessage('');

      // Start payment timer after order creation
      if (newOrder?.id && paymentMethod === 'razorpay') {
        startPaymentTimer(newOrder.id);
      }

      // ⚡ STEP 8: Post-order operations (run in parallel for speed)
      // These operations don't need to block the user from seeing success
      const postOrderOperations = async () => {
        try {
          // Parallel operations that can happen simultaneously
          await Promise.all([
            // Clear cart items
            ...cartItems.map(item => CartItem.delete(item.id)),
            
            // Update user info
            User.updateMyUserData({
              full_name: customerName,
              phone_number: phoneNumber
            }),
            
            // Redeem loyalty points if applicable
            pointsToRedeem > 0 ? base44.entities.LoyaltyTransaction.create({
              user_id: user.id,
              points: -loyaltyPoints,
              transaction_type: "redeemed",
              order_id: newOrder.id,
              description: `Redeemed all ${loyaltyPoints} points for ₹${(loyaltyPoints / 10).toFixed(2)} discount on order ${orderNumber}`,
              balance_after: 0
            }) : Promise.resolve(),
            
            // Track campaign usage if applicable
            appliedCampaign ? Promise.all([
              base44.entities.CampaignUsage.create({
                campaign_id: appliedCampaign.id,
                user_id: user.id,
                order_id: newOrder.id,
                discount_amount: calculateCampaignDiscount(),
                order_amount: finalAmount
              }),
              base44.entities.Campaign.update(appliedCampaign.id, {
                usage_count: (appliedCampaign.usage_count || 0) + 1,
                total_revenue: (appliedCampaign.total_revenue || 0) + finalAmount,
                total_discount_given: (appliedCampaign.total_discount_given || 0) + calculateCampaignDiscount()
              })
            ]) : Promise.resolve()
          ]);

          // Award loyalty points with tier-based multiplier
          const tierMultipliers = {
            Bronze: 1,
            Silver: 1.5,
            Gold: 2,
            Platinum: 3
          };
          
          const userTier = user.loyalty_tier || "Bronze";
          const basePoints = Math.floor(finalAmount * 0.05);
          const multiplier = tierMultipliers[userTier];
          const pointsEarned = Math.floor(basePoints * multiplier);
          
          // Bonus points for orders above certain amounts
          let bonusPoints = 0;
          if (finalAmount >= 1000) bonusPoints += 50;
          if (finalAmount >= 2000) bonusPoints += 100;
          if (finalAmount >= 3000) bonusPoints += 200;
          
          const totalPointsEarned = pointsEarned + bonusPoints;
          
          await base44.entities.LoyaltyTransaction.create({
            user_id: user.id,
            points: totalPointsEarned,
            transaction_type: "earned",
            order_id: newOrder.id,
            description: bonusPoints > 0 
              ? `Earned ${totalPointsEarned} points (${pointsEarned} base + ${bonusPoints} bonus) from order ${orderNumber}`
              : `Earned ${totalPointsEarned} points from order ${orderNumber} (${multiplier}x ${userTier} multiplier)`,
            balance_after: (loyaltyPoints - pointsToRedeem) + totalPointsEarned
          });

          // Notify delivery persons (non-blocking)
          DeliveryPerson.list().then(allDeliveryPersons => {
            Promise.all(
              allDeliveryPersons.map(person => 
                Notification.create({
                  user_id: person.email,
                  title: "New Order Available!",
                  message: `Order #${orderNumber} for ₹${finalAmount.toFixed(2)} is ready for pickup`,
                  type: "info"
                })
              )
            );
          });

          // Create success notification
          const notificationTitle = isScheduledOrder 
            ? "Order Scheduled Successfully!" 
            : "Order Placed Successfully!";
          
          const notificationMessage = isScheduledOrder
            ? `Your order ${orderNumber} has been scheduled for ${new Date(scheduledDateTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}! You earned ${totalPointsEarned} loyalty points!`
            : `Your order ${orderNumber} has been placed! You earned ${totalPointsEarned} loyalty points!`;

          await Notification.create({
            user_id: user.id,
            title: notificationTitle,
            message: notificationMessage,
            type: "success"
          });

          // Play notification sound
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play();
          } catch (error) {
            console.log("Could not play notification sound");
          }
        } catch (error) {
          console.error("Post-order operations error:", error);
          // Don't block user experience if post-order operations fail
        }
      };

      // ⚡ STEP 9: Show immediate success feedback (don't wait for post-order operations)
      const notificationTitle = isScheduledOrder 
        ? "Order Scheduled Successfully!" 
        : "Order Placed Successfully!";
      
      const notificationMessage = isScheduledOrder
        ? `Your order ${orderNumber} has been scheduled!`
        : `Your order ${orderNumber} has been placed!`;

      toast.success(notificationTitle, { description: notificationMessage, duration: 5000, id: 'order-processing' });
      
      // Navigate immediately (better UX)
      navigate(createPageUrl('Orders'));
      
      // Run post-order operations in background (non-blocking)
      postOrderOperations();

    } catch (error) {
      // Log error to database
      await logErrorToDB('API', error.message, '/cart', error.stack);
      
      console.error("Error placing order:", error);
      
      // Show error notification
      await Notification.create({
        user_id: user.id,
        title: "Order Failed",
        message: "There was an error placing your order. Please try again.",
        type: "error"
      });
      
      toast.error("Order failed. Please try again.", { id: 'order-processing' });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {Array(3).fill(0).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="w-20 h-20" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
          <ShoppingBag className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h2>
        <p className="text-gray-600 mb-8">Add some products to get started!</p>
        <Button
          onClick={() => navigate(createPageUrl('Shop'))}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          Continue Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 py-4 sm:px-6 space-y-3 sm:space-y-6 pb-tab-bar page-enter">
      {/* Progress Bar at Top */}
      <DeliveryProgressBar 
        subtotal={calculateSubtotal()} 
        settings={settings} 
        isFirstOrder={isFirstOrder}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BackButton to={createPageUrl('Shop')} className="md:hidden" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">My Cart</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl('Shop'))}
          className="h-8 w-8 hidden md:flex"
        >
          <span className="text-xl">×</span>
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-3 sm:gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-2 sm:space-y-4">
          <AnimatePresence>
            {cartItems.map((item) => {
              const product = products[item.product_id];
              if (!product) return null;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card className="shadow-sm">
                    <CardContent className="p-2 sm:p-4">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <ProductImage
                          src={product.image_url}
                          alt={product.name}
                          className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-xs sm:text-sm leading-tight mb-1">{product.name}</h3>
                          {product.dhaba_options?.length > 0 ? (
                            <div className="mt-1">
                              <Select 
                                value={selectedDhaba[product.id] || ""} 
                                onValueChange={(value) => setSelectedDhaba({ ...selectedDhaba, [product.id]: value })}
                              >
                                <SelectTrigger className="h-6 text-[10px] sm:text-xs">
                                  <SelectValue placeholder="Select Dhaba" />
                                </SelectTrigger>
                                <SelectContent>
                                  {product.dhaba_options.map((option, idx) => (
                                    <SelectItem key={idx} value={option.dhaba_name}>
                                      {option.dhaba_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <p className="text-emerald-600 font-medium text-[10px] sm:text-xs">{product.quantity} × ₹{getProductPrice(product)}</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1 sm:gap-1.5">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="h-6 w-6 sm:h-7 sm:w-7 rounded-sm"
                              >
                                <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              </Button>
                              <span className="font-bold px-1.5 sm:px-2 text-xs sm:text-sm min-w-[20px] text-center">{item.quantity}</span>
                              <Button
                                size="icon"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="h-6 w-6 sm:h-7 sm:w-7 bg-emerald-600 hover:bg-emerald-700 rounded-sm"
                              >
                                <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-xs sm:text-sm text-gray-900">₹{(getProductPrice(product) * item.quantity).toFixed(0)}</p>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(item.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-6 w-6"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Subscription Promo Banner */}
          {!isPremiumUser && (
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-xl p-3 flex items-center gap-3">
              <div className="text-2xl">👑</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-yellow-900 text-sm">Get FREE delivery with ₹99/month!</p>
                <p className="text-xs text-yellow-700 mt-0.5">Subscribe now → Free delivery on every order + Priority service</p>
              </div>
              <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs flex-shrink-0" onClick={() => navigate('/Subscription')}>
                Subscribe
              </Button>
            </div>
          )}

          {/* Recommended Products */}
          <RecommendedProducts
            onAddToCart={addToCart} 
            cartItems={cartItems}
            amountNeededForFreeDelivery={
              settings && calculateShippingCharge() > 0
                ? (isFirstOrder ? settings.first_order_threshold : settings.free_delivery_above) - calculateSubtotal()
                : 0
            }
          />


        </div>

        {/* Order Summary */}
        <div className="space-y-3 sm:space-y-4">
          <Card className="lg:sticky lg:top-6 shadow-sm">
            <CardHeader className="pb-2 sm:pb-4 p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Delivery Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-6 pt-0">
              <div className="space-y-2 sm:space-y-3">
                <div>
                  <Label htmlFor="customer-name" className="text-xs sm:text-sm">Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="customer-name"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: "" }));
                    }}
                    placeholder="Your name"
                    className={`h-8 sm:h-10 text-xs sm:text-sm ${fieldErrors.name ? 'border-red-500' : ''}`}
                    required
                  />
                  {fieldErrors.name && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="phone-number" className="text-xs sm:text-sm">Phone <span className="text-red-500">*</span></Label>
                  <Input
                    id="phone-number"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      // Only allow numbers
                      const value = e.target.value.replace(/[^\d]/g, '');
                      setPhoneNumber(value);
                      if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: "" }));
                    }}
                    placeholder="10-digit mobile number (e.g., 9876543210)"
                    className={`h-8 sm:h-10 text-xs sm:text-sm ${fieldErrors.phone ? 'border-red-500' : ''}`}
                    maxLength={10}
                    required
                  />
                  {fieldErrors.phone && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.phone}</p>
                  )}
                </div>
                 <div>
                  <Label className="text-xs sm:text-sm">Location <span className="text-red-500">*</span></Label>
                  <div id="hostel-select" className={`bg-emerald-50 border rounded p-2 flex items-center justify-between ${fieldErrors.hostel ? 'border-red-500' : 'border-emerald-200'}`}>
                    <div>
                      <p className="text-[10px] sm:text-xs text-gray-600">Delivering to</p>
                      <p className="text-xs sm:text-sm font-semibold text-gray-900">
                        {selectedHostel === "Other" ? "Other" : `${selectedHostel}`}
                      </p>
                    </div>
                    {isPremiumUser && (
                      <span className="text-[10px] bg-yellow-100 text-yellow-700 border border-yellow-300 rounded-full px-2 py-0.5 font-semibold flex items-center gap-1">
                        👑 Free Delivery
                      </span>
                    )}
                  </div>
                  {fieldErrors.hostel && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.hostel}</p>
                  )}
                 </div>

                 {selectedHostel === "Other" ? (
                  <div>
                    <Label htmlFor="custom-address" className="text-xs sm:text-sm">Address <span className="text-red-500">*</span></Label>
                    <Textarea
                      id="custom-address"
                      value={customAddress}
                      onChange={(e) => {
                        setCustomAddress(e.target.value);
                        if (fieldErrors.address) setFieldErrors(prev => ({ ...prev, address: "" }));
                      }}
                      placeholder="Complete address with landmarks"
                      rows={2}
                      className={`text-xs sm:text-sm ${fieldErrors.address ? 'border-red-500' : ''}`}
                      required
                    />
                    {fieldErrors.address && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.address}</p>
                    )}
                  </div>
                 ) : (
                  <div>
                    <Label htmlFor="room-number" className="text-xs sm:text-sm">Room No. <span className="text-red-500">*</span></Label>
                    <Input
                      id="room-number"
                      value={roomNumber}
                      onChange={(e) => {
                        setRoomNumber(e.target.value);
                        if (fieldErrors.room) setFieldErrors(prev => ({ ...prev, room: "" }));
                      }}
                      placeholder="e.g., 101, A-205"
                      className={`h-8 sm:h-10 text-xs sm:text-sm ${fieldErrors.room ? 'border-red-500' : ''}`}
                      disabled={!selectedHostel || selectedHostel === "Other"}
                      required={selectedHostel !== "Other"}
                    />
                    {fieldErrors.room && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.room}</p>
                    )}
                  </div>
                 )}
                <div>
                  <Label htmlFor="notes" className="text-xs sm:text-sm">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Special instructions..."
                    rows={2}
                    className="text-xs sm:text-sm"
                  />
                </div>

                {/* Schedule Order Option */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="schedule-order"
                        checked={isScheduledOrder}
                        onChange={(e) => {
                          setIsScheduledOrder(e.target.checked);
                          if (e.target.checked) {
                            // Auto-set to today's date (hidden from user)
                            const now = new Date();
                            setScheduledDate(now.toISOString().split('T')[0]);
                            
                            // Auto-set time to 15 minutes from now (rounded to nearest 5 min)
                            const futureTime = new Date(now.getTime() + 15 * 60 * 1000);
                            const minutes = Math.ceil(futureTime.getMinutes() / 5) * 5;
                            futureTime.setMinutes(minutes);
                            futureTime.setSeconds(0);
                            const timeString = futureTime.toTimeString().slice(0, 5);
                            setScheduledTime(timeString);
                          } else {
                            setScheduledDate("");
                            setScheduledTime("");
                            setFieldErrors(prev => ({ ...prev, scheduledTime: "" }));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <Label htmlFor="schedule-order" className="text-xs sm:text-sm font-semibold text-blue-900 cursor-pointer">
                        📅 Schedule Order (Within 30 mins)
                      </Label>
                    </div>
                  </div>
                  
                  {isScheduledOrder && (
                    <div className="space-y-2 mt-3">
                      <div>
                        <Label htmlFor="scheduled-time" className="text-xs text-blue-900">Delivery Time <span className="text-red-500">*</span></Label>
                        <Input
                          id="scheduled-time"
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => {
                            setScheduledTime(e.target.value);
                            // Auto-update date to today when time changes
                            setScheduledDate(new Date().toISOString().split('T')[0]);
                            if (fieldErrors.scheduledTime) setFieldErrors(prev => ({ ...prev, scheduledTime: "" }));
                          }}
                          step="300"
                          className={`h-9 text-sm ${fieldErrors.scheduledTime ? 'border-red-500' : ''}`}
                          required={isScheduledOrder}
                        />
                        {fieldErrors.scheduledTime && (
                          <p className="text-red-500 text-[10px] mt-0.5">{fieldErrors.scheduledTime}</p>
                        )}
                      </div>
                      <div className="bg-blue-100 rounded p-2">
                        <p className="text-[10px] text-blue-800 font-medium">
                          ⏰ Schedule between 10-30 minutes from now (Today)
                        </p>
                        <p className="text-[9px] text-blue-700 mt-0.5">
                          Your order will be prepared and delivered at the scheduled time
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {hasDhabaProducts() && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2">
                    <p className="text-[10px] sm:text-xs text-amber-800 font-medium">
                      🍽️ Select dhaba for items above
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="payment" className="text-xs sm:text-sm">Payment <span className="text-red-500">*</span></Label>
                  <Select onValueChange={setPaymentMethod} value={paymentMethod} required>
                    <SelectTrigger id="payment" className="h-8 sm:h-10 text-xs sm:text-sm">
                      <SelectValue placeholder="Payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash on Delivery</SelectItem>
                      <SelectItem value="razorpay">Online Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Timeout Countdown */}
                {paymentTimeLeft !== null && paymentMethod === "razorpay" && (
                  <div style={{
                    background: paymentTimeLeft < 60 ? '#FEE2E2' : '#FEF9C3',
                    border: `1px solid ${paymentTimeLeft < 60 ? '#DC2626' : '#CA8A04'}`,
                    borderRadius: '8px',
                    padding: '10px 16px',
                    marginBottom: '12px',
                    textAlign: 'center',
                    fontWeight: 600,
                    color: paymentTimeLeft < 60 ? '#DC2626' : '#92400E'
                  }}>
                    ⏱ Payment expires in{' '}
                    {Math.floor(paymentTimeLeft / 60)}:{String(paymentTimeLeft % 60).padStart(2, '0')}
                    {paymentTimeLeft < 60 && ' — Complete payment now!'}
                  </div>
                )}

                {paymentMethod === "razorpay" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-blue-900">Online Payment</p>
                        <p className="text-xs text-blue-700">Pay securely with UPI, Cards, or Wallets</p>
                      </div>
                    </div>
                    <p className="text-xs text-blue-600">
                      Click "Continue to Pay" below to open Razorpay payment gateway
                    </p>
                  </div>
                )}

                {/* Discount Code */}
                <div className="bg-blue-50 border border-blue-200 rounded p-2">
                  <Label className="text-[10px] sm:text-xs font-semibold text-blue-900 mb-1.5 block">Discount Code</Label>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Code"
                      value={discountCode}
                      onChange={(e) => {
                        setDiscountCode(e.target.value.toUpperCase());
                        setCodeError("");
                      }}
                      disabled={!!appliedCampaign}
                      className="border-blue-300 h-7 sm:h-8 text-xs"
                    />
                    <Button
                      type="button"
                      onClick={appliedCampaign ? () => { setAppliedCampaign(null); setDiscountCode(""); } : applyDiscountCode}
                      variant="outline"
                      size="sm"
                      className={`h-7 sm:h-8 text-[10px] sm:text-xs px-2 ${appliedCampaign ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}
                    >
                      {appliedCampaign ? "Remove" : "Apply"}
                    </Button>
                  </div>
                  {codeError && <p className="text-[9px] sm:text-xs text-red-600 mt-0.5">{codeError}</p>}
                  {appliedCampaign && (
                    <p className="text-[9px] sm:text-xs text-green-600 mt-0.5 font-medium">
                      ✓ {appliedCampaign.name} applied!
                    </p>
                  )}
                </div>

                {/* Loyalty Points Redemption - Weekend Only (Saturday & Sunday) */}
                {(() => { 
                  const dayOfWeek = new Date().getDay(); 
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
                  return isWeekend && loyaltyPoints >= 100; 
                })() && (
                  <div className="bg-gradient-to-r from-yellow-50 to-emerald-50 border border-emerald-200 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                        <span className="text-white font-bold text-sm">★</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs sm:text-sm font-bold text-gray-900 block">🎉 Weekend Reward!</Label>
                        <p className="text-[10px] sm:text-xs text-gray-600">
                          You have <span className="font-semibold text-emerald-600">{loyaltyPoints} points</span> = ₹{(loyaltyPoints / 10).toFixed(2)} off
                        </p>
                      </div>
                    </div>
                    {pointsToRedeem > 0 ? (
                      <div className="flex items-center justify-between bg-emerald-100 rounded-lg p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-600 text-lg">✓</span>
                          <p className="text-xs sm:text-sm font-semibold text-emerald-800">
                            Saving ₹{(pointsToRedeem / 10).toFixed(2)}
                          </p>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] sm:text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2" 
                          onClick={() => setPointsToRedeem(0)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPointsToRedeem(loyaltyPoints)}
                        className="w-full h-8 sm:h-9 text-[10px] sm:text-xs font-semibold bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400 transition-all"
                      >
                        <span className="mr-1">🎁</span>
                        Redeem All {loyaltyPoints} pts → Save ₹{(loyaltyPoints / 10).toFixed(2)}
                      </Button>
                    )}
                  </div>
                )}
                </div>

                <div className="border-t pt-2 space-y-1.5">
                <div className="flex justify-between text-[10px] sm:text-xs">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₹{calculateSubtotal().toFixed(0)}</span>
                </div>
                
                {/* Small Cart Fee */}
                {checkoutCharges?.smallCartFee > 0 && (
                  <div className="flex justify-between text-[10px] sm:text-xs">
                    <span className="text-gray-600 flex items-center gap-1">
                      Small Cart Fee
                      <span className="text-[8px] text-gray-400">
                        (below ₹{checkoutCharges?.threshold})
                      </span>
                    </span>
                    <span className="font-medium text-amber-600">
                      +₹{checkoutCharges.smallCartFee.toFixed(0)}
                    </span>
                  </div>
                )}
                
                {/* Handling Fee - Show appropriate fee based on delivery status */}
                {(() => {
                  const shipping = calculateShippingCharge();
                  const isFreeDelivery = shipping === 0;
                  const showFreeDeliveryHandling = isFreeDelivery && 
                    checkoutCharges?.settings?.free_delivery_handling_enabled;
                  const showRegularHandling = !isFreeDelivery && 
                    checkoutCharges?.handlingFee > 0;
                  
                  if (showFreeDeliveryHandling) {
                    return (
                      <div className="flex justify-between text-[10px] sm:text-xs">
                        <span className="text-gray-600 flex items-center gap-1">
                          Handling Fee
                          <span className="text-[8px] text-gray-400">
                            (free delivery)
                          </span>
                        </span>
                        <span className="font-medium text-blue-600">
                          +₹{checkoutCharges.settings.free_delivery_handling_fee.toFixed(0)}
                        </span>
                      </div>
                    );
                  } else if (showRegularHandling) {
                    return (
                      <div className="flex justify-between text-[10px] sm:text-xs">
                        <span className="text-gray-600">Handling Fee</span>
                        <span className="font-medium">+₹{checkoutCharges.handlingFee.toFixed(0)}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                <div className="flex justify-between text-[10px] sm:text-xs">
                  <span className="text-gray-600">Delivery</span>
                  <span className="font-medium">
                    {calculateShippingCharge() === 0 ? (
                      <span className="text-green-600">FREE</span>
                    ) : (
                      `₹${calculateShippingCharge().toFixed(0)}`
                    )}
                  </span>
                </div>
                {appliedCampaign && calculateCampaignDiscount() > 0 && (
                  <div className="flex justify-between text-[10px] sm:text-xs text-blue-600">
                    <span>Discount ({appliedCampaign.code})</span>
                    <span className="font-medium">-₹{calculateCampaignDiscount().toFixed(0)}</span>
                  </div>
                )}
                {appliedCampaign?.discount_type === 'free_shipping' && calculateShippingCharge() > 0 && (
                  <div className="flex justify-between text-[10px] sm:text-xs text-blue-600">
                    <span>Free Shipping</span>
                    <span className="font-medium">-₹{calculateShippingCharge().toFixed(0)}</span>
                  </div>
                )}
                {pointsToRedeem > 0 && (
                  <div className="flex justify-between text-[10px] sm:text-xs text-emerald-600">
                    <span>Points</span>
                    <span className="font-medium">-₹{calculatePointsDiscount().toFixed(0)}</span>
                  </div>
                )}
                
                {/* Helpful message for small cart fee */}
                {checkoutCharges?.shouldApplySmallCartFee && checkoutCharges?.threshold && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                    <p className="text-[9px] sm:text-[10px] text-amber-700">
                      Add Rs.{(checkoutCharges.threshold - calculateSubtotal()).toFixed(0)} more to avoid small cart fee
                    </p>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-sm sm:text-base font-bold pt-1.5 border-t">
                  <span>Total</span>
                  <span className="text-emerald-600">₹{calculateTotal().toFixed(0)}</span>
                </div>
              </div>
              
              {/* Payment countdown above Place Order button */}
              {paymentTimeLeft !== null && (
                <div style={{
                  background: paymentTimeLeft < 60 ? '#FEE2E2' : '#FEF9C3',
                  border: `1px solid ${paymentTimeLeft < 60 ? '#DC2626' : '#CA8A04'}`,
                  borderRadius: '8px',
                  padding: '10px 16px',
                  marginBottom: '8px',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: paymentTimeLeft < 60 ? '#DC2626' : '#92400E'
                }}>
                  ⏱ Payment expires in{' '}
                  {Math.floor(paymentTimeLeft / 60)}:{String(paymentTimeLeft % 60).padStart(2, '0')}
                  {paymentTimeLeft < 60 && ' — Complete payment now!'}
                </div>
              )}
              
              <Button
                onClick={() => {
                  if (paymentMethod === "razorpay") {
                    handleRazorpayPayment();
                  } else {
                    placeOrder();
                  }
                }}
                disabled={isPlacingOrder || cartItems.length === 0 || calculateSubtotal() === 0 || rateLimitCountdown > 0}
                className="w-full h-9 sm:h-10 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95"
              >
                {isPlacingOrder ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : paymentMethod === "razorpay" ? "Continue to Pay" : "Place Order"}
              </Button>
              
              {/* Retry message display */}
              {retryMessage && (
                <p style={{ color: '#6366F1', fontSize: '13px', textAlign: 'center', marginTop: '8px' }}>
                  🔄 {retryMessage}
                </p>
              )}

              {/* Rate limit countdown display */}
              {rateLimitCountdown > 0 && (
                <p style={{ color: '#DC2626', fontSize: '13px', textAlign: 'center', marginTop: '8px', fontWeight: 600 }}>
                  ⏳ Please wait {rateLimitCountdown} seconds before placing another order
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}