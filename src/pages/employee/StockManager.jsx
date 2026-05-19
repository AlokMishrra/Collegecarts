import React, { useState, useEffect } from 'react';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Plus, Search, TrendingDown, AlertTriangle, FileText, Download, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import ManageStockModal from '@/components/employee/ManageStockModal';

export default function StockManager() {
  const { employee, isSuperAdmin, hasPermission } = useEmployeeAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [stockOrders, setStockOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('inventory');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showManageStockModal, setShowManageStockModal] = useState(false);

  const canSeePrices = isSuperAdmin() || hasPermission('manage_finance') || hasPermission('view_prices');
  const canManageStock = isSuperAdmin() || hasPermission('manage_inventory');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Load stock orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('employee_stock_orders')
        .select(`
          *,
          employee:employee_accounts(full_name, employee_code),
          department:employee_departments(department_name)
        `)
        .order('requested_date', { ascending: false })
        .limit(50);

      if (ordersError) throw ordersError;
      setStockOrders(ordersData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load stock data');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockProducts = products.filter(p => p.stock_quantity < 10);
  const outOfStockProducts = products.filter(p => p.stock_quantity === 0);

  const handleCreateStockOrder = () => {
    navigate(`/employee/${employee.slug}/stock-orders/create`);
  };

  const handleViewOrder = (orderId) => {
    navigate(`/employee/${employee.slug}/stock/orders/${orderId}`);
  };

  const handleManageStock = (product) => {
    setSelectedProduct(product);
    setShowManageStockModal(true);
  };

  const handleStockUpdated = () => {
    loadData(); // Reload products to show updated stock
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'Pending', className: 'bg-yellow-600' },
      approved: { label: 'Approved', className: 'bg-blue-600' },
      fulfilled: { label: 'Fulfilled', className: 'bg-green-600' },
      rejected: { label: 'Rejected', className: 'bg-red-600' },
      cancelled: { label: 'Cancelled', className: 'bg-gray-600' }
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-600' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock Manager</h1>
          <p className="text-gray-500">Manage inventory and stock orders</p>
        </div>
        <Button onClick={handleCreateStockOrder}>
          <Plus className="h-4 w-4 mr-2" />
          Create Stock Order
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Products</p>
                <p className="text-3xl font-bold mt-1">{products.length}</p>
              </div>
              <Package className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm">Low Stock</p>
                <p className="text-3xl font-bold mt-1">{lowStockProducts.length}</p>
              </div>
              <TrendingDown className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm">Out of Stock</p>
                <p className="text-3xl font-bold mt-1">{outOfStockProducts.length}</p>
              </div>
              <AlertTriangle className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Stock Orders</p>
                <p className="text-3xl font-bold mt-1">{stockOrders.length}</p>
              </div>
              <FileText className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="orders">Stock Orders</TabsTrigger>
          <TabsTrigger value="low-stock">Low Stock Alerts</TabsTrigger>
        </TabsList>

        {/* Inventory Tab */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Product Inventory</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading inventory...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No products found</div>
              ) : (
                <div className="space-y-3">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <img
                          src={product.image_url || '/placeholder.png'}
                          alt={product.name}
                          className="h-16 w-16 rounded object-cover"
                        />
                        <div>
                          <h3 className="font-semibold">{product.name}</h3>
                          <p className="text-sm text-gray-500">{product.category}</p>
                          {canSeePrices && (
                            <p className="text-sm font-medium text-green-600">₹{product.price}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Stock</p>
                          <p className={`text-lg font-bold ${
                            product.stock_quantity === 0 ? 'text-red-600' :
                            product.stock_quantity < 10 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {product.stock_quantity}
                          </p>
                        </div>
                        <Badge variant={product.is_available ? 'default' : 'secondary'}>
                          {product.is_available ? 'Available' : 'Unavailable'}
                        </Badge>
                        {canManageStock && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleManageStock(product)}
                            className="flex items-center gap-2"
                          >
                            <Settings className="h-4 w-4" />
                            Manage Stock
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Recent Stock Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading orders...</div>
              ) : stockOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No stock orders found</div>
              ) : (
                <div className="space-y-3">
                  {stockOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div>
                        <h3 className="font-semibold">{order.order_number}</h3>
                        <p className="text-sm text-gray-500">
                          {order.employee?.full_name} • {order.department?.department_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(order.requested_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Items: {order.total_items}</p>
                          <p className="text-sm text-gray-600">Qty: {order.total_quantity}</p>
                          {canSeePrices && (
                            <p className="text-sm font-medium text-green-600">₹{order.total_value}</p>
                          )}
                        </div>
                        {getStatusBadge(order.status)}
                        <Button variant="ghost" size="sm" onClick={() => handleViewOrder(order.id)}>
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Low Stock Tab */}
        <TabsContent value="low-stock">
          <Card>
            <CardHeader>
              <CardTitle>Low Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No low stock items</div>
              ) : (
                <div className="space-y-3">
                  {lowStockProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <AlertTriangle className="h-8 w-8 text-yellow-600" />
                        <div>
                          <h3 className="font-semibold">{product.name}</h3>
                          <p className="text-sm text-gray-500">{product.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Stock</p>
                          <p className="text-lg font-bold text-yellow-600">{product.stock_quantity}</p>
                        </div>
                        <Button size="sm" onClick={handleCreateStockOrder}>
                          Order Now
                        </Button>
                        {canManageStock && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleManageStock(product)}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Manage
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manage Stock Modal */}
      <ManageStockModal
        open={showManageStockModal}
        onClose={() => setShowManageStockModal(false)}
        product={selectedProduct}
        onSuccess={handleStockUpdated}
      />
    </div>
  );
}
