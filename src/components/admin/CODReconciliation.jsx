import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, RefreshCw, DollarSign } from "lucide-react";
import { toast } from "sonner";

export default function CODReconciliation() {
  const [partners, setPartners] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [adminUser, setAdminUser] = useState(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    base44.auth.me().then(setAdminUser).catch(() => {});
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allPartners, recentSubmissions] = await Promise.all([
        base44.entities.DeliveryPerson.list().catch(() => []),
        supabase
          .from('cod_submissions')
          .select('*')
          .order('submitted_at', { ascending: false })
          .limit(50)
          .then(r => r.data || [])
          .catch(() => [])
      ]);

      setPartners(allPartners);
      setSubmissions(recentSubmissions);
    } catch (err) {
      console.error('COD reconciliation load error:', err);
    }
    setIsLoading(false);
  };

  const handleMarkSubmitted = async (partner) => {
    if (!window.confirm(`Mark ₹${partner.cod_held?.toFixed(2)} as submitted by ${partner.name}?`)) return;

    setProcessingId(partner.id);
    try {
      const { data, error } = await supabase.rpc('submit_cod_cash', {
        p_partner_id: partner.id,
        p_admin_id: adminUser?.id || null,
        p_notes: 'Marked submitted by admin'
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'RPC failed');

      toast.success(`Rs.${partner.cod_held?.toFixed(2)} marked as submitted for ${partner.name}`);
      await loadData();
    } catch (err) {
      console.error('Mark submitted error:', err);
      toast.error('Failed to mark as submitted. Try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const getPartnerStatus = (partner) => {
    if (!partner.cod_held || partner.cod_held <= 0) {
      return { label: '✅ Clear', color: 'bg-green-100 text-green-700', hoursLeft: null };
    }
    if (!partner.cod_held_since) {
      return { label: '⚠️ Held', color: 'bg-yellow-100 text-yellow-700', hoursLeft: null };
    }
    const hoursHeld = (Date.now() - new Date(partner.cod_held_since).getTime()) / (1000 * 60 * 60);
    if (hoursHeld >= 24) {
      return { label: '🔴 Overdue', color: 'bg-red-100 text-red-700', hoursLeft: 0 };
    }
    const hoursLeft = Math.ceil(24 - hoursHeld);
    const color = hoursLeft <= 4 ? 'bg-red-100 text-red-700' : hoursLeft <= 8 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700';
    return { label: `⏱ ${hoursLeft}h left`, color, hoursLeft };
  };

  // Summary stats
  const totalCodHeld = partners.reduce((sum, p) => sum + (p.cod_held || 0), 0);
  const partnersHoldingCash = partners.filter(p => (p.cod_held || 0) > 0).length;
  const overduePartners = partners.filter(p => {
    if (!p.cod_held || p.cod_held <= 0 || !p.cod_held_since) return false;
    return (Date.now() - new Date(p.cod_held_since).getTime()) / (1000 * 60 * 60) >= 24;
  }).length;
  const today = new Date().toDateString();
  const collectedToday = submissions.filter(s => new Date(s.submitted_at).toDateString() === today).length;

  if (isLoading && partners.length === 0) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">💵 COD Reconciliation</h2>
          <p className="text-sm text-gray-600 mt-1">Track cash held by delivery partners</p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Total COD Held</p>
            <p className="text-2xl font-bold text-orange-600">₹{totalCodHeld.toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Partners Holding Cash</p>
            <p className="text-2xl font-bold text-yellow-600">{partnersHoldingCash}</p>
          </CardContent>
        </Card>
        <Card className={overduePartners > 0 ? 'border-red-300' : ''}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Overdue (&gt;24hrs)</p>
            <p className={`text-2xl font-bold ${overduePartners > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {overduePartners}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Collected Today</p>
            <p className="text-2xl font-bold text-green-600">{collectedToday}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-partner table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Partner COD Status</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Partner</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Cash Held</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Held Since</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {partners.map(partner => {
                  const status = getPartnerStatus(partner);
                  return (
                    <tr key={partner.id} className={status.hoursLeft === 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm text-gray-900">{partner.name}</p>
                        <p className="text-xs text-gray-500">{partner.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`font-bold text-sm ${(partner.cod_held || 0) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                          ₹{(partner.cod_held || 0).toFixed(2)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {partner.cod_held_since
                          ? new Date(partner.cod_held_since).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={status.color}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {(partner.cod_held || 0) > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkSubmitted(partner)}
                            disabled={processingId === partner.id}
                            className="text-green-600 hover:text-green-700 text-xs"
                          >
                            {processingId === partner.id ? '...' : '✓ Mark Submitted'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Submissions */}
      {submissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent COD Submissions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Partner</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {submissions.map(sub => {
                    const partner = partners.find(p => p.id === sub.partner_id);
                    return (
                      <tr key={sub.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(sub.submitted_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {partner?.name || sub.partner_id}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-green-600">
                          ₹{sub.amount?.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={sub.method === 'wallet' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                            {sub.method === 'wallet' ? '💳 Digital' : '💵 Physical'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
