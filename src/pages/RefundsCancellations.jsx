import React, { useEffect } from "react";
import { useSEO } from "@/lib/useSEO";
import { CheckCircle, XCircle, Clock, IndianRupee } from "lucide-react";

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
    <div className="text-gray-600 text-sm leading-relaxed space-y-2">{children}</div>
  </div>
);

export default function RefundsCancellations() {
  useEffect(() => {
    useSEO({
      title: "Refunds & Cancellations",
      description: "CollegeCart's refund and cancellation policy. Learn how to cancel an order, when refunds are applicable, and how long they take to process.",
      url: "/refunds",
    });
  }, []);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Refunds & Cancellations</h1>
      <p className="text-gray-400 text-sm mb-8">Last updated: May 1, 2026</p>

      {/* Quick summary cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
          <Clock className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
          <p className="font-semibold text-emerald-800 text-sm">Cancel within 2 min</p>
          <p className="text-emerald-600 text-xs mt-1">Full refund guaranteed</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <IndianRupee className="w-6 h-6 text-blue-600 mx-auto mb-2" />
          <p className="font-semibold text-blue-800 text-sm">Refund in 5–7 days</p>
          <p className="text-blue-600 text-xs mt-1">To original payment method</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
          <XCircle className="w-6 h-6 text-orange-600 mx-auto mb-2" />
          <p className="font-semibold text-orange-800 text-sm">No cancellation</p>
          <p className="text-orange-600 text-xs mt-1">After order is dispatched</p>
        </div>
      </div>

      <Section title="1. Cancellation Policy">
        <p><strong>Before dispatch:</strong> You can cancel your order within 2 minutes of placing it. Go to My Orders → Select Order → Cancel Order.</p>
        <p><strong>After dispatch:</strong> Once the delivery partner has picked up your order, cancellation is not possible. Please contact support if there is an urgent issue.</p>
        <p><strong>COD orders:</strong> You may refuse delivery at the door. No charges will apply for refused COD orders.</p>
      </Section>

      <Section title="2. Refund Eligibility">
        <p>You are eligible for a full refund in the following cases:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Order cancelled within 2 minutes of placing</li>
          <li>Item(s) not delivered but payment was made</li>
          <li>Wrong item delivered</li>
          <li>Damaged, expired, or spoiled product received</li>
          <li>Duplicate payment charged</li>
          <li>Order cancelled by CollegeCart due to unavailability</li>
        </ul>
      </Section>

      <Section title="3. Non-Refundable Cases">
        <p>Refunds will not be issued in the following cases:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Order successfully delivered and accepted</li>
          <li>Cancellation requested after dispatch</li>
          <li>Incorrect delivery address provided by the customer</li>
          <li>Customer unavailable at delivery location after multiple attempts</li>
          <li>Perishable items (unless damaged/expired on delivery)</li>
        </ul>
      </Section>

      <Section title="4. Refund Process">
        <p><strong>Online payments (UPI / Card / PhonePe / Razorpay):</strong> Refunds are processed within 5–7 business days to your original payment method.</p>
        <p><strong>COD orders:</strong> Refunds for COD orders (e.g., wrong item) will be issued as CollegeCart wallet credits or via UPI transfer within 48 hours.</p>
        <p><strong>Wallet credits:</strong> Instantly credited and can be used on your next order.</p>
      </Section>

      <Section title="5. How to Request a Refund">
        <p>To request a refund:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Go to <strong>My Orders</strong> in the app</li>
          <li>Select the relevant order</li>
          <li>Tap <strong>"Report an Issue"</strong> and describe the problem</li>
          <li>Our support team will review and respond within 24 hours</li>
        </ol>
        <p className="mt-2">Alternatively, email us at <a href="mailto:contact@collegecarts.in" className="text-emerald-600 underline">contact@collegecarts.in</a> with your order ID and issue details.</p>
      </Section>

      <Section title="6. Loyalty Points & Offers">
        <p>Loyalty points earned on a refunded order will be reversed. Discount codes used on refunded orders cannot be reused.</p>
      </Section>

      <Section title="7. Contact">
        <p>For refund queries, contact us at <a href="mailto:contact@collegecarts.in" className="text-emerald-600 underline">contact@collegecarts.in</a> or call <a href="tel:+917248316506" className="text-emerald-600 underline">+91 7248316506</a>.</p>
      </Section>
    </div>
  );
}
