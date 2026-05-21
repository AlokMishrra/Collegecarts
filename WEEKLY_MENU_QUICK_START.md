# Weekly Menu System - Quick Start Guide

## 🚀 Setup in 5 Minutes

### Step 1: Run SQL Migration (2 minutes)
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the entire content from:
   ```
   d:\project\Collegecart\collegecart-final\sql\create-weekly-menu-system.sql
   ```
4. Click "Run"
5. ✅ Database setup complete!

### Step 2: Add Admin Component (1 minute)
1. The admin component is already created at:
   ```
   src/components/admin/WeeklyMenuScheduler.jsx
   ```
2. Import it in your admin dashboard:
   ```javascript
   import WeeklyMenuScheduler from '../components/admin/WeeklyMenuScheduler';
   
   // In your admin routes
   <Route path="/admin/weekly-menu" element={<WeeklyMenuScheduler />} />
   ```

### Step 3: Add Customer Component (1 minute)
1. The customer component is already created at:
   ```
   src/components/customer/TodaysMenu.jsx
   ```
2. Import it in your customer pages:
   ```javascript
   import TodaysMenu from '../components/customer/TodaysMenu';
   
   // In your meal ordering page
   <TodaysMenu onAddToCart={handleAddToCart} />
   ```

### Step 4: Schedule Your First Menu (1 minute)
1. Go to Admin Panel → Weekly Menu Schedule
2. Select "Monday" and "Breakfast"
3. Check the meals you want for Monday breakfast
4. Click "Save Menu"
5. Repeat for other days and meal types
6. ✅ Done! Menu will automatically show to customers!

---

## 📋 How It Works

### For Admin:
1. **One-time Setup**: Set menu for each day of the week
2. **Automatic Rotation**: Menu repeats weekly
3. **Easy Updates**: Change anytime without affecting other days
4. **Copy Feature**: Duplicate menus between days

### For Customers:
1. **Always Current**: See today's menu automatically
2. **No Confusion**: Clear, organized by meal type
3. **Fresh Daily**: Menu changes every day automatically

---

## 🎯 Example Workflow

### Monday Setup:
```javascript
// Admin selects Monday + Breakfast
// Checks: Poha, Dosa, Upma
// Clicks Save

// Admin selects Monday + Lunch  
// Checks: Dal Tadka, Chole Bhature
// Clicks Save

// Admin selects Monday + Snacks
// Checks: Samosa, Chai
// Clicks Save

// Admin selects Monday + Dinner
// Checks: Paneer Masala, Rajma Chawal
// Clicks Save
```

### Customer Experience:
```
Monday (Today):
🌅 Breakfast: Poha, Dosa, Upma
🍛 Lunch: Dal Tadka, Chole Bhature
🍿 Snacks: Samosa, Chai
🌙 Dinner: Paneer Masala, Rajma Chawal

Tuesday (Tomorrow):
[Shows Tuesday's menu automatically]
```

---

## 🔧 API Reference

### Get Today's Menu (Customer)
```javascript
const { data, error } = await supabase.rpc('get_todays_menu');
// Returns meals for current day automatically
```

### Schedule Menu (Admin)
```javascript
const { error } = await supabase.rpc('schedule_weekly_menu', {
  p_day_of_week: 1, // 1=Monday, 7=Sunday
  p_meal_type: 'breakfast',
  p_meal_ids: ['uuid1', 'uuid2', 'uuid3']
});
```

### Get Full Week (Admin)
```javascript
const { data, error } = await supabase.rpc('get_full_week_menu');
// Returns entire week's schedule
```

### Copy Day Menu (Admin)
```javascript
const { error } = await supabase.rpc('copy_day_menu', {
  p_from_day: 1, // Monday
  p_to_day: 5    // Friday
});
```

---

## 📊 Day Numbers Reference

| Number | Day       |
|--------|-----------|
| 1      | Monday    |
| 2      | Tuesday   |
| 3      | Wednesday |
| 4      | Thursday  |
| 5      | Friday    |
| 6      | Saturday  |
| 7      | Sunday    |

---

## ✅ Benefits

### Saves Time
- ⏰ Set once, runs forever
- 🔄 No daily updates needed
- 📅 Plan entire week in advance

### Better Experience
- 🎯 Customers always see current menu
- 📱 Automatic updates at midnight
- 🍽️ Organized by meal type

### Easy Management
- 📝 Simple admin interface
- 📋 Copy menus between days
- 👁️ Preview full week schedule

---

## 🆘 Troubleshooting

### Menu Not Showing?
1. Check if meals are scheduled for today
2. Verify meals have `is_available = true`
3. Check browser console for errors

### Wrong Day Showing?
1. Verify server timezone
2. Check system date/time

### Can't Save Menu?
1. Ensure you're logged in as admin
2. Check meal IDs are valid
3. Verify day_of_week is 1-7

---

## 📞 Support

For detailed documentation, see:
- `WEEKLY_MENU_SYSTEM.md` - Full documentation
- `sql/create-weekly-menu-system.sql` - Database schema
- `src/components/admin/WeeklyMenuScheduler.jsx` - Admin component
- `src/components/customer/TodaysMenu.jsx` - Customer component

---

**Status**: ✅ Production Ready  
**Last Updated**: May 21, 2026  
**Version**: 1.0
