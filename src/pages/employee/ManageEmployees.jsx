import React, { useState, useEffect } from 'react';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Search, Plus, Edit, Trash2, Eye, Key } from 'lucide-react';
import { Employee } from '@/entities/Employee';
import { useNavigate } from 'react-router-dom';
import CreateEmployeeModal from '@/components/employee/CreateEmployeeModal';
import EditEmployeeModal from '@/components/employee/EditEmployeeModal';
import { toast } from 'sonner';

export default function ManageEmployees() {
  const { employee } = useEmployeeAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await Employee.listWithDetails();
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewProfile = (emp) => {
    navigate(`/employee/${employee.slug}/profile/${emp.slug}`);
  };

  const handleEditEmployee = (emp) => {
    setSelectedEmployee(emp);
    setShowEditModal(true);
  };

  const handleDeleteEmployee = async (emp) => {
    if (!confirm(`Are you sure you want to delete ${emp.full_name}?`)) {
      return;
    }

    try {
      await Employee.delete(emp.id);
      toast.success('Employee deleted successfully');
      loadEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Failed to delete employee');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Employees</h1>
          <p className="text-gray-500">View and manage all employees</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Employee
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Employees ({filteredEmployees.length})</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading employees...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No employees found</div>
          ) : (
            <div className="space-y-4">
              {filteredEmployees.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                      {emp.photo ? (
                        <img src={emp.photo} alt={emp.full_name} className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <Users className="h-6 w-6 text-emerald-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold">{emp.full_name}</h3>
                      <p className="text-sm text-gray-500">{emp.email}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs text-gray-400">{emp.employee_code}</span>
                        {emp.role && (
                          <Badge variant="outline" className="text-xs">
                            {emp.role.role_name}
                          </Badge>
                        )}
                        {emp.department && (
                          <Badge variant="outline" className="text-xs">
                            {emp.department.department_name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={emp.status === 'active' ? 'default' : 'secondary'}>
                      {emp.status}
                    </Badge>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleViewProfile(emp)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEditEmployee(emp)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteEmployee(emp)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateEmployeeModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadEmployees}
      />

      <EditEmployeeModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        onSuccess={loadEmployees}
      />
    </div>
  );
}
