import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Download, 
  CheckCircle, 
  XCircle, 
  Package,
  User,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { generateStockOrderPDF } from '@/utils/pdfGenerator';

export default function StockOrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { employee, isSuperAdmin, hasPermission } = useEmployeeAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showFulfillDialog, setShowFulfillDialog] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employee_stock_orders')
        .select(`
          *,
          employee:employee_accounts(full_name, employee_code, photo),
          department:employee_departments(department_name),
          items:employee_stock_order_items(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (error) {
      console.error('Error loading order:', error);
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('employee_stock_orders')
        .update({
          status: 'approved',
          approved_by: employee.id,
          approved_date: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Log activity
      await supabase.from('employee_activity_logs').insert({
        employee_id: employee.id,
        activity_type: 'stock_order_approved',
        activity_description: `Approved stock order ${order.order_number}`,
        entity_type: 'employee_stock_orders',
        entity_id: id
      });

      toast.success('Stock order approved successfully!');
      setShowApproveDialog(false);
      loadOrder();
    } catch (error) {
      console.error('Error approving order:', error);
      toast.error('Failed to approve order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('employee_stock_orders')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          approved_by: employee.id,
          approved_date: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Log activity
      await supabase.from('employee_activity_logs').insert({
        employee_id: employee.id,
        activity_type: 'stock_order_rejected',
        activity_description: `Rejected stock order ${order.order_number}`,
        entity_type: 'employee_stock_orders',
        entity_id: id
      });

      toast.success('Stock order rejected');
      setShowRejectDialog(false);
      loadOrder();
    } catch (error) {
      console.error('Error rejecting order:', error);
      toast.error('Failed to reject order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFulfill = async () => {
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('employee_stock_orders')
        .update({
          status: 'fulfilled',
          fulfilled_by: employee.id,
          fulfilled_date: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Log activity
      await supabase.from('employee_activity_logs').insert({
        employee_id: employee.id,
        activity_type: 'stock_order_fulfilled',
        activity_description: `Fulfilled stock order ${order.order_number}`,
        entity_type: 'employee_stock_orders',
        entity_id: id
      });

      toast.success('Stock order fulfilled! Inventory has been updated.');
      setShowFulfillDialog(false);
      loadOrder();
    } catch (error) {
      console.error('Error fulfilling order:', error);
      toast.error('Failed to fulfill order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    const showPrices = isSuperAdmin() || hasPermission('view_finance');
    generateStockOrderPDF(order, showPrices);
  };

  const canApprove = () => {
    return (isSuperAdmin() || hasPermission('approve_stock_orders')) && order?.status === 'pending';
  };

  const canFulfill = () => {
    return (isSuperAdmin() || hasPermission('manage_stock')) && order?.status === 'approved';
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-600',
      approved: 'bg-blue-600',
      fulfilled: 'bg-green-600',
      rejected: 'bg-red-600',
      cancelled: 'bg-gray-600'
    };

    return (
      <Badge className={colors[status] || 'bg-gray-600'}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Order not found</p>
        <Button onClick={() => navigate(`/employee/${employee.slug}/stock-orders`)} className="mt-4">
          Back to Orders
        </Button>
      </div>
    );
  }

  const showPrices = isSuperAdmin() || hasPermission('view_finance');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(`/employee/${employee.slug}/stock-orders`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Stock Order Details</h1>
            <p className="text-gray-600 font-mono">{order.order_number}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          {canApprove() && (
            <>
              <Button
                onClick={() => setShowApproveDialog(true)}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={() => setShowRejectDialog(true)}
                disabled={actionLoading}
                variant="destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
          )}
          {canFulfill() && (
            <Button
              onClick={() => setShowFulfillDialog(true)}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Package className="h-4 w-4 mr-2" />
              Mark as Fulfilled
            </Button>
          )}
        </div>
      </div>

      {/* Order Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Requested By
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {order.employee?.photo && (
                <img
                  src={order.employee.photo}
                  alt={order.employee.full_name}
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div>
                <p className="font-medium">{order.employee?.full_name}</p>
                <p className="text-sm text-gray-600">{order.employee?.employee_code}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Order Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              {getStatusBadge(order.status)}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Priority:</span>
              <Badge variant="outline">{order.priority}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium">{order.order_type}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Items:</span>
              <span className="font-medium">{order.total_items}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Quantity:</span>
              <span className="font-medium">{order.total_quantity}</span>
            </div>
            {showPrices && (
              <div className="flex justify-between">
                <span className="text-gray-600">Total Value:</span>
                <span className="font-medium">₹{order.total_value?.toFixed(2)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                {showPrices && (
                  <>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total Price</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items?.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.product_name}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  {showPrices && (
                    <>
                      <TableCell>₹{item.unit_price?.toFixed(2)}</TableCell>
                      <TableCell>₹{item.total_price?.toFixed(2)}</TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Rejection Reason */}
      {order.rejection_reason && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Rejection Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{order.rejection_reason}</p>
          </CardContent>
        </Card>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Approve Stock Order
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this stock order?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Order Number:</span>
              <span className="font-medium">{order.order_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Items:</span>
              <span className="font-medium">{order.total_items}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Quantity:</span>
              <span className="font-medium">{order.total_quantity}</span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading ? 'Approving...' : 'Yes, Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fulfill Dialog */}
      <Dialog open={showFulfillDialog} onOpenChange={setShowFulfillDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <Package className="h-5 w-5" />
              Mark Order as Fulfilled
            </DialogTitle>
            <DialogDescription>
              This will mark the order as fulfilled and update the main inventory. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-emerald-50 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-emerald-700">
                <p className="font-medium mb-1">This will:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Update inventory quantities</li>
                  <li>Mark order as complete</li>
                  <li>Log the fulfillment activity</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowFulfillDialog(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleFulfill}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {actionLoading ? 'Processing...' : 'Yes, Mark as Fulfilled'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Reject Stock Order
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this stock order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rejection Reason *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a detailed reason for rejection..."
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason('');
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={actionLoading || !rejectionReason.trim()}
              variant="destructive"
            >
              {actionLoading ? 'Rejecting...' : 'Reject Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
