import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, X, Send, Loader2, Bot, User as UserIcon, ShoppingCart, Gift, Package, Ticket, Phone, Mail, Headphones } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { detectLanguage, detectIntent, knowledgeBase, extractEntities, generateHinglishResponse } from "@/utils/chatbotIntents";
import SupportTicketForm from "@/components/support/SupportTicketForm";

// Bot icon - place bot-icon.png in public folder
const BOT_ICON_URL = "/bot-icon.png";

// Fallback: Simple chat bubble icon as SVG data URL
const FALLBACK_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%2310b981'/%3E%3Cpath d='M30 40 Q50 25 70 40 L70 60 Q50 75 30 60 Z' fill='white'/%3E%3Ccircle cx='40' cy='45' r='3' fill='%2310b981'/%3E%3Ccircle cx='60' cy='45' r='3' fill='%2310b981'/%3E%3Cpath d='M40 55 Q50 60 60 55' stroke='%2310b981' stroke-width='2' fill='none'/%3E%3C/svg%3E";

export default function AIAssistant({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [userLanguage, setUserLanguage] = useState('english'); // Default to English
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [selectedContactMethod, setSelectedContactMethod] = useState(null);
  const [showContactOptions, setShowContactOptions] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Show typing animation first, then welcome message
      setIsTyping(true);
      
      setTimeout(() => {
        const userName = user?.full_name || user?.email?.split('@')[0] || 'there';
        const welcomeMsg = {
          id: Date.now(),
          role: "assistant",
          content: `Hello ${userName}! 👋 I'm CollegeCart's AI assistant.

I can help you with:
• Placing orders
• Checking/redeeming loyalty points
• Viewing products and stock
• Delivery and payment info
• Support & complaints

What do you need?`,
          showQuickActions: true
        };
        setMessages([welcomeMsg]);
        setChatHistory([{ role: "assistant", content: welcomeMsg.content }]);
        setIsTyping(false);
      }, 1500); // 1.5 second typing delay for welcome message
    }
  }, [isOpen, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getUserContext = async () => {
    if (!user) return {};
    
    try {
      // Get orders
      const orders = await base44.entities.Order.filter({ user_id: user.id }, '-created_date', 5);
      
      // Get loyalty points
      const loyaltyTxns = await base44.entities.LoyaltyTransaction.filter({ user_id: user.id });
      const points = loyaltyTxns.reduce((sum, t) => sum + t.points, 0);
      
      // Get cart
      const cartItems = await base44.entities.CartItem.filter({ user_id: user.id });
      
      // Get products
      const products = await base44.entities.Product.filter({ is_available: true }, '-created_date', 20);
      
      return {
        user: {
          name: user.full_name,
          email: user.email,
          hostel: user.selected_hostel,
          tier: user.loyalty_tier || 'Bronze'
        },
        orders: orders.map(o => ({
          order_number: o.order_number,
          status: o.status,
          total_amount: o.total_amount,
          created_date: o.created_date
        })),
        loyaltyPoints: points,
        tier: user.loyalty_tier || 'Bronze',
        cartItems: cartItems.length,
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          stock: p.stock_quantity,
          hostel_stock: p.hostel_stock
        }))
      };
    } catch (error) {
      console.error("Error getting context:", error);
      return {};
    }
  };

  const handleQuickAction = async (action) => {
    const actions = {
      english: {
        check_points: "How many loyalty points do I have?",
        track_order: "Where is my order?",
        check_stock: "What's available?",
        place_order: "I want to place an order",
        contact_us: "I need help / Contact support"
      },
      hinglish: {
        check_points: "Mere kitne loyalty points hain?",
        track_order: "Mera order kahan hai?",
        check_stock: "Kya available hai?",
        place_order: "Order karna hai",
        contact_us: "Madad chahiye / Support contact karo"
      }
    };
    
    const lang = userLanguage || 'english';
    
    if (actions[lang][action]) {
      setInputMessage(actions[lang][action]);
      setTimeout(() => handleSendMessage(actions[lang][action]), 100);
    }
  };

  const handleIntent = async (intent, entities, context, language) => {
    const userName = context.user?.name || 'there';
    
    switch (intent) {
      case 'CHECK_POINTS':
        return generateHinglishResponse('CHECK_POINTS', {
          points: context.loyaltyPoints || 0,
          tier: context.tier
        }, language);
        
      case 'ORDER_STATUS':
        if (context.orders && context.orders.length > 0) {
          const order = entities.orderNumber 
            ? context.orders.find(o => o.order_number.includes(entities.orderNumber))
            : context.orders[0];
          return generateHinglishResponse('ORDER_STATUS', { order }, language);
        }
        return language === 'hinglish'
          ? "Koi recent order nahi mila. Naya order place karna chahte ho?"
          : "No recent orders found. Would you like to place a new order?";
        
      case 'CHECK_STOCK':
        const hostelProducts = context.products?.filter(p => {
          if (!context.user?.hostel || context.user.hostel === 'Other') {
            return p.stock > 0;
          }
          return p.hostel_stock?.[context.user.hostel] > 0;
        });
        return generateHinglishResponse('CHECK_STOCK', {
          products: hostelProducts,
          hostel: context.user?.hostel
        }, language);
        
      case 'REDEEM_POINTS':
        const today = new Date().getDay();
        const isWeekend = today === 0 || today === 6;
        if (!isWeekend) {
          if (language === 'hinglish') {
            return `🎁 Loyalty Points sirf weekend (Saturday-Sunday) pe redeem kar sakte ho!

Aapke points: ${context.loyaltyPoints || 0}
Value: ₹${((context.loyaltyPoints || 0) / 10).toFixed(2)}

Weekend ka wait karo aur discount pao! 😊`;
          } else {
            return `🎁 Loyalty Points can only be redeemed on weekends (Saturday-Sunday)!

Your points: ${context.loyaltyPoints || 0}
Value: ₹${((context.loyaltyPoints || 0) / 10).toFixed(2)}

Wait for the weekend to get your discount! 😊`;
          }
        }
        if ((context.loyaltyPoints || 0) < 100) {
          if (language === 'hinglish') {
            return `Aapke paas ${context.loyaltyPoints || 0} points hain. Redeem karne ke liye kam se kam 100 points chahiye.

Aur ${100 - (context.loyaltyPoints || 0)} points kamao! 💪`;
          } else {
            return `You have ${context.loyaltyPoints || 0} points. You need at least 100 points to redeem.

Earn ${100 - (context.loyaltyPoints || 0)} more points! 💪`;
          }
        }
        if (language === 'hinglish') {
          return `✅ Haan! Aap apne ${context.loyaltyPoints} points redeem kar sakte ho!

Value: ₹${((context.loyaltyPoints || 0) / 10).toFixed(2)} discount

Cart page pe jao aur checkout karte waqt points use karo! 🎉`;
        } else {
          return `✅ Yes! You can redeem your ${context.loyaltyPoints} points!

Value: ₹${((context.loyaltyPoints || 0) / 10).toFixed(2)} discount

Go to cart page and use points during checkout! 🎉`;
        }
        
      case 'GREETING':
        const greetings = knowledgeBase.GREETING[language];
        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
        // Replace placeholder with actual user name
        return randomGreeting.replace('{name}', userName);
        
      case 'HELP':
        return knowledgeBase.HELP[language];
        
      case 'DELIVERY_INFO':
        return knowledgeBase.DELIVERY_INFO[language];
        
      case 'PAYMENT_INFO':
        return knowledgeBase.PAYMENT_INFO[language];
        
      case 'EARN_POINTS':
        return knowledgeBase.EARN_POINTS[language];
        
      case 'CONTACT_US':
        // Show contact options as part of the message
        return {
          text: knowledgeBase.CONTACT_US[language],
          showContactOptions: true
        };
        
      default:
        return null;
    }
  };

  const callGeminiAPI = async (message, context, language) => {
    try {
      // Use free Gemini API (no key needed for basic usage)
      const prompt = language === 'hinglish'
        ? `You are a helpful AI assistant for CollegeCart, a grocery delivery service for college students in India. Respond in Hinglish (mix of Hindi and English) in a friendly, conversational way.

User Context:
- Name: ${context.user?.name || 'User'}
- Hostel: ${context.user?.hostel || 'Not set'}
- Loyalty Points: ${context.loyaltyPoints || 0}
- Cart Items: ${context.cartItems || 0}
- Recent Orders: ${context.orders?.length || 0}

User Message: ${message}

Respond naturally in Hinglish. Keep it short (2-3 sentences). Use emojis. Be helpful and friendly.`
        : `You are a helpful AI assistant for CollegeCart, a grocery delivery service for college students in India. Respond in English in a friendly, conversational way.

User Context:
- Name: ${context.user?.name || 'User'}
- Hostel: ${context.user?.hostel || 'Not set'}
- Loyalty Points: ${context.loyaltyPoints || 0}
- Cart Items: ${context.cartItems || 0}
- Recent Orders: ${context.orders?.length || 0}

User Message: ${message}

Respond naturally in English. Keep it short (2-3 sentences). Use emojis. Be helpful and friendly.`;

      // For now, use rule-based fallback since Gemini needs API key
      // You can add Gemini API key later
      if (language === 'hinglish') {
        return `Samajh gaya! 😊 Main aapki madad karne ki koshish kar raha hoon. 

Kya aap:
• Order track karna chahte ho?
• Loyalty points check karna chahte ho?
• Products dekhna chahte ho?

Bataiye kya chahiye!`;
      } else {
        return `Got it! 😊 I'm here to help you.

Would you like to:
• Track your order?
• Check loyalty points?
• View products?

Let me know what you need!`;
      }
      
    } catch (error) {
      console.error("Gemini API error:", error);
      return null;
    }
  };

  const handleSendMessage = async (messageText = null) => {
    const textToSend = messageText || inputMessage.trim();
    if (!textToSend) return;

    // Detect language from user message
    const detectedLang = detectLanguage(textToSend);
    setUserLanguage(detectedLang);

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: textToSend
    };

    setMessages(prev => [...prev, userMessage]);
    setChatHistory(prev => [...prev, { role: "user", content: textToSend }]);
    setInputMessage("");
    
    // Show typing animation
    setIsTyping(true);

    // Simulate realistic typing delay (500ms - 2000ms based on response length)
    const typingDelay = Math.min(2000, Math.max(800, textToSend.length * 30));

    setTimeout(async () => {
      try {
        // Get user context
        const context = await getUserContext();
        
        // Detect intent
        const intent = detectIntent(textToSend);
        const entities = extractEntities(textToSend);
        
        // Try to handle with intent system first
        let response = await handleIntent(intent, entities, context, detectedLang);
        
        // Check if response is an object with showContactOptions
        let showContactOptions = false;
        if (response && typeof response === 'object' && response.showContactOptions) {
          showContactOptions = true;
          response = response.text;
        }
        
        // If no intent match, use AI
        if (!response) {
          response = await callGeminiAPI(textToSend, context, detectedLang);
        }
        
        // Fallback response
        if (!response) {
          if (detectedLang === 'hinglish') {
            response = `Hmm, samajh nahi aaya. 🤔

Kya aap:
• Order status check karna chahte ho?
• Loyalty points dekhna chahte ho?
• Products search karna chahte ho?

Thoda aur detail mein bataiye!`;
          } else {
            response = `Hmm, I didn't quite understand. 🤔

Would you like to:
• Check order status?
• View loyalty points?
• Search for products?

Please provide more details!`;
          }
        }

        const botMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: response,
          showContactOptions: showContactOptions
        };

        setMessages(prev => [...prev, botMessage]);
        setChatHistory(prev => [...prev, { role: "assistant", content: response }]);
        
      } catch (error) {
        console.error("Error:", error);
        const errorMsg = {
          id: Date.now() + 1,
          role: "assistant",
          content: detectedLang === 'hinglish'
            ? "Sorry, kuch problem ho gayi. Thodi der baad try karo! 😅"
            : "Sorry, something went wrong. Please try again later! 😅"
        };
        setMessages(prev => [...prev, errorMsg]);
      }

      setIsTyping(false);
    }, typingDelay);
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
            className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50"
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="h-14 w-14 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg relative p-0 overflow-visible"
              size="icon"
            >
              <div className="w-full h-full flex items-center justify-center bg-white rounded-full p-2 relative">
                <img 
                  src={BOT_ICON_URL} 
                  alt="AI Assistant" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>';
                  }}
                />
                {/* Online indicator on bot icon */}
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />
              </div>
              {/* Pulsing ring animation */}
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping" />
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
            className="fixed bottom-2 left-2 right-2 md:bottom-6 md:right-6 md:left-auto z-50 md:w-[420px]"
          >
            <Card className="shadow-2xl overflow-hidden max-h-[calc(100vh-80px)] flex flex-col">
              <CardHeader className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center flex-shrink-0 relative overflow-hidden p-0.5">
                      <img 
                        src={BOT_ICON_URL} 
                        alt="AI Bot" 
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          // Fallback to SVG icon if image fails to load
                          e.target.src = FALLBACK_ICON;
                        }}
                      />
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

              <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                {/* Support Form */}
                {showSupportForm && (
                  <div className="border-b">
                    <SupportTicketForm 
                      user={user} 
                      onClose={() => {
                        setShowSupportForm(false);
                        setSelectedContactMethod(null);
                      }}
                      language={userLanguage}
                      initialMethod={selectedContactMethod}
                    />
                  </div>
                )}
                
                {/* Messages */}
                <div className="h-[400px] overflow-y-auto p-3 space-y-3 bg-gradient-to-b from-gray-50 to-white">
                  {messages.map((message) => (
                    <div key={message.id}>
                      <div className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {message.role === 'assistant' && (
                          <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-emerald-200 p-0.5">
                            <img 
                              src={BOT_ICON_URL} 
                              alt="AI Bot" 
                              className="w-full h-full object-cover rounded-full"
                              onError={(e) => {
                                e.target.src = FALLBACK_ICON;
                              }}
                            />
                          </div>
                        )}
                        <div
                          className={`max-w-[75%] rounded-2xl p-2.5 ${
                            message.role === 'user'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white border border-gray-200 shadow-sm'
                          }`}
                        >
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content}
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
                          <Button size="sm" variant="outline" onClick={() => handleQuickAction('check_points')} className="text-[11px] h-7 px-2">
                            <Gift className="w-3 h-3 mr-1" />
                            Points
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleQuickAction('track_order')} className="text-[11px] h-7 px-2">
                            <Package className="w-3 h-3 mr-1" />
                            Track
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleQuickAction('check_stock')} className="text-[11px] h-7 px-2">
                            <ShoppingCart className="w-3 h-3 mr-1" />
                            Stock
                          </Button>
                        </div>
                      )}
                      
                      {/* Contact Options as Message */}
                      {message.showContactOptions && (
                        <div className="mt-2 ml-9 space-y-2">
                          <p className="text-xs font-semibold text-gray-700">
                            {userLanguage === 'hinglish' ? 'Kaise contact karein?' : 'How would you like to contact us?'}
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedContactMethod('ticket');
                                setShowSupportForm(true);
                                // Remove contact options from this message
                                setMessages(prev => prev.map(m => 
                                  m.id === message.id ? { ...m, showContactOptions: false } : m
                                ));
                              }}
                              className="flex flex-col items-center gap-1 h-auto py-2 hover:bg-emerald-50 hover:border-emerald-500"
                            >
                              <Ticket className="w-4 h-4 text-emerald-600" />
                              <span className="text-[10px] font-semibold">
                                {userLanguage === 'hinglish' ? 'Ticket' : 'Ticket'}
                              </span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedContactMethod('callback');
                                setShowSupportForm(true);
                                setMessages(prev => prev.map(m => 
                                  m.id === message.id ? { ...m, showContactOptions: false } : m
                                ));
                              }}
                              className="flex flex-col items-center gap-1 h-auto py-2 hover:bg-blue-50 hover:border-blue-500"
                            >
                              <Phone className="w-4 h-4 text-blue-600" />
                              <span className="text-[10px] font-semibold">
                                {userLanguage === 'hinglish' ? 'Call' : 'Call'}
                              </span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedContactMethod('email');
                                setShowSupportForm(true);
                                setMessages(prev => prev.map(m => 
                                  m.id === message.id ? { ...m, showContactOptions: false } : m
                                ));
                              }}
                              className="flex flex-col items-center gap-1 h-auto py-2 hover:bg-purple-50 hover:border-purple-500"
                            >
                              <Mail className="w-4 h-4 text-purple-600" />
                              <span className="text-[10px] font-semibold">
                                {userLanguage === 'hinglish' ? 'Email' : 'Email'}
                              </span>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex gap-2">
                      <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center overflow-hidden border border-emerald-200 p-0.5">
                        <img 
                          src={BOT_ICON_URL} 
                          alt="AI Bot" 
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            e.target.src = FALLBACK_ICON;
                          }}
                        />
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
                  <div className="flex gap-2 mb-2">
                    <Input
                      placeholder={userLanguage === 'hinglish' ? "Type karo..." : "Type your message..."}
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
                  {/* Support Button */}
                  <Button
                    onClick={() => {
                      setShowContactOptions(true);
                      setShowSupportForm(false);
                      setSelectedContactMethod(null);
                    }}
                    variant="outline"
                    className="w-full h-8 text-xs bg-gradient-to-r from-emerald-50 to-blue-50 hover:from-emerald-100 hover:to-blue-100 border-emerald-200"
                  >
                    <Headphones className="w-3.5 h-3.5 mr-1.5" />
                    {userLanguage === 'hinglish' ? 'Madad Chahiye? Support Contact Karo' : 'Need Help? Contact Support'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Contact Options Popup - Within Chatbot */}
      <AnimatePresence>
        {showContactOptions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-2 left-2 right-2 md:bottom-6 md:right-6 md:left-auto z-50 md:w-[420px]"
          >
            <Card className="shadow-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    {userLanguage === 'hinglish' ? 'Kaise contact karein?' : 'How would you like to contact us?'}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowContactOptions(false)}
                    className="text-white hover:bg-emerald-500 h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedContactMethod('ticket');
                      setShowSupportForm(true);
                      setShowContactOptions(false);
                    }}
                    className="flex flex-col items-center gap-2 h-auto py-6 hover:bg-emerald-50 hover:border-emerald-500 border-2"
                  >
                    <Ticket className="w-8 h-8 text-emerald-600" />
                    <div className="text-center">
                      <p className="text-sm font-semibold">
                        {userLanguage === 'hinglish' ? 'Ticket' : 'Create Ticket'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {userLanguage === 'hinglish' ? 'Track karo' : 'Track issue'}
                      </p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedContactMethod('callback');
                      setShowSupportForm(true);
                      setShowContactOptions(false);
                    }}
                    className="flex flex-col items-center gap-2 h-auto py-6 hover:bg-blue-50 hover:border-blue-500 border-2"
                  >
                    <Phone className="w-8 h-8 text-blue-600" />
                    <div className="text-center">
                      <p className="text-sm font-semibold">
                        {userLanguage === 'hinglish' ? 'Call' : 'Request Call'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {userLanguage === 'hinglish' ? 'Hum call karenge' : 'We\'ll call'}
                      </p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedContactMethod('email');
                      setShowSupportForm(true);
                      setShowContactOptions(false);
                    }}
                    className="flex flex-col items-center gap-2 h-auto py-6 hover:bg-purple-50 hover:border-purple-500 border-2"
                  >
                    <Mail className="w-8 h-8 text-purple-600" />
                    <div className="text-center">
                      <p className="text-sm font-semibold">
                        {userLanguage === 'hinglish' ? 'Email' : 'Email Support'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {userLanguage === 'hinglish' ? 'Email bhejo' : 'Send email'}
                      </p>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
