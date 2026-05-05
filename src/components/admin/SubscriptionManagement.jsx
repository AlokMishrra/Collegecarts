import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Clock, Users, TrendingUp, Loader2, Crown, Plus, Edit2, Star, Gift } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_PLANS = {
  student: { label: "Student Plan", price: 99 },
  faculty: { label: "Faculty Plan", price: 199 }
};

const STATUS_STYLES = {
  pending_verification: "bg-yellow-100 text-yellow-800",
  active: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-600"
};

export default function SubscriptionManagement() {
  const [subs, setSubs] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showLoyaltyDialog, setShowLoyaltyDialog] = useState(false);
  const [selectedSub, setSelectedSub] = useState(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [createForm, setCreateForm] = useState({ user_id: "", user_email: "", user_name: "", plan_type: "student", months: 1, amount: 99 });
  const [editForm, setEditForm] = useState({ plan_type: "student", status: "active", amount_paid: 99, end_date: "", admin_notes: "" });
  const [loyaltyForm, setLoyaltyForm] = useState({ user_id: "", user_name: "", points: "", reason: "", type: "bonus" });
  // Plan price management
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [editingPlan, setEditingPlan] = useState(null);
  const [newPlanKey, setNewPlanKey] = useState("");
  const [newPlanLabel, setNewPlanLabel] = useState("");
  const [newPlanPrice, setNewPlanPrice] = useState("");
  const [settingsId, setSettingsId] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [data, userList, settingsList] = await Promise.all([
      base44.entities.Subscription.list('-created_date', 200).catch(() => []),
      base44.entities.User.list().catch(() => []),
      base44.entities.Settings.list().catch(() => [])
    ]);
    setSubs(data);
    setUsers(userList);
    // Load plans from settings if available
    if (settingsList.length > 0 && settingsList[0].subscription_plans?.length > 0) {
      const savedPlans = {};
      settingsList[0].subscription_plans.forEach(p => {
        savedPlans[p.type] = { label: p.name, price: p.price };
      });
      setPlans(savedPlans);
      setSettingsId(settingsList[0].id);
    } else if (settingsList.length > 0) {
      setSettingsId(settingsList[0].id);
    }
    setIsLoading(false);
  };

  const savePlansToSettings = async (updatedPlans) => {
    if (!settingsId) return;
    const plansArray = Object.entries(updatedPlans).map(([type, p]) => ({
      type,
      name: p.label,
      price: p.price,
      icon: p.icon || "⭐",
      perks: p.perks || ["Free delivery on all orders", "Valid for 1 month", "Priority customer support"]
    }));
    try {
      await supabase.from('settings').update({ subscription_plans: plansArray }).eq('id', settingsId);
    } catch (e) {
      console.error('Failed to save plans:', e);
    }
  };

  const getEndDate = (months) => {
    const end = new Date();
    end.setMonth(end.getMonth() + months);
    return end.toISOString();
  };

  const approveSub = async (sub) => {
    setIsProcessing(true);
    const now = new Date();
    const endDate = getEndDate(1);
    const updated = { ...sub, status: 'active', start_date: now.toISOString(), end_date: endDate, admin_notes: "" };
    // Optimistic update
    setSubs(prev => prev.map(s => s.id === sub.id ? updated : s));
    await Promise.all([
      base44.entities.Subscription.update(sub.id, { status: 'active', start_date: now.toISOString(), end_date: endDate, admin_notes: "" }),
      base44.entities.Notification.create({ user_id: sub.user_id, title: "🎉 Premium Activated!", message: `Your ${plans[sub.plan_type]?.label || sub.plan_type} is now active. Enjoy free delivery for 1 month!`, type: "success" })
    ]).catch(() => {});
    setIsProcessing(false);
    toast.success("Subscription approved!");
  };

  const openRejectDialog = (sub) => {
    setSelectedSub(sub);
    setAdminNotes("");
    setShowRejectDialog(true);
  };

  const rejectSub = async () => {
    if (!selectedSub) return;
    setIsProcessing(true);
    const updated = { ...selectedSub, status: 'rejected', admin_notes: adminNotes };
    setSubs(prev => prev.map(s => s.id === selectedSub.id ? updated : s));
    await Promise.all([
      base44.entities.Subscription.update(selectedSub.id, { status: 'rejected', admin_notes: adminNotes }),
      base44.entities.Notification.create({ user_id: selectedSub.user_id, title: "Subscription Request Rejected", message: `Your subscription was not approved. ${adminNotes ? `Reason: ${adminNotes}` : "Please contact support."}`, type: "error" })
    ]).catch(() => {});
    setShowRejectDialog(false);
    setSelectedSub(null);
    setIsProcessing(false);
    toast.success("Subscription rejected.");
  };

  const cancelSub = async (sub) => {
    if (!window.confirm(`Cancel subscription for ${sub.user_name}?`)) return;
    setIsProcessing(true);
    const updated = { ...sub, status: 'cancelled', admin_notes: 'Cancelled by admin' };
    setSubs(prev => prev.map(s => s.id === sub.id ? updated : s));
    await Promise.all([
      base44.entities.Subscription.update(sub.id, { status: 'cancelled', admin_notes: 'Cancelled by admin' }),
      base44.entities.Notification.create({ user_id: sub.user_id, title: "Subscription Cancelled", message: "Your premium subscription has been cancelled by admin.", type: "info" })
    ]).catch(() => {});
    setIsProcessing(false);
    toast.success("Subscription cancelled.");
  };

  const handleCreateSubscription = async () => {
    if (!createForm.user_id || !createForm.plan_type) return;
    setIsProcessing(true);
    const plan = plans[createForm.plan_type] || { label: createForm.plan_type, price: 0 };
    const months = parseInt(createForm.months) || 1;
    const amount = parseFloat(createForm.amount) || plan.price * months;
    const now = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);
    try {
      const newSub = await base44.entities.Subscription.create({
        user_id: createForm.user_id,
        user_email: createForm.user_email,
        user_name: createForm.user_name,
        plan_type: createForm.plan_type,
        status: 'active',
        amount_paid: amount,
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
        upi_id: "admin-created",
        transaction_id: "admin-created"
      });
      setSubs(prev => [newSub, ...prev]);
      await base44.entities.Notification.create({ user_id: createForm.user_id, title: "🎉 Premium Activated!", message: `Your ${plan.label} has been activated for ${months} month${months > 1 ? "s" : ""}. Enjoy free delivery!`, type: "success" }).catch(() => {});
      setShowCreateDialog(false);
      setCreateForm({ user_id: "", user_email: "", user_name: "", plan_type: "student", months: 1, amount: plans.student?.price || 99 });
      toast.success("Subscription created successfully!");
    } catch (err) {
      toast.error("Failed to create subscription.");
    }
    setIsProcessing(false);
  };

  const openEditDialog = (sub) => {
    setSelectedSub(sub);
    setEditForm({
      plan_type: sub.plan_type || "student",
      status: sub.status || "active",
      amount_paid: sub.amount_paid || 0,
      end_date: sub.end_date ? new Date(sub.end_date).toISOString().split('T')[0] : "",
      admin_notes: sub.admin_notes || ""
    });
    setShowEditDialog(true);
  };

  const handleEditSubscription = async () => {
    if (!selectedSub) return;
    setIsProcessing(true);
    const updateData = {
      plan_type: editForm.plan_type,
      status: editForm.status,
      amount_paid: parseFloat(editForm.amount_paid) || 0,
      admin_notes: editForm.admin_notes
    };
    if (editForm.end_date) updateData.end_date = new Date(editForm.end_date).toISOString();
    // Optimistic update
    setSubs(prev => prev.map(s => s.id === selectedSub.id ? { ...s, ...updateData } : s));
    await base44.entities.Subscription.update(selectedSub.id, updateData).catch(() => {});
    if (editForm.status !== selectedSub.status) {
      const msg = editForm.status === 'active'
        ? `Your ${plans[editForm.plan_type]?.label || editForm.plan_type} has been reactivated. Enjoy free delivery!`
        : `Your subscription status has been updated to: ${editForm.status}.`;
      await base44.entities.Notification.create({ user_id: selectedSub.user_id, title: "Subscription Updated", message: msg, type: editForm.status === 'active' ? "success" : "info" }).catch(() => {});
    }
    setShowEditDialog(false);
    setSelectedSub(null);
    setIsProcessing(false);
    toast.success("Subscription updated!");
  };

  const openLoyaltyDialog = (user = null) => {
    setLoyaltyForm({
      user_id: user?.id || "",
      user_name: user?.full_name || user?.email || "",
      points: "",
      reason: "",
      type: "bonus"
    });
    setShowLoyaltyDialog(true);
  };

  const handleAddLoyaltyPoints = async () => {
    const rawPts = parseInt(loyaltyForm.points);
    if (!loyaltyForm.user_id || !rawPts || rawPts <= 0) return;
    // For 'redeemed' type, negate the points so it actually deducts
    const pts = loyaltyForm.type === 'redeemed' ? -rawPts : rawPts;
    setIsProcessing(true);
    try {
      const txns = await base44.entities.LoyaltyTransaction.filter({ user_id: loyaltyForm.user_id }).catch(() => []);
      const currentBalance = txns.reduce((sum, t) => sum + (t.points || 0), 0);
      const newBalance = currentBalance + pts;
      await Promise.all([
        base44.entities.LoyaltyTransaction.create({
          user_id: loyaltyForm.user_id,
          points: pts,
          transaction_type: loyaltyForm.type,
          description: loyaltyForm.reason || `Admin ${pts > 0 ? 'added' : 'deducted'} ${Math.abs(pts)} points`,
          balance_after: newBalance
        }),
        base44.entities.Notification.create({
          user_id: loyaltyForm.user_id,
          title: pts > 0 ? "🌟 Loyalty Points Added!" : "Loyalty Points Deducted",
          message: `${Math.abs(pts)} loyalty points have been ${pts > 0 ? 'added to' : 'deducted from'} your account.${loyaltyForm.reason ? ` Reason: ${loyaltyForm.reason}.` : ''} New balance: ${newBalance} points.`,
          type: pts > 0 ? "success" : "info"
        })
      ]);
      setShowLoyaltyDialog(false);
      setLoyaltyForm({ user_id: "", user_name: "", points: "", reason: "", type: "bonus" });
      toast.success(`${Math.abs(pts)} loyalty points ${pts > 0 ? 'added' : 'deducted'} successfully!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update loyalty points.");
    }
    setIsProcessing(false);
  };

  const handleUserSelect = (userId) => {
    const u = users.find(u => u.id === userId);
    setCreateForm(f => ({
      ...f,
      user_id: userId,
      user_email: u?.email || "",
      user_name: u?.full_name || ""
    }));
  };

  // Plan management
  const handleSavePlanPrice = async (key) => {
    if (!editingPlan || editingPlan.key !== key) return;
    const price = parseFloat(editingPlan.price);
    if (!price || price <= 0) return;
    const updated = { ...plans, [key]: { ...plans[key], price, label: editingPlan.label } };
    setPlans(updated);
    setEditingPlan(null);
    await savePlansToSettings(updated);
    toast.success(`${editingPlan.label} updated to ₹${price}/month`);
  };

  const handleAddNewPlan = async () => {
    const key = newPlanKey.trim().toLowerCase().replace(/\s+/g, '_');
    const price = parseFloat(newPlanPrice);
    if (!key || !newPlanLabel.trim() || !price || price <= 0) {
      toast.error("Fill in all plan fields.");
      return;
    }
    if (plans[key]) { toast.error("Plan key already exists."); return; }
    const updated = { ...plans, [key]: { label: newPlanLabel.trim(), price } };
    setPlans(updated);
    setNewPlanKey(""); setNewPlanLabel(""); setNewPlanPrice("");
    await savePlansToSettings(updated);
    toast.success(`${newPlanLabel} plan added!`);
  };

  const handleDeletePlan = async (key) => {
    if (Object.keys(plans).length <= 1) { toast.error("Must keep at least one plan."); return; }
    const updated = { ...plans };
    delete updated[key];
    setPlans(updated);
    await savePlansToSettings(updated);
    toast.success("Plan removed.");
  };

  const pending = subs.filter(s => s.status === 'pending_verification');
  const active = subs.filter(s => s.status === 'active');
  const revenue = active.reduce((sum, s) => sum + (s.amount_paid || 0), 0);

  const renderSubCard = (sub) => (
    <div key={sub.id} className="border rounded-xl p-4 bg-white hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-semibold text-gray-900">{sub.user_name || 'Unknown User'}</p>
            <Badge className={STATUS_STYLES[sub.status] || "bg-gray-100 text-gray-600"}>
              {sub.status?.replace(/_/g, ' ')}
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mb-1 truncate">{sub.user_email}</p>
          <p className="text-sm font-medium text-gray-700">
            {plans[sub.plan_type]?.label || sub.plan_type} · <span className="text-emerald-600 font-bold">₹{sub.amount_paid}</span>
          </p>
          {sub.upi_id && sub.upi_id !== "admin-created" && (
            <p className="text-xs text-gray-500 mt-1">UPI: <span className="font-mono text-blue-600">{sub.upi_id}</span></p>
          )}
          {sub.transaction_id && sub.transaction_id !== "admin-created" && (
            <p className="text-xs text-gray-500">TXN: <span className="font-mono text-emerald-600">{sub.transaction_id}</span></p>
          )}
          {sub.status === 'active' && sub.start_date && sub.end_date && (
            <p className="text-xs text-emerald-600 mt-1">
              ✓ {new Date(sub.start_date).toLocaleDateString('en-IN')} → {new Date(sub.end_date).toLocaleDateString('en-IN')}
            </p>
          )}
          {sub.admin_notes && <p className="text-xs text-red-500 mt-1 italic">Note: {sub.admin_notes}</p>}
          <p className="text-[10px] text-gray-400 mt-1">
            {new Date(sub.created_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={() => openEditDialog(sub)} disabled={isProcessing} className="text-xs border-blue-300 text-blue-600 hover:bg-blue-50">
            <Edit2 className="w-3.5 h-3.5 mr-1" />Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => openLoyaltyDialog({ id: sub.user_id, full_name: sub.user_name, email: sub.user_email })} disabled={isProcessing} className="text-xs border-yellow-300 text-yellow-700 hover:bg-yellow-50">
            <Star className="w-3.5 h-3.5 mr-1" />Points
          </Button>
          {sub.status === 'pending_verification' && (
            <>
              <Button size="sm" onClick={() => approveSub(sub)} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => openRejectDialog(sub)} disabled={isProcessing} className="text-xs">
                <XCircle className="w-3.5 h-3.5 mr-1" />Reject
              </Button>
            </>
          )}
          {sub.status === 'active' && (
            <Button size="sm" variant="destructive" onClick={() => cancelSub(sub)} disabled={isProcessing} className="text-xs">
              <XCircle className="w-3.5 h-3.5 mr-1" />Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />Subscription Management
          </h2>
          <p className="text-gray-500 text-sm">Student ₹99/mo · Faculty ₹199/mo</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => openLoyaltyDialog()} variant="outline" className="border-yellow-400 text-yellow-700 hover:bg-yellow-50 flex-shrink-0">
            <Star className="w-4 h-4 mr-1" />Loyalty Points
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} className="bg-yellow-500 hover:bg-yellow-600 text-white flex-shrink-0">
            <Plus className="w-4 h-4 mr-1" />Add Subscription
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-3 text-center">
            <Clock className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-yellow-700">{pending.length}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-emerald-700">{active.length}</p>
            <p className="text-xs text-gray-500">Active</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-blue-700">₹{revenue.toFixed(0)}</p>
            <p className="text-xs text-gray-500">Revenue</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="pending">
              Pending{pending.length > 0 && <Badge className="ml-1.5 bg-yellow-500 text-white text-xs px-1.5">{pending.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="all">All ({subs.length})</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-3 space-y-3">
            {pending.length === 0 ? <p className="text-center text-gray-400 py-10 text-sm">No pending requests</p> : pending.map(sub => renderSubCard(sub))}
          </TabsContent>
          <TabsContent value="active" className="mt-3 space-y-3">
            {active.length === 0 ? <p className="text-center text-gray-400 py-10 text-sm">No active subscriptions</p> : active.map(sub => renderSubCard(sub))}
          </TabsContent>
          <TabsContent value="all" className="mt-3 space-y-3">
            {subs.length === 0 ? <p className="text-center text-gray-400 py-10 text-sm">No subscriptions yet</p> : subs.map(sub => renderSubCard(sub))}
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans" className="mt-3 space-y-4">
            <p className="text-sm text-gray-500">Manage subscription plans and prices. Changes reflect immediately in the Create Subscription dialog.</p>

            {/* Existing Plans */}
            <div className="space-y-3">
              {Object.entries(plans).map(([key, plan]) => (
                <div key={key} className="border rounded-xl p-4 bg-white">
                  {editingPlan?.key === key ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs">Plan Name</Label>
                          <Input value={editingPlan.label} onChange={e => setEditingPlan(p => ({ ...p, label: e.target.value }))} className="mt-1" />
                        </div>
                        <div className="w-28">
                          <Label className="text-xs">Price (₹/mo)</Label>
                          <Input type="number" min={1} value={editingPlan.price} onChange={e => setEditingPlan(p => ({ ...p, price: e.target.value }))} className="mt-1" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSavePlanPrice(key)} className="bg-emerald-600 hover:bg-emerald-700 text-xs">Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingPlan(null)} className="text-xs">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{plan.label}</p>
                        <p className="text-sm text-emerald-600 font-bold">₹{plan.price}<span className="text-gray-400 font-normal text-xs">/month</span></p>
                        <p className="text-xs text-gray-400">Key: <code className="bg-gray-100 px-1 rounded">{key}</code></p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingPlan({ key, label: plan.label, price: plan.price })} className="text-xs border-blue-300 text-blue-600">
                          <Edit2 className="w-3.5 h-3.5 mr-1" />Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeletePlan(key)} className="text-xs border-red-300 text-red-600">
                          <XCircle className="w-3.5 h-3.5 mr-1" />Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add New Plan */}
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Plus className="w-4 h-4" />Add New Plan</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Plan Name</Label>
                  <Input placeholder="e.g. Premium" value={newPlanLabel} onChange={e => setNewPlanLabel(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Key (no spaces)</Label>
                  <Input placeholder="e.g. premium" value={newPlanKey} onChange={e => setNewPlanKey(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Price (₹/month)</Label>
                <Input type="number" min={1} placeholder="e.g. 299" value={newPlanPrice} onChange={e => setNewPlanPrice(e.target.value)} className="mt-1" />
              </div>
              <Button onClick={handleAddNewPlan} className="w-full bg-emerald-600 hover:bg-emerald-700 text-sm">
                <Plus className="w-4 h-4 mr-1" />Add Plan
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Create Subscription Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-500" />Create Subscription</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Select User</Label>
              <Select onValueChange={v => {
                const u = users.find(u => u.id === v);
                setCreateForm(f => ({ ...f, user_id: v, user_email: u?.email || "", user_name: u?.full_name || "" }));
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Plan</Label>
              <Select value={createForm.plan_type} onValueChange={v => setCreateForm(f => ({ ...f, plan_type: v, amount: plans[v]?.price * (parseInt(f.months) || 1) }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(plans).map(([key, plan]) => (
                    <SelectItem key={key} value={key}>{plan.label} — ₹{plan.price}/month</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Duration (months)</Label>
              <Input type="number" min={1} max={12} value={createForm.months}
                onChange={e => setCreateForm(f => ({ ...f, months: e.target.value, amount: plans[f.plan_type]?.price * (parseInt(e.target.value) || 1) }))}
                className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Amount to Charge (₹) <span className="text-gray-400">— editable</span></Label>
              <Input type="number" min={0} value={createForm.amount}
                onChange={e => setCreateForm(f => ({ ...f, amount: e.target.value }))}
                className="mt-1" />
              <p className="text-xs text-gray-400 mt-1">
                Valid till: {new Date(getEndDate(parseInt(createForm.months) || 1)).toLocaleDateString('en-IN')}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSubscription} disabled={isProcessing || !createForm.user_id} className="bg-yellow-500 hover:bg-yellow-600">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Activate Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subscription Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-blue-500" />Edit Subscription
            </DialogTitle>
          </DialogHeader>
          {selectedSub && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-semibold">{selectedSub.user_name}</p>
                <p className="text-gray-500 text-xs">{selectedSub.user_email}</p>
              </div>
              <div>
                <Label className="text-xs">Plan</Label>
                <Select value={editForm.plan_type} onValueChange={v => setEditForm(f => ({ ...f, plan_type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(plans).map(([key, plan]) => (
                      <SelectItem key={key} value={key}>{plan.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending_verification">Pending Verification</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Amount Paid (₹)</Label>
                <Input type="number" min={0} value={editForm.amount_paid}
                  onChange={e => setEditForm(f => ({ ...f, amount_paid: e.target.value }))}
                  className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Expiry Date</Label>
                <Input type="date" value={editForm.end_date}
                  onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))}
                  className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Admin Notes</Label>
                <Textarea placeholder="Internal notes..." value={editForm.admin_notes}
                  onChange={e => setEditForm(f => ({ ...f, admin_notes: e.target.value }))}
                  rows={2} className="mt-1" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleEditSubscription} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loyalty Points Dialog */}
      <Dialog open={showLoyaltyDialog} onOpenChange={setShowLoyaltyDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />Add / Deduct Loyalty Points
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Select User</Label>
              <Select value={loyaltyForm.user_id} onValueChange={v => {
                const u = users.find(u => u.id === v);
                setLoyaltyForm(f => ({ ...f, user_id: v, user_name: u?.full_name || u?.email || "" }));
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={loyaltyForm.type} onValueChange={v => setLoyaltyForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonus">Bonus (Add)</SelectItem>
                  <SelectItem value="earned">Earned (Add)</SelectItem>
                  <SelectItem value="redeemed">Deduct</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">
                Points {loyaltyForm.type === 'redeemed' ? '(will be deducted — enter positive number)' : '(to add)'}
              </Label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 100"
                value={loyaltyForm.points}
                onChange={e => setLoyaltyForm(f => ({ ...f, points: e.target.value }))}
                className="mt-1"
              />
              {loyaltyForm.points && (
                <p className="text-xs text-gray-500 mt-1">
                  Worth ₹{(Math.abs(parseInt(loyaltyForm.points) || 0) / 10).toFixed(2)} in discounts
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Reason (shown to user)</Label>
              <Input
                placeholder="e.g. Welcome bonus, Referral reward..."
                value={loyaltyForm.reason}
                onChange={e => setLoyaltyForm(f => ({ ...f, reason: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowLoyaltyDialog(false)}>Cancel</Button>
            <Button
              onClick={handleAddLoyaltyPoints}
              disabled={isProcessing || !loyaltyForm.user_id || !loyaltyForm.points}
              className={loyaltyForm.type === 'redeemed' ? "bg-red-600 hover:bg-red-700" : "bg-yellow-500 hover:bg-yellow-600"}
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                loyaltyForm.type === 'redeemed'
                  ? <><Gift className="w-4 h-4 mr-1" />Deduct Points</>
                  : <><Star className="w-4 h-4 mr-1" />Add Points</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Reject Subscription</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Rejecting <strong>{selectedSub?.user_name}</strong> — {plans[selectedSub?.plan_type]?.label || selectedSub?.plan_type}</p>
            <div>
              <Label>Reason (sent to user)</Label>
              <Textarea placeholder="Enter rejection reason..." value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={3} className="mt-1" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={rejectSub} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}