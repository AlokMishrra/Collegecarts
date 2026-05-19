import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { EmployeeStockOrder } from '@/entities/EmployeeStockOrder';
import { Package, Plus, Minus, Trash2, Search, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateStockOrder() {
  const navigate = useNavigate();
  const { employee } = useEmployeeAuth();
  const [products, setProducts] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [hostelFilter, setHostelFilter] = useState('all');
  const [categories, setCategories] = useState([]);
  const [orderDetails, setOrderDetails] = useState({
    order_type: 'internal',
    priority: 'normal',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_available', true)
        .order('name');

      if (error) throw error;
      
      // Debug: Log the first product to see ID format
      if (data && data.length > 0) {
        console.log('Sample product ID:', data[0].id, 'Type:', typeof data[0].id);
      }
      
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter;
    const matchesHostel = hostelFilter === 'all' || product.hostel_id === hostelFilter;
    return matchesSearch && matchesCategory && matchesHostel;
  });

  const addItem = (product) => {
    const existing = selectedItems.find(item => item.product_id === product.id);
    if (existing) {
      updateQuantity(product.id, existing.quantity + 1);
    } else {
      setSelectedItems([
        ...selectedItems,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: product.admin_price || 0
        }
      ]);
    }
    toast.success(`${product.name} added to order`);
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeItem(productId);
      return;
    }
    setSelectedItems(items =>
      items.map(item =>
        item.product_id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const removeItem = (productId) => {
    setSelectedItems(items => items.filter(item => item.product_id !== productId));
  };

  const calculateTotals = () => {
    const totalItems = selectedItems.length;
    const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = selectedItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
    return { totalItems, totalQuantity, totalValue };
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    try {
      setLoading(true);

      const { totalItems, totalQuantity, totalValue } = calculateTotals();
      const orderNumber = await EmployeeStockOrder.generateOrderNumber();

      // Create stock order
      const { data: order, error: orderError } = await supabase
        .from('employee_stock_orders')
        .insert({
          order_number: orderNumber,
          employee_id: employee.id,
          department_id: employee.department_id,
          hostel_id: employee.hostel_id,
          order_type: orderDetails.order_type,
          priority: orderDetails.priority,
          total_items: totalItems,
          total_quantity: totalQuantity,
          total_value: totalValue,
          notes: orderDetails.notes,
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const items = selectedItems.map(item => ({
        stock_order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price
      }));

      const { error: itemsError } = await supabase
        .from('employee_stock_order_items')
        .insert(items);

      if (itemsError) throw itemsError;

      // Log activity
      await supabase.from('employee_activity_logs').insert({
        employee_id: employee.id,
        activity_type: 'stock_order_created',
        activity_description: `Created stock order ${orderNumber}`,
        entity_type: 'employee_stock_orders',
        entity_id: order.id
      });

      toast.success('Stock order created successfully!');
      navigate(`/employee/${employee.slug}/stock-orders`);
    } catch (error) {
      console.error('Error creating stock order:', error);
      toast.error('Failed to create stock order');
    } finally {
      setLoading(false);
    }
  };

  const { totalItems, totalQuantity, totalValue } = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Create Stock Order</h1>
        <Button variant="outline" onClick={() => navigate(`/employee/${employee.slug}/stock-orders`)}>
          Cancel
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Select Products</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label>Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Hostel</Label>
                <Select value={hostelFilter} onValueChange={setHostelFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Hostels</SelectItem>
                    <SelectItem value="mithali">Mithali</SelectItem>
                    <SelectItem value="gavaskar">Gavaskar</SelectItem>
                    <SelectItem value="virat">Virat</SelectItem>
                    <SelectItem value="tendulkar">Tendulkar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredProducts.map(product => {
                const isAdded = selectedItems.some(item => item.product_id === product.id);
                const addedItem = selectedItems.find(item => item.product_id === product.id);
                
                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      {product.image_url && (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-gray-600">
                          Stock: {product.stock_quantity || 0}
                        </p>
                      </div>
                    </div>
                    {isAdded ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-600">
                          Added ({addedItem.quantity})
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addItem(product)}
                          className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => addItem(product)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Order Details */}
            <div className="space-y-3">
              <div>
                <Label>Order Type</Label>
                <Select
                  value={orderDetails.order_type}
                  onValueChange={(value) =>
                    setOrderDetails({ ...orderDetails, order_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="return">Return</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Priority</Label>
                <Select
                  value={orderDetails.priority}
                  onValueChange={(value) =>
                    setOrderDetails({ ...orderDetails, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={orderDetails.notes}
                  onChange={(e) =>
                    setOrderDetails({ ...orderDetails, notes: e.target.value })
                  }
                  placeholder="Add any notes..."
                  rows={3}
                />
              </div>
            </div>

            {/* Selected Items */}
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">Selected Items ({selectedItems.length})</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedItems.map(item => (
                  <div
                    key={item.product_id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.product_name}</p>
                      <p className="text-xs text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm w-8 text-center">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-red-600"
                        onClick={() => removeItem(item.product_id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Items:</span>
                <span className="font-medium">{totalItems}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Quantity:</span>
                <span className="font-medium">{totalQuantity}</span>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={loading || selectedItems.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? 'Creating Order...' : 'Create Stock Order'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
