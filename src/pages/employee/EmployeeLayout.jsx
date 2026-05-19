import React, { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Package,
  Truck,
  DollarSign,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  Briefcase,
  ClipboardList,
  BarChart3,
  MessageSquare,
  Calendar,
  FileText
} from 'lucide-react';

export default function EmployeeLayout() {
  const { employee, logout, isSuperAdmin } = useEmployeeAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await logout();
    navigate('/employee/login');
  };

  // Get navigation items based on role with slug-based paths
  const getNavigationItems = () => {
    const dashboardType = employee?.role?.dashboard_type;
    const slug = employee?.slug;

    const commonItems = [
      { name: 'Dashboard', icon: LayoutDashboard, path: `/employee/${slug}/dashboard` },
      { name: 'My Profile', icon: Users, path: `/employee/${slug}/profile` },
      { name: 'Attendance', icon: Calendar, path: `/employee/${slug}/attendance` },
      { name: 'My Salary', icon: DollarSign, path: `/employee/${slug}/salary` },
    ];

    const roleSpecificItems = {
      super_admin: [
        { name: 'Employees', icon: Users, path: `/employee/${slug}/manage/employees` },
        { name: 'Departments', icon: Briefcase, path: `/employee/${slug}/manage/departments` },
        { name: 'Stock Manager', icon: Package, path: `/employee/${slug}/stock` },
        { name: 'Stock Orders', icon: ClipboardList, path: `/employee/${slug}/stock-orders` },
        { name: 'Deliveries', icon: Truck, path: `/employee/${slug}/deliveries` },
        { name: 'Finance', icon: DollarSign, path: `/employee/${slug}/finance` },
        { name: 'Payouts', icon: DollarSign, path: `/employee/${slug}/payouts` },
        { name: 'Analytics', icon: BarChart3, path: `/employee/${slug}/analytics` },
        { name: 'Support', icon: MessageSquare, path: `/employee/${slug}/support` },
      ],
      manager: [
        { name: 'Employees', icon: Users, path: `/employee/${slug}/manage/employees` },
        { name: 'Stock Orders', icon: Package, path: `/employee/${slug}/stock-orders` },
        { name: 'Deliveries', icon: Truck, path: `/employee/${slug}/deliveries` },
        { name: 'Analytics', icon: BarChart3, path: `/employee/${slug}/analytics` },
      ],
      delivery: [
        { name: 'My Deliveries', icon: Truck, path: `/employee/${slug}/deliveries` },
        { name: 'Delivery History', icon: ClipboardList, path: `/employee/${slug}/delivery-history` },
      ],
      stock: [
        { name: 'Stock Manager', icon: Package, path: `/employee/${slug}/stock` },
        { name: 'Stock Orders', icon: ClipboardList, path: `/employee/${slug}/stock-orders` },
        { name: 'Create Order', icon: FileText, path: `/employee/${slug}/stock-orders/create` },
        { name: 'Inventory', icon: BarChart3, path: `/employee/${slug}/inventory` },
      ],
      finance: [
        { name: 'Salary Management', icon: DollarSign, path: `/employee/${slug}/finance/salaries` },
        { name: 'Payments', icon: FileText, path: `/employee/${slug}/finance/payments` },
        { name: 'Reports', icon: BarChart3, path: `/employee/${slug}/finance/reports` },
      ],
      support: [
        { name: 'Support Tickets', icon: MessageSquare, path: `/employee/${slug}/support/tickets` },
        { name: 'My Tickets', icon: ClipboardList, path: `/employee/${slug}/support/my-tickets` },
      ],
      sales: [
        { name: 'Orders', icon: Package, path: `/employee/${slug}/sales/orders` },
        { name: 'Customers', icon: Users, path: `/employee/${slug}/sales/customers` },
      ],
      inventory: [
        { name: 'Stock Orders', icon: Package, path: `/employee/${slug}/stock-orders` },
        { name: 'Create Order', icon: ClipboardList, path: `/employee/${slug}/stock-orders/create` },
      ],
    };

    return [...commonItems, ...(roleSpecificItems[dashboardType] || [])];
  };

  const navigationItems = getNavigationItems();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-emerald-600" />
              <span className="font-bold text-lg">CollegeCart Employee</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={employee?.photo} />
                    <AvatarFallback>{employee?.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium">{employee?.full_name}</p>
                    <p className="text-xs text-gray-500">{employee?.role?.role_name}</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{employee?.full_name}</p>
                    <p className="text-xs text-gray-500">{employee?.employee_code}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/employee/${employee?.slug}/profile`)}>
                  <Users className="mr-2 h-4 w-4" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/employee/${employee?.slug}/settings`)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside
          className={`fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 transition-transform duration-300 z-40 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0`}
        >
          <nav className="p-4 space-y-1 overflow-y-auto h-full">
            {navigationItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main
          className={`flex-1 transition-all duration-300 ${
            sidebarOpen ? 'lg:ml-64' : 'ml-0'
          }`}
        >
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
