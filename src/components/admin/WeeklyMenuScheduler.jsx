import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Clock, Save, Copy, Trash2, Eye } from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday', emoji: '📅' },
  { value: 2, label: 'Tuesday', emoji: '📅' },
  { value: 3, label: 'Wednesday', emoji: '📅' },
  { value: 4, label: 'Thursday', emoji: '📅' },
  { value: 5, label: 'Friday', emoji: '📅' },
  { value: 6, label: 'Saturday', emoji: '📅' },
  { value: 7, label: 'Sunday', emoji: '📅' }
];

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🌅', color: 'bg-orange-100 text-orange-800' },
  { value: 'lunch', label: 'Lunch', emoji: '🍛', color: 'bg-green-100 text-green-800' },
  { value: 'snacks', label: 'Snacks', emoji: '🍿', color: 'bg-purple-100 text-purple-800' },
  { value: 'dinner', label: 'Dinner', emoji: '🌙', color: 'bg-blue-100 text-blue-800' }
];

export default function WeeklyMenuScheduler() {
  const [selectedDay, setSelectedDay] = useState(1); // Monday
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const [availableMeals, setAvailableMeals] = useState([]);
  const [selectedMeals, setSelectedMeals] = useState([]);
  const [currentSchedule, setCurrentSchedule] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weekView, setWeekView] = useState(null);
  const [showWeekView, setShowWeekView] = useState(false);

  useEffect(() => {
    fetchAvailableMeals();
    fetchCurrentSchedule();
  }, [selectedDay, selectedMealType]);

  useEffect(() => {
    if (showWeekView) {
      fetchWeekView();
    }
  }, [showWeekView]);

  // Fetch all available meals
  async function fetchAvailableMeals() {
    setLoading(true);
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('is_available', true)
      .order('name');

    if (error) {
      console.error('Error fetching meals:', error);
    } else {
      setAvailableMeals(data || []);
    }
    setLoading(false);
  }

  // Fetch current schedule for selected day and meal type
  async function fetchCurrentSchedule() {
    const { data, error } = await supabase
      .from('weekly_menu_schedule')
      .select(`
        *,
        meals (*)
      `)
      .eq('day_of_week', selectedDay)
      .eq('meal_type', selectedMealType)
      .eq('is_active', true)
      .order('display_order');

    if (error) {
      console.error('Error fetching schedule:', error);
    } else {
      setCurrentSchedule(data || []);
      // Pre-select meals that are already scheduled
      const scheduledMealIds = data?.map(item => item.meal_id) || [];
      setSelectedMeals(scheduledMealIds);
    }
  }

  // Fetch full week view
  async function fetchWeekView() {
    const { data, error } = await supabase.rpc('get_full_week_menu');
    
    if (error) {
      console.error('Error fetching week view:', error);
    } else {
      setWeekView(data);
    }
  }

  // Save menu schedule
  async function saveMenu() {
    if (selectedMeals.length === 0) {
      alert('Please select at least one meal');
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc('schedule_weekly_menu', {
      p_day_of_week: selectedDay,
      p_meal_type: selectedMealType,
      p_meal_ids: selectedMeals
    });

    if (error) {
      alert('Error saving menu: ' + error.message);
      console.error(error);
    } else {
      alert('Menu saved successfully! ✅');
      fetchCurrentSchedule();
    }
    setSaving(false);
  }

  // Toggle meal selection
  function toggleMeal(mealId) {
    if (selectedMeals.includes(mealId)) {
      setSelectedMeals(selectedMeals.filter(id => id !== mealId));
    } else {
      setSelectedMeals([...selectedMeals, mealId]);
    }
  }

  // Copy menu from another day
  async function copyFromDay(fromDay) {
    if (window.confirm(`Copy menu from ${DAYS_OF_WEEK[fromDay - 1].label} to ${DAYS_OF_WEEK[selectedDay - 1].label}?`)) {
      const { error } = await supabase.rpc('copy_day_menu', {
        p_from_day: fromDay,
        p_to_day: selectedDay
      });

      if (error) {
        alert('Error copying menu: ' + error.message);
      } else {
        alert('Menu copied successfully!');
        fetchCurrentSchedule();
      }
    }
  }

  // Clear current day's menu
  async function clearDayMenu() {
    if (window.confirm(`Clear all meals for ${DAYS_OF_WEEK[selectedDay - 1].label}?`)) {
      const { error } = await supabase.rpc('clear_day_menu', {
        p_day_of_week: selectedDay
      });

      if (error) {
        alert('Error clearing menu: ' + error.message);
      } else {
        alert('Menu cleared successfully!');
        fetchCurrentSchedule();
        setSelectedMeals([]);
      }
    }
  }

  const currentMealType = MEAL_TYPES.find(mt => mt.value === selectedMealType);

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          📅 Weekly Menu Schedule
        </h1>
        <p className="text-gray-600">
          Set up your weekly menu once - it will automatically show to customers based on the day of the week. No daily updates needed!
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Day Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Day
            </label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {DAYS_OF_WEEK.map(day => (
                <option key={day.value} value={day.value}>
                  {day.emoji} {day.label}
                </option>
              ))}
            </select>
          </div>

          {/* Meal Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Meal Type
            </label>
            <select
              value={selectedMealType}
              onChange={(e) => setSelectedMealType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {MEAL_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.emoji} {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={saveMenu}
            disabled={saving || selectedMeals.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Menu'}
          </button>

          <button
            onClick={() => setShowWeekView(!showWeekView)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Eye size={18} />
            {showWeekView ? 'Hide' : 'View'} Full Week
          </button>

          <button
            onClick={clearDayMenu}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Trash2 size={18} />
            Clear Day
          </button>
        </div>
      </div>

      {/* Current Schedule Info */}
      {currentSchedule.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            Currently Scheduled ({currentSchedule.length} items)
          </h3>
          <div className="flex flex-wrap gap-2">
            {currentSchedule.map(item => (
              <span key={item.id} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                {item.meals?.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Meal Selection */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {currentMealType?.emoji} Select Meals for {DAYS_OF_WEEK[selectedDay - 1].label} {currentMealType?.label}
          </h2>
          <span className="text-sm text-gray-600">
            {selectedMeals.length} selected
          </span>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading meals...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableMeals.map(meal => (
              <div
                key={meal.id}
                onClick={() => toggleMeal(meal.id)}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  selectedMeals.includes(meal.id)
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedMeals.includes(meal.id)}
                    onChange={() => toggleMeal(meal.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    {meal.image_url && (
                      <img
                        src={meal.image_url}
                        alt={meal.name}
                        className="w-full h-32 object-cover rounded-lg mb-2"
                      />
                    )}
                    <h3 className="font-semibold text-gray-900">{meal.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{meal.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-lg font-bold text-green-600">₹{meal.price}</span>
                      {meal.calories && (
                        <span className="text-sm text-gray-500">{meal.calories} kcal</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Week View */}
      {showWeekView && weekView && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📊 Full Week Schedule
          </h2>
          <div className="space-y-6">
            {DAYS_OF_WEEK.map(day => {
              const dayMeals = weekView.filter(item => item.day_of_week === day.value);
              
              return (
                <div key={day.value} className="border-b pb-4">
                  <h3 className="font-semibold text-lg text-gray-900 mb-3">
                    {day.emoji} {day.label}
                  </h3>
                  
                  {MEAL_TYPES.map(mealType => {
                    const meals = dayMeals.filter(item => item.meal_type === mealType.value);
                    
                    if (meals.length === 0) return null;
                    
                    return (
                      <div key={mealType.value} className="mb-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${mealType.color} mb-2`}>
                          {mealType.emoji} {mealType.label}
                        </span>
                        <div className="flex flex-wrap gap-2 ml-4">
                          {meals.map(meal => (
                            <span key={meal.meal_id} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                              {meal.meal_name} - ₹{meal.meal_price}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {dayMeals.length === 0 && (
                    <p className="text-gray-400 italic ml-4">No meals scheduled</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
