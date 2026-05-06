import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  Truck, MapPin, Phone, Package, CheckCircle, Loader2, Lock, User,
  XCircle, AlertTriangle, Clock, Wallet, ChevronRight, MessageSquare,
  Shield, ArrowLeft, QrCode
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import ShiftSelector from "../components/delivery/ShiftSelector";
import OTPVerificationDialog from "../components/delivery/OTPVerificationDialog";
import WalletDashboard from "../components/delivery/WalletDashboard";
import CODPaymentCollector from "../components/delivery/CODPaymentCollector";
import RaiseQuery from "../components/delivery/RaiseQuery";
import { supabase } from "@/lib/supabase";
import { useDialog } from "@/components/ui/alert-dialog-custom";
import {
  deductStockOnDelivery,
  releaseStockOnCancel,
  notifyStockErrors
} from "@/utils/inventoryService";

export default function Delivery() {
  const { warning } = useDialog();
  const [deliveryPerson, setDeliveryPerson] = useState(null);
  const [assignedOrders, setAssignedOrders] = useState([]);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // Email/Password login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [acceptingOrderId, setAcceptingOrderId] = useState(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);
  const [showShiftSelector, setShowShiftSelector] = useState(false);
  const [otpDialog, setOtpDialog] = useState({ open: false, order: null });
  const [activeTab, setActiveTab] = useState("orders");
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [lifetimeEarnings, setLifetimeEarnings] = useState(0);
  const [loginPopup, setLoginPopup] = useState(null);

  // COD overdue blocking state
  const [codOverdue, setCodOverdue] = useState(false);
  const [codOverdueAmount, setCodOverdueAmount] = useState(0);
  const [addingToWallet, setAddingToWallet] = useState(false);

  // COD collection UI state
  const [codProcessing, setCodProcessing] = useState({});
  const [codInitiated, setCodInitiated] = useState({});
  const [onlineOtp, setOnlineOtp] = useState({});
  const [paymentLinks, setPaymentLinks] = useState({}); // Store payment links
  
  // QR Code modal state
  const [qrModal, setQrModal] = useState({ open: false, order: null, qrUrl: null, amount: 0 });
  const [qrLoading, setQrLoading] = useState(false);
  
  // OTP state for delivery confirmation
  const [otpValues, setOtpValues] = useState({});
  const [otpAttempts, setOtpAttempts] = useState({});

  // OTP countdown timer removed - using email/password login now

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Please enter both email and password');
      return;
    }
    
    setIsLoggingIn(true);
    setLoginError('');
    
    try {
      // Find delivery person by email and password
      const all = await base44.entities.DeliveryPerson.list().catch(() => []);
      const found = all.find(p => 
        p.email?.toLowerCase().trim() === loginEmail.toLowerCase().trim() &&
        p.password === loginPassword
      );
      
      if (!found) {
        setLoginError('Invalid email or password');
        setIsLoggingIn(false);
        return;
      }
      
      if (found.is_blocked) {
        setLoginError('Account blocked. Contact admin.');
        setIsLoggingIn(false);
        return;
      }
      
      localStorage.setItem('deliveryPerson', JSON.stringify(found));
      setDeliveryPerson(found);
      await loadOrders(found.id, found);
      
      const unreadNotifs = await base44.entities.Notification.filter({ 
        user_id: found.id, 
        is_read: false 
      }).catch(() => []);
      
      const approvalNotif = unreadNotifs.find(n => 
        n.title?.includes("Approved") || 
        n.title?.includes("Withdrawal") || 
        n.title?.includes("Top-up")
      );
      
      if (approvalNotif) {
        setLoginPopup({ 
          id: approvalNotif.id, 
          title: approvalNotif.title, 
          message: approvalNotif.message 
        });
      }
      
      setLoginEmail('');
      setLoginPassword('');
      setIsLoggingIn(false);
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Login failed. Please try again.');
      setIsLoggingIn(false);
    }
  };

  const loadOrders = useCallback(async (personId, person) => {
    const [preparing, outForDelivery, confirmed, scheduled] = await Promise.all([
      base44.entities.Order.filter({ delivery_person_id: personId, status: "preparing" }, '-created_date', 20).catch(() => []),
      base44.entities.Order.filter({ delivery_person_id: personId, status: "out_for_delivery" }, '-created_date', 20).catch(() => []),
      base44.entities.Order.filter({ status: "confirmed" }, '-created_date', 50).catch(() => []),
      base44.entities.Order.filter({ status: "scheduled" }, '-created_date', 50).catch(() => []),
    ]);
    setAssignedOrders([...preparing, ...outForDelivery]);
    // Filter available orders by assigned hostel - include both confirmed and scheduled orders
    const allAvailable = [...confirmed, ...scheduled];
    const unassigned = allAvailable.filter(o => !o.delivery_person_id);
    setAvailableOrders(unassigned);
  }, []);

  const checkShiftExpiry = useCallback(() => {
    // Shift expiry is now managed by admin-defined shifts; no-op here
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const saved = localStorage.getItem('deliveryPerson');
      if (saved) {
        try {
          const person = JSON.parse(saved);
          const fresh = await base44.entities.DeliveryPerson.filter({ id: person.id }).catch(() => []);
          let freshPerson = fresh[0] || person;
          if (freshPerson.is_blocked) {
            localStorage.removeItem('deliveryPerson');
          } else {
            // Auto-offline: if COD cash has not been submitted for >24hr, force offline
            if (freshPerson.wallet_balance < 0 && freshPerson.is_available) {
              const codTxns = await base44.entities.WalletTransaction.filter(
                { delivery_person_id: freshPerson.id, type: "cod_collection" },
                '-created_date', 1
              ).catch(() => []);
              if (codTxns.length > 0) {
                const hoursSince = (Date.now() - new Date(codTxns[0].created_date).getTime()) / (1000 * 60 * 60);
                if (hoursSince >= 24) {
                  await base44.entities.DeliveryPerson.update(freshPerson.id, { is_available: false, current_shift: null });
                  freshPerson = { ...freshPerson, is_available: false, current_shift: null };
                }
              }
            }
            setDeliveryPerson(freshPerson);
            localStorage.setItem('deliveryPerson', JSON.stringify(freshPerson));
            await loadOrders(freshPerson.id, freshPerson);
            // Load today's commission earnings from transactions
            const todayStr = new Date().toDateString();
            const txns = await base44.entities.WalletTransaction.filter({ delivery_person_id: freshPerson.id }, '-created_date', 100).catch(() => []);
            const earn = txns.filter(t => new Date(t.created_date).toDateString() === todayStr && t.type === "delivery_earning").reduce((s, t) => s + (t.amount || 0), 0);
            setTodayEarnings(earn);
            setLifetimeEarnings(freshPerson.lifetime_earnings || 0);
            // Check for unread approval notifications
            const unreadNotifs = await base44.entities.Notification.filter({ user_id: freshPerson.id, is_read: false }).catch(() => []);
            const approvalNotif = unreadNotifs.find(n => n.title?.includes("Approved") || n.title?.includes("Withdrawal") || n.title?.includes("Top-up"));
            if (approvalNotif) {
              setLoginPopup({ id: approvalNotif.id, title: approvalNotif.title, message: approvalNotif.message });
            }
          }
        } catch (e) {
          localStorage.removeItem('deliveryPerson');
        }
      }
      setIsLoading(false);
    };
    init();
  }, [loadOrders, checkShiftExpiry]);

  // ─── Refresh delivery person from DB (picks up admin changes) ──────────
  const refreshDeliveryPersonFromDB = useCallback(async () => {
    if (!deliveryPerson?.id) return;
    try {
      const { data: fresh } = await supabase
        .from('delivery_persons')
        .select('*')
        .eq('id', deliveryPerson.id)
        .single();
      if (fresh) {
        setDeliveryPerson(fresh);
        localStorage.setItem('deliveryPerson', JSON.stringify(fresh));
        // If admin cleared wallet/cod_held, dismiss any blocking popup
        if ((fresh.wallet_balance || 0) >= 0 && (!fresh.cod_held || fresh.cod_held <= 0)) {
          setCodOverdue(false);
          setCodOverdueAmount(0);
        }
      }
    } catch (e) {
      // silently fail
    }
  }, [deliveryPerson?.id]);

  // Check 24hr COD auto-offline rule
  const checkCODAutoOffline = useCallback(async (person) => {
    if (!person || !person.is_available || (person.wallet_balance || 0) >= 0) return;
    const codTxns = await base44.entities.WalletTransaction.filter(
      { delivery_person_id: person.id, type: "cod_collection" },
      '-created_date', 1
    ).catch(() => []);
    if (codTxns.length > 0) {
      const hoursSince = (Date.now() - new Date(codTxns[0].created_date).getTime()) / (1000 * 60 * 60);
      if (hoursSince >= 24) {
        await base44.entities.DeliveryPerson.update(person.id, { is_available: false, current_shift: null });
        const updated = { ...person, is_available: false, current_shift: null };
        setDeliveryPerson(updated);
        localStorage.setItem('deliveryPerson', JSON.stringify(updated));
      }
    }
  }, []);

  useEffect(() => {
    if (!deliveryPerson) return;

    // Poll every 15s as fallback
    const interval = setInterval(() => {
      checkCODAutoOffline(deliveryPerson).catch(() => {});
      refreshDeliveryPersonFromDB().catch(() => {});
    }, 15000);

    // ── Realtime: instant order updates ──────────────────────────────────
    const channel = supabase
      .channel(`orders_realtime_${deliveryPerson.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          const order = payload.new;
          const oldOrder = payload.old;
          const eventType = payload.eventType;

          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            if (!order) return;

            // New confirmed/scheduled order available for pickup
            if ((order.status === 'confirmed' || order.status === 'scheduled') && !order.delivery_person_id) {
              setAvailableOrders(prev => {
                const exists = prev.find(o => o.id === order.id);
                if (exists) return prev.map(o => o.id === order.id ? { ...o, ...order, created_date: order.created_at } : o);
                return [{ ...order, created_date: order.created_at }, ...prev];
              });
            }

            // Order assigned to this delivery person
            if (order.delivery_person_id === deliveryPerson.id &&
              (order.status === 'preparing' || order.status === 'out_for_delivery')) {
              setAssignedOrders(prev => {
                const exists = prev.find(o => o.id === order.id);
                if (exists) return prev.map(o => o.id === order.id ? { ...o, ...order, created_date: order.created_at } : o);
                return [{ ...order, created_date: order.created_at }, ...prev];
              });
              // Remove from available if it was there
              setAvailableOrders(prev => prev.filter(o => o.id !== order.id));
            }

            // Order delivered/cancelled — remove from both lists
            if (order.status === 'delivered' || order.status === 'cancelled') {
              setAssignedOrders(prev => prev.filter(o => o.id !== order.id));
              setAvailableOrders(prev => prev.filter(o => o.id !== order.id));
            }

            // Order taken by another delivery person — remove from available
            if (order.delivery_person_id && order.delivery_person_id !== deliveryPerson.id) {
              setAvailableOrders(prev => prev.filter(o => o.id !== order.id));
            }
          }

          if (eventType === 'DELETE' && oldOrder) {
            setAssignedOrders(prev => prev.filter(o => o.id !== oldOrder.id));
            setAvailableOrders(prev => prev.filter(o => o.id !== oldOrder.id));
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [deliveryPerson, checkCODAutoOffline, refreshDeliveryPersonFromDB]);

  const handleLogout = () => {
    localStorage.removeItem('deliveryPerson');
    setDeliveryPerson(null);
    setAssignedOrders([]);
    setAvailableOrders([]);
  };

  const handleGoOnline = async () => {
    // Always fetch fresh data from DB first — picks up any admin wallet resets
    let freshBalance = deliveryPerson.wallet_balance || 0;
    let freshCodHeld = 0;
    try {
      const { data: fresh } = await supabase
        .from('delivery_persons')
        .select('wallet_balance, cod_held, cod_held_since')
        .eq('id', deliveryPerson.id)
        .single();
      if (fresh) {
        freshBalance = fresh.wallet_balance || 0;
        freshCodHeld = fresh.cod_held || 0;
        // Sync state with latest DB values
        const updated = { ...deliveryPerson, wallet_balance: freshBalance, cod_held: freshCodHeld };
        setDeliveryPerson(updated);
        localStorage.setItem('deliveryPerson', JSON.stringify(updated));
        // Clear any stale popups if admin has reset
        if (freshBalance >= 0 && freshCodHeld <= 0) {
          setCodOverdue(false);
          setCodOverdueAmount(0);
        }
      }
    } catch (e) {
      // fallback to cached value
    }

    // Check COD overdue (>24hr held) — blocks going online
    const isOverdue = await checkCodSubmissionRequired();
    if (isOverdue) return;

    if (freshBalance < 0) {
      await warning(
        `You have ₹${Math.abs(freshBalance).toFixed(2)} in COD cash to submit. Please submit to admin first, then you can go online.`,
        'COD Cash Pending'
      );
      setActiveTab("wallet");
      return;
    }

    setShowShiftSelector(true);
  };

  const handleShiftSelected = async (shiftId) => {
    // Calculate shift_end_time from the selected shift's end_time
    let shiftEndTime = null;
    try {
      const shiftData = await base44.entities.DeliveryShift.filter({ id: shiftId }).catch(() => []);
      const shift = shiftData[0];
      if (shift?.end_time) {
        const [endH, endM] = shift.end_time.split(':').map(Number);
        const endDate = new Date();
        endDate.setHours(endH, endM, 0, 0);
        // If end time is earlier than now, it's tomorrow's shift
        if (endDate <= new Date()) {
          endDate.setDate(endDate.getDate() + 1);
        }
        shiftEndTime = endDate.toISOString();
      }
    } catch (e) {
      console.error('Could not calculate shift end time:', e);
    }

    const updateData = {
      is_available: true,
      current_shift: shiftId,
      ...(shiftEndTime ? { shift_end_time: shiftEndTime } : {})
    };

    // Also persist to supabase directly for shift_end_time (new column)
    try {
      await supabase.from('delivery_persons')
        .update(updateData)
        .eq('id', deliveryPerson.id);
    } catch (e) {
      // Fallback to base44 entity
      await base44.entities.DeliveryPerson.update(deliveryPerson.id, updateData);
    }

    const updated = { ...deliveryPerson, ...updateData };
    setDeliveryPerson(updated);
    localStorage.setItem('deliveryPerson', JSON.stringify(updated));
    setShowShiftSelector(false);
  };

  const handleGoOffline = async () => {
    setIsTogglingAvailability(true);
    const updated = { ...deliveryPerson, is_available: false, current_shift: null };
    await base44.entities.DeliveryPerson.update(deliveryPerson.id, { is_available: false, current_shift: null });
    setDeliveryPerson(updated);
    localStorage.setItem('deliveryPerson', JSON.stringify(updated));
    setIsTogglingAvailability(false);
  };

  const acceptOrder = async (orderId) => {
    setAcceptingOrderId(orderId);
    const order = availableOrders.find(o => o.id === orderId);
    setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
    setAssignedOrders(prev => [...prev, { ...order, status: "preparing", delivery_person_id: deliveryPerson.id }]);
    await Promise.all([
      base44.entities.Order.update(orderId, { delivery_person_id: deliveryPerson.id, status: "preparing" }),
      base44.entities.DeliveryPerson.update(deliveryPerson.id, { current_orders: [...(deliveryPerson.current_orders || []), orderId] })
    ]).catch(() => {});
    setAcceptingOrderId(null);
  };

  const markOutForDelivery = async (orderId) => {
    setUpdatingOrderId(orderId);
    const order = assignedOrders.find(o => o.id === orderId);
    setAssignedOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "out_for_delivery" } : o));
    await Promise.all([
      base44.entities.Order.update(orderId, { status: "out_for_delivery" }),
      order && base44.entities.Notification.create({ user_id: order.user_id, title: "Order Out for Delivery!", message: `Your order #${order.order_number} is on its way!`, type: "info" })
    ]).catch(() => {});
    setUpdatingOrderId(null);
  };

  const markOrderDelivered = async () => {
    const order = otpDialog.order;
    if (!order) return;
    setOtpDialog({ open: false, order: null });

    // Use cached person for instant UI — don't wait for DB fetch
    const freshPerson = deliveryPerson;

    const isCODPending = !order.is_paid && order.payment_method === "cash";
    const activeOrderCount = (freshPerson.current_orders || []).length;
    const commissionTiers = [0, 8, 12, 15];
    const prevTier = commissionTiers[Math.min(activeOrderCount, 3)];
    const newTier = commissionTiers[Math.min(activeOrderCount + 1, 3)];
    const commission = newTier - prevTier > 0 ? newTier - prevTier : 8;
    const codDeduction = isCODPending ? order.total_amount : 0;
    const newTotalDeliveries = (freshPerson.total_deliveries || 0) + 1;
    const newTotalEarnings = (freshPerson.total_earnings || 0) + commission;
    const newLifetimeEarnings = (freshPerson.lifetime_earnings || 0) + commission;
    const newWalletBalance = (freshPerson.wallet_balance || 0) - codDeduction;

    // ── Update UI instantly (optimistic) ─────────────────────────────────
    setAssignedOrders(prev => prev.filter(o => o.id !== order.id));
    setTodayEarnings(prev => prev + commission);
    setLifetimeEarnings(newLifetimeEarnings);
    const updatedPerson = { ...freshPerson, total_deliveries: newTotalDeliveries, total_earnings: newTotalEarnings, lifetime_earnings: newLifetimeEarnings, wallet_balance: newWalletBalance };
    setDeliveryPerson(updatedPerson);
    localStorage.setItem('deliveryPerson', JSON.stringify(updatedPerson));
    setUpdatingOrderId(null); // clear spinner immediately

    // ── Fire all DB writes in background (non-blocking) ──────────────────
    const dbWrites = async () => {
      // Stock reduction — atomic RPC with hostel support
      try {
        const stockResult = await deductStockOnDelivery(order);
        if (!stockResult.success) {
          console.error(`[Delivery] Stock deduction had errors for order ${order.order_number}:`, stockResult.errors);
        }
      } catch (err) {
        console.error(`[Delivery] Stock deduction failed for order ${order.order_number}:`, err);
      }

      const ops = [
        base44.entities.Order.update(order.id, { status: "delivered" }),
        base44.entities.DeliveryPerson.update(deliveryPerson.id, {
          total_deliveries: newTotalDeliveries,
          total_earnings: newTotalEarnings,
          lifetime_earnings: newLifetimeEarnings,
          wallet_balance: newWalletBalance,
          current_orders: (freshPerson.current_orders || []).filter(id => id !== order.id)
        }),
        base44.entities.WalletTransaction.create({
          delivery_person_id: deliveryPerson.id,
          amount: commission,
          type: "delivery_earning",
          description: `Commission for order #${order.order_number}`
        }),
        base44.entities.Notification.create({
          user_id: order.user_id,
          title: "Order Delivered!",
          message: `Your order #${order.order_number} has been delivered!`,
          type: "success"
        })
      ];

      if (isCODPending) {
        ops.push(
          base44.entities.WalletTransaction.create({
            delivery_person_id: deliveryPerson.id,
            amount: -codDeduction,
            type: "cod_collection",
            description: `COD cash collected for order #${order.order_number} — submit ₹${codDeduction.toFixed(2)} to admin`
          })
        );
      }

      await Promise.all(ops).catch(err => console.error('markOrderDelivered DB error:', err));
    };

    // Don't await — fire and forget so UI is instant
    dbWrites();
  };

  const cancelOrder = async () => {
    if (!orderToCancel || !cancellationReason.trim()) return;
    const orderId = orderToCancel.id;
    const order = assignedOrders.find(o => o.id === orderId);
    setShowCancelDialog(false);
    setAssignedOrders(prev => prev.filter(o => o.id !== orderId));

    // Release reserved stock on cancel (non-blocking)
    if (order) {
      releaseStockOnCancel(order).catch(err => {
        console.error(`[Delivery] Stock release on cancel failed for order ${order.order_number}:`, err);
      });
    }

    await Promise.all([
      base44.entities.Order.update(orderId, { status: "cancelled", delivery_person_id: null, cancellation_reason: cancellationReason, cancelled_by: deliveryPerson.name }),
      base44.entities.DeliveryPerson.update(deliveryPerson.id, { current_orders: (deliveryPerson.current_orders || []).filter(id => id !== orderId) }),
      order && base44.entities.Notification.create({ user_id: order.user_id, title: "Order Cancelled", message: `Your order #${order.order_number} was cancelled. Reason: ${cancellationReason}`, type: "error" })
    ]).catch(() => {});
    setOrderToCancel(null);
    setCancellationReason("");
  };

  const handleCODPaymentSuccess = (newBalance) => {
    const updated = { ...deliveryPerson, wallet_balance: newBalance };
    setDeliveryPerson(updated);
    localStorage.setItem('deliveryPerson', JSON.stringify(updated));
  };

  const handleCodCollection = async (order) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          cod_collected: true,
          cod_collected_at: new Date().toISOString(),
          cod_collected_by: deliveryPerson.id
        })
        .eq('id', order.id);

      if (error) {
        toast.error("Failed to mark cash collected. Try again.");
        return;
      }

      // Update partner's COD balance via RPC
      await supabase.rpc('increment_cod_balance', {
        p_partner_id: deliveryPerson.id,
        p_amount: order.total_amount
      }).catch(() => {
        // RPC may not exist yet — silently continue
      });

      // Update local state
      setAssignedOrders(prev =>
        prev.map(o => o.id === order.id ? { ...o, cod_collected: true } : o)
      );

      toast.success("Cash marked as collected. Your COD balance updated.");
    } catch (err) {
      console.error('COD collection error:', err);
      toast.error("Failed to mark cash collected.");
    }
  };

  const handleWalletUpdate = (updated) => {
    setDeliveryPerson(updated);
    localStorage.setItem('deliveryPerson', JSON.stringify(updated));
  };

  // ─── COD Submission Check ────────────────────────────────────────────────
  const checkCodSubmissionRequired = async () => {
    if (!deliveryPerson?.id) return false;
    try {
      const { data: partner } = await supabase
        .from('delivery_persons')
        .select('cod_held, cod_held_since, is_available, wallet_balance')
        .eq('id', deliveryPerson.id)
        .single();

      // If admin has reset wallet to 0 or positive, clear any blocking state
      if (!partner || (partner.wallet_balance || 0) >= 0) {
        setCodOverdue(false);
        setCodOverdueAmount(0);
        return false;
      }

      // wallet_balance is negative — use that as the actual amount owed
      const actualOwed = Math.abs(partner.wallet_balance);

      if (!partner.cod_held || partner.cod_held <= 0 || !partner.cod_held_since) {
        // No cod_held timing data, but wallet is negative — show overdue
        setCodOverdue(true);
        setCodOverdueAmount(actualOwed);
        return true;
      }

      const heldSince = new Date(partner.cod_held_since);
      const hoursHeld = (Date.now() - heldSince.getTime()) / (1000 * 60 * 60);

      if (hoursHeld >= 24) {
        setCodOverdue(true);
        setCodOverdueAmount(actualOwed);
        return true;
      }
      if (hoursHeld >= 20) {
        const hoursLeft = Math.ceil(24 - hoursHeld);
        import('sonner').then(({ toast }) => {
          toast.warning(
            `⚠️ Submit ₹${actualOwed.toFixed(2)} cash to admin within ${hoursLeft} hours or you cannot go online.`,
            { duration: 10000 }
          );
        });
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  // ─── Add to Wallet (clear COD via Razorpay) ─────────────────────────────
  const handleAddToWallet = async () => {
    setAddingToWallet(true);
    try {
      console.log('Creating wallet top-up payment for:', {
        partnerId: deliveryPerson.id,
        amount: codOverdueAmount,
        name: deliveryPerson.name,
        phone: deliveryPerson.phone,
        email: deliveryPerson.email
      });

      // Create Razorpay order for wallet top-up - use direct fetch to get error details
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-razorpay-cod-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ 
          orderId: `wallet_${deliveryPerson.id}_${Date.now()}`,
          amount: codOverdueAmount, 
          customerName: deliveryPerson.name,
          customerPhone: deliveryPerson.phone || '0000000000',
          customerEmail: deliveryPerson.email || 'partner@collegecart.in'
        })
      });

      const responseText = await response.text();
      console.log('Response status:', response.status);
      console.log('Response text:', responseText);

      if (!response.ok) {
        let errorMsg = 'Failed to create payment order';
        try {
          const errorData = JSON.parse(responseText);
          console.error('Error data:', errorData);
          errorMsg = errorData.error || errorData.message || errorMsg;
          if (errorData.details) errorMsg += ': ' + errorData.details;
        } catch (e) {
          errorMsg = responseText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const data = JSON.parse(responseText);
      console.log('Parsed response:', data);
      
      if (!data?.razorpayOrderId) {
        console.error('No razorpayOrderId in response:', data);
        throw new Error('Payment order ID not received');
      }

      // Open Razorpay checkout
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'CollegeCart',
        description: 'Wallet Top-up - COD Clearance',
        order_id: data.razorpayOrderId,
        handler: async function (response) {
          try {
            // Verify payment
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-cod-payment', {
              body: {
                orderId: `wallet_${deliveryPerson.id}`,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              }
            });

            if (verifyError || !verifyData?.success) {
              throw new Error('Payment verification failed');
            }

            // Clear COD balance — update wallet_balance and cod_held directly
            const { error: rpcError } = await supabase.rpc('clear_cod_via_wallet', {
              p_partner_id: deliveryPerson.id,
              p_payment_id: response.razorpay_payment_id,
              p_amount: codOverdueAmount
            });
            
            // If RPC doesn't exist, fall back to direct update
            if (rpcError) {
              console.warn('clear_cod_via_wallet RPC failed, using direct update:', rpcError.message);
              const { error: directError } = await supabase
                .from('delivery_persons')
                .update({ wallet_balance: 0, cod_held: 0, cod_held_since: null })
                .eq('id', deliveryPerson.id);
              if (directError) throw directError;
            }

            setCodOverdue(false);
            setCodOverdueAmount(0);
            
            const { data: fresh } = await supabase.from('delivery_persons').select('*').eq('id', deliveryPerson.id).single();
            if (fresh) { 
              setDeliveryPerson(fresh); 
              localStorage.setItem('deliveryPerson', JSON.stringify(fresh)); 
            }
            
            import('sonner').then(({ toast }) => {
              toast.success(`✅ ₹${codOverdueAmount} added to wallet. COD cleared. You can go online now.`);
            });
          } catch (err) {
            console.error('Payment verification error:', err);
            import('sonner').then(({ toast }) => { 
              toast.error('Payment verification failed. Contact admin if amount was deducted.'); 
            });
          } finally {
            setAddingToWallet(false);
          }
        },
        modal: {
          ondismiss: function() {
            setAddingToWallet(false);
            import('sonner').then(({ toast }) => { 
              toast.info('Payment cancelled. Please complete payment to unlock your account.'); 
            });
          }
        },
        theme: {
          color: '#10b981'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('Add to wallet error:', err);
      import('sonner').then(({ toast }) => { 
        toast.error('Payment failed. Try again or contact admin.'); 
      });
      setAddingToWallet(false);
    }
  };

  // ─── COD Cash Collection (Way 1) ────────────────────────────────────────
  const handleCashCollection = async (order) => {
    setCodProcessing(prev => ({ ...prev, [order.id]: true }));
    try {
      const { error } = await supabase.rpc('collect_cod_cash', {
        p_partner_id: deliveryPerson.id,
        p_order_id: order.id,
        p_amount: order.total_amount
      });
      if (error) throw error;
      setAssignedOrders(prev => prev.map(o => o.id === order.id ? { ...o, cod_collected: true, cod_collection_method: 'cash' } : o));
      const { data: fresh } = await supabase.from('delivery_persons').select('*').eq('id', deliveryPerson.id).single();
      if (fresh) { setDeliveryPerson(fresh); localStorage.setItem('deliveryPerson', JSON.stringify(fresh)); }
      import('sonner').then(({ toast }) => { toast.success('💵 Cash collected. Submit to admin within 24 hours.'); });
    } catch (err) {
      console.error('Cash collection error:', err);
      import('sonner').then(({ toast }) => { toast.error('Failed to record cash collection. Try again.'); });
    } finally {
      setCodProcessing(prev => ({ ...prev, [order.id]: false }));
    }
  };

  // ─── COD Online Collection (Way 2) ──────────────────────────────────────
  const handleOnlineCollection = async (order) => {
    setCodProcessing(prev => ({ ...prev, [order.id]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('create-cod-payment-link', {
        body: { orderId: order.id, amount: order.total_amount, customerName: order.customer_name, customerPhone: order.phone_number, customerEmail: 'customer@collegecart.in' }
      });
      if (error || !data?.paymentLink) throw new Error('Failed to create payment link');
      
      // Store the payment link for QR code generation
      setPaymentLinks(prev => ({ ...prev, [order.id]: data.paymentLink }));
      setCodInitiated(prev => ({ ...prev, [order.id]: 'online_pending' }));
      
      // Open payment link in new tab
      window.open(data.paymentLink, '_blank');
      
      import('sonner').then(({ toast }) => { 
        toast.success('Payment page opened. Ask customer to complete payment.'); 
      });
    } catch (err) {
      console.error('Online collection error:', err);
      import('sonner').then(({ toast }) => { toast.error('Failed to create payment link. Try again.'); });
    } finally {
      setCodProcessing(prev => ({ ...prev, [order.id]: false }));
    }
  };

  // ─── Show QR / Collect Online - Generate and show QR code ─────────────
  const handleShowQr = async (order) => {
    setQrLoading(true);
    try {
      console.log('Creating clean UPI QR code for order:', order.id);
      
      // Create clean UPI QR code (no Razorpay branding)
      const { data, error } = await supabase.functions.invoke('create-razorpay-qr', {
        body: { 
          orderId: order.id,
          amount: order.total_amount, 
          customerName: order.customer_name, 
          customerPhone: order.phone_number
        }
      });
      
      if (error || !data?.qrImageUrl) {
        throw new Error(data?.error || data?.details || 'Failed to create QR code');
      }

      console.log('Clean UPI QR code created for Razorpay order:', data.razorpayOrderId);

      // Show QR code modal
      setQrModal({
        open: true,
        order: order,
        qrUrl: data.qrImageUrl, // Clean QR image without branding
        amount: order.total_amount,
        razorpayOrderId: data.razorpayOrderId
      });

      // Start polling for payment status
      startPaymentPolling(order.id);

    } catch (err) {
      console.error('QR creation error:', err);
      import('sonner').then(({ toast }) => { 
        toast.error('Failed to create QR code: ' + err.message); 
      });
    } finally {
      setQrLoading(false);
    }
  };

  // Poll for payment status
  const startPaymentPolling = (orderId) => {
    let pollCount = 0;
    const maxPolls = 200; // 200 polls * 3 seconds = 10 minutes
    
    const pollInterval = setInterval(async () => {
      pollCount++;
      
      try {
        const { data: order } = await supabase
          .from('orders')
          .select('is_paid, cod_collected, payment_id')
          .eq('id', orderId)
          .single();

        if (order && order.is_paid && order.cod_collected) {
          // Payment received!
          clearInterval(pollInterval);
          
          // Update local state
          setAssignedOrders(prev => prev.map(o => 
            o.id === orderId ? { 
              ...o, 
              cod_collected: true, 
              cod_collection_method: 'qr_upi',
              is_paid: true,
              payment_id: order.payment_id
            } : o
          ));
          
          // Refresh delivery person data to show updated wallet
          const freshList = await base44.entities.DeliveryPerson.filter({ id: deliveryPerson.id }).catch(() => []);
          if (freshList[0]) {
            setDeliveryPerson(freshList[0]);
            localStorage.setItem('deliveryPerson', JSON.stringify(freshList[0]));
          }
          
          // Close QR modal
          setQrModal({ open: false, order: null, qrUrl: null, amount: 0 });
          
          import('sonner').then(({ toast }) => { 
            toast.success('✅ Payment received! Amount credited to your wallet.'); 
          });
        }
        
        // Stop polling after max attempts
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          import('sonner').then(({ toast }) => { 
            toast.error('Payment timeout. QR code expired. Please try again.'); 
          });
          setQrModal({ open: false, order: null, qrUrl: null, amount: 0 });
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000); // Poll every 3 seconds
  };

  // ─── Confirm Online OTP after customer pays ──────────────────────────────
  const handleOnlineOtpConfirm = async (order) => {
    const enteredOtp = onlineOtp[order.id];
    if (!enteredOtp || enteredOtp.trim() !== order.delivery_otp) {
      import('sonner').then(({ toast }) => { toast.error('Incorrect OTP. Ask customer to check their Orders page.'); });
      return;
    }
    setCodProcessing(prev => ({ ...prev, [order.id]: true }));
    try {
      const { data: verifyData } = await supabase.functions.invoke('verify-cod-payment', { body: { orderId: order.id } });
      if (!verifyData?.paid) {
        import('sonner').then(({ toast }) => { toast.error('Payment not confirmed yet. Ask customer to complete payment first.'); });
        setCodProcessing(prev => ({ ...prev, [order.id]: false }));
        return;
      }
      await supabase.rpc('collect_cod_online_complete', { p_partner_id: deliveryPerson.id, p_order_id: order.id, p_payment_id: verifyData.paymentId || '' });
      setAssignedOrders(prev => prev.map(o => o.id === order.id ? { ...o, cod_collected: true, cod_collection_method: 'online' } : o));
      setCodInitiated(prev => ({ ...prev, [order.id]: 'done' }));
      import('sonner').then(({ toast }) => { toast.success('✅ Online payment confirmed. No wallet deduction.'); });
    } catch (err) {
      console.error('Online OTP confirm error:', err);
    } finally {
      setCodProcessing(prev => ({ ...prev, [order.id]: false }));
    }
  };

  // ─── Shift end auto-offline check (every minute) ─────────────────────────
  useEffect(() => {
    if (!deliveryPerson?.id) return;
    const checkShiftEnd = setInterval(async () => {
      if (!deliveryPerson?.shift_end_time) return;
      const shiftEnd = new Date(deliveryPerson.shift_end_time);
      if (new Date() >= shiftEnd && deliveryPerson.is_available) {
        try {
          await supabase.rpc('force_partner_offline', { p_partner_id: deliveryPerson.id });
          const updated = { ...deliveryPerson, is_available: false, shift_end_time: null };
          setDeliveryPerson(updated);
          localStorage.setItem('deliveryPerson', JSON.stringify(updated));
          import('sonner').then(({ toast }) => { toast.warning('⏰ Your shift has ended. You are now offline.', { duration: 8000 }); });
          await checkCodSubmissionRequired();
        } catch (e) { console.error('Shift end offline error:', e); }
      }
    }, 60000);
    return () => clearInterval(checkShiftEnd);
  }, [deliveryPerson?.shift_end_time, deliveryPerson?.is_available, deliveryPerson?.id]);

  // ─── Check COD on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (deliveryPerson?.id) { checkCodSubmissionRequired(); }
  }, [deliveryPerson?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!deliveryPerson) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <Card>
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 mx-auto mb-3 bg-emerald-100 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl">Delivery Partner Login</CardTitle>
            <p className="text-gray-500 text-sm mt-1">Enter your email and password to continue</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="partner@email.com"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  autoComplete="email"
                  required
                  autoFocus
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="mt-1"
                />
              </div>
              {loginError && (
                <Alert variant="destructive">
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}
              <Button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-700" 
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 h-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const walletBalance = deliveryPerson.wallet_balance || 0;
  const isNegativeBalance = walletBalance < 0;

  // Helper function to determine order action state
  const getOrderActionState = (order) => {
    if (order.status === 'delivered') return 'COMPLETE';
    if (order.status === 'assigned' || order.status === 'preparing') return 'NEEDS_PICKUP';
    if (order.status === 'out_for_delivery' || order.status === 'picked_up') {
      if (order.payment_method === 'cash' || !order.is_paid) {
        if (!order.cod_collected) return 'NEEDS_COD';
        return 'NEEDS_OTP';
      }
      return 'NEEDS_OTP';
    }
    return 'UNKNOWN';
  };

  // Handler for OTP submission
  const handleOtpSubmit = async (orderId, otp) => {
    const order = assignedOrders.find(o => o.id === orderId);
    if (!order) return;

    if (otp !== order.delivery_otp) {
      const attempts = (otpAttempts[orderId] || 0) + 1;
      setOtpAttempts(prev => ({ ...prev, [orderId]: attempts }));
      
      if (attempts >= 3) {
        // Notify admin
        await base44.entities.Notification.create({
          user_id: 'admin',
          title: 'OTP Locked',
          message: `Delivery partner ${deliveryPerson.name} has exceeded OTP attempts for order #${order.order_number}`,
          type: 'error'
        }).catch(() => {});
      }
      return;
    }

    // OTP correct - mark as delivered
    setOtpDialog({ open: false, order: null });
    await markOrderDelivered();
  };

  // Handler for status update (mark as picked up)
  const handleStatusUpdate = async (orderId, newStatus) => {
    if (newStatus === 'picked_up' || newStatus === 'out_for_delivery') {
      await markOutForDelivery(orderId);
    }
  };

  // Handler for cancel order
  const handleCancelOrder = (orderId) => {
    const order = assignedOrders.find(o => o.id === orderId);
    if (order) {
      setOrderToCancel(order);
      setCancellationReason("");
      setShowCancelDialog(true);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-tab-bar px-2 page-enter">
      {/* ─── COD Overdue Popup (dismissible, background stays accessible) ── */}
      {codOverdue && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.45)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              background: 'white', borderRadius: '12px', padding: '24px',
              maxWidth: '300px', width: '100%', textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              pointerEvents: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔒</div>
            <h2 style={{ color: '#DC2626', fontSize: '16px', marginBottom: '6px', fontWeight: 700 }}>
              Account Blocked
            </h2>
            <p style={{ color: '#DC2626', fontSize: '24px', fontWeight: 800, marginBottom: '6px' }}>
              ₹{codOverdueAmount}
            </p>
            <p style={{ color: '#6B7280', fontSize: '12px', marginBottom: '16px', lineHeight: '1.4' }}>
              Pay online or contact admin
            </p>
            <button
              onClick={handleAddToWallet}
              disabled={addingToWallet}
              style={{
                width: '100%', background: '#10b981', color: 'white',
                border: 'none', borderRadius: '8px', padding: '10px',
                fontWeight: 700, fontSize: '14px',
                cursor: addingToWallet ? 'not-allowed' : 'pointer',
                opacity: addingToWallet ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              {addingToWallet ? 'Processing...' : '💳 Pay Now'}
            </button>
            <button
              onClick={() => setCodOverdue(false)}
              style={{
                marginTop: '10px', background: 'none', border: 'none',
                color: '#9CA3AF', fontSize: '12px', cursor: 'pointer'
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Dashboard</h1>
          <p className="text-gray-500 text-sm">Welcome, {deliveryPerson.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold ${deliveryPerson.is_available ? 'text-green-600' : 'text-gray-500'}`}>
              {deliveryPerson.is_available ? 'ONLINE' : 'OFFLINE'}
            </span>
            <button
              onClick={deliveryPerson.is_available ? handleGoOffline : handleGoOnline}
              disabled={isTogglingAvailability}
              className={`relative inline-flex items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 ${
                deliveryPerson.is_available ? 'bg-green-500' : isNegativeBalance ? 'bg-red-200' : 'bg-gray-300'
              }`}
              style={{ height: '20px', width: '70px', minWidth: '50px', padding: '5px' }}
            >
              <span 
                className="inline-block rounded-full bg-white shadow-md transition-transform duration-200"
                style={{ 
                  height: '30px', 
                  width: '30px',
                  transform: deliveryPerson.is_available ? 'translateX(28px)' : 'translateX(0)'
                }}
              />
            </button>
          </div>
          <Button variant="outline" onClick={handleLogout}>Logout</Button>
        </div>
      </div>

      {/* Status Banner */}
      {deliveryPerson.is_available ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
          <Clock className="w-5 h-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">
              {deliveryPerson.current_shift ? `Shift Active` : "Online"}
            </p>
            <p className="text-xs text-green-600">
              You're online and receiving orders
              {deliveryPerson.assigned_hostel && deliveryPerson.assigned_hostel !== "All"
                ? ` · ${deliveryPerson.assigned_hostel} hostel only`
                : ""}
            </p>
          </div>
          <Badge className="bg-green-500 text-white">ACTIVE</Badge>
        </div>
      ) : !deliveryPerson.is_available && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
          <p className="text-sm text-orange-800">
            {isNegativeBalance
              ? `Submit ₹${Math.abs(walletBalance).toFixed(2)} COD cash first (Wallet tab), then select a shift to go online.`
              : "Select a shift to start receiving orders."}
          </p>
        </div>
      )}

      {/* Shift end time display */}
      {deliveryPerson.is_available && deliveryPerson.shift_end_time && (
        <div style={{
          background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '8px',
          padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ color: '#1E40AF', fontWeight: 600, fontSize: '13px' }}>
            🕐 Shift ends at{' '}
            {new Date(deliveryPerson.shift_end_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span style={{ color: '#64748B', fontSize: '12px' }}>Auto-offline at shift end</span>
        </div>
      )}

      {/* Negative Balance Warning */}
      {isNegativeBalance && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-800">Submit COD Cash: ₹{Math.abs(walletBalance).toFixed(2)}</p>
            <p className="text-xs text-red-600 mt-0.5">You must settle this before accepting new orders.</p>
          </div>
          <Button size="sm" onClick={() => setActiveTab("wallet")} className="bg-red-600 hover:bg-red-700 text-white">
            Wallet <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Deliveries", value: deliveryPerson.total_deliveries || 0 },
          { label: "Today's Earnings", value: `₹${todayEarnings.toFixed(0)}`, color: "text-emerald-600" },
          { label: "Lifetime Earnings", value: `₹${(lifetimeEarnings || 0).toFixed(0)}`, color: "text-blue-600" },
          { label: "Active Orders", value: assignedOrders.length },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${stat.color || "text-gray-800"}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="orders">
            <Package className="w-4 h-4 mr-1.5" />Orders
            {(availableOrders.length + assignedOrders.length) > 0 && (
              <Badge className="ml-1.5 bg-emerald-600 text-white text-xs px-1.5">{availableOrders.length + assignedOrders.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="wallet">
            <Wallet className="w-4 h-4 mr-1.5" />Wallet
            {isNegativeBalance && <Badge className="ml-1.5 bg-red-500 text-white text-xs px-1.5">!</Badge>}
          </TabsTrigger>
          <TabsTrigger value="support">
            <MessageSquare className="w-4 h-4 mr-1.5" />Support
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-5 mt-4">
          {/* Available Orders */}
          {deliveryPerson.is_available && availableOrders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-semibold text-gray-900">New Orders</h2>
                <Badge className="bg-blue-100 text-blue-800">{availableOrders.length}</Badge>
              </div>
              <div className="space-y-3">
                <AnimatePresence>
                  {availableOrders.map(order => (
                    <motion.div key={order.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                      <Card className="border-blue-200 bg-blue-50">
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <Badge className="bg-blue-500 text-white">NEW</Badge>
                                {order.is_scheduled && order.scheduled_time && (
                                  <Badge className="bg-purple-100 text-purple-800 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(order.scheduled_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                  </Badge>
                                )}
                                {order.is_paid ? <Badge className="bg-green-100 text-green-800">PAID</Badge> : <Badge className="bg-yellow-100 text-yellow-800">COD</Badge>}
                                <span className="font-semibold text-sm">#{order.order_number}</span>
                              </div>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-gray-400" /><span>{order.customer_name}</span></div>
                                <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" /><span>{order.delivery_address}</span></div>
                              </div>
                              <p className="text-xl font-bold text-emerald-600 mt-2">₹{order.total_amount?.toFixed(2)}</p>
                              <p className="text-xs text-gray-500">+₹{(order.total_amount * 0.10).toFixed(2)} commission</p>
                            </div>
                            {(() => {
                              const hostel = (deliveryPerson.assigned_hostel || "").trim();
                              const addr = (order.delivery_address || "").toLowerCase().trim();
                              const canAccept = !hostel || hostel === "All" || addr.includes(hostel.toLowerCase().trim());
                              return (
                                <div className="flex flex-col items-end gap-1 self-start sm:self-auto">
                                  <Button
                                    onClick={() => acceptOrder(order.id)}
                                    disabled={acceptingOrderId === order.id || !canAccept}
                                    className={canAccept ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-200 text-gray-400 cursor-not-allowed"}
                                  >
                                    {acceptingOrderId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-1" />Accept</>}
                                  </Button>
                                  {!canAccept && (
                                    <span className="text-[10px] text-orange-500 font-medium">Not your hostel</span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Active Deliveries */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">My Active Deliveries ({assignedOrders.length})</h2>
            {assignedOrders.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No active deliveries</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {assignedOrders.map(order => {
                    const actionState = getOrderActionState(order);
                    
                    const statusConfig = {
                      preparing: { bg: '#10b981', label: 'Order Assigned' },
                      assigned: { bg: '#10b981', label: 'Order Assigned' },
                      out_for_delivery: { bg: '#10b981', label: 'Out for Delivery' },
                      picked_up: { bg: '#10b981', label: 'Out for Delivery' },
                      delivered: { bg: '#10b981', label: 'Delivered' }
                    };

                    const steps = [
                      { key: 'assigned', label: 'Assigned' },
                      { key: 'picked_up', label: 'Picked Up' },
                      { key: 'delivered', label: 'Delivered' }
                    ];
                    const stepIndex = { assigned: 0, preparing: 0, picked_up: 1, out_for_delivery: 1, delivered: 2 };
                    const currentStep = stepIndex[order.status] ?? 0;

                    return (
                      <motion.div 
                        key={order.id} 
                        layout 
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0 }}
                        className="order-card-enter"
                      >
                        <div style={{
                          background: '#FFFFFF',
                          borderRadius: '20px',
                          overflow: 'hidden',
                          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
                          marginBottom: '16px',
                          border: '1px solid #E2E8F0'
                        }}>
                          
                          <div style={{
                            background: statusConfig[order.status]?.bg || '#10b981',
                            padding: '10px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {(order.status === 'preparing' || order.status === 'assigned') && (
                                <Package style={{ width: '16px', height: '16px', color: '#fff' }} />
                              )}
                              {(order.status === 'out_for_delivery' || order.status === 'picked_up') && (
                                <Truck style={{ width: '16px', height: '16px', color: '#fff' }} />
                              )}
                              {order.status === 'delivered' && (
                                <CheckCircle style={{ width: '16px', height: '16px', color: '#fff' }} />
                              )}
                              <span style={{
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '13px',
                                letterSpacing: '0.3px'
                              }}>
                                {statusConfig[order.status]?.label}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {(order.payment_method === 'cash' || !order.is_paid) && (
                                <span style={{
                                  background: 'rgba(255,255,255,0.25)',
                                  color: '#fff',
                                  padding: '3px 10px',
                                  borderRadius: '20px',
                                  fontSize: '12px',
                                  fontWeight: 700
                                }}>
                                  COD ₹{order.total_amount}
                                </span>
                              )}
                              {order.payment_method !== 'cash' && order.is_paid && (
                                <span style={{
                                  background: 'rgba(255,255,255,0.25)',
                                  color: '#fff',
                                  padding: '3px 10px',
                                  borderRadius: '20px',
                                  fontSize: '12px',
                                  fontWeight: 700
                                }}>
                                  Paid Online
                                </span>
                              )}
                              <span style={{
                                color: 'rgba(255,255,255,0.8)',
                                fontSize: '11px'
                              }}>
                                #{order.id?.slice(-8).toUpperCase()}
                              </span>
                            </div>
                          </div>

                          {order.status !== 'delivered' && (
                            <div style={{
                              padding: '12px 16px 0',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              {steps.map((step, idx) => (
                                <React.Fragment key={step.key}>
                                  <div style={{ textAlign: 'center', flex: 'none' }}>
                                    <div style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      background: idx <= currentStep ? '#10b981' : '#E2E8F0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      margin: '0 auto 4px',
                                      transition: 'background 300ms'
                                    }}>
                                      {idx < currentStep ? (
                                        <span style={{ color: '#fff', fontSize: '14px' }}>✓</span>
                                      ) : idx === currentStep ? (
                                        <div style={{
                                          width: '10px',
                                          height: '10px',
                                          borderRadius: '50%',
                                          background: '#fff'
                                        }} />
                                      ) : (
                                        <div style={{
                                          width: '10px',
                                          height: '10px',
                                          borderRadius: '50%',
                                          background: '#CBD5E1'
                                        }} />
                                      )}
                                    </div>
                                    <span style={{
                                      fontSize: '10px',
                                      color: idx <= currentStep ? '#10b981' : '#94A3B8',
                                      fontWeight: idx === currentStep ? 700 : 400
                                    }}>
                                      {step.label}
                                    </span>
                                  </div>
                                  {idx < steps.length - 1 && (
                                    <div style={{
                                      flex: 1,
                                      height: '2px',
                                      background: idx < currentStep ? '#10b981' : '#E2E8F0',
                                      margin: '0 4px 18px',
                                      transition: 'background 300ms'
                                    }} />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          )}

                          <div style={{ padding: '14px 16px 10px' }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: '10px'
                            }}>
                              <div>
                                <p style={{
                                  fontSize: '18px',
                                  fontWeight: 800,
                                  color: '#1E1B4B',
                                  margin: '0 0 2px'
                                }}>
                                  {order.customer_name}
                                </p>
                                <p style={{
                                  fontSize: '13px',
                                  color: '#10b981',
                                  fontWeight: 600,
                                  margin: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <MapPin style={{ width: '14px', height: '14px' }} />
                                  {order.delivery_address}
                                </p>
                              </div>
                              <a
                                href={`tel:${order.phone_number}`}
                                style={{
                                  background: '#F0FDF4',
                                  border: '2px solid #16A34A',
                                  borderRadius: '14px',
                                  padding: '10px 16px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  textDecoration: 'none',
                                  flexShrink: 0,
                                  marginLeft: '12px',
                                  transition: 'transform 80ms'
                                }}
                                onTouchStart={e => e.currentTarget.style.transform = 'scale(0.95)'}
                                onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
                              >
                                <Phone style={{ width: '16px', height: '16px', color: '#16A34A' }} />
                                <span style={{
                                  color: '#16A34A',
                                  fontWeight: 700,
                                  fontSize: '14px'
                                }}>
                                  Call
                                </span>
                              </a>
                            </div>

                            <p style={{
                              fontSize: '12px',
                              color: '#94A3B8',
                              margin: '0 0 12px'
                            }}>
                              {order.phone_number}
                            </p>

                            <div style={{
                              height: '1px',
                              background: '#F1F5F9',
                              margin: '0 0 12px'
                            }} />

                            <div style={{ marginBottom: '10px' }}>
                              {order.items?.map((item, idx) => (
                                <div key={idx} style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '5px 0'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                      width: '6px',
                                      height: '6px',
                                      borderRadius: '50%',
                                      background: '#10b981',
                                      flexShrink: 0
                                    }} />
                                    <span style={{
                                      fontSize: '14px',
                                      color: '#374151',
                                      fontWeight: 500
                                    }}>
                                      {item.product_name}
                                    </span>
                                  </div>
                                  <span style={{
                                    fontSize: '13px',
                                    color: '#6B7280',
                                    background: '#F8F7FF',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontWeight: 600
                                  }}>
                                    × {item.quantity}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {order.delivery_notes && (
                              <div style={{
                                background: '#FFFBEB',
                                border: '1px solid #FCD34D',
                                borderRadius: '10px',
                                padding: '10px 12px',
                                marginBottom: '12px',
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'flex-start'
                              }}>
                                <MessageSquare className="w-4 h-4 text-yellow-700 flex-shrink-0" />
                                <div>
                                  <p style={{
                                    fontSize: '11px',
                                    color: '#92400E',
                                    fontWeight: 700,
                                    margin: '0 0 2px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                  }}>
                                    Customer Note
                                  </p>
                                  <p style={{
                                    fontSize: '13px',
                                    color: '#78350F',
                                    margin: 0,
                                    lineHeight: '1.4'
                                  }}>
                                    {order.delivery_notes}
                                  </p>
                                </div>
                              </div>
                            )}

                            <div style={{
                              background: '#F8F7FF',
                              borderRadius: '12px',
                              padding: '12px 16px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '4px'
                            }}>
                              <span style={{
                                fontSize: '13px',
                                color: '#6B7280',
                                fontWeight: 500
                              }}>
                                Order Total
                              </span>
                              <span style={{
                                fontSize: '24px',
                                fontWeight: 900,
                                color: '#1E1B4B',
                                letterSpacing: '-0.5px'
                              }}>
                                ₹{order.total_amount}
                              </span>
                            </div>
                          </div>

                          <div style={{
                            padding: '0 16px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                          }}>
                            {/* COD Collection - only show when needed */}
                            {order.payment_method === 'cash' && order.status === 'out_for_delivery' && !order.cod_collected && (
                              <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                  <Wallet className="w-5 h-5 text-amber-700" />
                                  <div>
                                    <p className="font-bold text-amber-900 text-sm">COD Collection Required</p>
                                    <p className="text-amber-700 text-xs">Amount: ₹{order.total_amount}</p>
                                  </div>
                                </div>
                                
                                {!codInitiated[order.id] && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <Button
                                      onClick={() => handleCashCollection(order)}
                                      disabled={codProcessing[order.id]}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                      <Wallet className="w-4 h-4 mr-1" />
                                      Got Cash
                                    </Button>
                                    <Button
                                      onClick={() => handleShowQr(order)}
                                      disabled={codProcessing[order.id]}
                                      variant="outline"
                                      className="border-2"
                                    >
                                      <QrCode className="w-4 h-4 mr-1" />
                                      Show QR
                                    </Button>
                                  </div>
                                )}
                                
                                {codProcessing[order.id] && (
                                  <div className="flex items-center justify-center gap-2 py-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                                    <span className="text-amber-700 text-sm font-medium">Processing...</span>
                                  </div>
                                )}
                                
                                {codInitiated[order.id] === 'online_pending' && (
                                  <div className="space-y-3">
                                    <div className="bg-white rounded-lg p-3 border border-amber-200">
                                      <div className="flex items-start gap-2">
                                        <Clock className="w-4 h-4 text-amber-600 mt-0.5" />
                                        <div>
                                          <p className="text-amber-900 font-semibold text-sm">Waiting for payment...</p>
                                          <p className="text-amber-700 text-xs mt-1">
                                            Ask customer to complete payment. Enter OTP once paid.
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium text-amber-900">Delivery OTP</Label>
                                      <Input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        placeholder="0 0 0 0"
                                        value={onlineOtp[order.id] || ''}
                                        onChange={(e) => setOnlineOtp(prev => ({ 
                                          ...prev, 
                                          [order.id]: e.target.value.replace(/\D/g, '').slice(0, 4) 
                                        }))}
                                        className="text-center text-2xl font-bold tracking-widest"
                                        maxLength={4}
                                      />
                                      <Button
                                        onClick={() => handleOnlineOtpConfirm(order)}
                                        disabled={!onlineOtp[order.id] || onlineOtp[order.id].length !== 4}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                                      >
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Confirm Payment
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* COD collected confirmation - single box */}
                            {order.cod_collected && (
                              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-3">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                                  <p className="text-emerald-800 font-semibold text-sm">
                                    Payment Collected — {order.cod_collection_method === 'cash' ? 'Cash' : 'Online'}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Action buttons */}
                            {actionState === 'NEEDS_PICKUP' && (
                              <Button
                                onClick={() => handleStatusUpdate(order.id, 'picked_up')}
                                disabled={updatingOrderId === order.id}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3"
                              >
                                {updatingOrderId === order.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                  <Truck className="w-4 h-4 mr-2" />
                                )}
                                Mark Picked Up
                              </Button>
                            )}

                            {actionState === 'NEEDS_OTP' && (
                              <Button
                                onClick={() => setOtpDialog({ open: true, order })}
                                disabled={updatingOrderId === order.id}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3"
                              >
                                {updatingOrderId === order.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                )}
                                Mark Delivered
                              </Button>
                            )}

                            {order.status !== 'delivered' && (
                              <Button
                                onClick={() => handleCancelOrder(order.id)}
                                variant="ghost"
                                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Cancel Order
                              </Button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="wallet" className="mt-4">
          <WalletDashboard deliveryPerson={deliveryPerson} onUpdate={handleWalletUpdate} todayEarningsFromParent={todayEarnings} />
        </TabsContent>

        <TabsContent value="support" className="mt-4">
          <RaiseQuery deliveryPerson={deliveryPerson} />
        </TabsContent>
      </Tabs>

      {/* Shift Selector */}
      <ShiftSelector open={showShiftSelector} onSelectShift={handleShiftSelected} onCancel={() => setShowShiftSelector(false)} />

      {/* OTP Verification Dialog */}
      <OTPVerificationDialog
        open={otpDialog.open}
        order={otpDialog.order}
        onClose={() => setOtpDialog({ open: false, order: null })}
        onVerify={markOrderDelivered}
        isLoading={!!updatingOrderId}
        deliveryPerson={deliveryPerson}
      />

      {/* Withdrawal/Deposit Approval Popup */}
      <Dialog open={!!loginPopup} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle className="w-5 h-5 text-emerald-600" />{loginPopup?.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700 leading-relaxed">{loginPopup?.message}</p>
          <DialogFooter>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={async () => {
                if (loginPopup?.id) {
                  await base44.entities.Notification.update(loginPopup.id, { is_read: true }).catch(() => {});
                }
                setLoginPopup(null);
              }}
            >
              OK, Got It!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-600" />Cancel Order</DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div>
              {orderToCancel && (
                <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm">
                  <p className="font-semibold">#{orderToCancel.order_number}</p>
                  <p className="text-gray-500">{orderToCancel.customer_name}</p>
                </div>
              )}
              <div className="mt-2">
                <Label>Reason <span className="text-red-500">*</span></Label>
                <Textarea placeholder="Enter cancellation reason..." value={cancellationReason} onChange={e => setCancellationReason(e.target.value)} rows={3} className="mt-1" />
              </div>
            </div>
          </DialogDescription>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Back</Button>
            <Button variant="destructive" onClick={cancelOrder} disabled={!cancellationReason.trim()}>Confirm Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Payment Modal */}
      <Dialog open={qrModal.open} onOpenChange={(open) => !open && setQrModal({ open: false, order: null, qrUrl: null, amount: 0 })}>
        <DialogContent className="sm:max-w-[380px] p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-emerald-700 text-lg">
              <QrCode className="w-5 h-5" />
              Scan QR to Pay
            </DialogTitle>
            <DialogDescription className="text-xs">
              Customer can scan this QR code with any UPI app
            </DialogDescription>
          </DialogHeader>
          
          {qrModal.order && (
            <div className="space-y-3">
              {/* Order Info */}
              <div className="bg-gray-50 rounded-lg p-2.5 text-sm">
                <p className="font-semibold text-sm">Order #{qrModal.order.order_number}</p>
                <p className="text-gray-600 text-xs">{qrModal.order.customer_name}</p>
                <p className="text-xl font-bold text-emerald-600 mt-1">₹{qrModal.amount?.toFixed(2)}</p>
              </div>

              {/* QR Code */}
              {qrModal.qrUrl ? (
                <div className="flex flex-col items-center justify-center bg-white p-3 rounded-lg border-2 border-emerald-200">
                  <img 
                    src={qrModal.qrUrl} 
                    alt="Payment QR Code" 
                    className="w-48 h-48 object-contain"
                  />
                  <p className="text-[10px] text-gray-500 mt-1.5 text-center leading-tight">
                    Ask customer to scan with Google Pay, PhonePe, Paytm, or any UPI app
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>
              )}

              {/* Waiting for payment */}
              <div className="flex items-center justify-center gap-2 text-xs text-gray-600 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Waiting for payment...</span>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                <p className="text-xs font-semibold text-blue-900 mb-1">Instructions:</p>
                <ul className="text-[10px] text-blue-800 space-y-0.5 leading-tight">
                  <li>• Show this QR code to the customer</li>
                  <li>• Customer scans with any UPI app</li>
                  <li>• Payment will be auto-verified</li>
                  <li>• Amount will be credited to your wallet</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button 
              variant="outline" 
              onClick={() => setQrModal({ open: false, order: null, qrUrl: null, amount: 0 })}
              className="w-full h-9 text-sm"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}