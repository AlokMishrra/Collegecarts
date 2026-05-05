import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, X, Send, Loader2, Bot, User as UserIcon, AlertCircle, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function CustomerSupportChatbot({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketData, setTicketData] = useState({
    subject: "",
    description: "",
    category: "general",
    priority: "medium"
  });
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: Date.now(),
        role: "assistant",
        content: `Hello${user?.full_name ? ` ${user.full_name}` : ''}! 👋 I'm your CollegeCart AI assistant. I can help you with:

• Orders - Track orders, check status, modify orders
• Products - Stock availability, product info, recommendations
• Loyalty & Rewards - Points balance, tier benefits, redeem rewards
• Delivery - Delivery times, tracking, hostel availability
• Payments - Payment issues, refunds, transaction status
• General - Account, policies, and other queries

How can I assist you today?`,
        showQuickActions: true
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getContextForAI = async () => {
    const context = {
      user_info: user ? {
        name: user.full_name,
        email: user.email,
        phone: user.phone_number,
        hostel: user.selected_hostel,
        tier: user.loyalty_tier || "Bronze",
        user_id: user.id
      } : null
    };

    if (user) {
      try {
        // Get user orders
        const orders = await base44.entities.Order.filter({ user_id: user.id }, '-created_date', 10);
        context.recent_orders = orders.map(o => ({
          order_number: o.order_number,
          status: o.status,
          total: o.total_amount,
          date: o.created_date,
          delivery_status: o.delivery_status
        }));

        // Get loyalty points
        const loyaltyTxns = await base44.entities.LoyaltyTransaction.filter({ user_id: user.id });
        const points = loyaltyTxns.reduce((sum, t) => sum + t.points, 0);
        context.loyalty_points = points;
        context.loyalty_tier = user.loyalty_tier || "Bronze";

        // Get active campaigns
        const campaigns = await base44.entities.Campaign.filter({ is_active: true });
        context.active_campaigns = campaigns.map(c => ({
          name: c.name,
          code: c.code,
          discount: c.discount_type === 'percentage' ? `${c.discount_value}%` : `₹${c.discount_value}`,
          min_order: c.min_order_value
        }));

        // Get cart items
        const cartItems = await base44.entities.CartItem.filter({ user_id: user.id });
        context.cart_items_count = cartItems.length;

        // Get recent support tickets
        try {
          const tickets = await base44.entities.SupportTicket.filter({ user_id: user.id }, '-created_date', 5);
          context.recent_tickets = tickets.map(t => ({
            ticket_number: t.ticket_number,
            subject: t.subject,
            status: t.status,
            category: t.category
          }));
        } catch (e) {
          // SupportTicket entity might not exist yet
          context.recent_tickets = [];
        }
      } catch (error) {
        console.error("Error fetching context:", error);
      }
    }

    // Get product stock info
    try {
      const products = await base44.entities.Product.filter({ is_available: true }, '-created_date', 20);
      context.available_products = products.map(p => ({
        name: p.name,
        price: p.price,
        stock: p.stock_quantity,
        category: p.category_id,
        hostel_stock: p.hostel_stock
      }));
    } catch (error) {
      console.error("Error fetching products:", error);
    }

    return context;
  };

  const handleQuickAction = (action) => {
    const quickMessages = {
      track_order: "I want to track my recent order",
      check_stock: "Check product stock availability",
      loyalty_points: "What's my loyalty points balance?",
      delivery_info: "When will my order be delivered?",
      create_ticket: "I need help with an issue"
    };

    if (action === 'create_ticket') {
      setShowTicketForm(true);
    } else {
      setInputMessage(quickMessages[action]);
      setTimeout(() => handleSendMessage(quickMessages[action]), 100);
    }
  };

  const handleSendMessage = async (messageText = null) => {
    const textToSend = messageText || inputMessage.trim();
    if (!textToSend) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: textToSend
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    try {
      const context = await getContextForAI();
      
      // Generate response using rule-based system (no API needed)
      const response = generateResponse(textToSend.toLowerCase(), context);

      const botMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: response,
        showTicketOption: response.toLowerCase().includes('support ticket') || response.toLowerCase().includes('create a ticket')
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Error getting response:", error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        content: "I'm sorry, I'm having trouble responding right now. Please try again or create a support ticket for assistance.",
        showTicketOption: true
      }]);
    }

    setIsTyping(false);
  };

  // Rule-based response generator (no API needed)
  const generateResponse = (query, context) => {
    const userName = context.user_info?.name || 'there';
    
    // Order tracking queries
    if (query.includes('track') || query.includes('order status') || query.includes('where is my order')) {
      if (context.recent_orders && context.recent_orders.length > 0) {
        const latestOrder = context.recent_orders[0];
        return `Hi ${userName}! 📦

Your latest order details:
• Order Number: ${latestOrder.order_number}
• Status: ${latestOrder.status.toUpperCase()}
• Amount: ₹${latestOrder.total}
• Date: ${new Date(latestOrder.date).toLocaleDateString()}

${latestOrder.status === 'pending' ? 'Your order is being prepared and will be delivered soon!' : ''}
${latestOrder.status === 'confirmed' ? 'Your order is confirmed and will be delivered within 40 minutes!' : ''}
${latestOrder.status === 'delivered' ? 'Your order has been delivered. Enjoy your items!' : ''}

Need help with something else?`;
      } else {
        return `Hi ${userName}! I don't see any recent orders in your account. 

You can:
• Browse products and place a new order
• Check your order history in the Orders page

Would you like help with anything else?`;
      }
    }

    // Stock availability queries
    if (query.includes('stock') || query.includes('available') || query.includes('in stock')) {
      const hostel = context.user_info?.hostel || 'your hostel';
      return `Hi ${userName}! 🛍️

To check product availability:
• All products show real-time stock for ${hostel}
• Products marked "OUT OF STOCK" are temporarily unavailable
• We restock daily, usually by morning

Popular items currently in stock:
${context.available_products?.slice(0, 3).map(p => `• ${p.name} - ₹${p.price} (${p.stock} available)`).join('\n') || '• Check the Shop page for current stock'}

Need to check a specific product? Let me know!`;
    }

    // Loyalty points queries
    if (query.includes('points') || query.includes('loyalty') || query.includes('rewards')) {
      const points = context.loyalty_points || 0;
      const tier = context.loyalty_tier || 'Bronze';
      return `Hi ${userName}! 🎁

Your Loyalty Status:
• Current Points: ${points} points
• Tier: ${tier}
• Points Value: ₹${(points * 0.1).toFixed(2)}

How to earn more points:
• Place orders (1 point per ₹10 spent)
• Refer friends (50 points per referral)
• Complete your profile (10 points)

Redeem your points:
• 100 points = ₹10 discount
• 500 points = ₹50 discount
• 1000 points = ₹100 discount

Want to redeem your points on your next order?`;
    }

    // Delivery queries
    if (query.includes('delivery') || query.includes('deliver') || query.includes('time') || query.includes('when')) {
      const hostel = context.user_info?.hostel || 'your hostel';
      return `Hi ${userName}! 🚚

Delivery Information for ${hostel}:
• Standard Delivery: 30-40 minutes
• Express Delivery: 15-20 minutes (₹20 extra)
• Free delivery on orders above ₹199

Delivery Hours:
• Monday-Friday: 8:00 AM - 11:00 PM
• Saturday-Sunday: 9:00 AM - 11:00 PM

Your order will be delivered right to your hostel room!

Need to place an order?`;
    }

    // Payment queries
    if (query.includes('payment') || query.includes('pay') || query.includes('refund') || query.includes('transaction')) {
      return `Hi ${userName}! 💳

Payment Options:
• Cash on Delivery (COD)
• Online Payment (UPI, Cards, Wallets)
• Cashfree Payment Gateway

Refund Policy:
• Refunds processed within 5-7 business days
• COD orders: Refund to original payment method
• Online orders: Refund to source account

Having a payment issue? I can help you create a support ticket for quick resolution.

Would you like to create a ticket?`;
    }

    // Campaign/discount queries
    if (query.includes('discount') || query.includes('offer') || query.includes('coupon') || query.includes('promo')) {
      if (context.active_campaigns && context.active_campaigns.length > 0) {
        return `Hi ${userName}! 🎉

Active Offers:
${context.active_campaigns.map(c => `• ${c.name}\n  Code: ${c.code}\n  Discount: ${c.discount}\n  Min Order: ₹${c.min_order || 0}`).join('\n\n')}

Apply these codes at checkout to save money!

Want to place an order now?`;
      } else {
        return `Hi ${userName}! 🎉

No active campaigns right now, but we frequently run offers!

Ways to save:
• Free delivery on orders above ₹199
• Use loyalty points for discounts
• Refer friends to earn rewards

Check back soon for new offers!`;
      }
    }

    // Account queries
    if (query.includes('account') || query.includes('profile') || query.includes('password') || query.includes('email')) {
      return `Hi ${userName}! 👤

Account Information:
• Email: ${context.user_info?.email || 'Not available'}
• Hostel: ${context.user_info?.hostel || 'Not set'}
• Loyalty Tier: ${context.user_info?.tier || 'Bronze'}

To update your account:
• Go to Profile page
• Click Edit Profile
• Update your details

Need help with account issues? I can create a support ticket for you.`;
    }

    // Cart queries
    if (query.includes('cart') || query.includes('checkout')) {
      const cartCount = context.cart_items_count || 0;
      return `Hi ${userName}! 🛒

Your Cart Status:
• Items in cart: ${cartCount}

${cartCount > 0 ? `Ready to checkout? Go to Cart page to complete your order!

Checkout Tips:
• Check for available discount codes
• Choose delivery time slot
• Select payment method (COD or Online)` : `Your cart is empty. Browse our products and add items to cart!

Popular Categories:
• Snacks & Beverages
• Groceries & Staples
• Personal Care
• Stationery`}

Need help finding something?`;
    }

    // Greeting
    if (query.includes('hello') || query.includes('hi') || query.includes('hey')) {
      return `Hello ${userName}! 👋

I'm here to help you with:
• Order tracking and status
• Product stock availability
• Loyalty points and rewards
• Delivery information
• Payment and refunds
• Account management

What would you like to know?`;
    }

    // Thank you
    if (query.includes('thank') || query.includes('thanks')) {
      return `You're welcome, ${userName}! 😊

Happy to help! If you need anything else, just ask.

Have a great day! 🎉`;
    }

    // Default response for unrecognized queries
    return `Hi ${userName}! 

I can help you with:
• Orders - Track your orders and check status
• Products - Check stock availability
• Loyalty Points - View balance and redeem rewards
• Delivery - Delivery times and information
• Payments - Payment options and refunds
• Account - Manage your profile

Could you please be more specific about what you need help with?

If you have a complex issue, I can help you create a support ticket for our team to assist you personally.`;
  };

  const handleCreateTicket = async () => {
    if (!ticketData.subject || !ticketData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsCreatingTicket(true);

    try {
      const ticket = await base44.entities.SupportTicket.create({
        user_id: user.id,
        subject: ticketData.subject,
        description: ticketData.description,
        category: ticketData.category,
        priority: ticketData.priority,
        status: 'open'
      });

      toast.success(`Support ticket created! Ticket #${ticket.ticket_number}`);
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "assistant",
        content: `✅ **Support Ticket Created Successfully!**

**Ticket Number:** ${ticket.ticket_number}
**Subject:** ${ticketData.subject}
**Category:** ${ticketData.category}
**Priority:** ${ticketData.priority}

Our support team will review your ticket and respond within 24 hours. You can track your ticket status in your profile.

Is there anything else I can help you with?`
      }]);

      setShowTicketForm(false);
      setTicketData({
        subject: "",
        description: "",
        category: "general",
        priority: "medium"
      });
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast.error("Failed to create ticket. Please try again.");
    }

    setIsCreatingTicket(false);
  };

  return (
    <>
      {/* Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed bottom-20 right-6 md:bottom-6 z-50"
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="h-14 w-14 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-lg relative"
              size="icon"
            >
              <MessageCircle className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-[95vw] max-w-[420px]"
          >
            <Card className="shadow-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center flex-shrink-0 relative">
                      <Bot className="w-5 h-5 text-emerald-600" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm font-semibold truncate">AI Assistant</CardTitle>
                      <Badge className="bg-green-500 text-[10px] px-1.5 py-0">Online</Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    className="text-white hover:bg-emerald-500 h-8 w-8 flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {!showTicketForm ? (
                  <>
                    {/* Messages */}
                    <div className="h-[400px] overflow-y-auto p-3 space-y-3 bg-gradient-to-b from-gray-50 to-white">
                      {messages.map((message) => (
                        <div key={message.id}>
                          <div
                            className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            {message.role === 'assistant' && (
                              <div className="w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4 text-white" />
                              </div>
                            )}
                            <div
                              className={`max-w-[75%] rounded-2xl p-2.5 ${
                                message.role === 'user'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-white border border-gray-200 shadow-sm'
                              }`}
                            >
                              <div className="text-sm leading-relaxed">
                                {message.content.split('\n').map((line, idx) => {
                                  if (line.trim() === '') return <div key={idx} className="h-1" />;
                                  
                                  // Handle bullet points
                                  if (line.trim().startsWith('•')) {
                                    return (
                                      <div key={idx} className="flex gap-1.5 mb-1">
                                        <span className="flex-shrink-0">•</span>
                                        <span className="flex-1">{line.trim().substring(1).trim()}</span>
                                      </div>
                                    );
                                  }
                                  
                                  // Handle bold text **text**
                                  const boldRegex = /\*\*(.*?)\*\*/g;
                                  const parts = line.split(boldRegex);
                                  
                                  return (
                                    <p key={idx} className="mb-1">
                                      {parts.map((part, i) => 
                                        i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
                                      )}
                                    </p>
                                  );
                                })}
                              </div>
                            </div>
                            {message.role === 'user' && (
                              <div className="w-7 h-7 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                                <UserIcon className="w-4 h-4 text-gray-600" />
                              </div>
                            )}
                          </div>
                          
                          {/* Quick Actions */}
                          {message.showQuickActions && (
                            <div className="mt-2 ml-9 flex flex-wrap gap-1.5">
                              <Button size="sm" variant="outline" onClick={() => handleQuickAction('track_order')} className="text-[11px] h-7 px-2">
                                📦 Track
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleQuickAction('check_stock')} className="text-[11px] h-7 px-2">
                                🛍️ Stock
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleQuickAction('loyalty_points')} className="text-[11px] h-7 px-2">
                                🎁 Points
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleQuickAction('create_ticket')} className="text-[11px] h-7 px-2">
                                🎫 Ticket
                              </Button>
                            </div>
                          )}

                          {/* Ticket Creation Option */}
                          {message.showTicketOption && message.role === 'assistant' && (
                            <div className="mt-2 ml-9">
                              <Button
                                size="sm"
                                onClick={() => setShowTicketForm(true)}
                                className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] h-7 px-2"
                              >
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Create Ticket
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex gap-2">
                          <div className="w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                          <div className="bg-white border border-gray-200 rounded-2xl p-2.5 shadow-sm">
                            <div className="flex gap-1">
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3 bg-white border-t">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Ask me anything..."
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                          disabled={isTyping}
                          className="flex-1 text-sm h-9"
                        />
                        <Button
                          onClick={() => handleSendMessage()}
                          disabled={!inputMessage.trim() || isTyping}
                          className="bg-emerald-600 hover:bg-emerald-700 h-9 w-9 p-0"
                          size="icon"
                        >
                          {isTyping ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Ticket Creation Form */
                  <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                        Create Support Ticket
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => setShowTicketForm(false)} className="h-7 w-7 p-0">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <label className="text-xs font-medium mb-1 block">Category *</label>
                        <Select value={ticketData.category} onValueChange={(value) => setTicketData({...ticketData, category: value})}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="order">📦 Order Issue</SelectItem>
                            <SelectItem value="product">🛍️ Product Issue</SelectItem>
                            <SelectItem value="delivery">🚚 Delivery Issue</SelectItem>
                            <SelectItem value="payment">💳 Payment Issue</SelectItem>
                            <SelectItem value="loyalty">🎁 Loyalty & Rewards</SelectItem>
                            <SelectItem value="general">❓ General Query</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-medium mb-1 block">Priority</label>
                        <Select value={ticketData.priority} onValueChange={(value) => setTicketData({...ticketData, priority: value})}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-medium mb-1 block">Subject *</label>
                        <Input
                          placeholder="Brief description of your issue"
                          value={ticketData.subject}
                          onChange={(e) => setTicketData({...ticketData, subject: e.target.value})}
                          className="h-9 text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium mb-1 block">Description *</label>
                        <Textarea
                          placeholder="Please provide detailed information..."
                          value={ticketData.description}
                          onChange={(e) => setTicketData({...ticketData, description: e.target.value})}
                          rows={3}
                          className="text-sm"
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button
                          onClick={handleCreateTicket}
                          disabled={isCreatingTicket || !ticketData.subject || !ticketData.description}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-9 text-sm"
                        >
                          {isCreatingTicket ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1.5" />
                              Create Ticket
                            </>
                          )}
                        </Button>
                        <Button variant="outline" onClick={() => setShowTicketForm(false)} className="h-9 text-sm">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
