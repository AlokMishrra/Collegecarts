import { supabase } from '@/lib/supabase';

/**
 * Fetch all active meal plans
 */
export const getMealPlans = async () => {
  const { data, error } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('is_active', true)
    .order('price_per_day', { ascending: true });
  if (error) throw error;
  return data || [];
};

/**
 * Fetch menu items by meal type, respecting weekly menu schedule set by admin
 */
export const getMenuItems = async (mealType = null) => {
  // Get current day of week (1=Monday, 7=Sunday) matching PostgreSQL ISODOW
  const jsDay = new Date().getDay(); // 0=Sunday, 1=Monday...
  const dayOfWeek = jsDay === 0 ? 7 : jsDay; // Convert to 1=Monday, 7=Sunday
  
  // Check if admin has set a weekly menu for today's day
  if (mealType) {
    const { data: weeklyMenu } = await supabase
      .from('weekly_menu_schedule')
      .select('meal_id')
      .eq('day_of_week', dayOfWeek)
      .eq('meal_type', mealType)
      .eq('is_active', true)
      .order('display_order');
    
    if (weeklyMenu && weeklyMenu.length > 0) {
      const mealIds = weeklyMenu.map(m => m.meal_id);
      // Fetch only the items scheduled for today
      const { data, error } = await supabase
        .from('meal_menu_items')
        .select('*')
        .in('id', mealIds)
        .eq('is_available', true);
      if (error) throw error;
      
      // Sort by the display_order from weekly schedule
      const ordered = mealIds
        .map(id => data.find(item => item.id === id))
        .filter(Boolean);
      return ordered;
    }
  }

  // Fallback: return all items of that type (original behavior)
  let query = supabase.from('meal_menu_items').select('*').eq('is_available', true);
  if (mealType) query = query.eq('meal_type', mealType);
  query = query.order('name');
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

/**
 * Subscribe to a meal plan
 */
export const subscribeToPlan = async (userId, planId, durationDays = 30, hostel = '', roomNumber = '') => {
  // Get plan details
  const { data: plan, error: planErr } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', planId)
    .single();
  
  if (planErr) throw planErr;

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + durationDays);

  const totalAmount = plan.price_per_day * durationDays;

  const { data, error } = await supabase
    .from('meal_subscriptions')
    .insert({
      user_id: userId,
      plan_id: planId,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      total_amount: totalAmount,
      hostel,
      room_number: roomNumber,
      status: 'active'
    })
    .select()
    .single();

  if (error) throw error;

  // Increment student count on plan
  await supabase.rpc('increment_meal_plan_students', { plan_id: planId }).catch(() => {});

  return data;
};

/**
 * Get user's active subscription
 */
export const getUserSubscription = async (userId) => {
  const { data, error } = await supabase
    .from('meal_subscriptions')
    .select('*, plan:meal_plans(name)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
};

/**
 * Place a meal order (individual or from subscription)
 */
export const placeMealOrder = async (userId, mealType, items, hostel, roomNumber, deliverySlot = null, subscriptionId = null) => {
  const totalCalories = items.reduce((sum, i) => sum + (i.calories || 0), 0);
  const totalPrice = items.reduce((sum, i) => sum + (i.price || 0), 0);

  const { data, error } = await supabase
    .from('meal_orders')
    .insert({
      user_id: userId,
      subscription_id: subscriptionId,
      meal_type: mealType,
      items,
      total_calories: totalCalories,
      total_price: totalPrice,
      hostel,
      room_number: roomNumber,
      delivery_date: new Date().toISOString().split('T')[0],
      delivery_time: deliverySlot,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Get delivery time slots for a meal type from database
 * Falls back to default slots if none configured
 */
export const getDeliverySlots = async (mealType) => {
  // Try to fetch from database first
  const { data, error } = await supabase
    .from('meal_delivery_slots')
    .select('*')
    .eq('meal_type', mealType)
    .eq('is_active', true)
    .order('start_time');
  
  if (!error && data && data.length > 0) {
    return data.map((slot, idx) => ({
      id: slot.id || `${mealType}_${idx}`,
      time: `${slot.start_time} - ${slot.end_time}`,
      label: slot.start_time,
      cutoff: slot.cutoff_time,
      max_orders: slot.max_orders,
      fee: slot.delivery_fee
    }));
  }

  // Fallback to default slots if none in database
  const defaultSlots = {
    breakfast: [
      { id: 'b1', time: '7:00 AM - 7:30 AM', label: '7:00 AM' },
      { id: 'b2', time: '7:30 AM - 8:00 AM', label: '7:30 AM' },
      { id: 'b3', time: '8:00 AM - 8:30 AM', label: '8:00 AM' },
      { id: 'b4', time: '8:30 AM - 9:00 AM', label: '8:30 AM' },
      { id: 'b5', time: '9:00 AM - 9:30 AM', label: '9:00 AM' },
      { id: 'b6', time: '9:30 AM - 10:00 AM', label: '9:30 AM' },
    ],
    lunch: [
      { id: 'l1', time: '12:00 PM - 12:30 PM', label: '12:00 PM' },
      { id: 'l2', time: '12:30 PM - 1:00 PM', label: '12:30 PM' },
      { id: 'l3', time: '1:00 PM - 1:30 PM', label: '1:00 PM' },
      { id: 'l4', time: '1:30 PM - 2:00 PM', label: '1:30 PM' },
      { id: 'l5', time: '2:00 PM - 2:30 PM', label: '2:00 PM' },
      { id: 'l6', time: '2:30 PM - 3:00 PM', label: '2:30 PM' },
    ],
    snacks: [
      { id: 's1', time: '4:00 PM - 4:30 PM', label: '4:00 PM' },
      { id: 's2', time: '4:30 PM - 5:00 PM', label: '4:30 PM' },
      { id: 's3', time: '5:00 PM - 5:30 PM', label: '5:00 PM' },
      { id: 's4', time: '5:30 PM - 6:00 PM', label: '5:30 PM' },
    ],
    dinner: [
      { id: 'd1', time: '7:00 PM - 7:30 PM', label: '7:00 PM' },
      { id: 'd2', time: '7:30 PM - 8:00 PM', label: '7:30 PM' },
      { id: 'd3', time: '8:00 PM - 8:30 PM', label: '8:00 PM' },
      { id: 'd4', time: '8:30 PM - 9:00 PM', label: '8:30 PM' },
      { id: 'd5', time: '9:00 PM - 9:30 PM', label: '9:00 PM' },
      { id: 'd6', time: '9:30 PM - 10:00 PM', label: '9:30 PM' },
    ],
  };
  return defaultSlots[mealType] || [];
};

/**
 * Get the weekly menu for a specific day (for calendar view)
 */
export const getWeeklyMenuForDay = async (dayOfWeek) => {
  const { data, error } = await supabase
    .from('weekly_menu_schedule')
    .select(`
      day_of_week,
      meal_type,
      display_order,
      meal_menu_items (*)
    `)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .order('display_order');
  
  if (error) throw error;
  return data || [];
};

/**
 * Get the full week menu (for calendar view)
 */
export const getFullWeekMenu = async () => {
  const { data, error } = await supabase
    .from('weekly_menu_schedule')
    .select(`
      day_of_week,
      meal_type,
      display_order,
      meal_menu_items (*)
    `)
    .eq('is_active', true)
    .order('day_of_week')
    .order('display_order');
  
  if (error) throw error;
  return data || [];
};

/**
 * Get user's meal order history
 */
export const getMealOrders = async (userId, limit = 20) => {
  const { data, error } = await supabase
    .from('meal_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
};
