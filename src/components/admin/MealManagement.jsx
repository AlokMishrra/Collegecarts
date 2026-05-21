import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { 
  UtensilsCrossed, Package, Users, TrendingUp, Plus, 
  Edit, Trash2, Search, RefreshCw, DollarSign, Clock,
  CheckCircle, XCircle, Loader2, Coffee, Sandwich, Pizza, Cookie, Star
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

export default function MealManagement() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ orders: 0, subscriptions: 0, revenue: 0, menuItems: 0 });
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [showAddKitchen, setShowAddKitchen] = useState(false);
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [filterMealType, setFilterMealType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [kitchens, setKitchens] = useState([]);
  const [deliverySlots, setDeliverySlots] = useState([]);
  const [hostelAssignments, setHostelAssignments] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [mealSettings, setMealSettings] = useState([]);
  const [showAddCoupon, setShowAddCoupon] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [deliveryPartners, setDeliveryPartners] = useState([]);
  const [dailyMenus, setDailyMenus] = useState({});
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 7 : new Date().getDay()); // 1=Monday, 7=Sunday
  const [savingMenu, setSavingMenu] = useState(false);
  const [menuForm, setMenuForm] = useState({ name: '', meal_type: 'breakfast', calories: 0, price: 0, image_url: '', is_available: true });
  const [planForm, setPlanForm] = useState({ name: '', description: '', price_per_day: 0, price_type: 'per_day', meals_per_day: 3, is_popular: false, is_active: true });

  useEffect(() => { 
    loadAll();
    loadWeeklyMenu(selectedDay);

    // Realtime subscription for meal orders
    const channel = supabase
      .channel('meal_orders_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_orders' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
        } else if (payload.eventType === 'INSERT') {
          setOrders(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ordersRes, menuRes, plansRes, subsRes, kitchensRes, slotsRes, hostelRes] = await Promise.all([
        supabase.from('meal_orders').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('meal_menu_items').select('*').order('meal_type'),
        supabase.from('meal_plans').select('*').order('price_per_day'),
        supabase.from('meal_subscriptions').select('*, plan:meal_plans(name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('meal_kitchens').select('*').order('name'),
        supabase.from('meal_delivery_slots').select('*').order('meal_type'),
        supabase.from('meal_hostel_assignments').select('*').order('delivery_priority'),
      ]);

      const { data: dpData } = await supabase.from('delivery_persons').select('*');
      setDeliveryPartners(dpData || []);

      const [couponsRes, reviewsRes, settingsRes] = await Promise.all([
        supabase.from('meal_coupons').select('*').order('created_at', { ascending: false }),
        supabase.from('meal_reviews').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('meal_settings').select('*').order('key'),
      ]);

      setOrders(ordersRes.data || []);
      setMenuItems(menuRes.data || []);
      setPlans(plansRes.data || []);
      setSubscriptions(subsRes.data || []);
      setKitchens(kitchensRes.data || []);
      setDeliverySlots(slotsRes.data || []);
      setHostelAssignments(hostelRes.data || []);
      setCoupons(couponsRes.data || []);
      setReviews(reviewsRes.data || []);
      setMealSettings(settingsRes.data || []);

      const totalRevenue = (ordersRes.data || []).reduce((s, order) => s + parseFloat(order.total_price || 0), 0)
        + (subsRes.data || []).filter(s => s.status === 'active').reduce((s, sub) => s + parseFloat(sub.total_amount || 0), 0);
      setStats({
        orders: (ordersRes.data || []).length,
        subscriptions: (subsRes.data || []).filter(s => s.status === 'active').length,
        revenue: totalRevenue,
        menuItems: (menuRes.data || []).length
      });
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Menu Item CRUD

  const saveMenuItem = async () => {
    try {
      if (editingItem) {
        await supabase.from('meal_menu_items').update(menuForm).eq('id', editingItem.id);
        toast.success('Menu item updated');
      } else {
        await supabase.from('meal_menu_items').insert(menuForm);
        toast.success('Menu item added');
      }
      setShowAddMenu(false);
      setEditingItem(null);
      setMenuForm({ name: '', meal_type: 'breakfast', calories: 0, price: 0, image_url: '', is_available: true });
      loadAll();
    } catch (err) {
      toast.error('Failed to save');
    }
  };

  const deleteMenuItem = async (id) => {
    toast('Delete this menu item?', {
      action: {
        label: 'Delete',
        onClick: async () => {
          await supabase.from('meal_menu_items').delete().eq('id', id);
          toast.success('Menu item deleted successfully');
          loadAll();
        }
      },
      cancel: { label: 'Cancel' },
    });
  };

  const editMenuItem = (item) => {
    setEditingItem(item);
    setMenuForm({ name: item.name, meal_type: item.meal_type, calories: item.calories, price: item.price, image_url: item.image_url || '', is_available: item.is_available });
    setShowAddMenu(true);
  };

  // Order Status Update
  const updateOrderStatus = async (orderId, status) => {
    await supabase.from('meal_orders').update({ status }).eq('id', orderId);
    toast.success(`Order marked as ${status}`);
    loadAll();
  };

  const loadWeeklyMenu = async (day) => {
    const { data } = await supabase
      .from('weekly_menu_schedule')
      .select('*')
      .eq('day_of_week', day)
      .eq('is_active', true);
    
    // Build map: { breakfast: [id1, id2], lunch: [...] }
    const map = {};
    (data || []).forEach(m => {
      if (!map[m.meal_type]) map[m.meal_type] = [];
      map[m.meal_type].push(m.meal_id);
    });
    setDailyMenus(map);
  };

  const saveMenuForDay = async (mealType, selectedIds) => {
    setSavingMenu(true);
    try {
      // Delete existing entries for this day + meal_type
      await supabase
        .from('weekly_menu_schedule')
        .delete()
        .eq('day_of_week', selectedDay)
        .eq('meal_type', mealType);
      
      // Insert new entries
      if (selectedIds.length > 0) {
        const rows = selectedIds.map((mealId, idx) => ({
          day_of_week: selectedDay,
          meal_type: mealType,
          meal_id: mealId,
          display_order: idx,
          is_active: true
        }));
        await supabase.from('weekly_menu_schedule').insert(rows);
      }
      
      const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      toast.success(`${mealType} menu saved for ${dayNames[selectedDay]}`);
      setDailyMenus(prev => ({ ...prev, [mealType]: selectedIds }));
    } catch (err) {
      toast.error('Failed to save menu');
    } finally {
      setSavingMenu(false);
    }
  };

  // Plan CRUD

  const savePlan = async () => {
    try {
      // If monthly pricing, convert to per-day
      const pricePerDay = planForm.price_type === 'monthly'
        ? Math.round((planForm.price_per_day / 30) * 100) / 100
        : planForm.price_per_day;
      
      await supabase.from('meal_plans').insert({
        name: planForm.name,
        description: planForm.description,
        price_per_day: pricePerDay,
        meals_per_day: planForm.meals_per_day,
        is_popular: planForm.is_popular,
        is_active: planForm.is_active
      });
      toast.success('Plan created');
      setShowAddPlan(false);
      setPlanForm({ name: '', description: '', price_per_day: 0, price_type: 'per_day', meals_per_day: 3, is_popular: false, is_active: true });
      loadAll();
    } catch (err) {
      toast.error('Failed to create plan');
    }
  };

  // Filtered menu items
  const filteredMenu = menuItems.filter(item => {
    if (filterMealType !== 'all' && item.meal_type !== filterMealType) return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const statusColor = (status) => {
    const map = { pending: 'bg-yellow-100 text-yellow-800', preparing: 'bg-blue-100 text-blue-800', ready: 'bg-purple-100 text-purple-800', delivered: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800' };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><UtensilsCrossed className="w-6 h-6 text-orange-500" /> Meal Management</h2>
          <p className="text-sm text-gray-500">Manage meals, subscriptions, orders & menu</p>
        </div>
        <Button onClick={loadAll} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Package className="w-8 h-8 text-blue-500" /><div><p className="text-2xl font-bold">{stats.orders}</p><p className="text-xs text-gray-500">Total Orders</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Users className="w-8 h-8 text-purple-500" /><div><p className="text-2xl font-bold">{stats.subscriptions}</p><p className="text-xs text-gray-500">Active Subs</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><DollarSign className="w-8 h-8 text-green-500" /><div><p className="text-2xl font-bold">₹{stats.revenue.toFixed(0)}</p><p className="text-xs text-gray-500">Revenue</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><UtensilsCrossed className="w-8 h-8 text-orange-500" /><div><p className="text-2xl font-bold">{stats.menuItems}</p><p className="text-xs text-gray-500">Menu Items</p></div></div></CardContent></Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 w-full max-w-4xl h-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="daily-menu">Weekly Menu</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="kitchens">Kitchens</TabsTrigger>
          <TabsTrigger value="slots">Slots</TabsTrigger>
          <TabsTrigger value="hostels">Hostels</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="subs">Subscriptions</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Recent Orders</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {orders.slice(0, 8).map(order => (
                  <div key={order.id} className="flex items-center justify-between text-sm border-b pb-2">
                    <div>
                      <p className="font-medium">{order.meal_type} - {order.items?.[0]?.name || 'Meal'}</p>
                      <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge className={statusColor(order.status)}>{order.status}</Badge>
                  </div>
                ))}
                {orders.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No orders yet</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Active Subscriptions</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {subscriptions.filter(s => s.status === 'active').slice(0, 8).map(sub => (
                  <div key={sub.id} className="flex items-center justify-between text-sm border-b pb-2">
                    <div>
                      <p className="font-medium">{sub.plan?.name || 'Plan'}</p>
                      <p className="text-xs text-gray-500">₹{sub.total_amount} • Ends {new Date(sub.end_date).toLocaleDateString()}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                ))}
                {subscriptions.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No subscriptions yet</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold">Meal Orders ({orders.length})</h3>
            <div className="flex gap-2">
              <Select value={filterMealType} onValueChange={setFilterMealType}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="snacks">Snacks</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Delivery Slot</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Hostel</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assign Delivery</TableHead>
                    <TableHead>Update Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders
                    .filter(o => filterMealType === 'all' || o.meal_type === filterMealType)
                    .map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(order.created_at).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {order.meal_type === 'breakfast' ? '☕' : order.meal_type === 'lunch' ? '🍛' : order.meal_type === 'snacks' ? '🍿' : '🌙'} {order.meal_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {order.delivery_time ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-medium border border-emerald-200">
                            🕐 {order.delivery_time}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-xs max-w-[160px] truncate">
                        {order.items?.map(i => i.name).join(', ') || '-'}
                      </TableCell>
                      <TableCell className="text-xs">{order.hostel || '-'}</TableCell>
                      <TableCell className="text-xs font-medium">
                        {order.total_price > 0 ? `₹${order.total_price}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColor(order.status)}>{order.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={order.delivery_partner_id || 'unassigned'}
                          onValueChange={async (dpId) => {
                            if (dpId === 'unassigned') {
                              await supabase.from('meal_orders').update({
                                delivery_partner_id: null,
                                delivery_partner_name: '',
                              }).eq('id', order.id);
                              toast.success('Delivery partner unassigned');
                              return;
                            }
                            const dp = deliveryPartners.find(d => d.id === dpId);
                            await supabase.from('meal_orders').update({
                              delivery_partner_id: dpId,
                              delivery_partner_name: dp?.name || '',
                              status: 'accepted',
                              assigned_at: new Date().toISOString()
                            }).eq('id', order.id);
                            toast.success(`Assigned to ${dp?.name}`);
                          }}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue placeholder={order.delivery_partner_name || 'Assign'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassign</SelectItem>
                            {deliveryPartners
                              .filter(dp => dp.is_available !== false && (!order.hostel || !dp.assigned_hostel || dp.assigned_hostel === 'All' || dp.assigned_hostel?.toLowerCase().includes(order.hostel?.toLowerCase())))
                              .map(dp => (
                              <SelectItem key={dp.id} value={dp.id}>{dp.name}{dp.assigned_hostel && dp.assigned_hostel !== 'All' ? ` (${dp.assigned_hostel})` : ''}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {order.delivery_partner_name && (
                          <p className="text-[9px] text-emerald-600 mt-0.5">{order.delivery_partner_name}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select onValueChange={async (v) => {
                          await supabase.from('meal_orders').update({ status: v, updated_at: new Date().toISOString() }).eq('id', order.id);
                          toast.success(`Marked as ${v}`);
                        }}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="Update" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="preparing">Preparing</SelectItem>
                            <SelectItem value="ready">Ready</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancel</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500"
                          title="Delete order"
                          onClick={() => {
                            toast('Delete this meal order?', {
                              action: {
                                label: 'Delete',
                                onClick: async () => {
                                  await supabase.from('meal_orders').delete().eq('id', order.id);
                                  toast.success('Order deleted successfully');
                                }
                              },
                              cancel: { label: 'Cancel' },
                            });
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {orders.length === 0 && <p className="text-center text-gray-400 py-8">No meal orders yet</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Menu Tab */}
        <TabsContent value="menu" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Input placeholder="Search menu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="max-w-xs" />
            <Select value={filterMealType} onValueChange={setFilterMealType}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="snacks">Snacks</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditingItem(null); setMenuForm({ name: '', meal_type: 'breakfast', calories: 0, price: 0, image_url: '', is_available: true }); setShowAddMenu(true); }} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>
          </div>

          <Card>
            <CardContent className="p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Calories</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMenu.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.image_url ? <img src={item.image_url} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 bg-gray-100 rounded-lg" />}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell><Badge variant="outline">{item.meal_type}</Badge></TableCell>
                      <TableCell>{item.calories} kcal</TableCell>
                      <TableCell>₹{item.price}</TableCell>
                      <TableCell>
                        <Badge className={item.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {item.is_available ? 'Available' : 'Unavailable'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => editMenuItem(item)}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="text-red-500" onClick={() => deleteMenuItem(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredMenu.length === 0 && <p className="text-center text-gray-400 py-8">No menu items found</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily Menu Tab */}
        <TabsContent value="daily-menu" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold">Weekly Menu Schedule</h3>
              <p className="text-xs text-gray-500">Select items for each meal slot. Menu repeats weekly - no daily updates needed!</p>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Day:</Label>
              <Select value={String(selectedDay)} onValueChange={v => { setSelectedDay(Number(v)); loadWeeklyMenu(Number(v)); }}>
                <SelectTrigger className="w-40 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                  <SelectItem value="7">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {['breakfast', 'lunch', 'snacks', 'dinner'].map(mealType => {
              const mealItems = menuItems.filter(m => m.meal_type === mealType);
              const selectedIds = dailyMenus[mealType] || [];
              const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
              
              return (
                <Card key={mealType}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm capitalize flex items-center gap-2">
                        {mealType === 'breakfast' ? '☕' : mealType === 'lunch' ? '🥗' : mealType === 'snacks' ? '🍿' : '🍛'} {mealType}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">{selectedIds.length} items</Badge>
                        <Button
                          size="sm"
                          className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700"
                          disabled={savingMenu}
                          onClick={() => saveMenuForDay(mealType, selectedIds)}
                        >
                          {savingMenu ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {mealItems.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No {mealType} items. Add them in the Menu tab first.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {mealItems.map(item => {
                          const isSelected = selectedIds.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              onClick={() => {
                                const newIds = isSelected
                                  ? selectedIds.filter(id => id !== item.id)
                                  : [...selectedIds, item.id];
                                setDailyMenus(prev => ({ ...prev, [mealType]: newIds }));
                              }}
                              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all ${
                                isSelected ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'
                              }`}>
                                {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                              </div>
                              {item.image_url && <img src={item.image_url} className="w-8 h-8 rounded-md object-cover" />}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{item.name}</p>
                                <p className="text-[10px] text-gray-500">{item.calories} kcal • ₹{item.price}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2 h-7 text-xs"
                      onClick={() => saveMenuForDay(mealType, selectedIds)}
                      disabled={savingMenu}
                    >
                      Save {mealType} menu for {dayNames[selectedDay]}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3 flex items-start gap-2">
              <Clock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                <strong>How it works:</strong> Set the menu for each day of the week (Monday-Sunday). Once saved, the menu automatically repeats every week. Customers will see the correct menu based on the current day. No need to update daily!
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Meal Plans</h3>
            <Button onClick={() => setShowAddPlan(true)} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-1" /> Add Plan</Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map(plan => (
              <Card key={plan.id} className={`relative ${plan.is_popular ? 'border-emerald-300' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-bold">{plan.name}</p>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                        setEditingPlan(plan);
                        setPlanForm({ name: plan.name, description: plan.description || '', price_per_day: plan.price_per_day, meals_per_day: plan.meals_per_day, is_popular: plan.is_popular, is_active: plan.is_active });
                        setShowEditPlan(true);
                      }}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => {
                        toast(`Delete "${plan.name}"? This will affect active subscribers.`, {
                          action: {
                            label: 'Delete',
                            onClick: async () => {
                              await supabase.from('meal_plans').delete().eq('id', plan.id);
                              toast.success('Plan deleted successfully');
                              loadAll();
                            }
                          },
                          cancel: { label: 'Cancel' },
                        });
                      }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">{plan.description}</p>
                  <p className="text-xl font-bold text-emerald-600 mt-2">₹{plan.price_per_day}/day</p>
                  <p className="text-xs text-gray-500">{plan.meals_per_day} meals/day</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Users className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-400">{plan.student_count || 0} students</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={plan.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={async () => {
                      await supabase.from('meal_plans').update({ is_active: !plan.is_active }).eq('id', plan.id);
                      loadAll();
                    }}>
                      {plan.is_active ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Kitchens Tab */}
        <TabsContent value="kitchens" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Kitchen Management</h3>
            <Button onClick={() => setShowAddKitchen(true)} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-1" /> Add Kitchen</Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {kitchens.map(kitchen => (
              <Card key={kitchen.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-lg">{kitchen.name}</h4>
                    <Badge className={kitchen.status === 'available' ? 'bg-green-100 text-green-800' : kitchen.status === 'busy' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                      {kitchen.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">{kitchen.location}</p>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                    <div><span className="text-gray-500">Capacity:</span> <span className="font-medium">{kitchen.capacity} orders/slot</span></div>
                    <div><span className="text-gray-500">Manager:</span> <span className="font-medium">{kitchen.manager_name || '-'}</span></div>
                  </div>
                  {kitchen.assigned_hostels && kitchen.assigned_hostels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {kitchen.assigned_hostels.map((h, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{h}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={async () => {
                      const newStatus = kitchen.status === 'available' ? 'busy' : 'available';
                      await supabase.from('meal_kitchens').update({ status: newStatus }).eq('id', kitchen.id);
                      toast.success(`Kitchen marked as ${newStatus}`);
                      loadAll();
                    }}>
                      Toggle Status
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-500" onClick={() => {
                      toast('Delete this kitchen?', {
                        action: {
                          label: 'Delete',
                          onClick: async () => {
                            await supabase.from('meal_kitchens').delete().eq('id', kitchen.id);
                            toast.success('Kitchen deleted successfully');
                            loadAll();
                          }
                        },
                        cancel: { label: 'Cancel' },
                      });
                    }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {kitchens.length === 0 && <p className="text-gray-400 text-center py-8 col-span-2">No kitchens configured. Add one to get started.</p>}
          </div>
        </TabsContent>

        {/* Delivery Slots Tab */}
        <TabsContent value="slots" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Delivery Slots</h3>
            <Button onClick={() => setShowAddSlot(true)} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-1" /> Add Slot</Button>
          </div>
          <Card>
            <CardContent className="p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meal Type</TableHead>
                    <TableHead>Time Window</TableHead>
                    <TableHead>Cutoff</TableHead>
                    <TableHead>Max Orders</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliverySlots.map(slot => {
                    // Convert 24h to 12h AM/PM
                    const to12h = (t) => {
                      if (!t) return '';
                      if (t.toLowerCase().includes('am') || t.toLowerCase().includes('pm')) return t;
                      const parts = t.replace('.', ':').split(':');
                      let h = parseInt(parts[0], 10);
                      const m = parts[1] ? parts[1].padStart(2, '0') : '00';
                      if (isNaN(h)) return t;
                      const period = h >= 12 ? 'PM' : 'AM';
                      if (h === 0) h = 12;
                      else if (h > 12) h -= 12;
                      return `${h}:${m} ${period}`;
                    };
                    return (
                    <TableRow key={slot.id}>
                      <TableCell><Badge variant="outline" className="capitalize">{slot.meal_type}</Badge></TableCell>
                      <TableCell className="font-medium">{to12h(slot.start_time)} - {to12h(slot.end_time)}</TableCell>
                      <TableCell className="text-orange-600 font-medium">{to12h(slot.cutoff_time)}</TableCell>
                      <TableCell>{slot.max_orders}</TableCell>
                      <TableCell>{slot.current_orders || 0}</TableCell>
                      <TableCell>{slot.delivery_fee > 0 ? `₹${slot.delivery_fee}` : 'Free'}</TableCell>
                      <TableCell>
                        <Badge className={slot.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {slot.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className={slot.is_active ? "text-red-500" : "text-emerald-600"} onClick={async () => {
                            await supabase.from('meal_delivery_slots').update({ is_active: !slot.is_active }).eq('id', slot.id);
                            loadAll();
                          }}>
                            {slot.is_active ? 'Disable' : 'Enable'}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => {
                            toast('Delete this delivery slot?', {
                              action: {
                                label: 'Delete',
                                onClick: async () => {
                                  await supabase.from('meal_delivery_slots').delete().eq('id', slot.id);
                                  toast.success('Slot deleted');
                                  loadAll();
                                }
                              },
                              cancel: { label: 'Cancel' },
                            });
                          }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {deliverySlots.length === 0 && <p className="text-center text-gray-400 py-8">No delivery slots configured</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hostel Assignment Tab */}
        <TabsContent value="hostels" className="space-y-4">
          <h3 className="font-semibold">Hostel Meal Assignments</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {hostelAssignments.map(assignment => {
              const assignedKitchen = kitchens.find(k => k.id === assignment.kitchen_id);
              return (
                <Card key={assignment.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold">{assignment.hostel_name}</h4>
                      <Badge className={assignment.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {assignment.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-gray-500">Kitchen:</span> <span className="font-medium">{assignedKitchen?.name || 'Not assigned'}</span></div>
                      <div><span className="text-gray-500">Priority:</span> <span className="font-medium">#{assignment.delivery_priority}</span></div>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-gray-500 text-xs">Meals:</span>
                        {(assignment.available_meal_types || []).map((type, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] capitalize">{type}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Select onValueChange={async (kitchenId) => {
                        await supabase.from('meal_hostel_assignments').update({ kitchen_id: kitchenId }).eq('id', assignment.id);
                        toast.success('Kitchen assigned');
                        loadAll();
                      }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Assign Kitchen" /></SelectTrigger>
                        <SelectContent>
                          {kitchens.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={async () => {
                        await supabase.from('meal_hostel_assignments').update({ is_active: !assignment.is_active }).eq('id', assignment.id);
                        loadAll();
                      }}>
                        {assignment.is_active ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {hostelAssignments.length === 0 && <p className="text-gray-400 text-center py-8 col-span-2">No hostel assignments. Run the SQL seed to create defaults.</p>}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <h3 className="font-semibold text-lg">Meal Analytics</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Orders by Meal Type */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Orders by Meal Type</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={(() => {
                        const counts = { breakfast: 0, lunch: 0, snacks: 0, dinner: 0 };
                        orders.forEach(o => { if (counts[o.meal_type] !== undefined) counts[o.meal_type]++; });
                        return Object.entries(counts).map(([name, value]) => ({ name, value }));
                      })()}
                      cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}
                    >
                      {['#10b981', '#3b82f6', '#f97316', '#a855f7'].map((color, i) => <Cell key={i} fill={color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue Trend */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Subscription Revenue (Last 7 Days)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={(() => {
                    const days = [];
                    for (let i = 6; i >= 0; i--) {
                      const d = new Date(); d.setDate(d.getDate() - i);
                      const dateStr = d.toISOString().split('T')[0];
                      const dayRevenue = subscriptions
                        .filter(s => s.created_at?.startsWith(dateStr))
                        .reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
                      days.push({ day: d.toLocaleDateString('en-IN', { weekday: 'short' }), revenue: dayRevenue });
                    }
                    return days;
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `₹${v}`} />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Popular Menu Items */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Most Ordered Items</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={(() => {
                    const itemCounts = {};
                    orders.forEach(o => {
                      (o.items || []).forEach(item => {
                        itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
                      });
                    });
                    return Object.entries(itemCounts)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([name, count]) => ({ name: name.length > 12 ? name.slice(0, 12) + '...' : name, count }));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Order Status Distribution */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Order Status Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={(() => {
                    const statusCounts = {};
                    orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
                    return Object.entries(statusCounts).map(([status, count]) => ({ status, count }));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-emerald-600">{orders.filter(o => o.status === 'delivered').length}</p><p className="text-[10px] text-gray-500">Delivered</p></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-yellow-600">{orders.filter(o => o.status === 'pending').length}</p><p className="text-[10px] text-gray-500">Pending</p></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-blue-600">{orders.filter(o => o.status === 'preparing').length}</p><p className="text-[10px] text-gray-500">Preparing</p></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-red-600">{orders.filter(o => o.status === 'cancelled').length}</p><p className="text-[10px] text-gray-500">Cancelled</p></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-purple-600">{subscriptions.filter(s => s.status === 'active').length}</p><p className="text-[10px] text-gray-500">Active Subs</p></CardContent></Card>
          </div>
        </TabsContent>

        {/* Subscriptions Tab */}
        <TabsContent value="subs" className="space-y-4">
          <h3 className="font-semibold">Subscription Management</h3>
          <Card>
            <CardContent className="p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map(sub => (
                    <TableRow key={sub.id}>
                      <TableCell className="text-xs">{sub.user_id?.slice(0, 8)}...</TableCell>
                      <TableCell className="font-medium">{sub.plan?.name || '-'}</TableCell>
                      <TableCell className="text-xs">{sub.start_date}</TableCell>
                      <TableCell className="text-xs">{sub.end_date}</TableCell>
                      <TableCell className="font-medium">₹{sub.total_amount}</TableCell>
                      <TableCell>
                        <Badge className={sub.status === 'active' ? 'bg-green-100 text-green-800' : sub.status === 'paused' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {sub.status === 'active' && (
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={async () => {
                              await supabase.from('meal_subscriptions').update({ status: 'paused' }).eq('id', sub.id);
                              toast.success('Subscription paused');
                              loadAll();
                            }}>Pause</Button>
                          )}
                          {sub.status === 'paused' && (
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={async () => {
                              await supabase.from('meal_subscriptions').update({ status: 'active' }).eq('id', sub.id);
                              toast.success('Subscription resumed');
                              loadAll();
                            }}>Resume</Button>
                          )}
                          <Button size="sm" variant="outline" className="text-xs h-7 text-red-500" onClick={() => {
                            toast('Cancel this subscription?', {
                              action: {
                                label: 'Yes, Cancel',
                                onClick: async () => {
                                  await supabase.from('meal_subscriptions').update({ status: 'cancelled' }).eq('id', sub.id);
                                  toast.success('Subscription cancelled successfully');
                                  loadAll();
                                }
                              },
                              cancel: { label: 'No' },
                            });
                          }}>Cancel</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {subscriptions.length === 0 && <p className="text-center text-gray-400 py-8">No subscriptions yet</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coupons Tab */}
        <TabsContent value="coupons" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Meal Coupons & Offers</h3>
            <Button onClick={() => setShowAddCoupon(true)} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-1" /> Add Coupon</Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coupons.map(coupon => (
              <Card key={coupon.id} className={!coupon.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <code className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold text-sm">{coupon.code}</code>
                    <Badge className={coupon.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{coupon.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <p className="font-semibold text-sm">{coupon.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{coupon.description}</p>
                  <div className="mt-3 space-y-1 text-xs">
                    <p><span className="text-gray-500">Discount:</span> <span className="font-medium">{coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `₹${coupon.discount_value}`}</span></p>
                    <p><span className="text-gray-500">Min Order:</span> ₹{coupon.min_order_amount}</p>
                    <p><span className="text-gray-500">Used:</span> {coupon.used_count}/{coupon.usage_limit}</p>
                    {coupon.valid_until && <p><span className="text-gray-500">Expires:</span> {new Date(coupon.valid_until).toLocaleDateString()}</p>}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="text-xs" onClick={async () => {
                      await supabase.from('meal_coupons').update({ is_active: !coupon.is_active }).eq('id', coupon.id);
                      loadAll();
                    }}>{coupon.is_active ? 'Disable' : 'Enable'}</Button>
                    <Button size="sm" variant="outline" className="text-xs text-red-500" onClick={() => {
                      toast('Delete this coupon?', {
                        action: {
                          label: 'Delete',
                          onClick: async () => {
                            await supabase.from('meal_coupons').delete().eq('id', coupon.id);
                            toast.success('Coupon deleted successfully');
                            loadAll();
                          }
                        },
                        cancel: { label: 'Cancel' },
                      });
                    }}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {coupons.length === 0 && <p className="text-gray-400 text-center py-8 col-span-3">No coupons. Create one to attract subscribers.</p>}
          </div>
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="space-y-4">
          <h3 className="font-semibold">Meal Reviews & Feedback</h3>
          <Card>
            <CardContent className="p-4">
              {reviews.length > 0 ? (
                <div className="space-y-3">
                  {reviews.map(review => (
                    <div key={review.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex">{[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />)}</div>
                          <span className="text-xs text-gray-500">{review.meal_item_name || 'General'}</span>
                        </div>
                        <Badge className={review.is_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>{review.is_approved ? 'Approved' : 'Pending'}</Badge>
                      </div>
                      {review.comment && <p className="text-sm text-gray-700 mt-2">{review.comment}</p>}
                      {review.admin_reply && <p className="text-xs text-emerald-600 mt-1 italic">Admin: {review.admin_reply}</p>}
                      <div className="flex gap-2 mt-2">
                        {!review.is_approved && (
                          <Button size="sm" variant="outline" className="text-xs h-6" onClick={async () => {
                            await supabase.from('meal_reviews').update({ is_approved: true }).eq('id', review.id);
                            toast.success('Approved'); loadAll();
                          }}><CheckCircle className="w-3 h-3 mr-1" /> Approve</Button>
                        )}
                        <Button size="sm" variant="outline" className="text-xs h-6 text-red-500" onClick={async () => {
                          await supabase.from('meal_reviews').delete().eq('id', review.id);
                          toast.success('Deleted'); loadAll();
                        }}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8">No reviews yet. Reviews will appear here when customers rate their meals.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <h3 className="font-semibold">Send Meal Notifications</h3>
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label>Notification Type</Label>
                <Select defaultValue="reminder">
                  <SelectTrigger id="notif-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reminder">Meal Reminder</SelectItem>
                    <SelectItem value="promo">Promotional Offer</SelectItem>
                    <SelectItem value="delay">Kitchen Delay Alert</SelectItem>
                    <SelectItem value="expiry">Subscription Expiry</SelectItem>
                    <SelectItem value="custom">Custom Message</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input id="notif-title" placeholder="Your lunch is ready!" />
              </div>
              <div>
                <Label>Message</Label>
                <Input id="notif-message" placeholder="Your meal has been prepared and is out for delivery." />
              </div>
              <div>
                <Label>Target Audience</Label>
                <Select defaultValue="all">
                  <SelectTrigger id="notif-target"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Meal Subscribers</SelectItem>
                    <SelectItem value="active">Active Subscribers Only</SelectItem>
                    <SelectItem value="mithali">Mithali Hostel</SelectItem>
                    <SelectItem value="gavaskar">Gavaskar Hostel</SelectItem>
                    <SelectItem value="virat">Virat Hostel</SelectItem>
                    <SelectItem value="tendulkar">Tendulkar Hostel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={async () => {
                const title = document.getElementById('notif-title')?.value;
                const message = document.getElementById('notif-message')?.value;
                if (!title || !message) { toast.error('Title and message required'); return; }
                
                // Get all active subscribers
                const { data: subs } = await supabase.from('meal_subscriptions').select('user_id').eq('status', 'active');
                if (!subs || subs.length === 0) { toast.error('No active subscribers to notify'); return; }
                
                // Create notifications for all subscribers
                const notifications = subs.map(s => ({
                  user_id: s.user_id,
                  title,
                  message,
                  type: 'info',
                  is_read: false
                }));
                
                const { error } = await supabase.from('notifications').insert(notifications);
                if (error) { toast.error('Failed to send: ' + error.message); return; }
                toast.success(`Notification sent to ${subs.length} subscribers!`);
              }}>
                Send Notification
              </Button>
            </CardContent>
          </Card>

          {/* Quick Notification Templates */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Quick Templates</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[
                { title: 'Breakfast Ready', msg: 'Your breakfast is being prepared. Delivery in 15 mins!' },
                { title: 'Lunch Time', msg: 'Today\'s lunch menu is ready. Order before 11:30 AM cutoff.' },
                { title: 'Subscription Expiring', msg: 'Your meal subscription expires in 3 days. Renew now to continue.' },
                { title: 'New Menu Added', msg: 'We\'ve added exciting new dishes to the menu. Check them out!' },
              ].map((tmpl, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{tmpl.title}</p>
                    <p className="text-xs text-gray-500">{tmpl.msg}</p>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                    document.getElementById('notif-title').value = tmpl.title;
                    document.getElementById('notif-message').value = tmpl.msg;
                    toast.info('Template loaded');
                  }}>Use</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <h3 className="font-semibold">Meal System Settings</h3>
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                {mealSettings.map(setting => (
                  <div key={setting.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize">{setting.key.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-500">{setting.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input 
                        defaultValue={setting.value} 
                        className="w-32 h-8 text-sm"
                        onBlur={async (e) => {
                          if (e.target.value !== setting.value) {
                            await supabase.from('meal_settings').update({ value: e.target.value, updated_at: new Date().toISOString() }).eq('id', setting.id);
                            toast.success(`${setting.key} updated`);
                          }
                        }}
                      />
                    </div>
                  </div>
                ))}
                {mealSettings.length === 0 && <p className="text-center text-gray-400 py-8">No settings found. Run the SQL seed to create defaults.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Menu Item Dialog */}
      <Dialog open={showAddMenu} onOpenChange={setShowAddMenu}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={menuForm.name} onChange={e => setMenuForm(p => ({...p, name: e.target.value}))} /></div>
            <div><Label>Meal Type</Label>
              <Select value={menuForm.meal_type} onValueChange={v => setMenuForm(p => ({...p, meal_type: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="snacks">Snacks</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Calories</Label><Input type="number" value={menuForm.calories} onChange={e => setMenuForm(p => ({...p, calories: parseInt(e.target.value) || 0}))} /></div>
              <div><Label>Price (₹)</Label><Input type="number" value={menuForm.price} onChange={e => setMenuForm(p => ({...p, price: parseInt(e.target.value) || 0}))} /></div>
            </div>
            <div><Label>Image URL</Label><Input value={menuForm.image_url} onChange={e => setMenuForm(p => ({...p, image_url: e.target.value}))} placeholder="https://..." /></div>
            <Button onClick={saveMenuItem} className="w-full bg-emerald-600 hover:bg-emerald-700">{editingItem ? 'Update' : 'Add'} Item</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Plan Dialog */}
      <Dialog open={showAddPlan} onOpenChange={setShowAddPlan}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Meal Plan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Plan Name</Label><Input value={planForm.name} onChange={e => setPlanForm(p => ({...p, name: e.target.value}))} /></div>
            <div><Label>Description</Label><Input value={planForm.description} onChange={e => setPlanForm(p => ({...p, description: e.target.value}))} /></div>
            <div>
              <Label>Pricing</Label>
              <div className="flex gap-2 mt-1">
                <Select value={planForm.price_type} onValueChange={v => setPlanForm(p => ({...p, price_type: v}))}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_day">Per Day (₹/day)</SelectItem>
                    <SelectItem value="monthly">Monthly (₹/month)</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  className="flex-1"
                  placeholder={planForm.price_type === 'monthly' ? 'e.g. 2999' : 'e.g. 149'}
                  value={planForm.price_per_day || ''}
                  onChange={e => setPlanForm(p => ({...p, price_per_day: parseFloat(e.target.value) || 0}))}
                />
              </div>
              {planForm.price_type === 'monthly' && planForm.price_per_day > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  = ₹{Math.round(planForm.price_per_day / 30)}/day (stored as per-day)
                </p>
              )}
            </div>
            <div><Label>Meals/Day</Label><Input type="number" value={planForm.meals_per_day} onChange={e => setPlanForm(p => ({...p, meals_per_day: parseInt(e.target.value) || 0}))} /></div>
            <Button onClick={savePlan} className="w-full bg-emerald-600 hover:bg-emerald-700">Create Plan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={showEditPlan} onOpenChange={setShowEditPlan}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Meal Plan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Plan Name</Label><Input value={planForm.name} onChange={e => setPlanForm(p => ({...p, name: e.target.value}))} /></div>
            <div><Label>Description</Label><Input value={planForm.description} onChange={e => setPlanForm(p => ({...p, description: e.target.value}))} /></div>
            <div>
              <Label>Pricing</Label>
              <div className="flex gap-2 mt-1">
                <Select value={planForm.price_type || 'per_day'} onValueChange={v => setPlanForm(p => ({...p, price_type: v}))}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_day">Per Day (₹/day)</SelectItem>
                    <SelectItem value="monthly">Monthly (₹/month)</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  className="flex-1"
                  value={planForm.price_per_day || ''}
                  onChange={e => setPlanForm(p => ({...p, price_per_day: parseFloat(e.target.value) || 0}))}
                />
              </div>
              {planForm.price_type === 'monthly' && planForm.price_per_day > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  = ₹{Math.round(planForm.price_per_day / 30)}/day (stored as per-day)
                </p>
              )}
            </div>
            <div><Label>Meals/Day</Label><Input type="number" value={planForm.meals_per_day} onChange={e => setPlanForm(p => ({...p, meals_per_day: parseInt(e.target.value) || 0}))} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="plan-popular" checked={planForm.is_popular} onChange={e => setPlanForm(p => ({...p, is_popular: e.target.checked}))} />
              <Label htmlFor="plan-popular">Mark as Popular</Label>
            </div>
            <Button onClick={async () => {
              if (!editingPlan) return;
              const pricePerDay = planForm.price_type === 'monthly'
                ? Math.round((planForm.price_per_day / 30) * 100) / 100
                : planForm.price_per_day;
              await supabase.from('meal_plans').update({
                name: planForm.name,
                description: planForm.description,
                price_per_day: pricePerDay,
                meals_per_day: planForm.meals_per_day,
                is_popular: planForm.is_popular,
                updated_at: new Date().toISOString()
              }).eq('id', editingPlan.id);
              toast.success('Plan updated');
              setShowEditPlan(false);
              setEditingPlan(null);
              loadAll();
            }} className="w-full bg-emerald-600 hover:bg-emerald-700">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Kitchen Dialog */}
      <Dialog open={showAddKitchen} onOpenChange={setShowAddKitchen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Kitchen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Kitchen Name</Label><Input id="kitchen-name" placeholder="Main Kitchen" /></div>
            <div><Label>Location</Label><Input id="kitchen-location" placeholder="Campus Block A" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Capacity (orders/slot)</Label><Input id="kitchen-capacity" type="number" defaultValue={100} /></div>
              <div><Label>Manager Name</Label><Input id="kitchen-manager" placeholder="Name" /></div>
            </div>
            <div><Label>Contact Phone</Label><Input id="kitchen-phone" placeholder="9876543210" /></div>
            <Button onClick={async () => {
              const name = document.getElementById('kitchen-name').value;
              const location = document.getElementById('kitchen-location').value;
              const capacity = parseInt(document.getElementById('kitchen-capacity').value) || 100;
              const manager = document.getElementById('kitchen-manager').value;
              const phone = document.getElementById('kitchen-phone').value;
              if (!name) { toast.error('Name required'); return; }
              await supabase.from('meal_kitchens').insert({ name, location, capacity, manager_name: manager, contact_phone: phone, status: 'available' });
              toast.success('Kitchen added');
              setShowAddKitchen(false);
              loadAll();
            }} className="w-full bg-emerald-600 hover:bg-emerald-700">Add Kitchen</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Delivery Slot Dialog */}
      <Dialog open={showAddSlot} onOpenChange={setShowAddSlot}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Delivery Slot</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Meal Type</Label>
              <Select defaultValue="breakfast">
                <SelectTrigger id="slot-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="snacks">Snacks</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Start Time</Label>
                <div className="flex gap-1">
                  <Input id="slot-start-time" placeholder="7:30" className="w-20" />
                  <Select defaultValue="AM">
                    <SelectTrigger id="slot-start-ampm" className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>End Time</Label>
                <div className="flex gap-1">
                  <Input id="slot-end-time" placeholder="9:30" className="w-20" />
                  <Select defaultValue="AM">
                    <SelectTrigger id="slot-end-ampm" className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Cutoff</Label>
                <div className="flex gap-1">
                  <Input id="slot-cutoff-time" placeholder="7:00" className="w-20" />
                  <Select defaultValue="AM">
                    <SelectTrigger id="slot-cutoff-ampm" className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Max Orders</Label><Input id="slot-max" type="number" defaultValue={50} /></div>
              <div><Label>Delivery Fee (₹)</Label><Input id="slot-fee" type="number" defaultValue={0} /></div>
            </div>
            <Button onClick={async () => {
              const meal_type = document.getElementById('slot-type')?.textContent?.toLowerCase() || 'breakfast';
              const startTime = document.getElementById('slot-start-time').value;
              const startAmpm = document.getElementById('slot-start-ampm')?.textContent || 'AM';
              const endTime = document.getElementById('slot-end-time').value;
              const endAmpm = document.getElementById('slot-end-ampm')?.textContent || 'AM';
              const cutoffTime = document.getElementById('slot-cutoff-time').value;
              const cutoffAmpm = document.getElementById('slot-cutoff-ampm')?.textContent || 'AM';
              
              if (!startTime || !endTime) { toast.error('Start and End times are required'); return; }
              
              // Convert to 24h for storage
              const to24h = (time, ampm) => {
                const parts = time.replace('.', ':').split(':');
                let h = parseInt(parts[0], 10);
                const m = parts[1] || '00';
                if (ampm === 'PM' && h !== 12) h += 12;
                if (ampm === 'AM' && h === 12) h = 0;
                return `${String(h).padStart(2, '0')}:${m}`;
              };
              
              const start_time = to24h(startTime, startAmpm);
              const end_time = to24h(endTime, endAmpm);
              const cutoff_time = cutoffTime ? to24h(cutoffTime, cutoffAmpm) : '';
              const max_orders = parseInt(document.getElementById('slot-max').value) || 50;
              const delivery_fee = parseInt(document.getElementById('slot-fee').value) || 0;
              
              await supabase.from('meal_delivery_slots').insert({ meal_type, start_time, end_time, cutoff_time, max_orders, delivery_fee });
              toast.success('Slot added successfully');
              setShowAddSlot(false);
              loadAll();
            }} className="w-full bg-emerald-600 hover:bg-emerald-700">Add Slot</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Coupon Dialog */}
      <Dialog open={showAddCoupon} onOpenChange={setShowAddCoupon}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Meal Coupon</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Coupon Code</Label><Input id="coupon-code" placeholder="MEAL20" /></div>
              <div><Label>Title</Label><Input id="coupon-title" placeholder="20% Off" /></div>
            </div>
            <div><Label>Description</Label><Input id="coupon-desc" placeholder="Get 20% off on meal plans" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Type</Label>
                <Select defaultValue="percentage">
                  <SelectTrigger id="coupon-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="flat">Flat Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Value</Label><Input id="coupon-value" type="number" placeholder="20" /></div>
              <div><Label>Max Discount</Label><Input id="coupon-max" type="number" placeholder="200" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min Order (₹)</Label><Input id="coupon-min" type="number" defaultValue={0} /></div>
              <div><Label>Usage Limit</Label><Input id="coupon-limit" type="number" defaultValue={100} /></div>
            </div>
            <Button onClick={async () => {
              const code = document.getElementById('coupon-code').value.toUpperCase();
              const title = document.getElementById('coupon-title').value;
              const description = document.getElementById('coupon-desc').value;
              const discount_value = parseFloat(document.getElementById('coupon-value').value) || 0;
              const max_discount = parseFloat(document.getElementById('coupon-max').value) || 0;
              const min_order_amount = parseFloat(document.getElementById('coupon-min').value) || 0;
              const usage_limit = parseInt(document.getElementById('coupon-limit').value) || 100;
              if (!code || !title) { toast.error('Code and title required'); return; }
              const { error } = await supabase.from('meal_coupons').insert({ code, title, description, discount_type: 'percentage', discount_value, max_discount, min_order_amount, usage_limit });
              if (error) { toast.error(error.message.includes('unique') ? 'Code already exists' : 'Failed'); return; }
              toast.success('Coupon created');
              setShowAddCoupon(false);
              loadAll();
            }} className="w-full bg-emerald-600 hover:bg-emerald-700">Create Coupon</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
