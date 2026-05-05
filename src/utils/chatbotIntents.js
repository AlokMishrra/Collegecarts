// Language detection
export const detectLanguage = (message) => {
  // Check for Hindi/Hinglish patterns
  const hindiPatterns = /[क-ह]|kya|hai|hain|mere|mera|kaise|kahan|kitne|chahiye|milega|ho|kar|sakte|baad|abhi|thoda|aur|pe|se|ko|ka|ki/i;
  
  if (hindiPatterns.test(message)) {
    return 'hinglish';
  }
  return 'english';
};

// Intent detection system for chatbot
export const detectIntent = (message) => {
  const msg = message.toLowerCase();
  
  // Order-related intents
  if (msg.match(/order|place.*order|buy|purchase|checkout/)) {
    return 'CREATE_ORDER';
  }
  if (msg.match(/track|status|where.*order|order.*status/)) {
    return 'ORDER_STATUS';
  }
  if (msg.match(/cancel.*order|order.*cancel/)) {
    return 'CANCEL_ORDER';
  }
  
  // Loyalty points intents
  if (msg.match(/points|loyalty|balance|kitne.*point/)) {
    return 'CHECK_POINTS';
  }
  if (msg.match(/redeem|use.*point|point.*use|discount/)) {
    return 'REDEEM_POINTS';
  }
  if (msg.match(/earn|kaise.*milte|how.*earn/)) {
    return 'EARN_POINTS';
  }
  
  // Product intents
  if (msg.match(/stock|available|milega|hai.*kya/)) {
    return 'CHECK_STOCK';
  }
  if (msg.match(/product|item|kya.*hai|what.*is/)) {
    return 'PRODUCT_INFO';
  }
  if (msg.match(/recommend|suggest|chahiye|best/)) {
    return 'RECOMMEND';
  }
  
  // Delivery intents
  if (msg.match(/delivery|deliver|kab.*milega|when/)) {
    return 'DELIVERY_INFO';
  }
  
  // Payment intents
  if (msg.match(/payment|pay|paisa|refund/)) {
    return 'PAYMENT_INFO';
  }
  
  // Greeting
  if (msg.match(/^(hi|hello|hey|namaste|hii|hlo)/)) {
    return 'GREETING';
  }
  
  // Help
  if (msg.match(/help|madad|kya.*kar.*sakte/)) {
    return 'HELP';
  }
  
  // Contact Us / Support
  if (msg.match(/contact|support|ticket|callback|call.*back|email.*support|raise.*ticket|create.*ticket|complaint|issue|problem|help.*me/)) {
    return 'CONTACT_US';
  }
  
  return 'GENERAL_QUERY';
};

// Knowledge base responses (both English and Hinglish)
export const knowledgeBase = {
  GREETING: {
    english: [
      "Hello {name}! 👋 I'm CollegeCart's AI assistant. How can I help you today?",
      "Hi {name}! 😊 Welcome to CollegeCart. What can I do for you?",
      "Hey {name}! 👋 I'm here to help. What do you need?"
    ],
    hinglish: [
      "Namaste {name}! 🙏 Main CollegeCart ka AI assistant hoon. Aapki kya madad kar sakta hoon?",
      "Hello {name}! 👋 CollegeCart mein aapka swagat hai. Kaise help kar sakta hoon?",
      "Hey {name}! 😊 Main yahan hoon aapki help karne ke liye. Kya chahiye?"
    ]
  },
  
  HELP: {
    english: `I can help you with:

• 📦 Placing orders
• 🎁 Checking/redeeming loyalty points
• 🛍️ Viewing products and stock
• 🚚 Delivery information
• 💳 Payment and refund info

What would you like to do?`,
    hinglish: `Main aapki help kar sakta hoon:

• 📦 Order place karne mein
• 🎁 Loyalty points check/redeem karne mein
• 🛍️ Products aur stock dekhne mein
• 🚚 Delivery info ke liye
• 💳 Payment aur refund ke liye

Kya karna chahte ho?`
  },
  
  DELIVERY_INFO: {
    english: `🚚 Delivery Information:

• Standard: 30-40 minutes
• Express: 15-20 minutes (₹20 extra)
• Free delivery on orders above ₹199

Delivery Hours:
• Mon-Fri: 8 AM - 11 PM
• Sat-Sun: 9 AM - 11 PM

Delivered right to your hostel room! 🏠`,
    hinglish: `🚚 Delivery Information:

• Standard: 30-40 minutes
• Express: 15-20 minutes (₹20 extra)
• Free delivery on orders above ₹199

Delivery Hours:
• Mon-Fri: 8 AM - 11 PM
• Sat-Sun: 9 AM - 11 PM

Seedha aapke hostel room tak! 🏠`
  },
  
  PAYMENT_INFO: {
    english: `💳 Payment Options:

• Cash on Delivery (COD)
• Online Payment (UPI, Cards, Wallets)
• Cashfree Gateway

Refund Policy:
• 5-7 business days for refunds
• Safe and secure payments

Any payment issues?`,
    hinglish: `💳 Payment Options:

• Cash on Delivery (COD)
• Online Payment (UPI, Cards, Wallets)
• Cashfree Gateway

Refund Policy:
• 5-7 business days mein refund
• Safe aur secure payments

Koi payment issue hai?`
  },
  
  EARN_POINTS: {
    english: `🎁 How to Earn Loyalty Points:

• ₹10 spent = 1 point
• Refer a friend = 50 points
• Complete profile = 10 points
• Weekend orders = Bonus points!

Points Value:
• 100 points = ₹10 discount
• 500 points = ₹50 discount
• 1000 points = ₹100 discount

💡 Redeem points on weekends (Sat-Sun)!`,
    hinglish: `🎁 Loyalty Points Kaise Kamaye:

• ₹10 spend = 1 point
• Friend refer karo = 50 points
• Profile complete karo = 10 points
• Weekend orders = Bonus points!

Points Value:
• 100 points = ₹10 discount
• 500 points = ₹50 discount
• 1000 points = ₹100 discount

💡 Weekend (Sat-Sun) pe points redeem kar sakte ho!`
  },
  
  CONTACT_US: {
    english: `📞 Contact & Support Options:

I can help you with:
• 🎫 Create Support Ticket
• 📞 Request a Callback
• 📧 Email Support

Choose how you'd like to reach us!`,
    hinglish: `📞 Contact & Support Options:

Main aapki madad kar sakta hoon:
• 🎫 Support Ticket banao
• 📞 Callback request karo
• 📧 Email support

Kaise contact karna chahte ho?`
  }
};

// Extract entities from message
export const extractEntities = (message) => {
  const entities = {};
  
  // Extract order number
  const orderMatch = message.match(/order[#\s]*(\d+)|#(\d+)/i);
  if (orderMatch) {
    entities.orderNumber = orderMatch[1] || orderMatch[2];
  }
  
  // Extract points amount
  const pointsMatch = message.match(/(\d+)\s*points?/i);
  if (pointsMatch) {
    entities.points = parseInt(pointsMatch[1]);
  }
  
  // Extract product name
  const productMatch = message.match(/(?:buy|order|chahiye)\s+(.+?)(?:\s|$)/i);
  if (productMatch) {
    entities.product = productMatch[1].trim();
  }
  
  return entities;
};

// Generate response based on detected language
export const generateHinglishResponse = (intent, data, language = 'english') => {
  switch (intent) {
    case 'ORDER_STATUS':
      if (data.order) {
        if (language === 'hinglish') {
          return `📦 Aapka Order #${data.order.order_number}:

Status: ${data.order.status === 'pending' ? '⏳ Pending' : data.order.status === 'confirmed' ? '✅ Confirmed' : data.order.status === 'delivered' ? '🎉 Delivered' : data.order.status}
Amount: ₹${data.order.total_amount}
Date: ${new Date(data.order.created_date).toLocaleDateString('en-IN')}

${data.order.status === 'confirmed' ? 'Jaldi hi deliver ho jayega! 🚚' : ''}
${data.order.status === 'delivered' ? 'Enjoy karo! 😊' : ''}`;
        } else {
          return `📦 Your Order #${data.order.order_number}:

Status: ${data.order.status === 'pending' ? '⏳ Pending' : data.order.status === 'confirmed' ? '✅ Confirmed' : data.order.status === 'delivered' ? '🎉 Delivered' : data.order.status}
Amount: ₹${data.order.total_amount}
Date: ${new Date(data.order.created_date).toLocaleDateString('en-IN')}

${data.order.status === 'confirmed' ? 'Will be delivered soon! 🚚' : ''}
${data.order.status === 'delivered' ? 'Enjoy! 😊' : ''}`;
        }
      }
      return language === 'hinglish' 
        ? "Koi recent order nahi mila. Naya order place karna chahte ho?"
        : "No recent orders found. Would you like to place a new order?";
      
    case 'CHECK_POINTS':
      if (language === 'hinglish') {
        return `🎁 Aapke Loyalty Points:

Balance: ${data.points} points
Value: ₹${(data.points / 10).toFixed(2)}
Tier: ${data.tier || 'Bronze'}

${data.points >= 100 ? '💡 Weekend (Sat-Sun) pe redeem kar sakte ho!' : ''}
${data.points < 100 ? `Aur ${100 - data.points} points kamao to redeem kar sakte ho!` : ''}`;
      } else {
        return `🎁 Your Loyalty Points:

Balance: ${data.points} points
Value: ₹${(data.points / 10).toFixed(2)}
Tier: ${data.tier || 'Bronze'}

${data.points >= 100 ? '💡 You can redeem on weekends (Sat-Sun)!' : ''}
${data.points < 100 ? `Earn ${100 - data.points} more points to redeem!` : ''}`;
      }
      
    case 'CHECK_STOCK':
      if (data.products && data.products.length > 0) {
        if (language === 'hinglish') {
          return `🛍️ Available Products (${data.hostel || 'Your hostel'}):

${data.products.slice(0, 5).map(p => `• ${p.name} - ₹${p.price} ${p.stock > 0 ? `(${p.stock} available)` : '❌ Out of stock'}`).join('\n')}

Kya order karna chahte ho?`;
        } else {
          return `🛍️ Available Products (${data.hostel || 'Your hostel'}):

${data.products.slice(0, 5).map(p => `• ${p.name} - ₹${p.price} ${p.stock > 0 ? `(${p.stock} available)` : '❌ Out of stock'}`).join('\n')}

What would you like to order?`;
        }
      }
      return language === 'hinglish'
        ? "Abhi stock check kar rahe hain... Kaunsa product chahiye?"
        : "Checking stock... Which product do you need?";
      
    default:
      return language === 'hinglish'
        ? "Samajh nahi aaya. Kya aap phir se bata sakte ho?"
        : "I didn't understand. Could you please rephrase?";
  }
};
