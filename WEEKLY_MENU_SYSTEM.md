# Weekly Menu Schedule System

## Overview
This system allows admins to set up a **weekly recurring menu** for meals. Once configured, the menu automatically shows to customers based on the current day of the week. **No daily updates needed** - the menu repeats every week automatically!

## Key Features

✅ **Day-wise Menu Planning** - Set different menus for Monday through Sunday  
✅ **Automatic Display** - Customers see today's menu automatically  
✅ **Set Once, Repeat Forever** - No need to update daily  
✅ **Meal Type Support** - Breakfast, Lunch, Snacks, Dinner  
✅ **Easy Management** - Copy menus between days, clear days, etc.  
✅ **Display Order Control** - Control the order meals appear in the menu  

## Database Setup

### 1. Run the SQL Migration
```bash
# Run this in Supabase SQL Editor
d:\project\Collegecart\collegecart-final\sql\create-weekly-menu-system.sql
```

### 2. Table Structure
```sql
weekly_menu_schedule
├── id (UUID)
├── day_of_week (1-7, where 1=Monday, 7=Sunday)
├── meal_type (breakfast, lunch, snacks, dinner)
├── meal_id (references meals table)
├── display_order (order of appearance)
├── is_active (boolean)
├── created_at
├── updated_at
└── created_by
```

## How It Works

### For Customers
1. Customer visits the meal ordering page
2. System automatically detects today's day of week (e.g., Tuesday = 2)
3. Shows meals scheduled for that day
4. Next day, automatically shows next day's menu
5. Repeats weekly - no admin intervention needed!

### For Admins
1. Admin sets up menu for each day of the week (one-time setup)
2. Can update anytime if menu changes
3. Can copy menus between days
4. Can view entire week's schedule

## Usage Examples

### 1. Schedule Monday Breakfast
```javascript
// In your admin panel
const { error } = await supabase.rpc('schedule_weekly_menu', {
  p_day_of_week: 1, // Monday
  p_meal_type: 'breakfast',
  p_meal_ids: [
    'uuid-of-poha',
    'uuid-of-dosa',
    'uuid-of-upma'
  ]
});
```

### 2. Get Today's Menu (For Customers)
```javascript
// Automatically shows today's menu based on current day
const { data, error } = await supabase.rpc('get_todays_menu');

// Returns meals for today with:
// - meal_type, meal_name, price, image, calories
// - display_order (order to show them)
// - day_name (e.g., "Monday")
```

### 3. Get Specific Day's Menu (For Admin Preview)
```javascript
// Preview Tuesday's menu
const { data, error } = await supabase.rpc('get_menu_for_day', {
  p_day_of_week: 2 // Tuesday
});
```

### 4. Get Full Week Menu (For Admin Dashboard)
```javascript
// See entire week's schedule
const { data, error } = await supabase.rpc('get_full_week_menu');

// Returns all meals for all days, grouped by day and meal type
```

### 5. Copy Menu from One Day to Another
```javascript
// Copy Monday's menu to Friday
const { error } = await supabase.rpc('copy_day_menu', {
  p_from_day: 1, // Monday
  p_to_day: 5    // Friday
});
```

### 6. Clear a Day's Menu
```javascript
// Clear all meals for Wednesday
const { error } = await supabase.rpc('clear_day_menu', {
  p_day_of_week: 3 // Wednesday
});
```

## Day of Week Reference

| Number | Day       |
|--------|-----------|
| 1      | Monday    |
| 2      | Tuesday   |
| 3      | Wednesday |
| 4      | Thursday  |
| 5      | Friday    |
| 6      | Saturday  |
| 7      | Sunday    |

## Meal Type Reference

- `breakfast` - Morning meals
- `lunch` - Afternoon meals
- `snacks` - Evening snacks
- `dinner` - Night meals

## Admin Workflow

### Initial Setup (One-time)
1. Go to Admin Panel → Weekly Menu Schedule
2. Select day (Monday-Sunday)
3. Select meal type (Breakfast, Lunch, Snacks, Dinner)
4. Choose meals from available meals list
5. Arrange order (drag & drop or set display_order)
6. Click "Save"
7. Repeat for all days and meal types

### Updating Menu
1. Select the day and meal type to update
2. Add/remove meals as needed
3. Save changes
4. Changes apply immediately for that day going forward

### Quick Actions
- **Copy Day**: Duplicate one day's menu to another day
- **Clear Day**: Remove all meals for a specific day
- **Preview**: See what customers will see on any day

## Customer Experience

### What Customers See
```
Today's Menu - Monday

🌅 Breakfast
- Poha with Peanuts (300 kcal) - ₹41
- Masala Dosa (450 kcal) - ₹50
- Veg Pulao (500 kcal) - ₹45

🍛 Lunch
- Dal Tadka + Rice (550 kcal) - ₹60
- Chole Bhature (650 kcal) - ₹70

🍿 Snacks
- Samosa + Chai (250 kcal) - ₹25

🌙 Dinner
- Paneer Butter Masala (600 kcal) - ₹80
- Rajma Chawal (580 kcal) - ₹55
```

### Automatic Updates
- **12:00 AM**: Menu automatically switches to next day
- **No manual intervention needed**
- **Repeats weekly** - Monday's menu shows every Monday

## Integration with Existing System

### Frontend Integration
```javascript
// In your meal ordering page component
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function TodaysMenu() {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodaysMenu();
  }, []);

  async function fetchTodaysMenu() {
    const { data, error } = await supabase.rpc('get_todays_menu');
    
    if (error) {
      console.error('Error fetching menu:', error);
      return;
    }
    
    // Group by meal type
    const grouped = data.reduce((acc, item) => {
      if (!acc[item.meal_type]) acc[item.meal_type] = [];
      acc[item.meal_type].push(item);
      return acc;
    }, {});
    
    setMenu(grouped);
    setLoading(false);
  }

  if (loading) return <div>Loading today's menu...</div>;

  return (
    <div>
      <h1>Today's Menu - {menu[0]?.day_name}</h1>
      
      {Object.entries(menu).map(([mealType, meals]) => (
        <div key={mealType}>
          <h2>{mealType.charAt(0).toUpperCase() + mealType.slice(1)}</h2>
          {meals.map(meal => (
            <div key={meal.meal_id}>
              <img src={meal.meal_image} alt={meal.meal_name} />
              <h3>{meal.meal_name}</h3>
              <p>{meal.meal_description}</p>
              <p>{meal.meal_calories} kcal • ₹{meal.meal_price}</p>
              <button>Add to Cart</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

### Admin Panel Integration
```javascript
// In your admin panel
function WeeklyMenuScheduler() {
  const [selectedDay, setSelectedDay] = useState(1); // Monday
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const [availableMeals, setAvailableMeals] = useState([]);
  const [selectedMeals, setSelectedMeals] = useState([]);

  async function saveMenu() {
    const { error } = await supabase.rpc('schedule_weekly_menu', {
      p_day_of_week: selectedDay,
      p_meal_type: selectedMealType,
      p_meal_ids: selectedMeals.map(m => m.id)
    });

    if (error) {
      alert('Error saving menu: ' + error.message);
    } else {
      alert('Menu saved successfully!');
    }
  }

  return (
    <div>
      <h1>Weekly Menu Schedule</h1>
      
      <select value={selectedDay} onChange={e => setSelectedDay(Number(e.target.value))}>
        <option value={1}>Monday</option>
        <option value={2}>Tuesday</option>
        <option value={3}>Wednesday</option>
        <option value={4}>Thursday</option>
        <option value={5}>Friday</option>
        <option value={6}>Saturday</option>
        <option value={7}>Sunday</option>
      </select>

      <select value={selectedMealType} onChange={e => setSelectedMealType(e.target.value)}>
        <option value="breakfast">Breakfast</option>
        <option value="lunch">Lunch</option>
        <option value="snacks">Snacks</option>
        <option value="dinner">Dinner</option>
      </select>

      {/* Meal selection UI */}
      <div>
        {availableMeals.map(meal => (
          <div key={meal.id}>
            <input
              type="checkbox"
              checked={selectedMeals.includes(meal)}
              onChange={e => {
                if (e.target.checked) {
                  setSelectedMeals([...selectedMeals, meal]);
                } else {
                  setSelectedMeals(selectedMeals.filter(m => m.id !== meal.id));
                }
              }}
            />
            <label>{meal.name} - ₹{meal.price}</label>
          </div>
        ))}
      </div>

      <button onClick={saveMenu}>Save Menu</button>
    </div>
  );
}
```

## Benefits

### For Business
- ✅ **Reduced Admin Work** - Set once, runs automatically
- ✅ **Consistent Experience** - Customers know what to expect each day
- ✅ **Easy Planning** - Plan entire week in advance
- ✅ **Flexible Updates** - Change anytime without affecting other days

### For Customers
- ✅ **Always Current** - See today's menu automatically
- ✅ **Predictable** - Know what's available each day
- ✅ **No Confusion** - Clear, organized menu display

## Troubleshooting

### Menu Not Showing
1. Check if meals are scheduled for today's day_of_week
2. Verify meals have `is_active = true`
3. Check if meals exist in meals table with `is_available = true`

### Wrong Day Showing
1. Verify server timezone is correct
2. Check `EXTRACT(ISODOW FROM CURRENT_DATE)` returns correct day (1-7)

### Meals Not Ordered Correctly
1. Check `display_order` values in weekly_menu_schedule table
2. Lower numbers appear first

## Advanced Features

### Seasonal Menus
You can create multiple menu schedules and activate/deactivate them:
```sql
-- Deactivate current menu
UPDATE weekly_menu_schedule SET is_active = false;

-- Activate summer menu
UPDATE weekly_menu_schedule SET is_active = true WHERE created_at > '2024-06-01';
```

### Special Day Overrides
Combine with daily_menu table for special occasions:
```sql
-- Check daily_menu first, fall back to weekly_menu_schedule
-- This allows special menus for holidays while keeping weekly schedule
```

## Migration from Daily Menu

If you're currently using the daily menu system:

1. **Keep Both Systems** - Use daily for special days, weekly for regular days
2. **Priority Logic** - Check daily_menu first, if empty use weekly_menu_schedule
3. **Gradual Migration** - Set up weekly menu, test, then switch over

## Support

For issues or questions:
1. Check this documentation
2. Verify SQL functions are created correctly
3. Check Supabase logs for errors
4. Test with sample data first

---

**Last Updated**: May 21, 2026  
**Version**: 1.0  
**Status**: Production Ready ✅
