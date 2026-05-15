import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { User } from "@/entities/User";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle, Clock, Crown, Truck, Loader2, Star, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const DEFAULT_PLANS = [
  {
    type: "student",
    name: "Student Plan",
    price: 99,
    icon: "🎓",
    colorClass: "border-emerald-300 hover:border-emerald-500",
    btnClass: "bg-emerald-600 hover:bg-emerald-700",
    textClass: "text-emerald-600",
    bgClass: "bg-emerald-50",
    checkClass: "text-emerald-500",
    perks: ["Free delivery on all orders", "Valid for 1 month", "Priority customer support"]
  },
  {
    type: "faculty",
    name: "Faculty Plan",
    price: 199,
    icon: "👨‍🏫",
    colorClass: "border-purple-300 hover:border-purple-500",
    btnClass: "bg-purple-600 hover:bg-purple-700",
    textClass: "text-purple-600",
    bgClass: "bg-purple-50",
    checkClass: "text-purple-500",
    perks: ["Free delivery on all orders", "Valid for 1 month", "Priority customer support", "Exclusive faculty benefits"]
  }
];

// Style config per plan index (cycles if more plans added)
const PLAN_STYLES = [
  { colorClass: "border-emerald-300 hover:border-emerald-500", btnClass: "bg-emerald-600 hover:bg-emerald-700", textClass: "text-emerald-600", checkClass: "text-emerald-500", icon: "🎓" },
  { colorClass: "border-purple-300 hover:border-purple-500", btnClass: "bg-purple-600 hover:bg-purple-700", textClass: "text-purple-600", checkClass: "text-purple-500", icon: "👨‍🏫" },
  { colorClass: "border-blue-300 hover:border-blue-500", btnClass: "bg-blue-600 hover:bg-blue-700", textClass: "text-blue-600", checkClass: "text-blue-500", icon: "⭐" },
  { colorClass: "border-orange-300 hover:border-orange-500", btnClass: "bg-orange-600 hover:bg-orange-700", textClass: "text-orange-600", checkClass: "text-orange-500", icon: "🏆" },
];

export default function Subscription() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [currentSub, setCurrentSub] = useState(null);
  const [settings, setSettings] = useState(null);
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [isLoading, setIsLoading] = useState(true);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    setIsLoading(true);
    try {
      const u = await User.me();
      setUser(u);
      const [subs, settingsList] = await Promise.all([
        base44.entities.Subscription.filter({ user_id: u.id }, '-created_date', 10).catch(() => []),
        base44.entities.Settings.list().catch(() => [])
      ]);
      const now = new Date();
      const active = subs.find(s => s.status === 'active' && (!s.end_date || new Date(s.end_date) > now));
      const pending = subs.find(s => s.status === 'pending_verification');
      setCurrentSub(active || pending || null);
      if (settingsList.length > 0) {
        setSettings(settingsList[0]);
        // Load plans from settings if admin has configured them
        if (settingsList[0].subscription_plans?.length > 0) {
          const loadedPlans = settingsList[0].subscription_plans.map((p, i) => {
            const style = PLAN_STYLES[i % PLAN_STYLES.length];
            return {
              type: p.type,
              name: p.name,
              price: p.price,
              icon: p.icon || style.icon,
              colorClass: style.colorClass,
              btnClass: style.btnClass,
              textClass: style.textClass,
              bgClass: "bg-gray-50",
              checkClass: style.checkClass,
              perks: p.perks?.length > 0 ? p.perks : ["Free delivery on all orders", "Valid for 1 month", "Priority customer support"]
            };
          });
          setPlans(loadedPlans);
        }
      }
    } catch {
      navigate(createPageUrl('Shop'));
    }
    setIsLoading(false);
  };

  const handleCancelSubscription = async () => {
    if (!currentSub) return;
    setIsCancelling(true);
    try {
      await base44.entities.Subscription.update(currentSub.id, { status: 'cancelled' });
      await base44.entities.Notification.create({
        user_id: user.id,
        title: "Subscription Cancelled",
        message: "Your premium subscription has been cancelled.",
        type: "info"
      });
      import('sonner').then(({ toast }) => toast.info('Subscription cancelled.'));
      setShowCancelDialog(false);
      await init();
    } catch (err) {
      console.error('Cancel error:', err);
      import('sonner').then(({ toast }) => toast.error('Failed to cancel. Please try again.'));
    } finally {
      setIsCancelling(false);
    }
  };

  const openPayDialog = (plan) => {
    setSelectedPlan(plan);
    setShowPayDialog(true);
  };

  const handleRazorpayPayment = async () => {
    if (!selectedPlan || !user) return;
    
    setIsProcessingPayment(true);
    
    try {
      // Create Razorpay order for subscription using existing function
      const { data, error } = await supabase.functions.invoke('create-razorpay-cod-order', {
        body: {
          orderId: `sub_${user.id}_${Date.now()}`,
          amount: selectedPlan.price,
          customerName: user.full_name || user.email,
          customerEmail: user.email,
          customerPhone: user.phone_number || '0000000000'
        }
      });

      if (error || !data?.razorpayOrderId) {
        console.error('Payment order creation error:', error);
        throw new Error('Failed to create payment order');
      }

      // Open Razorpay checkout
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'CollegeCart Premium',
        description: `${selectedPlan.name} - 1 Month`,
        order_id: data.razorpayOrderId,
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
              console.error('Payment verification error:', verifyError);
              throw new Error('Payment verification failed');
            }

            // ── OPTIMISTIC UI UPDATE — instant, no waiting for DB ──────
            // Build a local subscription object and update state immediately.
            // DB writes happen in the background — user sees Premium instantly.
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1);

            const optimisticSub = {
              id: 'temp-' + Date.now(),
              user_id: user.id,
              plan_type: selectedPlan.type,
              amount_paid: selectedPlan.price,
              payment_id: response.razorpay_payment_id,
              status: 'active',
              start_date: new Date().toISOString(),
              end_date: endDate.toISOString(),
            };

            // Update UI immediately — zero wait
            setCurrentSub(optimisticSub);
            setShowPayDialog(false);
            setIsProcessingPayment(false);

            import('sonner').then(({ toast }) =>
              toast.success('Premium activated! Enjoy free delivery on all orders.')
            );

            // ── Background DB writes — don't block UI ──────────────────
            Promise.all([
              base44.entities.Subscription.create({
                user_id: user.id,
                user_email: user.email,
                user_name: user.full_name,
                plan_type: selectedPlan.type,
                amount_paid: selectedPlan.price,
                payment_id: response.razorpay_payment_id,
                status: 'active',
                start_date: optimisticSub.start_date,
                end_date: optimisticSub.end_date,
              }),
              base44.entities.Notification.create({
                user_id: user.id,
                title: "🎉 Premium Activated!",
                message: `Your ${selectedPlan.name} is now active. Enjoy free delivery for 1 month!`,
                type: "success"
              }),
            ])
              .then(([createdSub]) => {
                // Replace optimistic id with real DB id
                if (createdSub?.id) setCurrentSub(prev => ({ ...prev, id: createdSub.id }));
              })
              .catch(err => {
                console.error('Background subscription save failed:', err);
                // Silently re-fetch to sync state with DB
                init();
              });

          } catch (err) {
            console.error('Payment verification error:', err);
            setIsProcessingPayment(false);
            import('sonner').then(({ toast }) => {
              toast.error('Payment verification failed. Contact support if amount was deducted.');
            });
          }
        },
        modal: {
          ondismiss: function() {
            setIsProcessingPayment(false);
            import('sonner').then(({ toast }) => {
              toast.info('Payment cancelled.');
            });
          }
        },
        prefill: {
          name: user.full_name || '',
          email: user.email || '',
          contact: user.phone_number || ''
        },
        theme: {
          color: selectedPlan.type === 'student' ? '#10b981' : '#9333ea'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('Payment error:', err);
      import('sonner').then(({ toast }) => {
        toast.error('Failed to initiate payment. Please try again.');
      });
      setIsProcessingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  const isActive = currentSub?.status === 'active';
  const isPending = currentSub?.status === 'pending_verification';
  const activePlanInfo = plans.find(p => p.type === currentSub?.plan_type);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-tab-bar">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
          <Crown className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">CollegeCart Premium</h1>
        <p className="text-gray-500 mt-1">Subscribe and enjoy free delivery on every order</p>
      </div>

      {/* Active Subscription */}
      {isActive && (
        <Card className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardContent className="p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-3 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-800">You're Premium! 🎉</h2>
            <p className="text-emerald-600 font-medium mt-1">{activePlanInfo?.name}</p>
            {currentSub?.end_date && (
              <p className="text-sm text-gray-500 mt-2">
                Valid until: <strong>{new Date(currentSub.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </p>
            )}
            <div className="mt-4 bg-white rounded-xl p-3 flex items-center justify-center gap-2 border border-emerald-200">
              <Truck className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold text-emerald-700">Free delivery on all your orders!</span>
            </div>
            <button
              onClick={() => setShowCancelDialog(true)}
              className="mt-4 text-xs text-gray-400 underline hover:text-red-500 transition-colors"
            >
              Cancel subscription
            </button>
          </CardContent>
        </Card>
      )}

      {/* Pending Verification */}
      {isPending && (
        <Card className="border-2 border-yellow-300 bg-yellow-50">
          <CardContent className="p-6 text-center">
            <Clock className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-yellow-800">Under Verification</h2>
            <p className="text-yellow-700 mt-1">Your subscription request is being reviewed by admin.</p>
            <p className="text-sm text-gray-500 mt-2">Expected activation: Within 24 hours</p>
            <Badge className="mt-3 bg-yellow-100 text-yellow-800 border border-yellow-300">
              {activePlanInfo?.name} — ₹{currentSub?.amount_paid}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Plan Selection */}
      {!isActive && !isPending && (
        <>
          <h2 className="text-xl font-semibold text-gray-700 text-center">Choose Your Plan</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {plans.map(plan => (
              <Card key={plan.type} className={`border-2 ${plan.colorClass} transition-all hover:shadow-lg cursor-pointer`}>
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="text-center mb-4">
                    <span className="text-5xl">{plan.icon}</span>
                    <h3 className="text-xl font-bold mt-3 text-gray-900">{plan.name}</h3>
                    <div className={`text-4xl font-bold mt-1 ${plan.textClass}`}>
                      ₹{plan.price}
                      <span className="text-sm font-normal text-gray-500">/month</span>
                    </div>
                  </div>
                  <ul className="space-y-2.5 mb-5 flex-1">
                    {plan.perks.map((perk, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm text-gray-700">
                        <CheckCircle className={`w-4 h-4 flex-shrink-0 ${plan.checkClass}`} />
                        {perk}
                      </li>
                    ))}
                  </ul>
                  <Button onClick={() => openPayDialog(plan)} className={`w-full ${plan.btnClass}`}>
                    <Crown className="w-4 h-4 mr-1.5" />Subscribe Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* How it works */}
          <Card className="bg-gray-50 border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-gray-700 flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />How it works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { step: "1", text: "Choose a plan" },
                  { step: "2", text: "Pay with Razorpay" },
                  { step: "3", text: "Instant activation!" }
                ].map(({ step, text }) => (
                  <div key={step} className="flex flex-col items-center gap-1.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center">
                      {step}
                    </div>
                    <p className="text-xs text-gray-600">{text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Cancel Subscription?
            </DialogTitle>
            <DialogDescription className="text-gray-600 pt-2">
              You'll lose your <strong>free delivery</strong> benefit immediately. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 my-2">
            <ul className="space-y-1.5 text-sm text-red-700">
              <li className="flex items-center gap-2">
                <span>✗</span> Free delivery on all orders — gone
              </li>
              <li className="flex items-center gap-2">
                <span>✗</span> Priority support — gone
              </li>
              {currentSub?.end_date && (
                <li className="flex items-center gap-2 text-gray-500">
                  <span>ℹ</span> Valid until {new Date(currentSub.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                </li>
              )}
            </ul>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={isCancelling}
              className="flex-1"
            >
              Keep Premium
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={isCancelling}
              className="flex-1"
            >
              {isCancelling ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling…</>
              ) : (
                'Yes, Cancel'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPayDialog} onOpenChange={(o) => { if (!o && !isProcessingPayment) setShowPayDialog(o); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedPlan?.icon}</span>
              Subscribe — {selectedPlan?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-center bg-gradient-to-br from-emerald-50 to-blue-50 rounded-xl p-6 border border-emerald-100">
              <p className="text-sm text-gray-500 mb-1">Pay to CollegeCart</p>
              <p className={`text-4xl font-bold ${selectedPlan?.textClass} mb-2`}>₹{selectedPlan?.price}</p>
              <p className="text-xs text-gray-500 mb-4">1 Month Premium Subscription</p>
              
              <Button 
                onClick={handleRazorpayPayment}
                disabled={isProcessingPayment}
                className={`w-full ${selectedPlan?.btnClass}`}
              >
                {isProcessingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-2" />
                    Pay ₹{selectedPlan?.price} with Razorpay
                  </>
                )}
              </Button>
              
              <p className="text-xs text-gray-400 mt-3">
                Secure payment via Razorpay • UPI, Cards, Wallets accepted
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}