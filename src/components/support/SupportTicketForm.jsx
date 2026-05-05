import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ticket, Phone, Mail, Loader2, CheckCircle2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SupportTicketForm({ user, onClose, language = 'english', initialMethod = 'ticket' }) {
  const [contactMethod, setContactMethod] = useState(initialMethod); // Use initialMethod prop
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    category: 'general',
    priority: 'medium',
    phone: user?.phone || '',
    email: user?.email || '',
    order_id: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const categories = [
    { value: 'order', label: language === 'hinglish' ? 'Order Issue' : 'Order Issue' },
    { value: 'product', label: language === 'hinglish' ? 'Product Issue' : 'Product Issue' },
    { value: 'delivery', label: language === 'hinglish' ? 'Delivery Issue' : 'Delivery Issue' },
    { value: 'payment', label: language === 'hinglish' ? 'Payment Issue' : 'Payment Issue' },
    { value: 'loyalty', label: language === 'hinglish' ? 'Loyalty Points' : 'Loyalty Points' },
    { value: 'general', label: language === 'hinglish' ? 'General Query' : 'General Query' }
  ];

  const priorities = [
    { value: 'low', label: language === 'hinglish' ? 'Low' : 'Low' },
    { value: 'medium', label: language === 'hinglish' ? 'Medium' : 'Medium' },
    { value: 'high', label: language === 'hinglish' ? 'High' : 'High' },
    { value: 'urgent', label: language === 'hinglish' ? 'Urgent' : 'Urgent' }
  ];

  const validatePhone = (phone) => {
    // Remove any spaces, dashes, or special characters
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    const invalidMsg = language === 'hinglish' 
      ? 'Invalid mobile number' 
      : 'Invalid mobile number';
    
    if (!cleaned) {
      return language === 'hinglish' ? 'Phone number zaroori hai' : 'Phone number is required';
    }
    
    // Check if it's exactly 10 digits
    if (cleaned.length !== 10) {
      return invalidMsg;
    }
    
    // Check if it starts with 6-9 (valid Indian mobile numbers)
    if (!/^[6-9]/.test(cleaned)) {
      return invalidMsg;
    }
    
    // Check for sequential numbers (1234567890, 0123456789, etc.)
    const isSequential = /^(0123456789|1234567890|9876543210|0987654321)$/.test(cleaned);
    if (isSequential) {
      return invalidMsg;
    }
    
    // Check for all same digits (1111111111, 9999999999, etc.)
    const allSame = /^(\d)\1{9}$/.test(cleaned);
    if (allSame) {
      return invalidMsg;
    }
    
    // Check for obvious fake patterns (1212121212, 1231231231, etc.)
    const repeatingPattern = /^(\d{2,4})\1+$/.test(cleaned);
    if (repeatingPattern) {
      return invalidMsg;
    }
    
    return '';
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    // Only allow numbers and basic formatting characters
    const cleaned = value.replace(/[^\d\s\-\(\)]/g, '');
    setFormData({ ...formData, phone: cleaned });
    
    // Clear error when user starts typing
    if (phoneError) {
      setPhoneError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate phone number for callback requests
    if (contactMethod === 'callback') {
      const error = validatePhone(formData.phone);
      if (error) {
        setPhoneError(error);
        return;
      }
    }
    
    setIsSubmitting(true);

    try {
      let ticketData = {};
      
      if (contactMethod === 'ticket') {
        // Create support ticket
        ticketData = {
          user_id: user.id,
          subject: formData.subject,
          description: formData.description,
          category: formData.category,
          priority: 'medium', // Default priority, admin can change later
          status: 'open',
          // Only include order_id if it's not empty
          ...(formData.order_id && formData.order_id.trim() ? { order_id: null } : {})
        };
        
        // Add order info to description if provided
        if (formData.order_id && formData.order_id.trim()) {
          ticketData.description = `Order Reference: ${formData.order_id}\n\n${formData.description}`;
        }
        
      } else if (contactMethod === 'callback') {
        // Create callback request ticket
        ticketData = {
          user_id: user.id,
          subject: `Callback Request - ${formData.subject || 'General'}`,
          description: `CALLBACK REQUEST\n\nPhone: ${formData.phone}\n\nMessage: ${formData.description}`,
          category: formData.category,
          priority: 'high', // Callbacks are high priority by default
          status: 'open'
        };
        
      } else if (contactMethod === 'email') {
        // Create email support ticket
        ticketData = {
          user_id: user.id,
          subject: `Email Support - ${formData.subject}`,
          description: `EMAIL SUPPORT REQUEST\n\nEmail: ${formData.email}\n\nMessage: ${formData.description}`,
          category: formData.category,
          priority: 'medium',
          status: 'open'
        };
      }

      // Create the ticket
      const result = await base44.entities.SupportTicket.create(ticketData);
      
      // Set ticket number - handle both array and object responses
      const ticket = Array.isArray(result) ? result[0] : result;
      setTicketNumber(ticket?.ticket_number || 'TICKET-CREATED');
      
      setSubmitSuccess(true);
      
      // Auto close after 10 seconds
      setTimeout(() => {
        onClose();
      }, 10000);
      
    } catch (error) {
      console.error("Error submitting support request:", error);
      alert(language === 'hinglish' 
        ? `Error: ${error.message || 'Kuch galat ho gaya. Phir se try karo!'}` 
        : `Error: ${error.message || 'Something went wrong. Please try again!'}`);
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-6 text-center"
      >
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {language === 'hinglish' ? 'Request Submit Ho Gayi!' : 'Request Submitted Successfully!'}
        </h3>
        {ticketNumber && ticketNumber !== 'TICKET-CREATED' && (
          <>
            <p className="text-gray-600 mb-2">
              {language === 'hinglish' ? 'Ticket Number:' : 'Ticket Number:'}
            </p>
            <p className="text-2xl font-bold text-emerald-600 mb-4">{ticketNumber}</p>
          </>
        )}
        <p className="text-sm text-gray-500">
          {language === 'hinglish' 
            ? 'Hum jaldi hi aapse contact karenge! 🎉' 
            : 'We will contact you soon! 🎉'}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          {language === 'hinglish' ? 'Contact & Support' : 'Contact & Support'}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Contact Method Selection */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Button
          type="button"
          variant={contactMethod === 'ticket' ? 'default' : 'outline'}
          onClick={() => setContactMethod('ticket')}
          className="flex flex-col items-center gap-1 h-auto py-3"
        >
          <Ticket className="w-5 h-5" />
          <span className="text-xs">
            {language === 'hinglish' ? 'Ticket' : 'Ticket'}
          </span>
        </Button>
        <Button
          type="button"
          variant={contactMethod === 'callback' ? 'default' : 'outline'}
          onClick={() => setContactMethod('callback')}
          className="flex flex-col items-center gap-1 h-auto py-3"
        >
          <Phone className="w-5 h-5" />
          <span className="text-xs">
            {language === 'hinglish' ? 'Callback' : 'Callback'}
          </span>
        </Button>
        <Button
          type="button"
          variant={contactMethod === 'email' ? 'default' : 'outline'}
          onClick={() => setContactMethod('email')}
          className="flex flex-col items-center gap-1 h-auto py-3"
        >
          <Mail className="w-5 h-5" />
          <span className="text-xs">
            {language === 'hinglish' ? 'Email' : 'Email'}
          </span>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Subject */}
        <div>
          <Label htmlFor="subject">
            {language === 'hinglish' ? 'Subject' : 'Subject'}
          </Label>
          <Input
            id="subject"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder={language === 'hinglish' ? 'Kya problem hai?' : 'What is the issue?'}
            required
          />
        </div>

        {/* Category */}
        <div>
          <Label htmlFor="category">
            {language === 'hinglish' ? 'Category' : 'Category'}
          </Label>
          <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Phone (for callback) */}
        {contactMethod === 'callback' && (
          <div>
            <Label htmlFor="phone">
              {language === 'hinglish' ? 'Phone Number *' : 'Phone Number *'}
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={handlePhoneChange}
              placeholder={language === 'hinglish' ? '10-digit mobile number' : '10-digit mobile number'}
              required
              maxLength={10}
              className={phoneError ? 'border-red-500' : ''}
            />
            {phoneError && (
              <p className="text-xs text-red-500 mt-1">{phoneError}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {language === 'hinglish' 
                ? 'Example: 9876543210' 
                : 'Example: 9876543210'}
            </p>
          </div>
        )}

        {/* Email (for email support) */}
        {contactMethod === 'email' && (
          <div>
            <Label htmlFor="email">
              {language === 'hinglish' ? 'Email Address' : 'Email Address'}
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder={language === 'hinglish' ? 'Aapka email' : 'Your email'}
              required
            />
          </div>
        )}

        {/* Order ID (optional, for tickets only) */}
        {contactMethod === 'ticket' && (
          <div>
            <Label htmlFor="order_id">
              {language === 'hinglish' ? 'Order Number (Optional)' : 'Order Number (Optional)'}
            </Label>
            <Input
              id="order_id"
              value={formData.order_id}
              onChange={(e) => setFormData({ ...formData, order_id: e.target.value })}
              placeholder={language === 'hinglish' ? 'Agar order se related hai (e.g., ORD-123)' : 'If related to an order (e.g., ORD-123)'}
            />
            <p className="text-xs text-gray-500 mt-1">
              {language === 'hinglish' ? 'Order number ya reference number daalein' : 'Enter your order number or reference'}
            </p>
          </div>
        )}

        {/* Description */}
        <div>
          <Label htmlFor="description">
            {language === 'hinglish' ? 'Message / Description' : 'Message / Description'}
          </Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder={language === 'hinglish' ? 'Detail mein bataiye...' : 'Describe in detail...'}
            rows={4}
            required
          />
        </div>

        {/* Submit Button */}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {language === 'hinglish' ? 'Submit ho raha hai...' : 'Submitting...'}
            </>
          ) : (
            <>
              {contactMethod === 'ticket' && <Ticket className="w-4 h-4 mr-2" />}
              {contactMethod === 'callback' && <Phone className="w-4 h-4 mr-2" />}
              {contactMethod === 'email' && <Mail className="w-4 h-4 mr-2" />}
              {language === 'hinglish' ? 'Submit Karo' : 'Submit Request'}
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
