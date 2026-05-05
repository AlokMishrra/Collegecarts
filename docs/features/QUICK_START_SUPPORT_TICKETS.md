# Support Ticket System - Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### Step 1: Deploy Database Schema
```sql
-- Open Supabase Dashboard → SQL Editor
-- Copy and paste contents of: supabase/support_tickets_table.sql
-- Click "Run" to execute
```

### Step 2: Test Customer Flow
1. Open your app
2. Click the green chatbot icon (bottom right)
3. Type: "I need help"
4. Fill out the support form
5. Submit and note the ticket number

### Step 3: Test Admin Flow
1. Login as admin
2. Go to CCA (Admin Panel)
3. Click "Support Tickets" tab
4. View your test ticket
5. Update status and add a comment

## ✅ That's It!

Your support ticket system is now live and ready to use.

---

## 📋 Quick Reference

### Customer Keywords (Trigger Support Form):
- "I need help"
- "Contact support"
- "Create a ticket"
- "I want a callback"
- "Email support"
- "I have a complaint"
- "Madad chahiye"

### Admin Quick Actions:
- **Search**: Type ticket number or keywords
- **Filter**: Use dropdowns for status/category/priority
- **View**: Click any ticket to see details
- **Update**: Click status buttons to change ticket state
- **Respond**: Add comments in the comment section

### Ticket Statuses:
- **Open**: New ticket, not yet addressed
- **In Progress**: Currently working on it
- **Resolved**: Issue fixed, awaiting confirmation
- **Closed**: Ticket completed

### Priority Levels:
- **Low**: General questions
- **Medium**: Standard issues (24h response)
- **High**: Important issues
- **Urgent**: Critical issues (1h response)

### Categories:
- **Order**: Order-related issues
- **Product**: Product questions
- **Delivery**: Delivery problems
- **Payment**: Payment/refund issues
- **Loyalty**: Loyalty points queries
- **General**: Other questions

---

## 🎯 Common Use Cases

### Customer: "My order hasn't arrived"
1. Open chatbot
2. Type "I need help"
3. Select "Create Ticket"
4. Category: Delivery
5. Priority: High
6. Enter order ID
7. Describe issue
8. Submit

### Admin: Responding to Ticket
1. Go to Support Tickets tab
2. Filter by "Open" status
3. Click the ticket
4. Change status to "In Progress"
5. Add comment: "Checking with delivery team..."
6. Update customer when resolved
7. Change status to "Resolved"

---

## 🔧 Troubleshooting

### "Tickets not showing in admin panel"
- Check if database schema is deployed
- Verify admin permissions
- Refresh the page

### "Can't create ticket"
- Check internet connection
- Verify user is logged in
- Check browser console for errors

### "Ticket number not generated"
- Ensure database function is created
- Check Supabase logs
- Verify trigger is active

---

## 📞 Need Help?

Refer to detailed documentation:
- `docs/features/SUPPORT_TICKET_SYSTEM.md` - Technical docs
- `docs/features/SUPPORT_TICKET_USAGE_GUIDE.md` - User guide
- `SUPPORT_TICKET_IMPLEMENTATION_SUMMARY.md` - Implementation details

---

## 🎉 Features at a Glance

✅ Three contact methods (Ticket, Callback, Email)
✅ Bilingual support (English/Hinglish)
✅ Auto-generated ticket numbers
✅ Admin dashboard with statistics
✅ Search and filter functionality
✅ Comment/response system
✅ Status tracking
✅ Secure RLS policies

**Status**: Production Ready 🚀
**Last Updated**: May 5, 2026
