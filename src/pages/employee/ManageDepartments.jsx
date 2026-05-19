import React, { useState, useEffect } from 'react';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Search, Plus, Edit, Trash2, Users } from 'lucide-react';
import { EmployeeDepartment } from '@/entities/EmployeeDepartment';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function ManageDepartments() {
  const { employee } = useEmployeeAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [formData, setFormData] = useState({
    department_name: '',
    department_code: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employee_departments')
        .select(`
          *,
          employees:employee_accounts(count)
        `)
        .order('department_name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingDepartment) {
        // Update
        const { error } = await supabase
          .from('employee_departments')
          .update(formData)
          .eq('id', editingDepartment.id);

        if (error) throw error;
        toast.success('Department updated successfully!');
      } else {
        // Create
        const { error } = await supabase
          .from('employee_departments')
          .insert(formData);

        if (error) throw error;
        toast.success('Department created successfully!');
      }

      setShowCreateModal(false);
      setEditingDepartment(null);
      setFormData({
        department_name: '',
        department_code: '',
        description: '',
        is_active: true
      });
      loadDepartments();
    } catch (error) {
      console.error('Error saving department:', error);
      toast.error(error.message || 'Failed to save department');
    }
  };

  const handleEdit = (dept) => {
    setEditingDepartment(dept);
    setFormData({
      department_name: dept.department_name,
      department_code: dept.department_code,
      description: dept.description || '',
      is_active: dept.is_active
    });
    setShowCreateModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this department?')) return;

    try {
      const { error } = await supabase
        .from('employee_departments')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      toast.success('Department deleted successfully!');
      loadDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      toast.error('Failed to delete department');
    }
  };

  const filteredDepartments = departments.filter(dept =>
    dept.department_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.department_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Departments</h1>
          <p className="text-gray-500">Create and manage employee departments</p>
        </div>
        <Button onClick={() => {
          setEditingDepartment(null);
          setFormData({
            department_name: '',
            department_code: '',
            description: '',
            is_active: true
          });
          setShowCreateModal(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Department
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Departments ({filteredDepartments.length})</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search departments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading departments...</div>
          ) : filteredDepartments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No departments found</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDepartments.map((dept) => (
                <Card key={dept.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <Briefcase className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{dept.department_name}</h3>
                          <p className="text-sm text-gray-500">{dept.department_code}</p>
                        </div>
                      </div>
                    </div>
                    
                    {dept.description && (
                      <p className="text-sm text-gray-600 mb-4">{dept.description}</p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="h-4 w-4" />
                        <span>{dept.employees?.[0]?.count || 0} employees</span>
                      </div>
                      <Badge variant={dept.is_active ? 'default' : 'secondary'}>
                        {dept.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleEdit(dept)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(dept.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? 'Edit Department' : 'Create New Department'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="department_name">Department Name *</Label>
              <Input
                id="department_name"
                value={formData.department_name}
                onChange={(e) => setFormData(prev => ({ ...prev, department_name: e.target.value }))}
                placeholder="e.g., Operations"
                required
              />
            </div>

            <div>
              <Label htmlFor="department_code">Department Code *</Label>
              <Input
                id="department_code"
                value={formData.department_code}
                onChange={(e) => setFormData(prev => ({ ...prev, department_code: e.target.value.toUpperCase() }))}
                placeholder="e.g., OPS"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the department"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingDepartment ? 'Update' : 'Create'} Department
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
