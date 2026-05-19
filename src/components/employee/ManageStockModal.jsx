import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { 
  Package, 
  Plus, 
  Minus, 
  TrendingUp, 
  TrendingDown, 
  History,
  AlertCircle,
  CheckCircle,
  Save
} from 'lucide-react';

export default function ManageStockModal({ open, onClose, product, onSuccess }) {
  const { employee } = useEmployeeAuth();
  const [loading, setLoading] = useState(false);
  const [stockHistory, setStockHistory] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [hostelStocks, setHostelStocks] = useState([]);
  const [currentProduct, setCurrentProduct] = useState(product);
  const [formData, setFormData] = useState({
    action: 'add', // 'add' or 'remove'
    quantity: '',
    reason: '',
    notes: '',
    hostel_id: employee?.hostel_id || '' // Default to employee's hostel
  });

  useEffect(() => {
    if (open && product) {
      setCurrentProduct(product);
      loadHostels();
      loadHostelStocks();
      loadStockHistory();
      loadProductData();
      resetForm();
    }
  }, [open, product]);

  const resetForm = () => {
    setFormData({
      action: 'add',
      quantity: '',
      reason: '',
      notes: '',
      hostel_id: employee?.hostel_id || ''
    });
  };

  const loadProductData = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', product.id)
        .single();

      if (error) throw error;
      if (data) {
        setCurrentProduct(data);
      }
    } catch (error) {
      console.error('Error loading product data:', error);
    }
  };

  const loadHostels = async () => {
    try {
      const { data, error } = await supabase
        .from('hostels')
        .select('*')
        .order('name');

      if (error) {
        console.error('Hostels query error:', error);
        throw error;
      }
      
      console.log('Loaded hostels:', data);
      setHostels(data || []);
      
      if (!data || data.length === 0) {
        toast.error('No hostels found in database');
      } else {
        console.log(`Successfully loaded ${data.length} hostels`);
      }
    } catch (error) {
      console.error('Error loading hostels:', error);
      toast.error('Failed to load hostels: ' + error.message);
    }
  };

  const loadHostelStocks = async () => {
    if (!product) return;
    
    try {
      const { data, error } = await supabase
        .from('hostel_stock')
        .select(`
          *,
          hostel:hostels(name)
        `)
        .eq('product_id', product.id);

      if (error) throw error;
      setHostelStocks(data || []);
    } catch (error) {
      console.error('Error loading hostel stocks:', error);
    }
  };

  const loadStockHistory = async () => {
    if (!product) return;
    
    try {
      const { data, error } = await supabase
        .from('employee_inventory_logs')
        .select(`
          *,
          employee:employee_accounts(full_name, employee_code),
          hostel:hostels(name)
        `)
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setStockHistory(data || []);
    } catch (error) {
      console.error('Error loading stock history:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.quantity || parseInt(formData.quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (!formData.reason) {
      toast.error('Please provide a reason for stock change');
      return;
    }

    if (!formData.hostel_id) {
      toast.error('Please select a hostel');
      return;
    }

    try {
      setLoading(true);

      const quantity = parseInt(formData.quantity);
      const quantityChange = formData.action === 'add' ? quantity : -quantity;

      // Call the database function to adjust hostel stock
      const { data: result, error: adjustError } = await supabase
        .rpc('adjust_hostel_stock', {
          p_hostel_id: formData.hostel_id,
          p_product_id: currentProduct.id,
          p_quantity_change: quantityChange,
          p_employee_id: employee.id,
          p_reason: formData.reason,
          p_notes: formData.notes
        });

      if (adjustError) throw adjustError;

      toast.success(`Stock ${formData.action === 'add' ? 'added' : 'removed'} successfully!`);
      
      // Reload data
      await Promise.all([
        loadStockHistory(),
        loadHostelStocks(),
        loadProductData() // Reload product to get updated total stock
      ]);
      
      // Reset form
      resetForm();
      
      // Notify parent to refresh its product list
      if (onSuccess) onSuccess();
      
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Failed to update stock');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdjust = async (amount) => {
    if (!currentProduct || !formData.hostel_id) {
      toast.error('Please select a hostel first');
      return;
    }

    try {
      setLoading(true);

      // Call the database function to adjust hostel stock
      const { data: result, error: adjustError } = await supabase
        .rpc('adjust_hostel_stock', {
          p_hostel_id: formData.hostel_id,
          p_product_id: currentProduct.id,
          p_quantity_change: amount,
          p_employee_id: employee.id,
          p_reason: 'Quick adjustment',
          p_notes: `Quick ${amount > 0 ? 'add' : 'remove'} ${Math.abs(amount)} units`
        });

      if (adjustError) throw adjustError;

      toast.success(`Stock adjusted by ${amount > 0 ? '+' : ''}${amount}`);
      
      // Reload data
      await Promise.all([
        loadStockHistory(),
        loadHostelStocks(),
        loadProductData() // Reload product to get updated total stock
      ]);
      
      // Notify parent to refresh its product list
      if (onSuccess) onSuccess();
      
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast.error('Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  };

  if (!currentProduct) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-600" />
            Manage Stock - {currentProduct.name}
          </DialogTitle>
        </DialogHeader>

        {/* Current Stock Info */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-600">Total Stock (All Hostels)</p>
              <p className={`text-4xl font-bold ${
                currentProduct.stock_quantity === 0 ? 'text-red-600' :
                currentProduct.stock_quantity < 10 ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {currentProduct.stock_quantity}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {currentProduct.category} • SKU: {currentProduct.id}
              </p>
            </div>
            <div className="text-right">
              <Badge variant={currentProduct.is_available ? 'default' : 'secondary'} className="mb-2">
                {currentProduct.is_available ? 'Available' : 'Unavailable'}
              </Badge>
              <p className="text-sm text-gray-600">₹{currentProduct.price}</p>
            </div>
          </div>

          {/* Hostel-wise Stock Breakdown */}
          {hostelStocks.length > 0 && (
            <div className="border-t border-blue-200 pt-3 mt-3">
              <p className="text-xs font-semibold text-blue-900 mb-2">Stock by Hostel:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {hostelStocks.map((hs) => (
                  <div key={hs.id} className="bg-white rounded px-2 py-1 text-xs">
                    <span className="text-gray-600">{hs.hostel?.name}:</span>
                    <span className="font-bold ml-1">{hs.stock_quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Tabs defaultValue="adjust" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="adjust">Adjust Stock</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Adjust Stock Tab */}
          <TabsContent value="adjust" className="space-y-4">
            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-2">
              <Button
                variant="outline"
                onClick={() => handleQuickAdjust(1)}
                disabled={loading}
                className="flex flex-col h-auto py-3"
              >
                <Plus className="h-5 w-5 text-green-600 mb-1" />
                <span className="text-xs">+1</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleQuickAdjust(10)}
                disabled={loading}
                className="flex flex-col h-auto py-3"
              >
                <TrendingUp className="h-5 w-5 text-green-600 mb-1" />
                <span className="text-xs">+10</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleQuickAdjust(-1)}
                disabled={loading || currentProduct.stock_quantity === 0}
                className="flex flex-col h-auto py-3"
              >
                <Minus className="h-5 w-5 text-red-600 mb-1" />
                <span className="text-xs">-1</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleQuickAdjust(-10)}
                disabled={loading || currentProduct.stock_quantity < 10}
                className="flex flex-col h-auto py-3"
              >
                <TrendingDown className="h-5 w-5 text-red-600 mb-1" />
                <span className="text-xs">-10</span>
              </Button>
            </div>

            {/* Manual Adjustment Form */}
            <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4">
              {/* Hostel Selection */}
              <div>
                <Label htmlFor="hostel_id">Hostel *</Label>
                <select
                  id="hostel_id"
                  value={formData.hostel_id}
                  onChange={(e) => setFormData({ ...formData, hostel_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select hostel</option>
                  {hostels.map(hostel => (
                    <option key={hostel.id} value={hostel.id}>
                      {hostel.name}
                      {hostelStocks.find(hs => hs.hostel_id === hostel.id) && 
                        ` (Current: ${hostelStocks.find(hs => hs.hostel_id === hostel.id).stock_quantity})`
                      }
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="action">Action</Label>
                  <select
                    id="action"
                    value={formData.action}
                    onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="add">Add Stock</option>
                    <option value="remove">Remove Stock</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="Enter quantity"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="reason">Reason *</Label>
                <select
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select reason</option>
                  <option value="New stock received">New stock received</option>
                  <option value="Stock return">Stock return</option>
                  <option value="Damaged goods">Damaged goods</option>
                  <option value="Expired items">Expired items</option>
                  <option value="Theft/Loss">Theft/Loss</option>
                  <option value="Inventory correction">Inventory correction</option>
                  <option value="Transfer to another location">Transfer to another location</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any additional details..."
                  rows={3}
                />
              </div>

              {/* Preview */}
              {formData.quantity && formData.hostel_id && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-blue-900">Preview</span>
                  </div>
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">
                      {hostels.find(h => h.id === formData.hostel_id)?.name}
                    </p>
                    <p>
                      Current Stock: <span className="font-bold">
                        {hostelStocks.find(hs => hs.hostel_id === formData.hostel_id)?.stock_quantity || 0}
                      </span>
                    </p>
                    <p>
                      {formData.action === 'add' ? 'Adding' : 'Removing'}: <span className="font-bold">{formData.quantity}</span>
                    </p>
                    <p className="mt-2 text-lg">
                      New Stock: <span className="font-bold text-blue-600">
                        {formData.action === 'add' 
                          ? (hostelStocks.find(hs => hs.hostel_id === formData.hostel_id)?.stock_quantity || 0) + parseInt(formData.quantity || 0)
                          : Math.max(0, (hostelStocks.find(hs => hs.hostel_id === formData.hostel_id)?.stock_quantity || 0) - parseInt(formData.quantity || 0))
                        }
                      </span>
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Updating...' : 'Update Stock'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-3">
            {stockHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <History className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No stock history available</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {stockHistory.map((log) => (
                  <div key={log.id} className="border rounded-lg p-3 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${
                          log.action_type === 'stock_in' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {log.action_type === 'stock_in' ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${
                              log.quantity_change > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
                            </span>
                            <span className="text-sm text-gray-600">units</span>
                            {log.hostel && (
                              <Badge variant="outline" className="text-xs">
                                {log.hostel.name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-1">{log.reason}</p>
                          {log.notes && (
                            <p className="text-xs text-gray-500 mt-1">{log.notes}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span>{log.employee?.full_name}</span>
                            <span>•</span>
                            <span>{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-gray-500">Stock</p>
                        <p className="font-semibold">{log.previous_quantity} → {log.new_quantity}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
