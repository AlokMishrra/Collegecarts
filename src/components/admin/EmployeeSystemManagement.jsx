import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Employee } from '@/entities/Employee';
import { EmployeeRole } from '@/entities/EmployeeRole';
import { EmployeeDepartment } from '@/entities/EmployeeDepartment';
import { Users, Plus, Edit, Trash2, Search, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

export default function EmployeeSystemManagement() {
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role_id: '',
    department_id: '',
    joining_date: new Date().toISOString().split('T')[0],
    status: 'active'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('Starting to load employee data...');
      
      // Load employees
      let employeesData = [];
      try {
        employeesData = await Employee.listWithDetails();
        console.log('Employees loaded:', employeesData);
      } catch (err) {
        console.error('Error loading employees:', err);
      }

      // Load roles
      let rolesData = [];
      try {
        rolesData = await EmployeeRole.list();
        console.log('Roles loaded:', rolesData);
      } catch (err) {
        console.error('Error loading roles:', err);
        // Try direct query as fallback
        const { data, error } = await supabase
          .from('employee_roles')
          .select('*')
          .order('hierarchy_level', { ascending: false });
        
        if (error) {
          console.error('Direct roles query error:', error);
        } else {
          rolesData = data;
          console.log('Roles loaded via direct query:', rolesData);
        }
      }

      // Load departments
      let departmentsData = [];
      try {
        departmentsData = await EmployeeDepartment.listActive();
        console.log('Departments loaded:', departmentsData);
      } catch (err) {
        console.error('Error loading departments:', err);
        // Try direct query as fallback
        const { data, error } = await supabase
          .from('employee_departments')
          .select('*')
          .eq('is_active', true)
          .order('department_name');
        
        if (error) {
          console.error('Direct departments query error:', error);
        } else {
          departmentsData = data;
          console.log('Departments loaded via direct query:', departmentsData);
        }
      }

      setEmployees(employeesData || []);
      setRoles(rolesData || []);
      setDepartments(departmentsData || []);

      console.log('Final state:', {
        employees: employeesData?.length || 0,
        roles: rolesData?.length || 0,
        departments: departmentsData?.length || 0
      });

      if (!rolesData || rolesData.length === 0) {
        toast.error('No roles found. Please run the database migration first.');
      }
      if (!departmentsData || departmentsData.length === 0) {
        toast.error('No departments found. Please run the database migration first.');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error(`Failed to load data: ${error.message}`);
    }
  };

  const generateEmployeeCode = async () => {
    const { data } = await supabase.rpc('generate_employee_code');
    return data;
  };

  const generateSlug = (fullName, employeeCode) => {
    const baseSlug = fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${baseSlug}-${employeeCode}`;
  };

  const handleSubmit = async () => {
    try {
      if (!formData.full_name || !formData.email || !formData.role_id || !formData.department_id) {
        toast.error('Please fill all required fields');
        return;
      }

      if (!editingEmployee && !formData.password) {
        toast.error('Password is required for new employees');
        return;
      }

      let employeeData = { ...formData };

      if (!editingEmployee) {
        // Generate employee code and slug
        const employeeCode = await generateEmployeeCode();
        const slug = generateSlug(formData.full_name, employeeCode);

        // Note: Password should be hashed on the backend/database trigger
        // For now, we'll store it as-is and let Supabase handle it
        employeeData = {
          ...employeeData,
          employee_code: employeeCode,
          slug: slug,
          password_hash: formData.password // Backend should hash this
        };

        delete employeeData.password;

        const { error } = await supabase
          .from('employee_accounts')
          .insert(employeeData);

        if (error) throw error;
        toast.success('Employee created successfully!');
      } else {
        // Update existing employee
        if (formData.password) {
          employeeData.password_hash = formData.password; // Backend should hash this
        }
        delete employeeData.password;

        const { error } = await supabase
          .from('employee_accounts')
          .update(employeeData)
          .eq('id', editingEmployee.id);

        if (error) throw error;
        toast.success('Employee updated successfully!');
      }

      setShowForm(false);
      setEditingEmployee(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error(error.message || 'Failed to save employee');
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      full_name: employee.full_name,
      email: employee.email || '',
      phone: employee.phone || '',
      password: '',
      role_id: employee.role_id || '',
      department_id: employee.department_id || '',
      joining_date: employee.joining_date?.split('T')[0] || '',
      status: employee.status
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;

    try {
      const { error } = await supabase
        .from('employee_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Employee deleted successfully!');
      loadData();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Failed to delete employee');
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      password: '',
      role_id: '',
      department_id: '',
      joining_date: new Date().toISOString().split('T')[0],
      status: 'active'
    });
  };

  const filteredEmployees = employees.filter(emp =>
    emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            Employee System Management
          </h2>
          <p className="text-gray-600">Manage employee accounts and access</p>
        </div>
        <Button
          onClick={() => {
            setShowForm(true);
            setEditingEmployee(null);
            resetForm();
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Employee
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{employees.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {employees.filter(e => e.status === 'active').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{departments.length}</p>
            {departments.length === 0 && (
              <p className="text-xs text-red-600 mt-1">⚠️ No departments loaded</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{roles.length}</p>
            {roles.length === 0 && (
              <p className="text-xs text-red-600 mt-1">⚠️ No roles loaded</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Employees Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map(employee => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{employee.full_name}</p>
                      <p className="text-sm text-gray-600">{employee.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{employee.employee_code}</Badge>
                  </TableCell>
                  <TableCell>{employee.role?.role_name || 'N/A'}</TableCell>
                  <TableCell>{employee.department?.department_name || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p>{employee.email}</p>
                      <p className="text-gray-600">{employee.phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        employee.status === 'active'
                          ? 'bg-green-600'
                          : 'bg-gray-400'
                      }
                    >
                      {employee.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleEdit(employee)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleDelete(employee.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Employee Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Full Name *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+91 9876543210"
                />
              </div>
              <div>
                <Label>Password {!editingEmployee && '*'}</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder={editingEmployee ? 'Leave blank to keep current' : 'Enter password'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Role *</Label>
                <Select
                  value={formData.role_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">No roles available</div>
                    ) : (
                      roles.map(role => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.role_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {roles.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    No roles found. Check console for errors.
                  </p>
                )}
              </div>
              <div>
                <Label>Department *</Label>
                <Select
                  value={formData.department_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, department_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">No departments available</div>
                    ) : (
                      departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.department_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {departments.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    No departments found. Check console for errors.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Joining Date</Label>
                <Input
                  type="date"
                  value={formData.joining_date}
                  onChange={(e) =>
                    setFormData({ ...formData, joining_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {editingEmployee ? 'Update' : 'Create'} Employee
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
