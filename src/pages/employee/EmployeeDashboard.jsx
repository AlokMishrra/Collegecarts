import React, { useState, useEffect } from 'react';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Package,
  Truck,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  BarChart3,
  Bell,
  X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { EmployeeAttendance } from '@/entities/EmployeeAttendance';
import { toast } from 'sonner';
import KYCVerificationDialog from '@/components/employee/KYCVerificationDialog';

export default function EmployeeDashboard() {
  const { employee, isSuperAdmin } = useEmployeeAuth();
  const [stats, setStats] = useState({});
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [showKYCDialog, setShowKYCDialog] = useState(false);
  const [newPayoutNotification, setNewPayoutNotification] = useState(null);

  useEffect(() => {
    loadDashboardData();
    checkForNewPayouts();
    checkKYCStatus();
  }, [employee]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load today's attendance
      const attendance = await EmployeeAttendance.getTodayAttendance(employee.id);
      setTodayAttendance(attendance);

      // Load pending payouts for this employee
      const { data: payouts, error: payoutsError } = await supabase
        .from('employee_payouts')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: false });

      if (!payoutsError) {
        setPendingPayouts(payouts || []);
      }

      // Load stats based on role
      if (isSuperAdmin()) {
        await loadSuperAdminStats();
      } else {
        await loadEmployeeStats();
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkForNewPayouts = async () => {
    try {
      // Check for payouts created in last 7 days that user hasn't seen
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('employee_payouts')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const latestPayout = data[0];
        const seenKey = `payout_notification_seen_${latestPayout.id}`;
        
        // Check if user has seen this notification
        if (!localStorage.getItem(seenKey)) {
          setNewPayoutNotification(latestPayout);
        }
      }
    } catch (error) {
      console.error('Error checking new payouts:', error);
    }
  };

  const dismissPayoutNotification = () => {
    if (newPayoutNotification) {
      localStorage.setItem(`payout_notification_seen_${newPayoutNotification.id}`, 'true');
      setNewPayoutNotification(null);
    }
  };

  const checkKYCStatus = () => {
    if (!employee) return;
    // Show KYC dialog if status is not verified or submitted
    const kycStatus = employee.kyc_status || 'pending';
    if (kycStatus === 'pending' || kycStatus === 'rejected') {
      // Don't show for super admins
      if (!isSuperAdmin()) {
        // Check if user dismissed it today
        const dismissedKey = `kyc_dismissed_${employee.id}_${new Date().toDateString()}`;
        if (!localStorage.getItem(dismissedKey)) {
          setShowKYCDialog(true);
        }
      }
    }
  };

  const handleKYCClose = () => {
    // Mark as dismissed for today
    const dismissedKey = `kyc_dismissed_${employee.id}_${new Date().toDateString()}`;
    localStorage.setItem(dismissedKey, 'true');
    setShowKYCDialog(false);
  };

  const loadSuperAdminStats = async () => {
    const [
      { count: totalEmployees },
      { count: activeEmployees },
      { count: pendingStockOrders },
      { count: todayDeliveries },
      { data: pendingSalaries }
    ] = await Promise.all([
      supabase.from('employee_accounts').select('*', { count: 'exact', head: true }),
      supabase.from('employee_accounts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('employee_stock_orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('employee_delivery_assignments').select('*', { count: 'exact', head: true }).gte('assignment_date', new Date().toISOString().split('T')[0]),
      supabase.from('employee_salary_logs').select('total_salary').eq('paid_status', 'pending')
    ]);

    const totalPendingSalary = pendingSalaries?.reduce((sum, s) => sum + parseFloat(s.total_salary || 0), 0) || 0;

    setStats({
      totalEmployees,
      activeEmployees,
      pendingStockOrders,
      todayDeliveries,
      totalPendingSalary
    });
  };

  const loadEmployeeStats = async () => {
    const dashboardType = employee?.role?.dashboard_type;

    if (dashboardType === 'delivery') {
      const { count: myDeliveries } = await supabase
        .from('employee_delivery_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('employee_id', employee.id)
        .eq('status', 'assigned');

      const { count: completedToday } = await supabase
        .from('employee_delivery_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('employee_id', employee.id)
        .eq('status', 'delivered')
        .gte('delivery_time', new Date().toISOString().split('T')[0]);

      setStats({ myDeliveries, completedToday });
    } else if (dashboardType === 'stock') {
      const { count: myOrders } = await supabase
        .from('employee_stock_orders')
        .select('*', { count: 'exact', head: true })
        .eq('employee_id', employee.id);

      const { count: pendingOrders } = await supabase
        .from('employee_stock_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      setStats({ myOrders, pendingOrders });
    }
  };

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      const location = await getCurrentLocation();
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform
      };

      await EmployeeAttendance.checkIn(employee.id, location, deviceInfo);
      toast.success('Checked in successfully!');
      loadDashboardData();
    } catch (error) {
      toast.error('Failed to check in');
      console.error(error);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setCheckingIn(true);
      const location = await getCurrentLocation();
      await EmployeeAttendance.checkOut(employee.id, location);
      toast.success('Checked out successfully!');
      loadDashboardData();
    } catch (error) {
      toast.error('Failed to check out');
      console.error(error);
    } finally {
      setCheckingIn(false);
    }
  };

  const getCurrentLocation = () => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          () => resolve(null)
        );
      } else {
        resolve(null);
      }
    });
  };

  const getMonthName = (month) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1] || '';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      {/* KYC Verification Dialog */}
      <KYCVerificationDialog 
        open={showKYCDialog} 
        onClose={handleKYCClose}
        onSuccess={() => setShowKYCDialog(false)}
      />

      {/* New Payout Notification Banner */}
      {newPayoutNotification && (
        <Card className="border-2 border-green-500 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className="bg-green-500 p-2 rounded-full">
                  <Bell className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-green-900 text-lg mb-1">
                    🎉 New Salary Payout Created!
                  </h3>
                  <p className="text-green-800 mb-3">
                    Your salary for <strong>{getMonthName(newPayoutNotification.payout_month)} {newPayoutNotification.payout_year}</strong> has been processed.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-gray-600 text-xs">Gross Salary</p>
                      <p className="font-bold text-green-700">{formatCurrency(newPayoutNotification.gross_salary)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-gray-600 text-xs">Net Salary</p>
                      <p className="font-bold text-green-700">{formatCurrency(newPayoutNotification.net_salary)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-gray-600 text-xs">Status</p>
                      <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                        {newPayoutNotification.payment_status === 'pending' ? 'Processing' : newPayoutNotification.payment_status}
                      </Badge>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-gray-600 text-xs">Payment Method</p>
                      <p className="font-semibold text-gray-700 capitalize text-xs">
                        {newPayoutNotification.payment_method?.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <p className="text-green-700 text-sm mt-3 font-medium">
                    💰 Your salary will be credited to your account shortly!
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={dismissPayoutNotification}
                className="text-green-700 hover:text-green-900 hover:bg-green-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Payouts Alert */}
      {pendingPayouts.length > 0 && !newPayoutNotification && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900">
                  {pendingPayouts.length} Pending Salary Payment{pendingPayouts.length > 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-yellow-800">
                  Your salary is being processed and will be credited soon.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = `/employee/${employee.slug}/salary`}
                className="border-yellow-600 text-yellow-700 hover:bg-yellow-100"
              >
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-blue-600 rounded-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {employee?.full_name}!
        </h1>
        <p className="text-emerald-100">
          {employee?.role?.role_name} • {employee?.department?.department_name}
        </p>
        <p className="text-sm text-emerald-100 mt-1">
          Employee ID: {employee?.employee_code}
        </p>
      </div>

      {/* Attendance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today's Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              {todayAttendance ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Checked In</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Check-in: {new Date(todayAttendance.check_in).toLocaleTimeString()}
                  </p>
                  {todayAttendance.check_out && (
                    <p className="text-sm text-gray-600">
                      Check-out: {new Date(todayAttendance.check_out).toLocaleTimeString()}
                    </p>
                  )}
                  {todayAttendance.work_hours && (
                    <p className="text-sm font-medium text-emerald-600">
                      Work Hours: {todayAttendance.work_hours} hrs
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  <span className="text-gray-600">Not checked in yet</span>
                </div>
              )}
            </div>
            <div>
              {!todayAttendance ? (
                <Button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {checkingIn ? 'Checking In...' : 'Check In'}
                </Button>
              ) : !todayAttendance.check_out ? (
                <Button
                  onClick={handleCheckOut}
                  disabled={checkingIn}
                  variant="outline"
                >
                  {checkingIn ? 'Checking Out...' : 'Check Out'}
                </Button>
              ) : (
                <Badge className="bg-green-600">Completed</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      {isSuperAdmin() ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                Total Employees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalEmployees || 0}</p>
              <p className="text-xs text-gray-600">{stats.activeEmployees || 0} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-600" />
                Pending Stock Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.pendingStockOrders || 0}</p>
              <p className="text-xs text-gray-600">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Truck className="h-4 w-4 text-green-600" />
                Today's Deliveries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.todayDeliveries || 0}</p>
              <p className="text-xs text-gray-600">Scheduled</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-purple-600" />
                Pending Salaries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">₹{stats.totalPendingSalary?.toFixed(2) || '0.00'}</p>
              <p className="text-xs text-gray-600">To be paid</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {employee?.role?.dashboard_type === 'delivery' && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-600" />
                    My Deliveries
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats.myDeliveries || 0}</p>
                  <p className="text-xs text-gray-600">Assigned to me</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Completed Today
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats.completedToday || 0}</p>
                  <p className="text-xs text-gray-600">Deliveries</p>
                </CardContent>
              </Card>
            </>
          )}

          {employee?.role?.dashboard_type === 'stock' && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-orange-600" />
                    My Orders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats.myOrders || 0}</p>
                  <p className="text-xs text-gray-600">Total orders</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    Pending Orders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats.pendingOrders || 0}</p>
                  <p className="text-xs text-gray-600">Awaiting approval</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Calendar className="h-6 w-6" />
              <span className="text-sm">View Attendance</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <DollarSign className="h-6 w-6" />
              <span className="text-sm">My Salary</span>
            </Button>
            {isSuperAdmin() && (
              <>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Package className="h-6 w-6" />
                  <span className="text-sm">Stock Orders</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <BarChart3 className="h-6 w-6" />
                  <span className="text-sm">Analytics</span>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
