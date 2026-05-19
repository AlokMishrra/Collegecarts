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
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { User, Mail, Phone, Building, Briefcase, Key, AlertCircle } from 'lucide-react';
import bcrypt from 'bcryptjs';

export default function EditEmployeeModal({ open, onClose, employee, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [salaryStructures, setSalaryStructures] = useState([]);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    department_id: '',
    role_id: '',
    salary_structure_id: '',
    status: 'active'
  });

  useEffect(() => {
    if (open) {
      loadData();
      if (employee) {
        setFormData({
          full_name: employee.full_name || '',
          email: employee.email || '',
          phone: employee.phone || '',
          department_id: employee.department_id || '',
          role_id: employee.role_id || '',
          salary_structure_id: employee.salary_structure_id || '',
          status: employee.status || 'active'
        });
      }
    }
  }, [open, employee]);

  const loadData = async () => {
    try {
      const [depts, rolesData, salaries] = await Promise.all([
        supabase.from('employee_departments').select('*').order('department_name'),
        supabase.from('employee_roles').select('*').order('hierarchy_level'),
        supabase.from('employee_salary_structures').select('*').order('structure_name')
      ]);

      setDepartments(depts.data || []);
      setRoles(rolesData.data || []);
      setSalaryStructures(salaries.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.full_name || !formData.email || !formData.department_id || !formData.role_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from('employee_accounts')
        .update(formData)
        .eq('id', employee.id);

      if (error) throw error;

      toast.success('Employee updated successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error('Failed to update employee: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      setLoading(true);

      // Generate temporary password
      const tempPassword = `Temp${Math.random().toString(36).slice(-8)}@`;
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      const { error } = await supabase
        .from('employee_accounts')
        .update({
          password_hash: hashedPassword,
          must_change_password: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', employee.id);

      if (error) throw error;

      // Show password to admin
      toast.success(
        `Password Reset Successfully! Temporary Password: ${tempPassword}. Employee will be forced to change this password on next login.`,
        { duration: 10000 }
      );

      // Copy to clipboard
      navigator.clipboard.writeText(tempPassword);
      toast.info('Password copied to clipboard!');

    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-600" />
            Edit Employee
          </DialogTitle>
          <DialogDescription>
            Update employee information and manage their account
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-gray-700">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Department & Role */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-gray-700">Department & Role</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                  <Select
                    value={formData.department_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, department_id: value }))}
                  >
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.department_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                  <Select
                    value={formData.role_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, role_id: value }))}
                  >
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.role_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Salary Structure */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-gray-700">Salary Structure</h3>
            
            <div className="space-y-2">
              <Label htmlFor="salary_structure">Salary Structure</Label>
              <Select
                value={formData.salary_structure_id || "none"}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  salary_structure_id: value === "none" ? null : value 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select salary structure" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Salary Structure</SelectItem>
                  {salaryStructures.map((structure) => (
                    <SelectItem key={structure.id} value={structure.id}>
                      {structure.structure_name} - ₹{parseFloat(structure.gross_salary).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Password Reset Section */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
              <Key className="w-4 h-4" />
              Password Management
            </h3>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900">Reset Employee Password</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    This will generate a temporary password and force the employee to change it on next login.
                  </p>
                  <Button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={loading}
                    variant="outline"
                    className="mt-3 border-yellow-600 text-yellow-700 hover:bg-yellow-100"
                    size="sm"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Reset Password
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
