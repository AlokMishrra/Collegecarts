import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Package, ArrowUpCircle, AlertTriangle, Loader2, PlusCircle, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";

export default function WalletDashboard({ deliveryPerson, onUpdate, todayEarningsFromParent }) {
  const [transactions, setTransactions] = useState([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showAddMoneyDialog, setShowAddMoneyDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawUpiId, setWithdrawUpiId] = useState("");
  const [addMoneyAmount, setAddMoneyAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [withdrawSource, setWithdrawSource] = useState("wallet");

  useEffect(() => { loadData(); }, [deliveryPerson.id]);

  const loadData = async () => {
    const [txns, withdrawals] = await Promise.all([
      base44.entities.WalletTransaction.filter({ delivery_person_id: deliveryPerson.id }, '-created_date', 50).catch(() => []),
      base44.entities.WithdrawalRequest.filter({ delivery_person_id: deliveryPerson.id, status: "pending" }).catch(() => []),
    ]);
    setTransactions(txns);
    setPendingWithdrawals(withdrawals);
    const today = new Date().toDateString();
    const earn = txns
      .filter(t => new Date(t.created_date).toDateString() === today && t.type === "delivery_earning")
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    setTodayEarnings(todayEarningsFromParent !== undefined ? todayEarningsFromParent : earn);
  };

  const dailyEarningsList = Object.values(
    transactions
      .filter(t => t.type === "delivery_earning")
      .reduce((acc, t) => {
        const key = new Date(t.created_date).toDateString();
        if (!acc[key]) acc[key] = { date: new Date(t.created_date), amount: 0, count: 0 };
        acc[key].amount += t.amount || 0;
        acc[key].count++;
        return acc;
      }, {})
  ).sort((a, b) => b.date - a.date);

  const handleRequestWithdrawal = async () => {
    const amount = parseFloat(withdrawAmount);
    const maxAmount = withdrawSource === "earnings" ? (deliveryPerson.total_earnings || 0) : walletBalance;
    if (!amount || amount <= 0 || amount > maxAmount) return;
    setIsLoading(true);
    await base44.entities.WithdrawalRequest.create({
      delivery_person_id: deliveryPerson.id,
      delivery_person_name: deliveryPerson.name,
      amount,
      upi_id: withdrawUpiId,
      type: "withdrawal",
      status: "pending",
      notes: withdrawSource === "earnings" ? "Withdrawal from total earnings" : "Withdrawal from wallet balance"
    });
    setShowWithdrawDialog(false);
    setWithdrawAmount("");
    setWithdrawUpiId("");
    setWithdrawSource("wallet");
    loadData();
    setIsLoading(false);
  };

  // ─── Razorpay Add Money ──────────────────────────────────────────────────
  const handleAddMoneyRazorpay = async () => {
    const amount = parseFloat(addMoneyAmount);
    if (!amount || amount <= 0) return;
    setIsPaymentLoading(true);

    try {
      // Load Razorpay script if not already loaded
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      // Create Razorpay order
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
          amount,
          customerName: deliveryPerson.name,
          customerPhone: deliveryPerson.phone || '0000000000',
          customerEmail: deliveryPerson.email || 'partner@collegecart.in'
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create payment order');
      }

      const data = await response.json();
      if (!data?.razorpayOrderId) throw new Error('Payment order ID not received');

      setIsPaymentLoading(false);

      // Open Razorpay checkout
      const options = {
        key: data.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: data.currency || 'INR',
        name: 'CollegeCart',
        description: 'Wallet Top-up',
        order_id: data.razorpayOrderId,
        handler: async function (rzpResponse) {
          try {
            setIsPaymentLoading(true);

            // Verify payment
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-cod-payment', {
              body: {
                orderId: `wallet_${deliveryPerson.id}`,
                razorpayOrderId: rzpResponse.razorpay_order_id,
                razorpayPaymentId: rzpResponse.razorpay_payment_id,
                razorpaySignature: rzpResponse.razorpay_signature
              }
            });

            if (verifyError || !verifyData?.success) {
              throw new Error('Payment verification failed');
            }

            // Update wallet balance in DB
            const newBalance = (deliveryPerson.wallet_balance || 0) + amount;
            const { error: updateError } = await supabase
              .from('delivery_persons')
              .update({ wallet_balance: newBalance })
              .eq('id', deliveryPerson.id);

            if (updateError) throw updateError;

            // Log transaction
            await base44.entities.WalletTransaction.create({
              delivery_person_id: deliveryPerson.id,
              amount,
              type: "deposit",
              description: `Wallet top-up via Razorpay (${rzpResponse.razorpay_payment_id})`
            }).catch(() => {});

            // Fetch fresh data and update parent in real-time
            const { data: fresh } = await supabase
              .from('delivery_persons')
              .select('*')
              .eq('id', deliveryPerson.id)
              .single();

            if (fresh && onUpdate) onUpdate(fresh);

            setShowAddMoneyDialog(false);
            setAddMoneyAmount("");
            loadData();

            import('sonner').then(({ toast }) => {
              toast.success(`✅ ₹${amount} added to your wallet!`);
            });
          } catch (err) {
            console.error('Payment verification error:', err);
            import('sonner').then(({ toast }) => {
              toast.error('Payment verification failed. Contact admin if amount was deducted.');
            });
          } finally {
            setIsPaymentLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsPaymentLoading(false);
            import('sonner').then(({ toast }) => {
              toast.info('Payment cancelled.');
            });
          }
        },
        prefill: {
          name: deliveryPerson.name || '',
          contact: deliveryPerson.phone || '',
          email: deliveryPerson.email || ''
        },
        theme: { color: '#10b981' }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('Add money error:', err);
      setIsPaymentLoading(false);
      import('sonner').then(({ toast }) => {
        toast.error(err.message || 'Payment failed. Try again or contact admin.');
      });
    }
  };

  const walletBalance = deliveryPerson.wallet_balance || 0;
  const isNegative = walletBalance < 0;
  const cashOwed = isNegative ? Math.abs(walletBalance) : 0;

  const txTypeLabel = {
    delivery_earning: "Commission",
    cod_collection: "COD Collected",
    cash_submitted: "Cash Submitted",
    withdrawal: "Withdrawal",
    deposit: "Deposit",
    incentive: "Incentive"
  };

  return (
    <div className="space-y-4">
      {/* Balance Card */}
      <Card className={`border-2 ${isNegative ? "border-red-300 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className={`w-5 h-5 ${isNegative ? "text-red-600" : "text-emerald-600"}`} />
            <h3 className="font-bold text-gray-900">My Wallet</h3>
            {isNegative && <Badge className="bg-red-100 text-red-700 ml-auto">Submit Cash Required</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Current Balance</p>
              <p className={`text-2xl font-bold ${isNegative ? "text-red-600" : "text-emerald-600"}`}>
                {isNegative ? "-" : ""}₹{Math.abs(walletBalance).toFixed(2)}
              </p>
              {isNegative && <p className="text-xs text-red-500">COD cash owed</p>}
            </div>
            <div className="bg-white rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Today's Earnings</p>
              <p className="text-2xl font-bold text-blue-600">₹{todayEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Lifetime Earnings</p>
              <p className="text-xl font-bold text-amber-600">₹{(deliveryPerson.lifetime_earnings || 0).toFixed(2)}</p>
              <p className="text-[10px] text-gray-400">Never resets</p>
            </div>
            <div className="bg-white rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">COD Held</p>
              <p className="text-xl font-bold text-orange-600">₹{(deliveryPerson.cod_balance || 0).toFixed(2)}</p>
              <p className="text-[10px] text-gray-400">Cash in hand</p>
            </div>
            <div className="bg-white rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Total Earnings</p>
              <p className="text-xl font-bold text-purple-600">₹{(deliveryPerson.total_earnings || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Total Deliveries</p>
              <div className="flex items-center gap-1">
                <Package className="w-4 h-4 text-gray-400" />
                <p className="text-xl font-bold text-gray-800">{deliveryPerson.total_deliveries || 0}</p>
              </div>
            </div>
          </div>

          {pendingWithdrawals.length > 0 && (
            <p className="text-xs text-orange-600 mb-3 font-medium">{pendingWithdrawals.length} pending request(s) awaiting admin approval</p>
          )}

          {isNegative && (
            <div className="bg-red-100 rounded-lg p-3 flex items-start gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700">
                You collected ₹{cashOwed.toFixed(2)} COD cash. Submit it physically to admin — they will reset your wallet.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {walletBalance > 0 && (
              <Button size="sm" variant="outline" onClick={() => { setWithdrawSource("wallet"); setShowWithdrawDialog(true); }} className="border-emerald-500 text-emerald-600 hover:bg-emerald-50">
                <ArrowUpCircle className="w-4 h-4 mr-1" />Withdraw Wallet
              </Button>
            )}
            {(deliveryPerson.total_earnings || 0) > 0 && (
              <Button size="sm" variant="outline" onClick={() => { setWithdrawSource("earnings"); setWithdrawAmount(""); setShowWithdrawDialog(true); }} className="border-purple-500 text-purple-600 hover:bg-purple-50">
                <ArrowUpCircle className="w-4 h-4 mr-1" />Withdraw Earnings
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => { setShowAddMoneyDialog(true); setAddMoneyAmount(""); }} className="border-blue-500 text-blue-600 hover:bg-blue-50">
              <PlusCircle className="w-4 h-4 mr-1" />Add Money
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions / Daily Earnings Tabs */}
      <Tabs defaultValue="transactions">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="daily"><Calendar className="w-3.5 h-3.5 mr-1" />Daily Earnings</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          {transactions.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y max-h-72 overflow-y-auto">
                  {transactions.map((txn, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-xs font-medium text-gray-800 truncate">{txn.description}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[9px] px-1 py-0">{txTypeLabel[txn.type] || txn.type}</Badge>
                          <p className="text-[10px] text-gray-400">{new Date(txn.created_date).toLocaleDateString('en-IN')}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 ${txn.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {txn.amount >= 0 ? "+" : ""}₹{Math.abs(txn.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-center text-gray-400 py-8 text-sm">No transactions yet</p>
          )}
        </TabsContent>

        <TabsContent value="daily">
          {dailyEarningsList.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-700">Commission Earned Per Day</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-72 overflow-y-auto">
                  {dailyEarningsList.map((day, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {day.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-gray-400">{day.count} delivery{day.count > 1 ? "s" : ""}</p>
                      </div>
                      <p className="text-lg font-bold text-emerald-600">₹{day.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-center text-gray-400 py-8 text-sm">No earnings recorded yet</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{withdrawSource === "earnings" ? "Withdraw from Total Earnings" : "Withdraw from Wallet"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Available</p>
              <p className={`text-xl font-bold ${withdrawSource === "earnings" ? "text-purple-600" : "text-emerald-600"}`}>
                ₹{withdrawSource === "earnings" ? (deliveryPerson.total_earnings || 0).toFixed(2) : walletBalance.toFixed(2)}
              </p>
            </div>
            <div>
              <Label>Amount to Withdraw</Label>
              <Input type="number" placeholder="Enter amount" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
            </div>
            <div>
              <Label>Your UPI ID</Label>
              <Input placeholder="yourname@upi" value={withdrawUpiId} onChange={(e) => setWithdrawUpiId(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowWithdrawDialog(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={handleRequestWithdrawal}
                disabled={isLoading || !withdrawAmount || !withdrawUpiId || parseFloat(withdrawAmount) > (withdrawSource === "earnings" ? (deliveryPerson.total_earnings || 0) : walletBalance) || parseFloat(withdrawAmount) <= 0}
                className={`flex-1 ${withdrawSource === "earnings" ? "bg-purple-600 hover:bg-purple-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Money via Razorpay Dialog */}
      <Dialog open={showAddMoneyDialog} onOpenChange={(o) => { if (!o) setAddMoneyAmount(""); setShowAddMoneyDialog(o); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-blue-600" />Add Money to Wallet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Pay securely via Razorpay</p>
              <p className="text-xs text-gray-400">UPI · Cards · Net Banking · Wallets</p>
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                placeholder="Enter amount to add"
                value={addMoneyAmount}
                onChange={(e) => setAddMoneyAmount(e.target.value)}
                min={1}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowAddMoneyDialog(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={handleAddMoneyRazorpay}
                disabled={isPaymentLoading || !addMoneyAmount || parseFloat(addMoneyAmount) <= 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isPaymentLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing...</>
                  : `💳 Pay ₹${addMoneyAmount || '0'}`
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
