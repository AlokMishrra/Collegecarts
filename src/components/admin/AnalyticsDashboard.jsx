import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  Users, 
  Truck,
  Clock,
  AlertCircle,
  Calendar,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    loadAnalytics();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      loadAnalytics();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch all data in parallel
      const [
        allOrders,
        allDeliveryPersons,
        scheduledOrders,
        withdrawalRequests,
        allProducts
      ] = await Promise.all([
        base44.entities.Order.list(),
        base44.entities.DeliveryPerson.list(),
        base44.entities.Order.filter({ is_scheduled: true, status: 'scheduled' }),
        base44.entities.WithdrawalRequest?.filter({ status: 'pending' }).catch(() => []),
        base44.entities.Product.list()
      ]);

      // Filter today's orders in JavaScript
      const todayOrders = allOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= today;
      });

      // Calculate today's revenue
      const todayRevenue = todayOrders.reduce((sum, order) => 
        sum + (order.total_amount || 0), 0
      );

      // Calculate total revenue
      const totalRevenue = allOrders.reduce((sum, order) => 
        sum + (order.total_amount || 0), 0
      );

      // Calculate delivery costs (₹20 per delivery)
      const deliveryCostPerOrder = 20;
      const totalDeliveryCost = allOrders.filter(o => 
        o.status === 'delivered'
      ).length * deliveryCostPerOrder;

      // Estimated profit (revenue - delivery costs)
      const estimatedProfit = totalRevenue - totalDeliveryCost;

      // Active delivery partners
      const activePartners = allDeliveryPersons.filter(dp => 
        dp.is_available === true
      ).length;

      // Calculate average delivery time
      const deliveredOrders = allOrders.filter(o => 
        o.status === 'delivered' && o.delivered_at && o.created_at
      );
      
      const avgDeliveryTime = deliveredOrders.length > 0
        ? deliveredOrders.reduce((sum, order) => {
            const created = new Date(order.created_at);
            const delivered = new Date(order.delivered_at);
            return sum + (delivered - created);
          }, 0) / deliveredOrders.length / 60000 // Convert to minutes
        : 0;

      // Top 10 best-selling products
      const productSales = {};
      allOrders.forEach(order => {
        order.items?.forEach(item => {
          if (!productSales[item.product_id]) {
            productSales[item.product_id] = {
              id: item.product_id,
              name: item.product_name,
              quantity: 0,
              revenue: 0
            };
          }
          productSales[item.product_id].quantity += item.quantity;
          productSales[item.product_id].revenue += item.price * item.quantity;
        });
      });

      const topProducts = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      const lowProducts = Object.values(productSales)
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 10);

      // Orders pending assignment for more than 10 minutes
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const unassignedOrders = allOrders.filter(order => 
        order.status === 'confirmed' &&
        !order.delivery_person_id &&
        new Date(order.created_at) < tenMinutesAgo
      );

      setStats({
        todayOrders: todayOrders.length,
        totalOrders: allOrders.length,
        todayRevenue,
        totalRevenue,
        estimatedProfit,
        totalDeliveryCost,
        activePartners,
        totalPartners: allDeliveryPersons.length,
        avgDeliveryTime: Math.round(avgDeliveryTime),
        scheduledOrdersCount: scheduledOrders.length,
        pendingWithdrawals: withdrawalRequests.length,
        topProducts,
        lowProducts,
        unassignedOrders: unassignedOrders.length,
        totalProducts: allProducts.length,
        outOfStockProducts: allProducts.filter(p => p.stock_quantity === 0).length
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error loading analytics:", error);
    }
    setIsLoading(false);
  };

  if (isLoading && !stats) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-sm text-gray-600">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <Button
          onClick={loadAnalytics}
          variant="outline"
          size="sm"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Alert for unassigned orders */}
      {stats?.unassignedOrders > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <p className="font-semibold text-red-900">
                {stats.unassignedOrders} order(s) unassigned for more than 10 minutes!
              </p>
              <p className="text-sm text-red-700">
                Please assign delivery partners immediately.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Orders */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Orders</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.todayOrders || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Total: {stats?.totalOrders || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Revenue */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Revenue</p>
                <p className="text-3xl font-bold text-emerald-600">
                  ₹{stats?.todayRevenue?.toFixed(0) || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Total: ₹{stats?.totalRevenue?.toFixed(0) || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estimated Profit */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Estimated Profit</p>
                <p className="text-3xl font-bold text-purple-600">
                  ₹{stats?.estimatedProfit?.toFixed(0) || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Delivery Cost: ₹{stats?.totalDeliveryCost || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Partners */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Partners</p>
                <p className="text-3xl font-bold text-orange-600">
                  {stats?.activePartners || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Total: {stats?.totalPartners || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Truck className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Avg Delivery Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.avgDeliveryTime || 0} min
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Scheduled Orders</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.scheduledOrdersCount || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">Pending Withdrawals</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.pendingWithdrawals || 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 10 Best-Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.topProducts?.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-600">
                        {product.quantity} sold • ₹{product.revenue.toFixed(0)} revenue
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {(!stats?.topProducts || stats.topProducts.length === 0) && (
                <p className="text-center text-gray-500 py-8">No sales data yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bottom 10 Low-Performing Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.lowProducts?.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-600">
                        {product.quantity} sold • ₹{product.revenue.toFixed(0)} revenue
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {(!stats?.lowProducts || stats.lowProducts.length === 0) && (
                <p className="text-center text-gray-500 py-8">No sales data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Product Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">{stats?.totalProducts || 0}</p>
              <p className="text-sm text-gray-600 mt-1">Total Products</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-3xl font-bold text-red-600">{stats?.outOfStockProducts || 0}</p>
              <p className="text-sm text-gray-600 mt-1">Out of Stock</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">
                {((stats?.totalProducts - stats?.outOfStockProducts) / stats?.totalProducts * 100 || 0).toFixed(0)}%
              </p>
              <p className="text-sm text-gray-600 mt-1">In Stock</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-3xl font-bold text-purple-600">
                {stats?.topProducts?.length || 0}
              </p>
              <p className="text-sm text-gray-600 mt-1">Active Products</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
