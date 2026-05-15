import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  TrendingUp, 
  Save,
  AlertCircle,
  CheckCircle,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { useCheckoutCharges, useUpdateCheckoutSettings } from '@/hooks/useCheckoutCharges';
import { supabase } from '@/lib/supabase';

export default function CheckoutChargesManagement() {
  const { settings, loading: loadingSettings } = useCheckoutCharges();
  const { updateSettings, updating } = useUpdateCheckoutSettings();
  
  // Form state
  const [formData, setFormData] = useState({
    small_cart_enabled: true,
    small_cart_threshold: 40,
    small_cart_fee: 10,
    handling_fee_enabled: true,
    handling_fee: 10,
    free_delivery_handling_enabled: true,
    free_delivery_handling_fee: 20
  });

  // Preview state
  const [previewSubtotal, setPreviewSubtotal] = useState(30);

  // Analytics state
  const [analytics, setAnalytics] = useState({
    totalSmallCartRevenue: 0,
    totalHandlingRevenue: 0,
    ordersWithSmallCartFee: 0,
    avgCartValue: 0
  });

  // Load settings into form
  useEffect(() => {
    if (settings) {
      setFormData({
        small_cart_enabled: settings.small_cart_enabled,
        small_cart_threshold: settings.small_cart_threshold,
        small_cart_fee: settings.small_cart_fee,
        handling_fee_enabled: settings.handling_fee_enabled,
        handling_fee: settings.handling_fee,
        free_delivery_handling_enabled: settings.free_delivery_handling_enabled ?? true,
        free_delivery_handling_fee: settings.free_delivery_handling_fee ?? 20
      });
    }
  }, [settings]);

  // Load analytics
  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('small_cart_fee, handling_fee, subtotal_before_fees')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const totalSmallCartRevenue = data.reduce((sum, order) => sum + (order.small_cart_fee || 0), 0);
      const totalHandlingRevenue = data.reduce((sum, order) => sum + (order.handling_fee || 0), 0);
      const ordersWithSmallCartFee = data.filter(order => order.small_cart_fee > 0).length;
      const avgCartValue = data.length > 0 
        ? data.reduce((sum, order) => sum + (order.subtotal_before_fees || 0), 0) / data.length 
        : 0;

      setAnalytics({
        totalSmallCartRevenue,
        totalHandlingRevenue,
        ordersWithSmallCartFee,
        avgCartValue
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const handleSave = async () => {
    try {
      const result = await updateSettings(formData);
      
      if (result.success) {
        toast.success('Checkout charges updated successfully!');
        loadAnalytics(); // Reload analytics
      } else {
        toast.error('Failed to update settings: ' + result.error);
      }
    } catch (error) {
      toast.error('Error saving settings');
      console.error(error);
    }
  };

  const calculatePreview = () => {
    const shouldApplySmallCartFee = 
      formData.small_cart_enabled && 
      previewSubtotal < formData.small_cart_threshold;

    const smallCartFee = shouldApplySmallCartFee ? formData.small_cart_fee : 0;
    const handlingFee = formData.handling_fee_enabled ? formData.handling_fee : 0;
    const total = previewSubtotal + smallCartFee + handlingFee;

    return { smallCartFee, handlingFee, total };
  };

  const preview = calculatePreview();

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Checkout Charges & Fees</h2>
        <p className="text-sm text-gray-600 mt-1">
          Configure small cart charges and handling fees for all orders
        </p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm">Small Cart Revenue</p>
                <p className="text-3xl font-bold mt-1">
                  ₹{analytics.totalSmallCartRevenue.toFixed(2)}
                </p>
                <p className="text-xs text-emerald-100 mt-1">Last 30 days</p>
              </div>
              <ShoppingCart className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Handling Revenue</p>
                <p className="text-3xl font-bold mt-1">
                  ₹{analytics.totalHandlingRevenue.toFixed(2)}
                </p>
                <p className="text-xs text-blue-100 mt-1">Last 30 days</p>
              </div>
              <Package className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Orders with Fee</p>
                <p className="text-3xl font-bold mt-1">
                  {analytics.ordersWithSmallCartFee}
                </p>
                <p className="text-xs text-purple-100 mt-1">Small cart orders</p>
              </div>
              <TrendingUp className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Avg Cart Value</p>
                <p className="text-3xl font-bold mt-1">
                  ₹{analytics.avgCartValue.toFixed(2)}
                </p>
                <p className="text-xs text-amber-100 mt-1">Before fees</p>
              </div>
              <DollarSign className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Small Cart Charge Settings */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-emerald-600" />
              Small Cart Charge
            </CardTitle>
            <CardDescription>
              Apply a fee when cart value is below threshold
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="small-cart-enabled" className="flex-1">
                Enable Small Cart Fee
              </Label>
              <Switch
                id="small-cart-enabled"
                checked={formData.small_cart_enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, small_cart_enabled: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="small-cart-threshold">
                Minimum Cart Threshold (₹)
              </Label>
              <Input
                id="small-cart-threshold"
                type="number"
                min="0"
                step="1"
                value={formData.small_cart_threshold}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    small_cart_threshold: parseFloat(e.target.value) || 0
                  })
                }
                disabled={!formData.small_cart_enabled}
              />
              <p className="text-xs text-gray-500">
                Fee applies if cart is below this amount
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="small-cart-fee">Small Cart Fee (₹)</Label>
              <Input
                id="small-cart-fee"
                type="number"
                min="0"
                step="1"
                value={formData.small_cart_fee}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    small_cart_fee: parseFloat(e.target.value) || 0
                  })
                }
                disabled={!formData.small_cart_enabled}
              />
              <p className="text-xs text-gray-500">
                Fee charged for small carts
              </p>
            </div>

            {formData.small_cart_enabled && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-emerald-700">
                    <p className="font-medium mb-1">Active Rule:</p>
                    <p>
                      If cart &lt; Rs.{formData.small_cart_threshold}, add Rs.
                      {formData.small_cart_fee} fee
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Handling Charge Settings */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Handling Charges
            </CardTitle>
            <CardDescription>
              Configure handling fees for orders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Regular Handling Fee */}
            <div className="space-y-3 pb-3 border-b">
              <div className="flex items-center justify-between">
                <Label htmlFor="handling-enabled" className="flex-1">
                  Enable Handling Fee
                </Label>
                <Switch
                  id="handling-enabled"
                  checked={formData.handling_fee_enabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, handling_fee_enabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="handling-fee">Handling Fee (Rs.)</Label>
                <Input
                  id="handling-fee"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.handling_fee}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      handling_fee: parseFloat(e.target.value) || 0
                    })
                  }
                  disabled={!formData.handling_fee_enabled}
                />
                <p className="text-xs text-gray-500">
                  Fee applied to every order
                </p>
              </div>
            </div>

            {/* Free Delivery Handling Fee */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="free-delivery-handling-enabled" className="flex-1 text-sm">
                  Free Delivery Handling Fee
                </Label>
                <Switch
                  id="free-delivery-handling-enabled"
                  checked={formData.free_delivery_handling_enabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, free_delivery_handling_enabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="free-delivery-handling-fee">
                  Fee Amount (Rs.)
                </Label>
                <Input
                  id="free-delivery-handling-fee"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.free_delivery_handling_fee}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      free_delivery_handling_fee: parseFloat(e.target.value) || 0
                    })
                  }
                  disabled={!formData.free_delivery_handling_enabled}
                />
                <p className="text-xs text-gray-500">
                  Extra fee when delivery is free
                </p>
              </div>

              {formData.free_delivery_handling_enabled && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <p className="text-xs text-amber-700">
                    This fee applies when order is above free delivery threshold
                  </p>
                </div>
              )}
            </div>

            {(formData.handling_fee_enabled || formData.free_delivery_handling_enabled) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-700">
                    <p className="font-medium mb-1">Active Rules:</p>
                    {formData.handling_fee_enabled && (
                      <p>Rs.{formData.handling_fee} on all orders</p>
                    )}
                    {formData.free_delivery_handling_enabled && (
                      <p>Rs.{formData.free_delivery_handling_fee} when delivery is free</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Preview */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-600" />
              Live Preview
            </CardTitle>
            <CardDescription>
              See how charges apply in real-time
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preview-subtotal">Test Subtotal (Rs.)</Label>
              <Input
                id="preview-subtotal"
                type="number"
                min="0"
                step="10"
                value={previewSubtotal}
                onChange={(e) =>
                  setPreviewSubtotal(parseFloat(e.target.value) || 0)
                }
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">₹{previewSubtotal.toFixed(2)}</span>
              </div>

              {preview.smallCartFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Small Cart Fee:</span>
                  <span className="font-medium text-emerald-600">
                    +₹{preview.smallCartFee.toFixed(2)}
                  </span>
                </div>
              )}

              {preview.handlingFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Handling Fee:</span>
                  <span className="font-medium text-blue-600">
                    +₹{preview.handlingFee.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold">Total:</span>
                <span className="font-bold text-lg">
                  ₹{preview.total.toFixed(2)}
                </span>
              </div>
            </div>

            {preview.smallCartFee > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">
                  Add Rs.{(formData.small_cart_threshold - previewSubtotal).toFixed(2)} more to avoid small cart fee
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updating}
          className="bg-emerald-600 hover:bg-emerald-700"
          size="lg"
        >
          {updating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
