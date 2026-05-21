import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Clock, ShoppingCart, Plus } from 'lucide-react';

const MEAL_TYPE_CONFIG = {
  breakfast: { emoji: '🌅', label: 'Breakfast', color: 'bg-orange-50 border-orange-200', time: '7:00 AM - 10:00 AM' },
  lunch: { emoji: '🍛', label: 'Lunch', color: 'bg-green-50 border-green-200', time: '12:00 PM - 3:00 PM' },
  snacks: { emoji: '🍿', label: 'Snacks', color: 'bg-purple-50 border-purple-200', time: '4:00 PM - 6:00 PM' },
  dinner: { emoji: '🌙', label: 'Dinner', color: 'bg-blue-50 border-blue-200', time: '7:00 PM - 10:00 PM' }
};

export default function TodaysMenu({ onAddToCart }) {
  const [menu, setMenu] = useState({});
  const [loading, setLoading] = useState(true);
  const [dayName, setDayName] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTodaysMenu();
    
    // Refresh menu at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow - now;
    
    const midnightTimer = setTimeout(() => {
      fetchTodaysMenu();
      // Set up daily refresh
      setInterval(fetchTodaysMenu, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
    
    return () => clearTimeout(midnightTimer);
  }, []);

  async function fetchTodaysMenu() {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.rpc('get_todays_menu');
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        setError('No menu available for today. Please check back later!');
        setLoading(false);
        return;
      }
      
      // Group meals by meal type
      const grouped = data.reduce((acc, item) => {
        if (!acc[item.meal_type]) {
          acc[item.meal_type] = [];
        }
        acc[item.meal_type].push(item);
        return acc;
      }, {});
      
      setMenu(grouped);
      setDayName(data[0]?.day_name || '');
    } catch (err) {
      console.error('Error fetching menu:', err);
      setError('Failed to load menu. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleAddToCart(meal) {
    if (onAddToCart) {
      onAddToCart({
        id: meal.meal_id,
        name: meal.meal_name,
        price: meal.meal_price,
        image: meal.meal_image,
        description: meal.meal_description,
        calories: meal.meal_calories
      });
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800 text-lg">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="text-blue-600" size={32} />
          <h1 className="text-3xl font-bold text-gray-900">
            Today's Menu
          </h1>
        </div>
        <p className="text-gray-600 text-lg">
          {dayName} - Fresh meals prepared daily
        </p>
      </div>

      {/* Menu Sections */}
      <div className="space-y-8">
        {Object.entries(menu).map(([mealType, meals]) => {
          const config = MEAL_TYPE_CONFIG[mealType];
          if (!config) return null;

          return (
            <div key={mealType} className={`border-2 rounded-xl p-6 ${config.color}`}>
              {/* Meal Type Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-3xl">{config.emoji}</span>
                    {config.label}
                  </h2>
                  <div className="flex items-center gap-2 text-gray-600 mt-1">
                    <Clock size={16} />
                    <span className="text-sm">{config.time}</span>
                  </div>
                </div>
                <span className="px-4 py-2 bg-white rounded-full text-sm font-medium text-gray-700">
                  {meals.length} items
                </span>
              </div>

              {/* Meal Items */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {meals
                  .sort((a, b) => a.display_order - b.display_order)
                  .map(meal => (
                    <div
                      key={meal.meal_id}
                      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      {/* Meal Image */}
                      {meal.meal_image && (
                        <div className="relative h-48 overflow-hidden">
                          <img
                            src={meal.meal_image}
                            alt={meal.meal_name}
                            className="w-full h-full object-cover"
                          />
                          {meal.meal_calories && (
                            <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm">
                              {meal.meal_calories} kcal
                            </div>
                          )}
                        </div>
                      )}

                      {/* Meal Info */}
                      <div className="p-4">
                        <h3 className="font-bold text-lg text-gray-900 mb-2">
                          {meal.meal_name}
                        </h3>
                        
                        {meal.meal_description && (
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                            {meal.meal_description}
                          </p>
                        )}

                        {/* Price and Add to Cart */}
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold text-green-600">
                            ₹{meal.meal_price}
                          </span>
                          <button
                            onClick={() => handleAddToCart(meal)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Plus size={18} />
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {Object.keys(menu).length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            No meals available for today. Please check back later!
          </p>
        </div>
      )}

      {/* Info Banner */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 text-sm">
          💡 <strong>Tip:</strong> Our menu changes daily! Check back tomorrow for new delicious options.
        </p>
      </div>
    </div>
  );
}
