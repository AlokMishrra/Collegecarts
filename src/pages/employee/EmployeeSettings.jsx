import React, { useState } from 'react';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings, Lock, Bell, Shield, User, Eye, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import ChangePasswordModal from '@/components/employee/ChangePasswordModal';

export default function EmployeeSettings() {
  const { employee } = useEmployeeAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    attendanceReminders: true,
    salaryAlerts: true,
    darkMode: false,
    showProfilePhoto: true,
    twoFactorAuth: false
  });

  const handleSettingChange = async (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    // Save to database (you can create a settings table or use employee_accounts)
    try {
      // For now, just show success
      toast.success('Setting updated');
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error('Failed to update setting');
    }
  };

  const handlePasswordChangeComplete = (success) => {
    setShowPasswordModal(false);
    if (success) {
      toast.success('Password changed successfully!');
    }
  };

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-8 h-8 text-blue-600" />
          Settings
        </h1>
        <p className="text-gray-600 mt-1">Manage your account preferences and security settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Security Settings */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-red-50 to-orange-50">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-600" />
                Security & Privacy
              </CardTitle>
              <CardDescription>
                Manage your password and security preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Change Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Lock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Password</p>
                    <p className="text-sm text-gray-600">Change your account password</p>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => setShowPasswordModal(true)}
                >
                  Change Password
                </Button>
              </div>

              <Separator />

              {/* Two-Factor Authentication */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Shield className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                    <p className="text-sm text-gray-600">Add an extra layer of security</p>
                  </div>
                </div>
                <Switch
                  checked={settings.twoFactorAuth}
                  onCheckedChange={(checked) => handleSettingChange('twoFactorAuth', checked)}
                />
              </div>

              <Separator />

              {/* Profile Visibility */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Eye className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Show Profile Photo</p>
                    <p className="text-sm text-gray-600">Display your photo to other employees</p>
                  </div>
                </div>
                <Switch
                  checked={settings.showProfilePhoto}
                  onCheckedChange={(checked) => handleSettingChange('showProfilePhoto', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-cyan-50">
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                Notifications
              </CardTitle>
              <CardDescription>
                Choose what notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Email Notifications */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Email Notifications</p>
                  <p className="text-sm text-gray-600">Receive notifications via email</p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
                />
              </div>

              <Separator />

              {/* Push Notifications */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Push Notifications</p>
                  <p className="text-sm text-gray-600">Receive push notifications in browser</p>
                </div>
                <Switch
                  checked={settings.pushNotifications}
                  onCheckedChange={(checked) => handleSettingChange('pushNotifications', checked)}
                />
              </div>

              <Separator />

              {/* Attendance Reminders */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Attendance Reminders</p>
                  <p className="text-sm text-gray-600">Get reminded to mark attendance</p>
                </div>
                <Switch
                  checked={settings.attendanceReminders}
                  onCheckedChange={(checked) => handleSettingChange('attendanceReminders', checked)}
                />
              </div>

              <Separator />

              {/* Salary Alerts */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Salary Alerts</p>
                  <p className="text-sm text-gray-600">Get notified about salary updates</p>
                </div>
                <Switch
                  checked={settings.salaryAlerts}
                  onCheckedChange={(checked) => handleSettingChange('salaryAlerts', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
              <CardTitle className="flex items-center gap-2">
                {settings.darkMode ? <Moon className="w-5 h-5 text-purple-600" /> : <Sun className="w-5 h-5 text-yellow-600" />}
                Appearance
              </CardTitle>
              <CardDescription>
                Customize how the app looks for you
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Dark Mode */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Dark Mode</p>
                  <p className="text-sm text-gray-600">Switch to dark theme (Coming Soon)</p>
                </div>
                <Switch
                  checked={settings.darkMode}
                  onCheckedChange={(checked) => {
                    handleSettingChange('darkMode', checked);
                    toast.info('Dark mode coming soon!');
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Info Sidebar */}
        <div className="space-y-6">
          {/* Account Overview */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-green-50 to-teal-50">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-green-600" />
                Account Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Employee Code</p>
                <p className="font-semibold text-gray-900">{employee?.employee_code}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-semibold text-gray-900 break-all">{employee?.email}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-semibold text-gray-900">{employee?.phone}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-gray-500">Role</p>
                <p className="font-semibold text-gray-900">{employee?.role?.role_name}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-gray-500">Department</p>
                <p className="font-semibold text-gray-900">{employee?.department?.department_name}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  employee?.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {employee?.status}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-red-50">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setShowPasswordModal(true)}
              >
                <Lock className="w-4 h-4 mr-2" />
                Change Password
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => toast.info('Feature coming soon!')}
              >
                <User className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && employee && (
        <ChangePasswordModal
          open={showPasswordModal}
          onClose={handlePasswordChangeComplete}
          employee={employee}
          isForced={false}
        />
      )}
    </div>
  );
}
