import React, { useEffect } from "react";
import { useSEO } from "@/lib/useSEO";
import { Mail, Phone, MapPin, Clock, MessageCircle } from "lucide-react";

export default function ContactUs() {
  useEffect(() => {
    useSEO({
      title: "Contact Us",
      description: "Get in touch with CollegeCart. Reach us at contact@collegecarts.in or call +91 7248316506. We're here to help with your orders, delivery queries, and more.",
      url: "/contact",
    });
  }, []);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Contact Us</h1>
      <p className="text-gray-500 mb-8">We're here to help. Reach out to us through any of the channels below.</p>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex gap-4 items-start shadow-sm">
          <div className="bg-emerald-50 rounded-xl p-3">
            <Mail className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Email</p>
            <a href="mailto:contact@collegecarts.in" className="text-emerald-600 hover:underline text-sm">
              contact@collegecarts.in
            </a>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex gap-4 items-start shadow-sm">
          <div className="bg-emerald-50 rounded-xl p-3">
            <Phone className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Phone / WhatsApp</p>
            <a href="tel:+917248316506" className="text-emerald-600 hover:underline text-sm">
              +91 7248316506
            </a>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex gap-4 items-start shadow-sm">
          <div className="bg-emerald-50 rounded-xl p-3">
            <Clock className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Support Hours</p>
            <p className="text-gray-600 text-sm">Mon – Sun: 8:00 AM – 11:00 PM</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex gap-4 items-start shadow-sm">
          <div className="bg-emerald-50 rounded-xl p-3">
            <MapPin className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Currently Serving</p>
            <p className="text-gray-600 text-sm">Shivalik College, Dehradun</p>
            <p className="text-gray-600 text-sm">Quantum University, Roorkee</p>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <MessageCircle className="w-5 h-5 text-emerald-600" />
          <p className="font-semibold text-emerald-800">Business / Partnership Enquiries</p>
        </div>
        <p className="text-emerald-700 text-sm">
          Interested in partnering with CollegeCart or listing your college? Write to us at{" "}
          <a href="mailto:contact@collegecarts.in" className="underline font-medium">contact@collegecarts.in</a>{" "}
          with the subject line <strong>"Partnership Enquiry"</strong>.
        </p>
      </div>

      {/* Structured data for contact page */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ContactPage",
        "name": "Contact CollegeCart",
        "url": "https://collegecarts.in/contact",
        "description": "Contact CollegeCart for support, orders, and partnership enquiries.",
        "mainEntity": {
          "@type": "Organization",
          "name": "CollegeCart",
          "telephone": "+91-7248316506",
          "email": "contact@collegecarts.in"
        }
      })}} />
    </div>
  );
}
