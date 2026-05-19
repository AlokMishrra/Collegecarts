import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Employee } from '@/entities/Employee';
import { EmployeeRole } from '@/entities/EmployeeRole';
import { EmployeeDepartment } from '@/entities/EmployeeDepartment';
import { EmployeeSalaryStructure } from '@/entities/EmployeeSalaryStructure';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { User, Mail, Phone, MapPin, Calendar, Briefcase, DollarSign, Upload, CheckCircle } from 'lucide-react';

export default function CreateEmployeeModal({ open, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [salaryStructures, setSalaryStructures] = useState([]);
  const [createdEmployee, setCreatedEmployee] = useState(null);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    emergency_contact: '',
    emergency_phone: '',
    date_of_birth: '',
    gender: '',
    blood_group: '',
    role_id: '',
    department_id: '',
    salary_structure_id: '',
    joining_date: new Date().toISOString().split('T')[0],
    photo: null
  });

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      const [rolesData, depsData, salariesData] = await Promise.all([
        EmployeeRole.list(),
        EmployeeDepartment.list(),
        EmployeeSalaryStructure.list()
      ]);
      setRoles(rolesData || []);
      setDepartments(depsData || []);
      setSalaryStructures(salariesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load form data');
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `employee-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('employee-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('employee-assets')
        .getPublicUrl(filePath);

      handleChange('photo', publicUrl);
      toast.success('Photo uploaded successfully');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
    }
  };

  const validateStep1 = () => {
    if (!formData.full_name || !formData.email || !formData.phone) {
      toast.error('Please fill all required fields');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error('Invalid email format');
      return false;
    }
    if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
      toast.error('Invalid phone number');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.role_id || !formData.department_id) {
      toast.error('Please select role and department');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const generateEmployeeCode = () => {
    return 'CCEMP' + Math.floor(1000 + Math.random() * 9000);
  };

  const generateSlug = (name, code) => {
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${slug}-${code}`;
  };

  const generateTemporaryPassword = () => {
    return 'CC' + Math.random().toString(36).slice(-8).toUpperCase();
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Generate employee code and slug
      const employeeCode = generateEmployeeCode();
      const slug = generateSlug(formData.full_name, employeeCode);
      const tempPassword = generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      // Create employee account
      const { data: newEmployee, error: createError } = await supabase
        .from('employee_accounts')
        .insert({
          employee_code: employeeCode,
          slug: slug,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          emergency_contact: formData.emergency_contact,
          emergency_phone: formData.emergency_phone,
          date_of_birth: formData.date_of_birth || null,
          gender: formData.gender || null,
          blood_group: formData.blood_group || null,
          role_id: formData.role_id,
          department_id: formData.department_id,
          salary_structure_id: formData.salary_structure_id || null,
          joining_date: formData.joining_date,
          photo: formData.photo,
          password_hash: passwordHash,
          must_change_password: true,
          status: 'active',
          // KYC fields (if admin provides them)
          aadhaar_number: formData.aadhaar_number || null,
          pan_number: formData.pan_number || null,
          bank_account_number: formData.bank_account_number || null,
          bank_ifsc: formData.bank_ifsc || null,
          kyc_status: (formData.aadhaar_number && formData.pan_number) ? 'verified' : 'pending',
          aadhaar_verified: !!formData.aadhaar_number,
          pan_verified: !!formData.pan_number,
          bank_verified: !!formData.bank_account_number,
          kyc_verified_at: (formData.aadhaar_number && formData.pan_number) ? new Date().toISOString() : null
        })
        .select(`
          *,
          role:employee_roles(*),
          department:employee_departments(*),
          salary_structure:employee_salary_structures(*)
        `)
        .single();

      if (createError) throw createError;

      // Create initial attendance profile
      await supabase.from('employee_attendance').insert({
        employee_id: newEmployee.id,
        attendance_date: new Date().toISOString().split('T')[0],
        attendance_status: 'absent'
      });

      // Create notification
      await supabase.from('employee_notifications').insert({
        employee_id: newEmployee.id,
        title: 'Welcome to CollegeCart!',
        message: `Your account has been created. Your temporary password is: ${tempPassword}`,
        type: 'info',
        priority: 'high'
      });

      // Log activity
      await supabase.from('employee_activity_logs').insert({
        employee_id: newEmployee.id,
        activity_type: 'account_created',
        activity_description: 'Employee account created successfully'
      });

      setCreatedEmployee({
        ...newEmployee,
        tempPassword: tempPassword
      });

      toast.success('Employee created successfully!');
      setStep(4);
    } catch (error) {
      console.error('Error creating employee:', error);
      toast.error(error.message || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      address: '',
      emergency_contact: '',
      emergency_phone: '',
      date_of_birth: '',
      gender: '',
      blood_group: '',
      role_id: '',
      department_id: '',
      salary_structure_id: '',
      joining_date: new Date().toISOString().split('T')[0],
      photo: null
    });
    setCreatedEmployee(null);
    onClose();
    if (createdEmployee) {
      onSuccess();
    }
  };

  const copyCredentials = () => {
    const text = `Employee Code: ${createdEmployee.employee_code}\nEmail: ${createdEmployee.email}\nTemporary Password: ${createdEmployee.tempPassword}\nLogin URL: ${window.location.origin}/employee/login`;
    navigator.clipboard.writeText(text);
    toast.success('Credentials copied to clipboard!');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {step === 4 ? 'Employee Created Successfully!' : 'Create New Employee'}
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        {step < 4 && (
          <div className="flex items-center justify-between mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-1 mx-2 ${
                    step > s ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Personal Information */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => handleChange('full_name', e.target.value)}
                    placeholder="Enter full name"
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="email@example.com"
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone">Phone *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="10-digit phone number"
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => handleChange('date_of_birth', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select value={formData.gender} onValueChange={(val) => handleChange('gender', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="blood_group">Blood Group</Label>
                <Select value={formData.blood_group} onValueChange={(val) => handleChange('blood_group', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                      <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Enter full address"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="emergency_contact">Emergency Contact Name</Label>
                <Input
                  id="emergency_contact"
                  value={formData.emergency_contact}
                  onChange={(e) => handleChange('emergency_contact', e.target.value)}
                  placeholder="Contact person name"
                />
              </div>

              <div>
                <Label htmlFor="emergency_phone">Emergency Phone</Label>
                <Input
                  id="emergency_phone"
                  value={formData.emergency_phone}
                  onChange={(e) => handleChange('emergency_phone', e.target.value)}
                  placeholder="Emergency contact number"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="photo">Employee Photo</Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                />
                {formData.photo && (
                  <img src={formData.photo} alt="Preview" className="mt-2 h-20 w-20 rounded-full object-cover" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Role & Department */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role_id">Role *</Label>
                <Select value={formData.role_id} onValueChange={(val) => handleChange('role_id', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.role_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="department_id">Department *</Label>
                <Select value={formData.department_id} onValueChange={(val) => handleChange('department_id', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.department_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="joining_date">Joining Date *</Label>
                <Input
                  id="joining_date"
                  type="date"
                  value={formData.joining_date}
                  onChange={(e) => handleChange('joining_date', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="salary_structure_id">Salary Structure</Label>
                <Select value={formData.salary_structure_id} onValueChange={(val) => handleChange('salary_structure_id', val === 'none' ? '' : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select salary structure (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {salaryStructures.map(salary => (
                      <SelectItem key={salary.id} value={salary.id}>
                        {salary.structure_name} - ₹{salary.base_salary}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* KYC Documents Section */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                KYC Documents (Optional - Employee can self-verify later)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="aadhaar_number">Aadhaar Number</Label>
                  <Input
                    id="aadhaar_number"
                    value={formData.aadhaar_number || ''}
                    onChange={(e) => handleChange('aadhaar_number', e.target.value.replace(/\D/g, '').slice(0, 12))}
                    placeholder="12-digit Aadhaar number"
                    maxLength={12}
                  />
                </div>
                <div>
                  <Label htmlFor="pan_number">PAN Number</Label>
                  <Input
                    id="pan_number"
                    value={formData.pan_number || ''}
                    onChange={(e) => handleChange('pan_number', e.target.value.toUpperCase().slice(0, 10))}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                  />
                </div>
                <div>
                  <Label htmlFor="bank_account_number">Bank Account Number</Label>
                  <Input
                    id="bank_account_number"
                    value={formData.bank_account_number || ''}
                    onChange={(e) => handleChange('bank_account_number', e.target.value)}
                    placeholder="Bank account number"
                  />
                </div>
                <div>
                  <Label htmlFor="bank_ifsc">Bank IFSC Code</Label>
                  <Input
                    id="bank_ifsc"
                    value={formData.bank_ifsc || ''}
                    onChange={(e) => handleChange('bank_ifsc', e.target.value.toUpperCase())}
                    placeholder="IFSC code"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3">Review Employee Details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Name:</span>
                  <span className="ml-2 font-medium">{formData.full_name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Email:</span>
                  <span className="ml-2 font-medium">{formData.email}</span>
                </div>
                <div>
                  <span className="text-gray-600">Phone:</span>
                  <span className="ml-2 font-medium">{formData.phone}</span>
                </div>
                <div>
                  <span className="text-gray-600">Role:</span>
                  <span className="ml-2 font-medium">
                    {roles.find(r => r.id === formData.role_id)?.role_name || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Department:</span>
                  <span className="ml-2 font-medium">
                    {departments.find(d => d.id === formData.department_id)?.department_name || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Joining Date:</span>
                  <span className="ml-2 font-medium">{formData.joining_date}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              A temporary password will be generated and sent to the employee's email.
            </p>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && createdEmployee && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Employee Created Successfully!
              </h3>
              <p className="text-gray-600">
                {createdEmployee.full_name} has been added to the system.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-gray-900 mb-3">Login Credentials</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Employee Code:</span>
                  <span className="font-mono font-semibold">{createdEmployee.employee_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-mono">{createdEmployee.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Temporary Password:</span>
                  <span className="font-mono font-semibold text-blue-600">{createdEmployee.tempPassword}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Profile URL:</span>
                  <span className="font-mono text-xs">/employee/{createdEmployee.slug}/profile</span>
                </div>
              </div>
              <Button onClick={copyCredentials} className="w-full mt-3" variant="outline">
                Copy Credentials
              </Button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              <strong>Important:</strong> Please share these credentials with the employee securely. 
              They should change their password after first login.
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between mt-6">
          {step < 4 && (
            <>
              <Button
                variant="outline"
                onClick={step === 1 ? handleClose : handleBack}
                disabled={loading}
              >
                {step === 1 ? 'Cancel' : 'Back'}
              </Button>
              <Button
                onClick={step === 3 ? handleSubmit : handleNext}
                disabled={loading}
              >
                {loading ? 'Creating...' : step === 3 ? 'Create Employee' : 'Next'}
              </Button>
            </>
          )}
          {step === 4 && (
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
