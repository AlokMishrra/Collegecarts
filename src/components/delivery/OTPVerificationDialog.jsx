import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, AlertTriangle, Loader2, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const MAX_ATTEMPTS = 3;

export default function OTPVerificationDialog({ open, onClose, onVerify, order, isLoading, deliveryPerson }) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);

  // Reset state when dialog opens for a new order
  useEffect(() => {
    if (open) {
      setOtp("");
      setError("");
      setAttempts(0);
      setIsLocked(false);
    }
  }, [open, order?.id]);

  const escalateToAdmin = async () => {
    setIsEscalating(true);
    try {
      await base44.client.from('admin_alerts').insert({
        type: 'otp_failed',
        message: `Delivery partner entered wrong OTP ${MAX_ATTEMPTS} times for order #${order?.order_number}`,
        data: JSON.stringify({
          orderId: order?.id,
          orderNumber: order?.order_number,
          partnerId: deliveryPerson?.id,
          partnerName: deliveryPerson?.name,
          customerName: order?.customer_name,
          deliveryAddress: order?.delivery_address
        }),
        created_at: new Date().toISOString(),
        resolved: false
      });
    } catch (err) {
      // Silently fail — alert table may not exist yet
      console.error('Failed to create admin alert:', err);
    }
    setIsEscalating(false);
  };

  const handleVerify = async () => {
    if (!otp.trim()) { setError("Please enter the OTP"); return; }
    if (isLocked) return;

    if (otp.trim() === order?.delivery_otp) {
      // Correct OTP
      setError("");
      setOtp("");
      setAttempts(0);
      setIsLocked(false);
      onVerify();
    } else {
      // Wrong OTP
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        setIsLocked(true);
        setError(`🔒 OTP locked after ${MAX_ATTEMPTS} wrong attempts. Admin has been notified.`);
        toast.error(`3 wrong attempts. This order has been escalated to admin.`);
        await escalateToAdmin();
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts;
        setError(`Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
        toast.error(`Wrong OTP — ${remaining} attempt${remaining === 1 ? '' : 's'} left`);
      }
    }
  };

  const handleClose = () => {
    setOtp("");
    setError("");
    // Don't reset attempts on close — lock persists until dialog reopens for new order
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isLocked ? 'bg-red-100' : 'bg-emerald-100'}`}>
              {isLocked
                ? <Lock className="w-6 h-6 text-red-600" />
                : <Shield className="w-6 h-6 text-emerald-600" />
              }
            </div>
            <div>
              <DialogTitle>{isLocked ? 'OTP Locked' : 'Enter Delivery OTP'}</DialogTitle>
              <p className="text-sm text-gray-500">
                {isLocked ? 'Admin has been notified' : 'Ask customer for their OTP'}
              </p>
            </div>
          </div>
        </DialogHeader>

        {order && (
          <div className="bg-gray-50 rounded-lg p-3 mb-1 text-sm">
            <p className="font-semibold text-gray-900">Order #{order.order_number}</p>
            <p className="text-gray-600">{order.customer_name}</p>
            <p className="text-gray-500 text-xs mt-0.5">{order.delivery_address}</p>
          </div>
        )}

        {/* Attempt indicator dots */}
        {!isLocked && (
          <div className="flex items-center gap-2 justify-center mb-1">
            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i < attempts ? 'bg-red-500' : 'bg-gray-200'
                }`}
              />
            ))}
            <span className="text-xs text-gray-500 ml-1">
              {attempts > 0 ? `${attempts}/${MAX_ATTEMPTS} attempts` : 'Enter OTP'}
            </span>
          </div>
        )}

        {isLocked ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <Lock className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p style={{ color: '#DC2626', fontWeight: 600, fontSize: '13px' }}>
              🔒 OTP locked. Admin has been notified.
            </p>
            <p className="text-xs text-red-500 mt-1">
              Contact admin to manually verify and complete this delivery.
            </p>
          </div>
        ) : (
          <Input
            type="number"
            placeholder="Enter 4-digit OTP"
            value={otp}
            onChange={(e) => { setOtp(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            className="text-center text-2xl font-bold tracking-widest h-14"
            maxLength={4}
            disabled={isLocked}
          />
        )}

        {error && !isLocked && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="flex gap-3 mt-1">
          <Button variant="outline" onClick={handleClose} className="flex-1" disabled={isLoading || isEscalating}>
            {isLocked ? 'Close' : 'Cancel'}
          </Button>
          {!isLocked && (
            <Button
              onClick={handleVerify}
              disabled={!otp.trim() || isLoading || isEscalating}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {isLoading || isEscalating
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : "Verify & Deliver"
              }
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
