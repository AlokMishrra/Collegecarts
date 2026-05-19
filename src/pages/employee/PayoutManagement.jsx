import React, { useState, useEffect } from 'react';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, Plus, Search, Filter, Download, CheckCircle, 
  XCircle, Clock, AlertCircle, TrendingUp, Users, Calendar 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import CreatePayoutModal from '@/components/employee/CreatePayoutModal';
import PayoutDetailModal from '@/components/employee/PayoutDetailModal';

export default function PayoutManagement() {
  const { employee, isSuperAdmin } = useEmployeeAuth();
  const [payouts, setPayouts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [stats, setStats] = useState({
    totalPaid: 0,
    pending: 0,
    thisMonth: 0,
    employeeCount: 0
  });

  useEffect(() => {
    if (!isSuperAdmin()) {
      toast.error('Access denied. Only Super Admins can manage payouts.');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load payouts with employee details
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('employee_payouts')
        .select(`
          *,
          employee:employee_id(
            id,
            employee_code,
            full_name,
            email,
            photo
          ),
          processor:processed_by(
            full_name
          )
        `)
        .order('payout_year', { ascending: false })
        .order('payout_month', { ascending: false });

      if (payoutsError) throw payoutsError;
      setPayouts(payoutsData || []);

      // Load employees for creating payouts
      const { data: employeesData, error: employeesError } = await supabase
        .from('employee_accounts')
        .select(`
          *,
          role:employee_roles(role_name),
          department:employee_departments(department_name),
          salary_structure:employee_salary_structures(*)
        `)
        .eq('status', 'active')
        .order('full_name');

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);

      // Calculate stats
      calculateStats(payoutsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load payout data');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (payoutsData) => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const totalPaid = payoutsData
      .filter(p => p.payment_status === 'completed')
      .reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0);

    const pending = payoutsData
      .filter(p => p.payment_status === 'pending')
      .reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0);

    const thisMonth = payoutsData
      .filter(p => p.payout_month === currentMonth && p.payout_year === currentYear)
      .reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0);

    const employeeCount = new Set(payoutsData.map(p => p.employee_id)).size;

    setStats({ totalPaid, pending, thisMonth, employeeCount });
  };

  const filteredPayouts = payouts.filter(payout => {
    const matchesSearch = 
      payout.employee?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payout.employee?.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payout.employee?.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || payout.payment_status === statusFilter;

    const matchesMonth = monthFilter === 'all' || payout.payout_month === parseInt(monthFilter);

    return matchesSearch && matchesStatus && matchesMonth;
  });

  const getStatusBadge = (status) => {
    const variants = {
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      processing: { color: 'bg-blue-100 text-blue-800', icon: TrendingUp },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircle }
    };

    const variant = variants[status] || variants.pending;
    const Icon = variant.icon;

    return (
      <Badge className={`${variant.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const getMonthName = (month) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1] || '';
  };

  const handleUpdateStatus = async (payoutId, newStatus) => {
    try {
      const updates = {
        payment_status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'completed') {
        updates.processed_by = employee.id;
        updates.processed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('employee_payouts')
        .update(updates)
        .eq('id', payoutId);

      if (error) throw error;

      toast.success(`Payout marked as ${newStatus}!`);
      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update payout status');
    }
  };

  const handleViewPayout = (payout) => {
    setSelectedPayout(payout);
    setShowDetailModal(true);
  };

  if (!isSuperAdmin()) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-gray-600 mt-2">Only Super Admins can access payout management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-emerald-600" />
            Payout Management
          </h1>
          <p className="text-gray-600 mt-1">Manage employee salary payouts</p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Payout
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Total Paid</p>
                <p className="text-3xl font-bold mt-2">₹{stats.totalPaid.toLocaleString()}</p>
                <p className="text-green-100 text-xs mt-1">All time</p>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <CheckCircle className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm font-medium">Pending</p>
                <p className="text-3xl font-bold mt-2">₹{stats.pending.toLocaleString()}</p>
                <p className="text-yellow-100 text-xs mt-1">To be processed</p>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <Clock className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">This Month</p>
                <p className="text-3xl font-bold mt-2">₹{stats.thisMonth.toLocaleString()}</p>
                <p className="text-blue-100 text-xs mt-1">Current month</p>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <Calendar className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Employees</p>
                <p className="text-3xl font-bold mt-2">{stats.employeeCount}</p>
                <p className="text-purple-100 text-xs mt-1">Paid employees</p>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <Users className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {[...Array(12)].map((_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                    {getMonthName(i + 1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payouts List */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Records ({filteredPayouts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading payouts...</div>
          ) : filteredPayouts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No payouts found. Create your first payout to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPayouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                      {payout.employee?.photo ? (
                        <img
                          src={payout.employee.photo}
                          alt={payout.employee.full_name}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <Users className="h-6 w-6 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{payout.employee?.full_name}</h3>
                      <p className="text-sm text-gray-500">
                        {payout.employee?.employee_code} • {payout.employee?.email}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs text-gray-400">
                          {getMonthName(payout.payout_month)} {payout.payout_year}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-400">
                          {payout.payment_method?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Gross</p>
                      <p className="font-semibold">₹{parseFloat(payout.gross_salary).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Net</p>
                      <p className="font-semibold text-green-600">₹{parseFloat(payout.net_salary).toLocaleString()}</p>
                    </div>
                    <div className="w-32">
                      {getStatusBadge(payout.payment_status)}
                    </div>
                    <div className="flex gap-2">
                      {payout.payment_status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(payout.id, 'completed')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Mark Paid
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleViewPayout(payout)}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Payout Modal */}
      <CreatePayoutModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadData}
        employees={employees}
        currentUser={employee}
      />

      {/* Payout Detail Modal */}
      <PayoutDetailModal
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedPayout(null);
        }}
        payout={selectedPayout}
      />
    </div>
  );
}
