import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DollarSign,
  Calendar,
  CreditCard,
  User,
  Mail,
  Phone,
  Briefcase,
  Building,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  Plus,
  Minus,
  FileText
} from 'lucide-react';

export default function PayoutDetailModal({ open, onClose, payout }) {
  if (!payout) return null;

  const getStatusIcon = (status) => {
    const icons = {
      completed: CheckCircle,
      pending: Clock,
      processing: TrendingUp,
      failed: XCircle
    };
    return icons[status] || Clock;
  };

  const getStatusColor = (status) => {
    const colors = {
      completed: 'text-green-600 bg-green-100',
      pending: 'text-yellow-600 bg-yellow-100',
      processing: 'text-blue-600 bg-blue-100',
      failed: 'text-red-600 bg-red-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  const getMonthName = (month) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1] || '';
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount || 0).toLocaleString('en-IN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const StatusIcon = getStatusIcon(payout.payment_status);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" />
            Payout Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Employee Info */}
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={payout.employee?.photo} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-600 text-xl">
                    {payout.employee?.full_name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{payout.employee?.full_name}</h3>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {payout.employee?.employee_code}
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {payout.employee?.email}
                    </div>
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${getStatusColor(payout.payment_status)}`}>
                  <StatusIcon className="w-5 h-5" />
                  <span className="font-semibold capitalize">{payout.payment_status}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payout Period */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Payout Period
                  </p>
                  <p className="text-lg font-semibold mt-1">
                    {getMonthName(payout.payout_month)} {payout.payout_year}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Payout Date
                  </p>
                  <p className="text-lg font-semibold mt-1">
                    {new Date(payout.payout_date).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment Method
                  </p>
                  <p className="text-lg font-semibold mt-1 capitalize">
                    {payout.payment_method?.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Earnings */}
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-green-800">
                <Plus className="w-5 h-5" />
                Earnings
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-green-700">Gross Salary</p>
                  <p className="text-lg font-bold text-green-900">{formatCurrency(payout.gross_salary)}</p>
                </div>
                <div>
                  <p className="text-sm text-green-700">Basic Salary</p>
                  <p className="text-lg font-bold text-green-900">{formatCurrency(payout.basic_salary)}</p>
                </div>
                <div>
                  <p className="text-sm text-green-700">HRA</p>
                  <p className="text-lg font-bold text-green-900">{formatCurrency(payout.hra)}</p>
                </div>
                <div>
                  <p className="text-sm text-green-700">Transport Allowance</p>
                  <p className="text-lg font-bold text-green-900">{formatCurrency(payout.transport_allowance)}</p>
                </div>
                <div>
                  <p className="text-sm text-green-700">Other Allowances</p>
                  <p className="text-lg font-bold text-green-900">{formatCurrency(payout.other_allowances)}</p>
                </div>
                <div>
                  <p className="text-sm text-green-700">Bonus</p>
                  <p className="text-lg font-bold text-green-900">{formatCurrency(payout.bonus)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deductions */}
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-red-800">
                <Minus className="w-5 h-5" />
                Deductions
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-red-700">PF Deduction</p>
                  <p className="text-lg font-bold text-red-900">{formatCurrency(payout.pf_deduction)}</p>
                </div>
                <div>
                  <p className="text-sm text-red-700">Tax Deduction</p>
                  <p className="text-lg font-bold text-red-900">{formatCurrency(payout.tax_deduction)}</p>
                </div>
                <div>
                  <p className="text-sm text-red-700">Other Deductions</p>
                  <p className="text-lg font-bold text-red-900">{formatCurrency(payout.other_deductions)}</p>
                </div>
                <div>
                  <p className="text-sm text-red-700">Penalty</p>
                  <p className="text-lg font-bold text-red-900">{formatCurrency(payout.penalty)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Net Salary */}
          <Card className="border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-700 font-medium">NET SALARY</p>
                  <p className="text-4xl font-bold text-emerald-600 mt-1">
                    {formatCurrency(payout.net_salary)}
                  </p>
                </div>
                <DollarSign className="w-16 h-16 text-emerald-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          {/* Additional Info */}
          {(payout.notes || payout.payment_reference || payout.processed_at) && (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-4">Additional Information</h3>
                <div className="space-y-3">
                  {payout.payment_reference && (
                    <div>
                      <p className="text-sm text-gray-600">Payment Reference</p>
                      <p className="font-medium">{payout.payment_reference}</p>
                    </div>
                  )}
                  {payout.processed_at && (
                    <div>
                      <p className="text-sm text-gray-600">Processed At</p>
                      <p className="font-medium">{formatDate(payout.processed_at)}</p>
                    </div>
                  )}
                  {payout.processor?.full_name && (
                    <div>
                      <p className="text-sm text-gray-600">Processed By</p>
                      <p className="font-medium">{payout.processor.full_name}</p>
                    </div>
                  )}
                  {payout.notes && (
                    <div>
                      <p className="text-sm text-gray-600">Notes</p>
                      <p className="font-medium">{payout.notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timestamps */}
          <div className="text-xs text-gray-500 text-center">
            Created: {formatDate(payout.created_at)} • 
            Last Updated: {formatDate(payout.updated_at)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
