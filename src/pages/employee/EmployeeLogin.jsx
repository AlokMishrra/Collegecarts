import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, Lock, User, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import ChangePasswordModal from '@/components/employee/ChangePasswordModal';

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const { login } = useEmployeeAuth();
  const [formData, setFormData] = useState({
    emailOrPhone: '',
    password: '',
    rememberDevice: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [loggedInEmployee, setLoggedInEmployee] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(
        formData.emailOrPhone,
        formData.password,
        formData.rememberDevice
      );

      if (result.success) {
        // Check if password change is required
        if (result.mustChangePassword) {
          setLoggedInEmployee(result.employee);
          setShowPasswordChangeModal(true);
          toast.info('Please change your temporary password');
        } else {
          toast.success('Login successful!');
          // Navigate to slug-based dashboard
          const employeeSlug = result.employee.slug || `${result.employee.full_name.toLowerCase().replace(/\s+/g, '-')}-${result.employee.employee_code}`;
          navigate(`/employee/${employeeSlug}/dashboard`);
        }
      } else {
        setError(result.error || 'Login failed');
        toast.error(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred during login');
      toast.error('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChangeComplete = (success) => {
    if (success) {
      setShowPasswordChangeModal(false);
      toast.success('Password changed successfully! Redirecting...');
      // Navigate to dashboard after password change
      const employeeSlug = loggedInEmployee.slug || `${loggedInEmployee.full_name.toLowerCase().replace(/\s+/g, '-')}-${loggedInEmployee.employee_code}`;
      setTimeout(() => {
        navigate(`/employee/${employeeSlug}/dashboard`);
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-full mb-4">
            <Briefcase className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">CollegeCart</h1>
          <p className="text-gray-600 mt-2">Employee Operations Portal</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Employee Login</CardTitle>
            <CardDescription>
              Access your employee dashboard and operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="emailOrPhone">Email or Phone</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="emailOrPhone"
                    type="text"
                    placeholder="Enter email or phone"
                    value={formData.emailOrPhone}
                    onChange={(e) => setFormData({ ...formData, emailOrPhone: e.target.value })}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10 pr-10"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberDevice"
                  checked={formData.rememberDevice}
                  onCheckedChange={(checked) => setFormData({ ...formData, rememberDevice: checked })}
                />
                <label
                  htmlFor="rememberDevice"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Remember this device for 30 days
                </label>
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login to Dashboard'}
              </Button>

              <div className="text-center text-sm text-gray-600">
                <button
                  type="button"
                  onClick={() => navigate('/employee/forgot-password')}
                  className="text-emerald-600 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>For customer access, visit <a href="/" className="text-emerald-600 hover:underline">main website</a></p>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordChangeModal && loggedInEmployee && (
        <ChangePasswordModal
          open={showPasswordChangeModal}
          onClose={handlePasswordChangeComplete}
          employee={loggedInEmployee}
          isForced={true}
        />
      )}
    </div>
  );
}
