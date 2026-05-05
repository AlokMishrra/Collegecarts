import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Package, User, MapPin, Phone } from "lucide-react";
import { OrderListSkeleton } from "@/components/ui/loading-skeleton";

export default function ScheduledOrdersManager() {
  const [scheduledOrders, setScheduledOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadScheduledOrders();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadScheduledOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadScheduledOrders = async () => {
    try {
      // Get all orders and filter in JavaScript (Supabase doesn't support $or in filter)
      const allOrders = await base44.entities.Order.list();
      
      // Filter to only show orders that are scheduled
      const scheduledOnly = allOrders.filter(o => 
        (o.status === 'scheduled' || o.is_scheduled === true) && o.scheduled_time
      );
      
      // Sort by scheduled_time
      scheduledOnly.sort((a, b) => 
        new Date(a.scheduled_time) - new Date(b.scheduled_time)
      );
      
      setScheduledOrders(scheduledOnly);
    } catch (error) {
      console.error("Error loading scheduled orders:", error);
      setScheduledOrders([]);
    }
    setIsLoading(false);
  };

  const releaseOrderNow = async (orderId) => {
    try {
      await base44.entities.Order.update(orderId, {
        status: 'confirmed',
        is_scheduled: false
      });
      
      await base44.entities.Notification.create({
        user_id: 'admin',
        title: "Scheduled Order Released",
        message: `Order has been released for delivery assignment`,
        type: "info"
      });
      
      loadScheduledOrders();
    } catch (error) {
      console.error("Error releasing order:", error);
    }
  };

  const cancelScheduledOrder = async (orderId, userId) => {
    try {
      await base44.entities.Order.update(orderId, {
        status: 'cancelled'
      });
      
      await base44.entities.Notification.create({
        user_id: userId,
        title: "Scheduled Order Cancelled",
        message: "Your scheduled order has been cancelled by admin",
        type: "warning"
      });
      
      loadScheduledOrders();
    } catch (error) {
      console.error("Error cancelling order:", error);
    }
  };

  const getTimeUntilScheduled = (scheduledTime) => {
    const now = new Date();
    const scheduled = new Date(scheduledTime);
    const diff = scheduled - now;
    
    if (diff < 0) return { label: "Releasing now...", color: "#16A34A", urgent: true };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const totalMinutes = Math.floor(diff / 60000);
    
    let label;
    if (hours > 0) {
      label = `${hours}h ${minutes}m`;
    } else {
      label = `${minutes}m`;
    }
    
    return {
      label,
      color: totalMinutes < 2 ? '#EA580C' : '#2563EB',
      urgent: totalMinutes < 2
    };
  };

  if (isLoading) {
    return <OrderListSkeleton count={3} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Scheduled Orders</h2>
          <p className="text-gray-600">
            {scheduledOrders.length} order(s) scheduled for later delivery
          </p>
        </div>
      </div>

      {scheduledOrders.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">No Scheduled Orders</h3>
            <p className="text-gray-600">
              Orders scheduled by customers will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {scheduledOrders.map((order) => (
            <Card key={order.id} className="border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Order Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Package className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-semibold text-lg">
                            Order #{order.order_number}
                          </p>
                          <p className="text-sm text-gray-600">
                            {order.customer_name}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">
                        Scheduled
                      </Badge>
                    </div>

                    {/* Scheduled Time */}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">
                          {new Date(order.scheduled_time).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">
                          {new Date(order.scheduled_time).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-semibold px-2 py-1 rounded"
                          style={{
                            background: getTimeUntilScheduled(order.scheduled_time).urgent ? '#FFF7ED' : '#EFF6FF',
                            color: getTimeUntilScheduled(order.scheduled_time).color
                          }}
                        >
                          {getTimeUntilScheduled(order.scheduled_time).urgent ? '🟠 ' : '🕐 '}
                          Releases in: {getTimeUntilScheduled(order.scheduled_time).label}
                        </span>
                      </div>
                    </div>

                    {/* Order Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">{order.delivery_address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">{order.phone_number}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">
                          {order.items?.length || 0} item(s)
                        </span>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Order Items:</p>
                      <div className="space-y-1">
                        {order.items?.map((item, index) => (
                          <p key={index} className="text-sm text-gray-700">
                            {item.quantity}x {item.product_name} - ₹{(item.price * item.quantity).toFixed(0)}
                          </p>
                        ))}
                      </div>
                      <p className="text-sm font-bold text-emerald-600 mt-2">
                        Total: ₹{order.total_amount.toFixed(0)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex md:flex-col gap-2">
                    <Button
                      onClick={() => releaseOrderNow(order.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 flex-1 md:flex-none"
                      size="sm"
                    >
                      Release Now
                    </Button>
                    <Button
                      onClick={() => cancelScheduledOrder(order.id, order.user_id)}
                      variant="outline"
                      className="text-red-600 hover:text-red-700 flex-1 md:flex-none"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
