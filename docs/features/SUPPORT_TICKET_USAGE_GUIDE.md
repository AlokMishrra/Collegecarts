# Support Ticket System - Usage Guide

## For Customers

### How to Contact Support

#### Method 1: Using Quick Action Button
1. Open the AI chatbot (green bot icon in bottom right)
2. Click the **"Contact Us"** quick action button
3. Choose your preferred contact method:
   - 🎫 **Create Ticket** - For detailed issues
   - 📞 **Request Callback** - Get a call from support
   - 📧 **Email Support** - Email-based support

#### Method 2: Type Your Request
Simply type any of these phrases in the chatbot:
- "I need help"
- "Contact support"
- "Create a ticket"
- "I want a callback"
- "Email support"
- "I have a complaint"
- "There's an issue"
- "Madad chahiye" (Hinglish)

### Creating a Support Ticket

**Step 1: Choose Contact Method**
- Click on one of the three options (Ticket/Callback/Email)

**Step 2: Fill Out the Form**

For **Support Ticket**:
- **Subject**: Brief description of your issue
- **Category**: Select from dropdown (Order, Product, Delivery, Payment, Loyalty, General)
- **Priority**: How urgent is it? (Low, Medium, High, Urgent)
- **Order ID** (optional): If related to a specific order
- **Description**: Explain your issue in detail

For **Callback Request**:
- **Subject**: What you need help with
- **Phone Number**: Your contact number
- **Category**: Type of issue
- **Description**: Brief message about your issue

For **Email Support**:
- **Subject**: Issue summary
- **Email**: Your email address
- **Category**: Type of issue
- **Description**: Detailed message

**Step 3: Submit**
- Click "Submit Request" button
- You'll receive a unique ticket number (e.g., TICKET-20260505-0001)
- Save this number for reference

**Step 4: Wait for Response**
- Support team will review your ticket
- You'll be contacted via your preferred method
- Check back for updates

### Ticket Categories Explained

- **Order**: Issues with placing, tracking, or canceling orders
- **Product**: Questions about products, stock, or quality issues
- **Delivery**: Delivery delays, wrong address, or delivery person issues
- **Payment**: Payment failures, refunds, or billing questions
- **Loyalty**: Loyalty points, redemption, or tier-related queries
- **General**: Any other questions or feedback

### Priority Levels

- **Low**: General questions, no urgency
- **Medium**: Standard issues, response within 24 hours
- **High**: Important issues affecting your order
- **Urgent**: Critical issues requiring immediate attention

---

## For Admins

### Accessing Support Tickets

1. Login to admin panel (CCA page)
2. Navigate to **"Support Tickets"** tab
3. View dashboard with ticket statistics

### Dashboard Overview

**Statistics Cards:**
- **Total Tickets**: All tickets ever created
- **Open**: New tickets awaiting response
- **In Progress**: Tickets being worked on
- **Resolved**: Completed tickets

### Managing Tickets

#### Filtering Tickets
Use the filter bar to find specific tickets:
- **Search**: Type ticket number, subject, or keywords
- **Status Filter**: Open, In Progress, Resolved, Closed
- **Category Filter**: Order, Product, Delivery, Payment, Loyalty, General
- **Priority Filter**: Low, Medium, High, Urgent

#### Viewing Ticket Details
1. Click on any ticket in the list
2. Dialog opens with full ticket information:
   - Ticket number and status
   - Customer information
   - Subject and description
   - Category and priority
   - Related order (if applicable)
   - Creation date
   - All comments/responses

#### Updating Ticket Status
In the ticket detail dialog:
1. Find the "Update Status" section
2. Click the appropriate status button:
   - **Open**: New ticket, not yet addressed
   - **In Progress**: Currently working on it
   - **Resolved**: Issue fixed, awaiting confirmation
   - **Closed**: Ticket completed and closed

Status automatically updates with timestamp.

#### Adding Comments/Responses
1. Open ticket detail dialog
2. Scroll to "Add Comment" section
3. Type your response in the text area
4. Click "Send Comment"
5. Comment appears in the conversation history
6. Customer can see your response

### Best Practices for Admins

#### Response Time Guidelines
- **Urgent**: Respond within 1 hour
- **High**: Respond within 4 hours
- **Medium**: Respond within 24 hours
- **Low**: Respond within 48 hours

#### Ticket Workflow
1. **New Ticket Arrives** → Status: Open
2. **Start Working** → Change to: In Progress
3. **Issue Resolved** → Change to: Resolved
4. **Customer Confirms** → Change to: Closed

#### Communication Tips
- Be polite and professional
- Acknowledge the issue
- Provide clear solutions
- Ask for confirmation
- Thank the customer

#### Using Comments Effectively
- **First Response**: Acknowledge receipt, ask for details if needed
- **Updates**: Keep customer informed of progress
- **Resolution**: Explain what was done to fix the issue
- **Follow-up**: Ask if issue is resolved to their satisfaction

### Common Scenarios

#### Scenario 1: Order Not Delivered
1. Open ticket, change status to "In Progress"
2. Check order details and delivery status
3. Contact delivery person if needed
4. Add comment: "Checking with delivery team, will update shortly"
5. Once resolved, add comment with resolution
6. Change status to "Resolved"
7. Wait for customer confirmation, then "Closed"

#### Scenario 2: Payment Issue
1. Review payment details in ticket
2. Check payment gateway logs
3. Add comment explaining the issue
4. Process refund if needed
5. Confirm with customer
6. Close ticket

#### Scenario 3: Product Quality Complaint
1. Review product and order details
2. Request photos if needed (via comment)
3. Offer replacement or refund
4. Process the resolution
5. Add comment with tracking info
6. Mark as resolved

### Keyboard Shortcuts (Future Enhancement)
- `Ctrl + F`: Focus search
- `Ctrl + O`: Filter by Open
- `Ctrl + P`: Filter by In Progress
- `Ctrl + R`: Filter by Resolved

### Reporting & Analytics (Future Enhancement)
- Average response time
- Resolution rate
- Customer satisfaction scores
- Most common issues
- Peak support hours

---

## Troubleshooting

### For Customers

**Q: I didn't receive a ticket number**
- Check your internet connection
- Try submitting again
- Contact support via phone if issue persists

**Q: How do I check my ticket status?**
- Currently, wait for admin response
- Future: Customer portal to track tickets

**Q: Can I update my ticket?**
- Currently, create a new ticket referencing the old one
- Future: Ability to add comments to your own tickets

### For Admins

**Q: Tickets not loading**
- Check internet connection
- Refresh the page
- Check Supabase connection

**Q: Can't update ticket status**
- Verify admin permissions
- Check RLS policies in Supabase
- Ensure you're logged in as admin

**Q: Comments not saving**
- Check network connection
- Verify user authentication
- Check browser console for errors

---

## Contact Information

**For Technical Issues:**
- Email: tech@collegecart.com
- Phone: +91-XXXXXXXXXX

**For Support System Questions:**
- Contact development team
- Refer to technical documentation

---

## Version History

- **v1.0** (May 5, 2026): Initial release
  - Support ticket creation
  - Callback requests
  - Email support
  - Admin management panel
  - Bilingual support (English/Hinglish)
