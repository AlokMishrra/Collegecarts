import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { DollarSign, Download, Calendar, TrendingUp, CheckCircle, Clock, XCircle, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function EmployeeSalary() {
  const { employee } = useEmployeeAuth();
  const [payouts, setPayouts] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [newPayoutModal, setNewPayoutModal] = useState(null);
  const [stats, setStats] = useState({
    totalEarned: 0,
    avgSalary: 0,
    lastSalary: 0,
    pendingCount: 0
  });

  useEffect(() => {
    if (employee) {
      loadPayouts();
      checkForNewPayouts();
    }
  }, [employee, selectedYear]);

  const checkForNewPayouts = async () => {
    try {
      // Check for payouts created in last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data, error } = await supabase
        .from('employee_payouts')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const latestPayout = data[0];
        // Check if user has seen this notification
        const seenKey = `payout_seen_${latestPayout.id}`;
        if (!localStorage.getItem(seenKey)) {
          setNewPayoutModal(latestPayout);
          localStorage.setItem(seenKey, 'true');
        }
      }
    } catch (error) {
      console.error('Error checking new payouts:', error);
    }
  };

  const loadPayouts = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('employee_payouts')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('payout_year', selectedYear)
        .order('payout_month', { ascending: false });

      if (error) throw error;

      setPayouts(data || []);

      // Calculate stats
      const totalEarned = data
        .filter(p => p.payment_status === 'completed')
        .reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0);
      
      const paidPayouts = data.filter(p => p.payment_status === 'completed');
      const avgSalary = paidPayouts.length > 0 
        ? totalEarned / paidPayouts.length 
        : 0;
      
      const lastSalary = data.length > 0 
        ? parseFloat(data[0].net_salary || 0) 
        : 0;
      
      const pendingCount = data.filter(p => p.payment_status === 'pending').length;

      setStats({
        totalEarned: totalEarned.toFixed(2),
        avgSalary: avgSalary.toFixed(2),
        lastSalary: lastSalary.toFixed(2),
        pendingCount
      });
    } catch (error) {
      console.error('Error loading payouts:', error);
      toast.error('Failed to load salary data');
    } finally {
      setLoading(false);
    }
  };

  const generatePayslipPDF = async (payout, employee) => {
    try {
      // Dynamically import jsPDF
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Helper functions - Use "Rs." instead of ₹ symbol for PDF compatibility
      const formatCurrency = (amount) => {
        return `Rs. ${parseFloat(amount || 0).toLocaleString('en-IN', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}`;
      };

      const getMonthName = (month) => {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
        return months[month - 1] || '';
      };

      // Colors
      const primaryColor = [16, 185, 129];
      const darkColor = [31, 41, 55];
      const lightGray = [243, 244, 246];

      // Header with company info and logo area
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 45, 'F');

      // Company Name - Left aligned
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(26);
      doc.setFont('helvetica', 'bold');
      doc.text('CollegeCart', 20, 22);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Employee Salary Slip', 20, 32);

      // Company Details - Right aligned
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('CollegeCart Pvt. Ltd.', pageWidth - 20, 15, { align: 'right' });
      doc.text('Campus Address, City', pageWidth - 20, 21, { align: 'right' });
      doc.text('Email: hr@collegecart.com', pageWidth - 20, 27, { align: 'right' });
      doc.text('Phone: +91-XXXXXXXXXX', pageWidth - 20, 33, { align: 'right' });

      // Reset text color
      doc.setTextColor(...darkColor);

      // Payslip period
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`Salary Slip - ${getMonthName(payout.payout_month)} ${payout.payout_year}`, pageWidth / 2, 60, { align: 'center' });

      // Employee and Payment Details Section
      let yPos = 72;
      
      // Employee Details Box - Left Side
      doc.setFillColor(...lightGray);
      doc.roundedRect(15, yPos, (pageWidth - 35) / 2, 45, 3, 3, 'F');

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('EMPLOYEE DETAILS', 20, yPos + 8);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkColor);
      
      doc.text('Name:', 20, yPos + 18);
      doc.text('Code:', 20, yPos + 26);
      doc.text('Department:', 20, yPos + 34);
      doc.text('Designation:', 20, yPos + 42);

      doc.setFont('helvetica', 'normal');
      const leftColValueX = 50;
      doc.text(employee.full_name || 'N/A', leftColValueX, yPos + 18);
      doc.text(employee.employee_code || 'N/A', leftColValueX, yPos + 26);
      doc.text(employee.department?.department_name || 'N/A', leftColValueX, yPos + 34);
      doc.text(employee.role?.role_name || 'N/A', leftColValueX, yPos + 42);

      // Payment Details Box - Right Side
      const rightBoxX = (pageWidth - 35) / 2 + 20;
      doc.setFillColor(...lightGray);
      doc.roundedRect(rightBoxX, yPos, (pageWidth - 35) / 2, 45, 3, 3, 'F');

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('PAYMENT DETAILS', rightBoxX + 5, yPos + 8);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkColor);
      
      doc.text('Payment Date:', rightBoxX + 5, yPos + 18);
      doc.text('Payment Method:', rightBoxX + 5, yPos + 26);
      doc.text('Bank Account:', rightBoxX + 5, yPos + 34);
      doc.text('Status:', rightBoxX + 5, yPos + 42);

      doc.setFont('helvetica', 'normal');
      const rightColValueX = rightBoxX + 40;
      doc.text(new Date(payout.payout_date).toLocaleDateString('en-IN'), rightColValueX, yPos + 18);
      doc.text((payout.payment_method || 'bank_transfer').replace('_', ' ').toUpperCase(), rightColValueX, yPos + 26);
      doc.text(employee.bank_account_number ? `****${employee.bank_account_number.slice(-4)}` : 'N/A', rightColValueX, yPos + 34);
      doc.text(payout.payment_status?.toUpperCase() || 'PAID', rightColValueX, yPos + 42);

      yPos += 55;

      // Earnings Table
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('EARNINGS', 20, yPos);
      yPos += 5;

      const earningsData = [
        ['Basic Salary', formatCurrency(payout.basic_salary)],
        ['HRA', formatCurrency(payout.hra)],
        ['Transport Allowance', formatCurrency(payout.transport_allowance)],
        ['Other Allowances', formatCurrency(payout.other_allowances)],
        ['Bonus', formatCurrency(payout.bonus)]
      ];

      doc.autoTable({
        startY: yPos,
        head: [['Description', 'Amount']],
        body: earningsData,
        theme: 'grid',
        headStyles: { 
          fillColor: primaryColor, 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 10
        },
        bodyStyles: { 
          fontSize: 9,
          cellPadding: { top: 2, right: 5, bottom: 2, left: 5 }
        },
        columnStyles: { 
          0: { 
            cellWidth: 120,
            halign: 'left'
          }, 
          1: { 
            cellWidth: 60, 
            halign: 'right'
          } 
        },
        margin: { left: 15, right: 15 }
      });

      yPos = doc.lastAutoTable.finalY + 2;

      // Gross Salary
      doc.setFillColor(...lightGray);
      doc.rect(15, yPos, pageWidth - 30, 10, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkColor);
      doc.text('GROSS SALARY', 20, yPos + 7);
      doc.text(formatCurrency(payout.gross_salary), pageWidth - 20, yPos + 7, { align: 'right' });

      yPos += 13;

      // Deductions Table
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text('DEDUCTIONS', 20, yPos);
      yPos += 5;

      const deductionsData = [
        ['PF Deduction', formatCurrency(payout.pf_deduction)],
        ['Tax Deduction (TDS)', formatCurrency(payout.tax_deduction)],
        ['Other Deductions', formatCurrency(payout.other_deductions)],
        ['Penalty', formatCurrency(payout.penalty)]
      ];

      doc.autoTable({
        startY: yPos,
        head: [['Description', 'Amount']],
        body: deductionsData,
        theme: 'grid',
        headStyles: { 
          fillColor: [220, 38, 38], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 10
        },
        bodyStyles: { 
          fontSize: 9,
          cellPadding: { top: 2, right: 5, bottom: 2, left: 5 }
        },
        columnStyles: { 
          0: { 
            cellWidth: 120,
            halign: 'left'
          }, 
          1: { 
            cellWidth: 60, 
            halign: 'right'
          } 
        },
        margin: { left: 15, right: 15 }
      });

      yPos = doc.lastAutoTable.finalY + 2;

      // Total Deductions
      const totalDeductions = 
        parseFloat(payout.pf_deduction || 0) + 
        parseFloat(payout.tax_deduction || 0) + 
        parseFloat(payout.other_deductions || 0) + 
        parseFloat(payout.penalty || 0);

      doc.setFillColor(...lightGray);
      doc.rect(15, yPos, pageWidth - 30, 10, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkColor);
      doc.text('TOTAL DEDUCTIONS', 20, yPos + 7);
      doc.text(formatCurrency(totalDeductions), pageWidth - 20, yPos + 7, { align: 'right' });

      yPos += 13;

      // Net Salary (Highlighted)
      doc.setFillColor(...primaryColor);
      doc.roundedRect(15, yPos, pageWidth - 30, 14, 3, 3, 'F');
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('NET SALARY', 20, yPos + 9);
      doc.text(formatCurrency(payout.net_salary), pageWidth - 20, yPos + 9, { align: 'right' });

      yPos += 18;

      // Notes section if available
      if (payout.notes) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...darkColor);
        doc.text('Notes:', 20, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const splitNotes = doc.splitTextToSize(payout.notes, pageWidth - 40);
        doc.text(splitNotes, 20, yPos + 5);
        yPos += 5 + (splitNotes.length * 5);
      }

      // Footer - Always at the bottom of the page
      const footerY = pageHeight - 20;
      
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(15, footerY, pageWidth - 15, footerY);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(107, 114, 128);
      doc.text('This is a computer-generated payslip and does not require a signature.', pageWidth / 2, footerY + 5, { align: 'center' });
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}`, pageWidth / 2, footerY + 10, { align: 'center' });
      doc.text('For any queries, please contact HR Department', pageWidth / 2, footerY + 15, { align: 'center' });

      // Save
      const fileName = `Payslip_${employee.employee_code}_${getMonthName(payout.payout_month)}_${payout.payout_year}.pdf`;
      doc.save(fileName);

      return { success: true, fileName };
    } catch (error) {
      console.error('Error generating payslip:', error);
      throw error;
    }
  };

  const handleDownloadPayslip = async (payout) => {
    try {
      toast.loading('Generating payslip...');
      
      const result = await generatePayslipPDF(payout, employee);
      
      if (result.success) {
        toast.dismiss();
        toast.success(`Payslip downloaded: ${result.fileName}`);
      }
    } catch (error) {
      console.error('Error generating payslip:', error);
      toast.dismiss();
      toast.error('Failed to generate payslip. Please try again.');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: { label: 'Paid', className: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
      processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800', icon: TrendingUp },
      failed: { label: 'Failed', className: 'bg-red-100 text-red-800', icon: XCircle }
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800', icon: DollarSign };
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.className} flex items-center gap-1 w-fit`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getMonthName = (month) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1] || '';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      {/* New Payout Notification Modal */}
      <Dialog open={!!newPayoutModal} onOpenChange={() => setNewPayoutModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-6 h-6" />
              New Salary Payout!
            </DialogTitle>
            <DialogDescription>
              You have received a new salary payout
            </DialogDescription>
          </DialogHeader>
          {newPayoutModal && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Month</p>
                    <p className="font-semibold">{getMonthName(newPayoutModal.payout_month)} {newPayoutModal.payout_year}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Status</p>
                    {getStatusBadge(newPayoutModal.payment_status)}
                  </div>
                  <div>
                    <p className="text-gray-600">Gross Salary</p>
                    <p className="font-semibold">{formatCurrency(newPayoutModal.gross_salary)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Net Salary</p>
                    <p className="font-semibold text-green-600">{formatCurrency(newPayoutModal.net_salary)}</p>
                  </div>
                </div>
              </div>
              <Button 
                onClick={() => setNewPayoutModal(null)} 
                className="w-full bg-green-600 hover:bg-green-700"
              >
                View in Salary History
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Salary History</h1>
          <p className="text-gray-600">View your salary records and download payslips</p>
        </div>
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(year => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Total Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalEarned)}
            </p>
            <p className="text-xs text-gray-600 mt-1">In {selectedYear}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Average Salary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.avgSalary)}
            </p>
            <p className="text-xs text-gray-600 mt-1">Per month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              Last Salary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(stats.lastSalary)}
            </p>
            <p className="text-xs text-gray-600 mt-1">Most recent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-yellow-600" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{stats.pendingCount}</p>
            <p className="text-xs text-gray-600 mt-1">Payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Salary History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Salary Records - {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading salary history...</p>
            </div>
          ) : payouts.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No salary records for this year</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Basic Salary</TableHead>
                  <TableHead>Allowances</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium">
                      {getMonthName(payout.payout_month)} {payout.payout_year}
                    </TableCell>
                    <TableCell>{formatCurrency(payout.basic_salary)}</TableCell>
                    <TableCell>
                      {formatCurrency(
                        (parseFloat(payout.hra || 0) + 
                         parseFloat(payout.transport_allowance || 0) + 
                         parseFloat(payout.other_allowances || 0))
                      )}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(payout.bonus)}
                    </TableCell>
                    <TableCell className="text-red-600">
                      {formatCurrency(
                        (parseFloat(payout.pf_deduction || 0) + 
                         parseFloat(payout.tax_deduction || 0) + 
                         parseFloat(payout.other_deductions || 0) + 
                         parseFloat(payout.penalty || 0))
                      )}
                    </TableCell>
                    <TableCell className="font-bold text-green-600">
                      {formatCurrency(payout.net_salary)}
                    </TableCell>
                    <TableCell>{getStatusBadge(payout.payment_status)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadPayslip(payout)}
                        disabled={payout.payment_status !== 'completed'}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Payslip
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Salary Breakdown (for latest payout) */}
      {payouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Salary Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Basic Salary</p>
                <p className="text-lg font-bold">{formatCurrency(payouts[0].basic_salary)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">HRA</p>
                <p className="text-lg font-bold">{formatCurrency(payouts[0].hra)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Transport Allowance</p>
                <p className="text-lg font-bold">{formatCurrency(payouts[0].transport_allowance)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Other Allowances</p>
                <p className="text-lg font-bold">{formatCurrency(payouts[0].other_allowances)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Bonus</p>
                <p className="text-lg font-bold">{formatCurrency(payouts[0].bonus)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">PF Deduction</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(payouts[0].pf_deduction)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Tax Deduction</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(payouts[0].tax_deduction)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Net Salary</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(payouts[0].net_salary)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
