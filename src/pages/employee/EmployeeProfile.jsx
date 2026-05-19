import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Employee } from '@/entities/Employee';
import { EmployeeAttendance } from '@/entities/EmployeeAttendance';
import { EmployeeActivityLog } from '@/entities/EmployeeActivityLog';
import ChangePasswordModal from '@/components/employee/ChangePasswordModal';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  MapPin,
  Download,
  QrCode,
  IdCard,
  TrendingUp,
  Clock,
  Award,
  Target,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  Shield,
  Lock
} from 'lucide-react';
import QRCode from 'qrcode';

export default function EmployeeProfile() {
  const { employeeSlug, viewEmployeeSlug } = useParams(); // Get both params
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [attendanceData, setAttendanceData] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [performanceStats, setPerformanceStats] = useState({
    attendanceRate: 0,
    totalWorkHours: 0,
    overtimeHours: 0,
    tasksCompleted: 0
  });

  // Determine which employee to load
  const targetSlug = viewEmployeeSlug || employeeSlug;
  const isOwnProfile = !viewEmployeeSlug;

  useEffect(() => {
    if (targetSlug) {
      loadEmployee();
    }
  }, [targetSlug]);

  const loadEmployee = async () => {
    try {
      const data = await Employee.findBySlug(targetSlug);
      setEmployee(data);
      
      // Generate QR code
      const qrData = JSON.stringify({
        employee_code: data.employee_code,
        name: data.full_name,
        role: data.role?.role_name
      });
      const qrUrl = await QRCode.toDataURL(qrData);
      setQrCodeUrl(qrUrl);

      // Load attendance data for current month
      const now = new Date();
      const attendance = await EmployeeAttendance.getMonthlyAttendance(
        data.id,
        now.getFullYear(),
        now.getMonth() + 1
      );
      setAttendanceData(attendance || []);

      // Calculate performance stats
      calculatePerformanceStats(attendance || []);

      // Load recent activities
      const activities = await EmployeeActivityLog.getEmployeeActivities(data.id, 10);
      setRecentActivities(activities || []);
    } catch (error) {
      console.error('Error loading employee:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePerformanceStats = (attendance) => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const workingDays = Math.floor(daysInMonth * 0.7); // Approximate working days
    
    const presentDays = attendance.filter(a => a.attendance_status === 'present').length;
    const totalWorkHours = attendance.reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0);
    const overtimeHours = attendance.reduce((sum, a) => sum + (parseFloat(a.overtime_hours) || 0), 0);

    setPerformanceStats({
      attendanceRate: workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0,
      totalWorkHours: Math.round(totalWorkHours),
      overtimeHours: Math.round(overtimeHours),
      tasksCompleted: presentDays // Placeholder
    });
  };

  const getAttendanceCalendar = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const calendar = [];
    let week = new Array(7).fill(null);
    
    // Fill empty days before month starts
    for (let i = 0; i < firstDay; i++) {
      week[i] = null;
    }
    
    // Fill days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const attendance = attendanceData.find(a => a.attendance_date === dateStr);
      
      week[firstDay + day - 1] = {
        day,
        date: dateStr,
        status: attendance?.attendance_status || 'none',
        isToday: day === now.getDate()
      };
      
      if ((firstDay + day) % 7 === 0 || day === daysInMonth) {
        calendar.push([...week]);
        week = new Array(7).fill(null);
      }
    }
    
    return calendar;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'bg-green-500';
      case 'absent': return 'bg-red-500';
      case 'late': return 'bg-yellow-500';
      case 'half_day': return 'bg-orange-500';
      case 'leave': return 'bg-blue-500';
      default: return 'bg-gray-200';
    }
  };

  const getPermissionBadges = () => {
    if (!employee?.role?.permissions) return [];
    
    const permissions = employee.role.permissions;
    const badges = [];
    
    if (permissions.all) {
      badges.push({ label: 'Super Admin', color: 'bg-purple-600', icon: Shield });
    }
    
    const permissionMap = {
      manage_employees: { label: 'Manage Employees', color: 'bg-blue-600', icon: User },
      manage_inventory: { label: 'Inventory', color: 'bg-green-600', icon: Briefcase },
      manage_finance: { label: 'Finance', color: 'bg-yellow-600', icon: TrendingUp },
      manage_deliveries: { label: 'Deliveries', color: 'bg-indigo-600', icon: MapPin },
      view_analytics: { label: 'Analytics', color: 'bg-pink-600', icon: Activity },
      approve_stock_orders: { label: 'Approve Orders', color: 'bg-teal-600', icon: CheckCircle }
    };
    
    Object.entries(permissions).forEach(([key, value]) => {
      if (value && permissionMap[key]) {
        badges.push(permissionMap[key]);
      }
    });
    
    return badges;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800">Employee Not Found</h2>
          <p className="text-gray-600 mt-2">The requested employee profile could not be found.</p>
        </div>
      </div>
    );
  }

  const permissionBadges = getPermissionBadges();
  const attendanceCalendar = getAttendanceCalendar();

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isOwnProfile ? 'My Profile' : 'Employee Profile'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isOwnProfile 
              ? 'Your personal information and performance overview'
              : 'Complete employee information and performance overview'}
          </p>
        </div>
        <div className="flex gap-2">
          {isOwnProfile && (
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => setShowPasswordChangeModal(true)}
            >
              <Lock className="h-4 w-4" />
              Change Password
            </Button>
          )}
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download ID Card
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Download QR
          </Button>
        </div>
      </div>

      {/* Profile Header Card */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center md:items-start">
              <Avatar className="h-32 w-32 border-4 border-white shadow-xl">
                <AvatarImage src={employee.photo} />
                <AvatarFallback className="text-4xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  {employee.full_name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              {qrCodeUrl && (
                <div className="mt-4 p-2 bg-white rounded-lg shadow">
                  <img src={qrCodeUrl} alt="QR Code" className="w-24 h-24" />
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">{employee.full_name}</h2>
                  <p className="text-lg text-gray-600 mt-1">{employee.role?.role_name}</p>
                  <div className="flex gap-2 mt-3">
                    <Badge className="bg-blue-600 text-white">{employee.employee_code}</Badge>
                    <Badge className={employee.status === 'active' ? 'bg-green-600 text-white' : 'bg-gray-400 text-white'}>
                      {employee.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-medium text-gray-900">{employee.email || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm font-medium text-gray-900">{employee.phone || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-xs text-gray-500">Department</p>
                    <p className="text-sm font-medium text-gray-900">{employee.department?.department_name || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-xs text-gray-500">Joined</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(employee.joining_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Attendance Rate</p>
                <p className="text-3xl font-bold mt-2">{performanceStats.attendanceRate}%</p>
                <p className="text-blue-100 text-xs mt-1">This month</p>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <CheckCircle className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Work Hours</p>
                <p className="text-3xl font-bold mt-2">{performanceStats.totalWorkHours}h</p>
                <p className="text-green-100 text-xs mt-1">This month</p>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <Clock className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Overtime</p>
                <p className="text-3xl font-bold mt-2">{performanceStats.overtimeHours}h</p>
                <p className="text-purple-100 text-xs mt-1">This month</p>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <TrendingUp className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Days Present</p>
                <p className="text-3xl font-bold mt-2">{performanceStats.tasksCompleted}</p>
                <p className="text-orange-100 text-xs mt-1">This month</p>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <Target className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Calendar */}
        <Card className="lg:col-span-2 border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-purple-50">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Attendance Calendar - {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-2">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-semibold text-gray-600">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              {attendanceCalendar.map((week, weekIdx) => (
                <div key={weekIdx} className="grid grid-cols-7 gap-2">
                  {week.map((day, dayIdx) => (
                    <div
                      key={dayIdx}
                      className={`
                        aspect-square flex items-center justify-center rounded-lg text-sm font-medium
                        ${day ? getStatusColor(day.status) : 'bg-transparent'}
                        ${day?.isToday ? 'ring-2 ring-blue-600 ring-offset-2' : ''}
                        ${day?.status === 'present' ? 'text-white' : ''}
                        ${day?.status === 'absent' ? 'text-white' : ''}
                        ${day?.status === 'none' ? 'text-gray-400 bg-gray-100' : ''}
                      `}
                      title={day ? `${day.date} - ${day.status}` : ''}
                    >
                      {day?.day}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span className="text-sm text-gray-600">Present</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span className="text-sm text-gray-600">Absent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500"></div>
                <span className="text-sm text-gray-600">Late</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500"></div>
                <span className="text-sm text-gray-600">Leave</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-200"></div>
                <span className="text-sm text-gray-600">No Data</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skills & Permissions */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-600" />
              Skills & Permissions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {permissionBadges.length > 0 ? (
                permissionBadges.map((badge, idx) => {
                  const Icon = badge.icon;
                  return (
                    <div
                      key={idx}
                      className={`${badge.color} text-white p-3 rounded-lg flex items-center gap-3 shadow-md hover:shadow-lg transition-shadow`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{badge.label}</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500 text-center py-4">No permissions assigned</p>
              )}
            </div>

            {/* Role Info */}
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-semibold text-gray-900 mb-3">Role Information</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Role</span>
                  <span className="font-medium text-gray-900">{employee.role?.role_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Dashboard Type</span>
                  <span className="font-medium text-gray-900">{employee.role?.dashboard_type || 'Standard'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Hierarchy Level</span>
                  <span className="font-medium text-gray-900">{employee.role?.hierarchy_level || 'N/A'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Personal Details & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Details */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-green-50 to-teal-50">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-green-600" />
              Personal Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Gender</p>
                  <p className="font-medium text-gray-900">{employee.gender || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Blood Group</p>
                  <p className="font-medium text-gray-900">{employee.blood_group || 'N/A'}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Date of Birth</p>
                <p className="font-medium text-gray-900">
                  {employee.date_of_birth
                    ? new Date(employee.date_of_birth).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })
                    : 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Address</p>
                <p className="font-medium text-gray-900">{employee.address || 'N/A'}</p>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-semibold text-gray-900 mb-3">Emergency Contact</h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Contact Name</p>
                    <p className="font-medium text-gray-900">{employee.emergency_contact || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Contact Phone</p>
                    <p className="font-medium text-gray-900">{employee.emergency_phone || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-red-50">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-orange-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity, idx) => (
                  <div key={idx} className="flex gap-3 pb-4 border-b last:border-0 last:pb-0">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 mt-2 rounded-full bg-blue-600"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.activity_description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(activity.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Salary Information */}
      {employee.salary_structure && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-yellow-50 to-orange-50">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-yellow-600" />
              Salary Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Base Salary</p>
                <p className="text-2xl font-bold text-gray-900">₹{employee.salary_structure.base_salary?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">HRA</p>
                <p className="text-2xl font-bold text-gray-900">₹{employee.salary_structure.hra?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Allowances</p>
                <p className="text-2xl font-bold text-gray-900">₹{(employee.salary_structure.transport_allowance || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Total CTC</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{(
                    (employee.salary_structure.base_salary || 0) +
                    (employee.salary_structure.hra || 0) +
                    (employee.salary_structure.transport_allowance || 0)
                  ).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Password Change Modal */}
      {showPasswordChangeModal && employee && (
        <ChangePasswordModal
          open={showPasswordChangeModal}
          onClose={(success) => {
            setShowPasswordChangeModal(false);
            if (success) {
              // Optionally reload employee data
              loadEmployee();
            }
          }}
          employee={employee}
          isForced={false}
        />
      )}
    </div>
  );
}
