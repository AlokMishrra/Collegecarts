import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { DollarSign, Plus, Minus, Calculator, AlertCircle } from 'lucide-react';

export default function CreatePayoutModal({ open, onClose, onSuccess, employees, currentUser }) {
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    payout_month: new Date().getMonth() + 1,
    payout_year: new Date().getFullYear(),
    gross_salary: 0,
    basic_salary: 0,
    hra: 0,
    transport_allowance: 0,
    other_allowances: 0,
    pf_deduction: 0,
    tax_deduction: 0,
    other_deductions: 0,
    bonus: 0,
    penalty: 0,
    net_salary: 0,
    payment_method: 'bank_transfer',
    payment_status: 'pending',
    notes: ''
  });

  // Calculate net salary whenever any field changes
  useEffect(() => {
    calculateNetSalary();
  }, [
    formData.gross_salary,
    formData.pf_deduction,
    formData.tax_deduction,
    formData.other_deductions,
    formData.bonus,
    formData.penalty
  ]);

  const calculateNetSalary = () => {
    const gross = parseFloat(formData.gross_salary) || 0;
    const pfDeduction = parseFloat(formData.pf_deduction) || 0;
    const taxDeduction = parseFloat(formData.tax_deduction) || 0;
    const otherDeductions = parseFloat(formData.other_deductions) || 0;
    const bonus = parseFloat(formData.bonus) || 0;
    const penalty = parseFloat(formData.penalty) || 0;

    const totalDeductions = pfDeduction + taxDeduction + otherDeductions + penalty;
    const netSalary = gross + bonus - totalDeductions;

    setFormData(prev => ({
      ...prev,
      net_salary: Math.max(0, netSalary)
    }));
  };

  const handleEmployeeSelect = async (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;

    setSelectedEmployee(employee);

    // Auto-fill salary structure if available
    if (employee.salary_structure) {
      const structure = employee.salary_structure;
      const grossSalary = parseFloat(structure.gross_salary) || 0;
      const basicSalary = parseFloat(structure.basic_salary) || 0;
      const hra = parseFloat(structure.hra) || 0;
      const transportAllowance = parseFloat(structure.transport_allowance) || 0;
      const otherAllowances = parseFloat(structure.other_allowances) || 0;
      const pfDeduction = parseFloat(structure.pf_deduction) || 0;
      const taxDeduction = parseFloat(structure.tax_deduction) || 0;

      setFormData(prev => ({
        ...prev,
        employee_id: employeeId,
        gross_salary: grossSalary,
        basic_salary: basicSalary,
        hra: hra,
        transport_allowance: transportAllowance,
        other_allowances: otherAllowances,
        pf_deduction: pfDeduction,
        tax_deduction: taxDeduction
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        employee_id: employeeId
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.employee_id) {
      toast.error('Please select an employee');
      return;
    }

    if (formData.gross_salary <= 0) {
      toast.error('Gross salary must be greater than 0');
      return;
    }

    try {
      setLoading(true);

      // Check if payout already exists for this employee and month
      const { data: existingPayout, error: checkError } = await supabase
        .from('employee_payouts')
        .select('id')
        .eq('employee_id', formData.employee_id)
        .eq('payout_month', formData.payout_month)
        .eq('payout_year', formData.payout_year)
        .single();

      if (existingPayout) {
        toast.error('Payout already exists for this employee and month');
        return;
      }

      // Create payout
      const { data, error } = await supabase
        .from('employee_payouts')
        .insert({
          ...formData,
          created_by: currentUser.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Payout created successfully');
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error creating payout:', error);
      toast.error('Failed to create payout: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      employee_id: '',
      payout_month: new Date().getMonth() + 1,
      payout_year: new Date().getFullYear(),
      gross_salary: 0,
      basic_salary: 0,
      hra: 0,
      transport_allowance: 0,
      other_allowances: 0,
      pf_deduction: 0,
      tax_deduction: 0,
      other_deductions: 0,
      bonus: 0,
      penalty: 0,
      net_salary: 0,
      payment_method: 'bank_transfer',
      payment_status: 'pending',
      notes: ''
    });
    setSelectedEmployee(null);
    onClose();
  };

  const getMonthName = (month) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1] || '';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            Create Employee Payout
          </DialogTitle>
          <DialogDescription>
            Create a new salary payout for an employee. All fields will be auto-filled from their salary structure.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Employee Selection */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee">Employee *</Label>
                <Select
                  value={formData.employee_id}
                  onValueChange={handleEmployeeSelect}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="month">Month *</Label>
                <Select
                  value={formData.payout_month.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, payout_month: parseInt(value) }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...Array(12)].map((_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {getMonthName(i + 1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Year *</Label>
                <Select
                  value={formData.payout_year.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, payout_year: parseInt(value) }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...Array(5)].map((_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedEmployee && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-900">
                        {selectedEmployee.full_name} - {selectedEmployee.role?.role_name}
                      </p>
                      <p className="text-blue-700">
                        {selectedEmployee.department?.department_name} • {selectedEmployee.email}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* Salary Components */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4 text-green-600" />
              Earnings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gross_salary">Gross Salary *</Label>
                <Input
                  id="gross_salary"
                  type="number"
                  step="0.01"
                  value={formData.gross_salary}
                  onChange={(e) => setFormData(prev => ({ ...prev, gross_salary: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="basic_salary">Basic Salary</Label>
                <Input
                  id="basic_salary"
                  type="number"
                  step="0.01"
                  value={formData.basic_salary}
                  onChange={(e) => setFormData(prev => ({ ...prev, basic_salary: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hra">HRA</Label>
                <Input
                  id="hra"
                  type="number"
                  step="0.01"
                  value={formData.hra}
                  onChange={(e) => setFormData(prev => ({ ...prev, hra: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transport_allowance">Transport Allowance</Label>
                <Input
                  id="transport_allowance"
                  type="number"
                  step="0.01"
                  value={formData.transport_allowance}
                  onChange={(e) => setFormData(prev => ({ ...prev, transport_allowance: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="other_allowances">Other Allowances</Label>
                <Input
                  id="other_allowances"
                  type="number"
                  step="0.01"
                  value={formData.other_allowances}
                  onChange={(e) => setFormData(prev => ({ ...prev, other_allowances: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bonus">Bonus</Label>
                <Input
                  id="bonus"
                  type="number"
                  step="0.01"
                  value={formData.bonus}
                  onChange={(e) => setFormData(prev => ({ ...prev, bonus: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Deductions */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Minus className="w-4 h-4 text-red-600" />
              Deductions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pf_deduction">PF Deduction</Label>
                <Input
                  id="pf_deduction"
                  type="number"
                  step="0.01"
                  value={formData.pf_deduction}
                  onChange={(e) => setFormData(prev => ({ ...prev, pf_deduction: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_deduction">Tax Deduction</Label>
                <Input
                  id="tax_deduction"
                  type="number"
                  step="0.01"
                  value={formData.tax_deduction}
                  onChange={(e) => setFormData(prev => ({ ...prev, tax_deduction: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="other_deductions">Other Deductions</Label>
                <Input
                  id="other_deductions"
                  type="number"
                  step="0.01"
                  value={formData.other_deductions}
                  onChange={(e) => setFormData(prev => ({ ...prev, other_deductions: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="penalty">Penalty</Label>
                <Input
                  id="penalty"
                  type="number"
                  step="0.01"
                  value={formData.penalty}
                  onChange={(e) => setFormData(prev => ({ ...prev, penalty: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Net Salary Calculation */}
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-600" />
                  <span className="font-semibold text-emerald-900">Net Salary</span>
                </div>
                <span className="text-2xl font-bold text-emerald-600">
                  ₹{formData.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Details */}
          <div className="space-y-4">
            <h3 className="font-semibold">Payment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method *</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_status">Payment Status *</Label>
                <Select
                  value={formData.payment_status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, payment_status: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any additional notes or comments..."
                rows={3}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
              {loading ? 'Creating...' : 'Create Payout'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
