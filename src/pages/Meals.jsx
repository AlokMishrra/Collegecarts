import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, Leaf, Shield, UtensilsCrossed, Flame, Star,
  ChevronRight, Users, Calendar, TrendingUp, Heart,
  Coffee, Sandwich, Pizza, Cookie, CheckCircle, Loader2, X
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { getMealPlans, getMenuItems, subscribeToPlan, getUserSubscription, placeMealOrder, getDeliverySlots, getFullWeekMenu } from '@/services/mealsService';

const fallbackPlans = [
  {
    id: 'standard',
    name: 'Standard Plan',
    description: 'Breakfast, Lunch, Dinner',
    price: 149,
    unit: 'day',
    meals: '3 Meals / Day',
    students: '500+ Students',
    icon: '🍱',
    color: '#10b981',
    popular: false
  },
  {
    id: 'healthy',
    name: 'Healthy Plan',
    description: 'Low Oil, High Protein',
    price: 189,
    unit: 'day',
    meals: '3 Meals / Day',
    students: '420+ Students',
    icon: '🥗',
    color: '#10b981',
    popular: true
  },
  {
    id: 'premium',
    name: 'Premium Plan',
    description: 'Special & Variety Meals',
    price: 219,
    unit: 'day',
    meals: '3 Meals / Day',
    students: '300+ Students',
    icon: '⭐',
    color: '#a855f7',
    popular: false
  },
  {
    id: 'saver',
    name: 'Student Saver',
    description: 'Budget Friendly Meals',
    price: 99,
    unit: 'day',
    meals: '2 Meals / Day',
    students: '620+ Students',
    icon: '💰',
    color: '#f97316',
    popular: false
  }
];

const features = [
  { icon: Clock, label: 'On-Time\nDelivery', color: '#10b981' },
  { icon: Shield, label: 'Hygienic\nFood', color: '#3b82f6' },
  { icon: UtensilsCrossed, label: 'Custom\nMeals', color: '#f97316' },
  { icon: Leaf, label: 'Nutrition\nRich', color: '#22c55e' },
  { icon: Star, label: 'Best\nPrices', color: '#eab308' },
];

const fallbackMenu = {
  breakfast: [
    { name: 'Poha with Peanuts', kcal: 300, img: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=120&h=120&fit=crop&q=80' },
    { name: 'Masala Dosa', kcal: 450, img: 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=120&h=120&fit=crop&q=80' },
    { name: 'Veg Pulao', kcal: 500, img: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=120&h=120&fit=crop&q=80' },
    { name: 'Oats Upma', kcal: 320, img: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=120&h=120&fit=crop&q=80' },
    { name: 'Banana Milkshake', kcal: 180, img: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=120&h=120&fit=crop&q=80' },
  ],
  lunch: [
    { name: 'Dal Tadka + Rice', kcal: 550, img: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=120&h=120&fit=crop&q=80' },
    { name: 'Chole Bhature', kcal: 650, img: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=120&h=120&fit=crop&q=80' },
    { name: 'Veg Thali', kcal: 700, img: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=120&h=120&fit=crop&q=80' },
    { name: 'Rajma Chawal', kcal: 580, img: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=120&h=120&fit=crop&q=80' },
  ],
  snacks: [
    { name: 'Samosa + Chai', kcal: 250, img: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=120&h=120&fit=crop&q=80' },
    { name: 'Bread Pakora', kcal: 300, img: 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=120&h=120&fit=crop&q=80' },
    { name: 'Vada Pav', kcal: 350, img: 'https://images.unsplash.com/photo-1606491956689-2ea866880049?w=120&h=120&fit=crop&q=80' },
  ],
  dinner: [
    { name: 'Paneer Butter Masala', kcal: 600, img: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=120&h=120&fit=crop&q=80' },
    { name: 'Naan + Dal Makhani', kcal: 700, img: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=120&h=120&fit=crop&q=80' },
    { name: 'Veg Biryani', kcal: 750, img: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=120&h=120&fit=crop&q=80' },
    { name: 'Roti + Sabzi', kcal: 450, img: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=120&h=120&fit=crop&q=80' },
  ]
};

const mealTabs = [
  { id: 'breakfast', label: 'Breakfast', icon: Coffee },
  { id: 'lunch', label: 'Lunch', icon: Sandwich },
  { id: 'snacks', label: 'Snacks', icon: Cookie },
  { id: 'dinner', label: 'Dinner', icon: Pizza },
];

export default function Meals() {
  const { user } = useAuth();
  const [activeMealTab, setActiveMealTab] = useState('breakfast');
  const [mealPlans, setMealPlans] = useState([]);
  const [menuItems, setMenuItems] = useState({});
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);
  const [orderingItem, setOrderingItem] = useState(null);
  
  // Delivery slot selection
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [pendingOrderItem, setPendingOrderItem] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  
  // Calendar view
  const [showCalendar, setShowCalendar] = useState(false);
  const [weekMenu, setWeekMenu] = useState(null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  
  // Customize meal
  const [showCustomize, setShowCustomize] = useState(false);
  const [customizeItem, setCustomizeItem] = useState(null);
  const [spiceLevel, setSpiceLevel] = useState('medium');
  const [extras, setExtras] = useState([]);
  const [removals, setRemovals] = useState([]);

  // Load data from database
  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plans, breakfast, lunch, snacks, dinner] = await Promise.all([
        getMealPlans().catch(() => []),
        getMenuItems('breakfast').catch(() => []),
        getMenuItems('lunch').catch(() => []),
        getMenuItems('snacks').catch(() => []),
        getMenuItems('dinner').catch(() => []),
      ]);

      setMealPlans(plans.length > 0 ? plans : fallbackPlans);
      setMenuItems({
        breakfast: breakfast.length > 0 ? breakfast : fallbackMenu.breakfast,
        lunch: lunch.length > 0 ? lunch : fallbackMenu.lunch,
        snacks: snacks.length > 0 ? snacks : fallbackMenu.snacks,
        dinner: dinner.length > 0 ? dinner : fallbackMenu.dinner,
      });

      // Check user subscription
      if (user?.id) {
        const sub = await getUserSubscription(user.id).catch(() => null);
        setActiveSubscription(sub);
      }
    } catch (err) {
      console.error('Error loading meals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan) => {
    if (!user) {
      toast.error('Please login to subscribe');
      return;
    }
    setSubscribing(plan.id);
    
    const totalAmount = (plan.price_per_day || plan.price) * 30; // 30 days
    
    // Open Razorpay
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: totalAmount * 100, // paise
      currency: 'INR',
      name: 'CollegeCart Meals',
      description: `${plan.name} - 30 Days`,
      handler: async (response) => {
        // Payment successful - create subscription
        try {
          await subscribeToPlan(user.id, plan.id, 30, user.selected_hostel || '', '');
          toast.success(`Subscribed to ${plan.name}! Your meals start tomorrow.`);
          setActiveSubscription({ plan_id: plan.id, plan });
          loadData();
        } catch (err) {
          toast.error('Payment received but subscription failed. Contact support.');
        }
        setSubscribing(null);
      },
      prefill: {
        name: user.full_name || '',
        email: user.email || '',
        contact: user.phone || ''
      },
      theme: { color: '#10b981' },
      modal: {
        ondismiss: () => setSubscribing(null)
      }
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error('Payment gateway not available. Try again.');
      setSubscribing(null);
    }
  };

  const handleAddMealItem = async (item) => {
    if (!user) {
      toast.error('Please login to order meals');
      return;
    }
    // Load delivery slots from database for this meal type
    const slots = await getDeliverySlots(activeMealTab);
    setAvailableSlots(slots);
    // Show delivery slot picker before adding to cart
    setPendingOrderItem(item);
    setSelectedSlot(null);
    setShowSlotPicker(true);
  };

  const confirmOrderWithSlot = async () => {
    if (!selectedSlot) {
      toast.error('Please select a delivery time slot');
      return;
    }
    
    const item = pendingOrderItem;
    setShowSlotPicker(false);
    setOrderingItem(item.id || item.name);
    
    try {
      // Add to cart
      if (item.id) {
        const { data: existing } = await supabase
          .from('cart_items')
          .select('id, quantity')
          .eq('user_id', user.id)
          .eq('product_id', item.id)
          .maybeSingle();

        if (existing) {
          await supabase.from('cart_items').update({ 
            quantity: existing.quantity + 1
          }).eq('id', existing.id);
        } else {
          await supabase.from('cart_items').insert({
            user_id: user.id,
            product_id: item.id,
            quantity: 1
          });
        }
        
        // Store delivery slot info in localStorage for checkout
        const mealSlots = JSON.parse(localStorage.getItem('mealDeliverySlots') || '{}');
        mealSlots[item.id] = { meal_type: activeMealTab, delivery_slot: selectedSlot.time };
        localStorage.setItem('mealDeliverySlots', JSON.stringify(mealSlots));
        
        window.dispatchEvent(new Event('cartUpdated'));
      }
      
      toast.success(`${item.name} added to cart`, {
        description: `${activeMealTab.charAt(0).toUpperCase() + activeMealTab.slice(1)} • Delivery: ${selectedSlot.time}`,
      });
    } catch (err) {
      console.error('Add to cart error:', err);
      toast.error('Failed to add to cart. Please try again.');
    } finally {
      setOrderingItem(null);
      setPendingOrderItem(null);
      setSelectedSlot(null);
    }
  };

  const handleViewCalendar = async () => {
    setShowCalendar(true);
    setLoadingCalendar(true);
    try {
      const data = await getFullWeekMenu();
      setWeekMenu(data);
    } catch (err) {
      toast.error('Failed to load weekly menu');
    } finally {
      setLoadingCalendar(false);
    }
  };

  const handleCustomize = (item) => {
    setCustomizeItem(item);
    setSpiceLevel('medium');
    setExtras([]);
    setRemovals([]);
    setShowCustomize(true);
  };

  const confirmCustomOrder = async () => {
    if (!user) {
      toast.error('Please login to order');
      return;
    }
    setShowCustomize(false);
    // Load delivery slots for this meal type
    const slots = await getDeliverySlots(activeMealTab);
    setAvailableSlots(slots);
    // Pass customization info along with the item to slot picker
    setPendingOrderItem({
      ...customizeItem,
      price: (customizeItem.price || 0) + extras.length * 10,
      customizations: { spiceLevel, extras, removals }
    });
    setSelectedSlot(null);
    setShowSlotPicker(true);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto -mt-2">
      
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-emerald-600 to-green-500 p-5 lg:p-8">
        <div className="relative z-10 max-w-[60%]">
          <h1 className="text-2xl lg:text-3xl font-bold text-white leading-tight">
            Healthy Meals,<br/>Delivered <span className="text-yellow-300">Fresh</span>
          </h1>
          <p className="text-emerald-100 text-sm mt-2">Nutritious • Hygienic • On Time</p>
          <Button className="mt-4 bg-white text-emerald-700 hover:bg-emerald-50 font-semibold shadow-lg">
            Explore Plans
          </Button>
        </div>
        {/* Thali image on right */}
        <img 
          src="https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&h=200&fit=crop"
          alt="Indian Thali"
          className="absolute right-0 bottom-0 w-[45%] h-full object-cover opacity-90 rounded-l-3xl"
        />
        {/* Decorative overlay */}
        <div className="absolute right-0 bottom-0 w-[45%] h-full bg-gradient-to-r from-emerald-600/80 to-transparent" />
      </div>

      {/* Feature Badges */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <div key={i} className="flex flex-col items-center gap-1.5 min-w-[64px]">
              <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shadow-sm">
                <Icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <span className="text-[10px] text-gray-600 text-center font-medium whitespace-pre-line leading-tight">
                {f.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Popular Meal Plans */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Popular Meal Plans</h2>
          <button className="text-sm text-emerald-600 font-medium flex items-center gap-0.5">
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {mealPlans.map((plan) => (
            <div 
              key={plan.id} 
              className={`relative flex-shrink-0 w-[160px] bg-white rounded-xl border p-3.5 ${
                plan.is_popular || plan.popular ? 'border-emerald-300 shadow-md' : 'border-gray-200'
              }`}
            >
              {(plan.is_popular || plan.popular) && (
                <div className="absolute -top-2 right-3">
                  <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.5">
                    <Heart className="w-2.5 h-2.5 mr-0.5" /> Popular
                  </Badge>
                </div>
              )}
              <p className="font-semibold text-sm text-gray-900">{plan.name}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{plan.description}</p>
              <div className="mt-3">
                <span className="text-lg font-bold" style={{ color: plan.color || '#10b981' }}>₹{plan.price_per_day || plan.price}</span>
                <span className="text-xs text-gray-500"> / day</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">{plan.meals_per_day || plan.meals} Meals / Day</p>
              <div className="flex items-center gap-1 mt-1.5">
                <Users className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] text-gray-400">{plan.student_count || 0}+ Students</span>
              </div>
              <Button 
                size="sm" 
                className="w-full mt-3 h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                disabled={subscribing === plan.id || activeSubscription?.plan_id === plan.id}
                onClick={() => handleSubscribe(plan)}
              >
                {subscribing === plan.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : activeSubscription?.plan_id === plan.id ? (
                  <><CheckCircle className="w-3 h-3 mr-1" /> Active</>
                ) : (
                  'Subscribe'
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Today's Menu */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">Today's Menu</h2>
        
        {/* Meal Type Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
          {mealTabs.map((tab) => {
            const active = activeMealTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMealTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  active 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Menu Items */}
        <div className="space-y-3">
          {(menuItems[activeMealTab] || []).map((item, i) => (
            <div key={item.id || i} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
              <img 
                src={item.image_url || item.img} 
                alt={item.name}
                className="w-14 h-14 rounded-xl object-cover"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                <p className="text-xs text-gray-500">{item.calories || item.kcal} kcal • ₹{item.price}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleCustomize(item)}
                  className="w-7 h-7 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-500 hover:bg-orange-100 transition-colors"
                  title="Customize"
                >
                  <UtensilsCrossed className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => handleAddMealItem(item)}
                  disabled={orderingItem === (item.id || item.name)}
                  className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold text-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                >
                  {orderingItem === (item.id || item.name) ? <Loader2 className="w-3 h-3 animate-spin" /> : '+'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <Button className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700">
          View Full Menu
        </Button>
      </div>

      {/* Promo Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100">
          <h3 className="font-semibold text-sm text-gray-900">Customize Your Meal</h3>
          <p className="text-[10px] text-gray-500 mt-1">Remove ingredients, add extras, set spice level</p>
          <Button 
            size="sm" 
            variant="outline" 
            className="mt-3 h-7 text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
            onClick={() => {
              const items = menuItems[activeMealTab] || [];
              if (items.length > 0) {
                handleCustomize(items[0]);
              } else {
                toast.info('Select a meal item first to customize');
              }
            }}
          >
            Customize Now
          </Button>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
          <h3 className="font-semibold text-sm text-gray-900">Meal Calendar</h3>
          <p className="text-[10px] text-gray-500 mt-1">Plan your meals in advance for the week</p>
          <Button 
            size="sm" 
            variant="outline" 
            className="mt-3 h-7 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
            onClick={handleViewCalendar}
          >
            <Calendar className="w-3 h-3 mr-1" /> View Calendar
          </Button>
        </div>
      </div>

      {/* ===== DELIVERY SLOT PICKER MODAL ===== */}
      {showSlotPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setShowSlotPicker(false)}>
          <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Choose Delivery Time</h3>
              <button onClick={() => setShowSlotPicker(false)} className="p-1 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {pendingOrderItem && (
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 mb-4">
                {(pendingOrderItem.image_url || pendingOrderItem.img) && (
                  <img src={pendingOrderItem.image_url || pendingOrderItem.img} alt={pendingOrderItem.name} className="w-12 h-12 rounded-lg object-cover" />
                )}
                <div>
                  <p className="font-semibold text-sm">{pendingOrderItem.name}</p>
                  <p className="text-xs text-gray-500">{pendingOrderItem.calories || pendingOrderItem.kcal} kcal • ₹{pendingOrderItem.price}</p>
                </div>
              </div>
            )}

            <p className="text-sm text-gray-600 mb-3">
              <Clock className="w-4 h-4 inline mr-1" />
              Select your preferred delivery slot for <span className="font-medium capitalize">{activeMealTab}</span>:
            </p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {availableSlots.map(slot => (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot)}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    selectedSlot?.id === slot.id
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 inline mr-1" />
                  {slot.label}
                </button>
              ))}
            </div>

            {selectedSlot && (
              <p className="text-xs text-emerald-600 mb-3 text-center">
                Delivery between <strong>{selectedSlot.time}</strong>
              </p>
            )}

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={!selectedSlot || orderingItem}
              onClick={confirmOrderWithSlot}
            >
              {orderingItem ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Add to Cart
            </Button>
          </div>
        </div>
      )}

      {/* ===== MEAL CALENDAR MODAL ===== */}
      {showCalendar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCalendar(false)}>
          <div className="bg-white w-full max-w-lg mx-4 rounded-2xl p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                <Calendar className="w-5 h-5 inline mr-2 text-blue-600" />
                Weekly Meal Calendar
              </h3>
              <button onClick={() => setShowCalendar(false)} className="p-1 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {loadingCalendar ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                <span className="ml-2 text-gray-500">Loading menu...</span>
              </div>
            ) : weekMenu && weekMenu.length > 0 ? (
              <div className="space-y-4">
                {[
                  { day: 1, name: 'Monday' },
                  { day: 2, name: 'Tuesday' },
                  { day: 3, name: 'Wednesday' },
                  { day: 4, name: 'Thursday' },
                  { day: 5, name: 'Friday' },
                  { day: 6, name: 'Saturday' },
                  { day: 7, name: 'Sunday' },
                ].map(({ day, name }) => {
                  const dayItems = weekMenu.filter(m => m.day_of_week === day);
                  const jsDay = new Date().getDay();
                  const today = jsDay === 0 ? 7 : jsDay;
                  const isToday = day === today;
                  
                  if (dayItems.length === 0) return null;
                  
                  return (
                    <div key={day} className={`rounded-lg border p-3 ${isToday ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-sm text-gray-900">{name}</h4>
                        {isToday && <Badge className="bg-emerald-500 text-white text-[9px] px-1.5">Today</Badge>}
                      </div>
                      <div className="space-y-1">
                        {['breakfast', 'lunch', 'snacks', 'dinner'].map(mealType => {
                          const meals = dayItems.filter(m => m.meal_type === mealType);
                          if (meals.length === 0) return null;
                          return (
                            <div key={mealType} className="flex items-start gap-2">
                              <span className="text-[10px] font-medium text-gray-500 uppercase w-16 flex-shrink-0 pt-0.5">
                                {mealType === 'breakfast' ? '☕' : mealType === 'lunch' ? '🍛' : mealType === 'snacks' ? '🍿' : '🌙'} {mealType}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {meals.map((m, i) => (
                                  <span key={i} className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-700">
                                    {m.meal_menu_items?.name || 'Item'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No weekly menu has been set up yet.</p>
                <p className="text-xs text-gray-400 mt-1">Check back later!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== CUSTOMIZE MEAL MODAL ===== */}
      {showCustomize && customizeItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setShowCustomize(false)}>
          <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Customize Your Meal</h3>
              <button onClick={() => setShowCustomize(false)} className="p-1 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 mb-4">
              {(customizeItem.image_url || customizeItem.img) && (
                <img src={customizeItem.image_url || customizeItem.img} alt={customizeItem.name} className="w-12 h-12 rounded-lg object-cover" />
              )}
              <div>
                <p className="font-semibold text-sm">{customizeItem.name}</p>
                <p className="text-xs text-gray-500">{customizeItem.calories || customizeItem.kcal} kcal • ₹{customizeItem.price}</p>
              </div>
            </div>

            {/* Spice Level */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Spice Level</label>
              <div className="flex gap-2">
                {['mild', 'medium', 'spicy', 'extra spicy'].map(level => (
                  <button
                    key={level}
                    onClick={() => setSpiceLevel(level)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
                      spiceLevel === level
                        ? 'bg-red-100 border-2 border-red-400 text-red-700'
                        : 'bg-gray-100 border-2 border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {level === 'mild' ? '🌶️' : level === 'medium' ? '🌶️🌶️' : level === 'spicy' ? '🌶️🌶️🌶️' : '🔥'} {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Extras */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Add Extras (+₹10 each)</label>
              <div className="flex flex-wrap gap-2">
                {['Extra Rice', 'Extra Roti', 'Raita', 'Salad', 'Papad', 'Pickle'].map(extra => (
                  <button
                    key={extra}
                    onClick={() => setExtras(prev => prev.includes(extra) ? prev.filter(e => e !== extra) : [...prev, extra])}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      extras.includes(extra)
                        ? 'bg-emerald-100 border-2 border-emerald-400 text-emerald-700'
                        : 'bg-gray-100 border-2 border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {extras.includes(extra) ? '✓ ' : '+ '}{extra}
                  </button>
                ))}
              </div>
            </div>

            {/* Removals */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Remove Ingredients</label>
              <div className="flex flex-wrap gap-2">
                {['Onion', 'Garlic', 'Coriander', 'Green Chili', 'Tomato'].map(item => (
                  <button
                    key={item}
                    onClick={() => setRemovals(prev => prev.includes(item) ? prev.filter(r => r !== item) : [...prev, item])}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      removals.includes(item)
                        ? 'bg-red-100 border-2 border-red-300 text-red-700 line-through'
                        : 'bg-gray-100 border-2 border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {removals.includes(item) ? '✗ ' : ''}{item}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Summary */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Base Price</span>
                <span>₹{customizeItem.price}</span>
              </div>
              {extras.length > 0 && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-600">Extras ({extras.length})</span>
                  <span>+₹{extras.length * 10}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t">
                <span>Total</span>
                <span className="text-emerald-600">₹{(customizeItem.price || 0) + extras.length * 10}</span>
              </div>
            </div>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={confirmCustomOrder}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Choose Delivery Slot
            </Button>
          </div>
        </div>
      )}

      {/* Bottom spacing for mobile nav */}
      <div className="h-4" />
    </div>
  );
}
