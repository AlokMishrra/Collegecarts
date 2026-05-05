import React, { useEffect } from "react";
import { useSEO } from "@/lib/useSEO";

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
    <div className="text-gray-600 text-sm leading-relaxed space-y-2">{children}</div>
  </div>
);

export default function PrivacyPolicy() {
  useEffect(() => {
    useSEO({
      title: "Privacy Policy",
      description: "CollegeCart's Privacy Policy. Learn how we collect, use, and protect your personal data when you use our grocery delivery service.",
      url: "/privacy",
    });
  }, []);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-gray-400 text-sm mb-8">Last updated: May 1, 2026</p>

      <Section title="1. Introduction">
        <p>CollegeCart ("we", "us", "our") is committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights regarding your personal information.</p>
      </Section>

      <Section title="2. Information We Collect">
        <p><strong>Account information:</strong> Name, email address, phone number, and hostel/room details when you register.</p>
        <p><strong>Order information:</strong> Products ordered, delivery address, payment method, and order history.</p>
        <p><strong>Device information:</strong> IP address, browser type, device type, and usage data for analytics.</p>
        <p><strong>Location data:</strong> Approximate location to verify service availability (only with your permission).</p>
      </Section>

      <Section title="3. How We Use Your Information">
        <ul className="list-disc pl-5 space-y-1">
          <li>To process and deliver your orders</li>
          <li>To send order confirmations and delivery updates</li>
          <li>To improve our products and services</li>
          <li>To send promotional offers (you can opt out anytime)</li>
          <li>To prevent fraud and ensure platform security</li>
          <li>To comply with legal obligations</li>
        </ul>
      </Section>

      <Section title="4. Data Sharing">
        <p>We do not sell your personal data. We share data only with:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Delivery partners:</strong> Name, room number, and order details for delivery</li>
          <li><strong>Payment processors:</strong> Razorpay, PhonePe for secure payment processing</li>
          <li><strong>Analytics providers:</strong> Anonymised usage data to improve the app</li>
          <li><strong>Legal authorities:</strong> When required by law</li>
        </ul>
      </Section>

      <Section title="5. Data Retention">
        <p>We retain your account data for as long as your account is active. Order history is retained for 3 years for legal and accounting purposes. You may request deletion of your account at any time.</p>
      </Section>

      <Section title="6. Your Rights">
        <p>You have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access the personal data we hold about you</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your account and data</li>
          <li>Opt out of marketing communications</li>
          <li>Withdraw consent for data processing</li>
        </ul>
        <p>To exercise these rights, email us at <a href="mailto:contact@collegecarts.in" className="text-emerald-600 underline">contact@collegecarts.in</a>.</p>
      </Section>

      <Section title="7. Cookies">
        <p>We use essential cookies to keep you logged in and remember your preferences. We do not use third-party advertising cookies.</p>
      </Section>

      <Section title="8. Security">
        <p>We use industry-standard encryption (HTTPS/TLS) and secure infrastructure (Supabase) to protect your data. Payment data is handled entirely by PCI-DSS compliant processors.</p>
      </Section>

      <Section title="9. Children's Privacy">
        <p>Our services are not directed at children under 13. We do not knowingly collect data from children under 13.</p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>We may update this policy from time to time. We will notify you of significant changes via email or in-app notification.</p>
      </Section>

      <Section title="11. Contact">
        <p>For privacy-related queries, contact us at <a href="mailto:contact@collegecarts.in" className="text-emerald-600 underline">contact@collegecarts.in</a>.</p>
      </Section>
    </div>
  );
}
