import React, { useEffect } from "react";
import { useSEO } from "@/lib/useSEO";

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
    <div className="text-gray-600 text-sm leading-relaxed space-y-2">{children}</div>
  </div>
);

export default function TermsConditions() {
  useEffect(() => {
    useSEO({
      title: "Terms & Conditions",
      description: "Read CollegeCart's Terms & Conditions. By using our app you agree to these terms governing orders, payments, delivery, and use of our platform.",
      url: "/terms",
    });
  }, []);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms & Conditions</h1>
      <p className="text-gray-400 text-sm mb-8">Last updated: May 1, 2026</p>

      <Section title="1. Acceptance of Terms">
        <p>By accessing or using the CollegeCart platform (website or app at collegecarts.in), you agree to be bound by these Terms & Conditions. If you do not agree, please do not use our services.</p>
      </Section>

      <Section title="2. About CollegeCart">
        <p>CollegeCart is a hostel-based instant delivery service for college students in India. We deliver groceries, snacks, beverages, and daily essentials to hostel rooms within 10–20 minutes.</p>
        <p>We are currently live at Shivalik College (Dehradun) and Quantum University (Roorkee).</p>
      </Section>

      <Section title="3. Eligibility">
        <p>Our services are available to students and residents of colleges and hostels where CollegeCart operates. You must be at least 18 years old or have parental consent to use our platform.</p>
      </Section>

      <Section title="4. Products & Pricing">
        <p>All product prices are listed in Indian Rupees (INR) and are inclusive of applicable taxes unless stated otherwise.</p>
        <p>Prices may change without prior notice. The price at the time of placing the order is the final price.</p>
        <p>We reserve the right to limit quantities of any product per order.</p>
        <p>Product images are for illustrative purposes only. Actual products may vary slightly.</p>
      </Section>

      <Section title="5. Orders & Delivery">
        <p>Orders are subject to product availability. In case of unavailability, we will notify you and offer a refund or substitute.</p>
        <p>Delivery times are estimates (10–20 minutes) and may vary due to demand, weather, or other factors.</p>
        <p>You are responsible for providing accurate hostel and room details. CollegeCart is not liable for failed deliveries due to incorrect information.</p>
        <p>Minimum order value may apply and will be displayed at checkout.</p>
      </Section>

      <Section title="6. Payments">
        <p>We accept Cash on Delivery (COD), UPI, PhonePe, and card payments via Razorpay.</p>
        <p>All online transactions are processed securely. CollegeCart does not store your payment card details.</p>
        <p>In case of a failed payment, the amount will be refunded to your original payment method within 5–7 business days.</p>
      </Section>

      <Section title="7. User Account">
        <p>You are responsible for maintaining the confidentiality of your account credentials.</p>
        <p>You agree not to share your account with others or use another person's account.</p>
        <p>CollegeCart reserves the right to suspend or terminate accounts that violate these terms.</p>
      </Section>

      <Section title="8. Prohibited Conduct">
        <p>You agree not to: place fraudulent orders, abuse promotional offers, harass delivery partners, or use the platform for any unlawful purpose.</p>
      </Section>

      <Section title="9. Intellectual Property">
        <p>All content on the CollegeCart platform — including logos, images, text, and software — is the property of CollegeCart and protected by applicable intellectual property laws.</p>
      </Section>

      <Section title="10. Limitation of Liability">
        <p>CollegeCart is not liable for any indirect, incidental, or consequential damages arising from the use of our services. Our maximum liability is limited to the value of the order in question.</p>
      </Section>

      <Section title="11. Governing Law">
        <p>These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in Dehradun, Uttarakhand.</p>
      </Section>

      <Section title="12. Contact">
        <p>For any questions regarding these terms, contact us at <a href="mailto:contact@collegecarts.in" className="text-emerald-600 underline">contact@collegecarts.in</a> or call <a href="tel:+917248316506" className="text-emerald-600 underline">+91 7248316506</a>.</p>
      </Section>
    </div>
  );
}
