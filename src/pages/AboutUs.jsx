import React, { useEffect } from "react";
import { useSEO } from "@/lib/useSEO";
import { ROUTE_META } from "@/route-meta";
import { Zap, ShieldCheck, IndianRupee, Star, Truck, Users, Linkedin, Twitter, Facebook } from "lucide-react";

export default function AboutUs() {
  useEffect(() => {
    useSEO(ROUTE_META["/AboutUs"]);
  }, []);

  const products = [
    { category: "Snacks & Chips", examples: "Lays, Kurkure, Biscuits, Namkeen", priceRange: "₹10 – ₹150" },
    { category: "Beverages", examples: "Cold drinks, Energy drinks, Juices, Water", priceRange: "₹15 – ₹120" },
    { category: "Instant Food", examples: "Maggi, Cup Noodles, Poha, Oats", priceRange: "₹20 – ₹80" },
    { category: "Dairy & Eggs", examples: "Milk, Curd, Butter, Eggs", priceRange: "₹25 – ₹120" },
    { category: "Fruits & Vegetables", examples: "Bananas, Apples, Tomatoes, Onions", priceRange: "₹20 – ₹200" },
    { category: "Personal Care", examples: "Soap, Shampoo, Toothpaste, Sanitizer", priceRange: "₹30 – ₹300" },
    { category: "Stationery", examples: "Pens, Notebooks, Highlighters", priceRange: "₹10 – ₹200" },
    { category: "Medicines & Health", examples: "Paracetamol, Bandages, ORS, Vitamins", priceRange: "₹20 – ₹250" },
    { category: "Grocery Staples", examples: "Rice, Dal, Atta, Sugar, Salt", priceRange: "₹30 – ₹500" },
    { category: "Combos & Bundles", examples: "Snack combos, Study night packs", priceRange: "₹99 – ₹499" },
  ];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">About CollegeCart</h1>
      <p className="text-gray-500 mb-8 text-sm leading-relaxed">
        CollegeCart is India's fastest campus delivery service — built by students, for students. Founded by Alok Mishra in 2026, we deliver groceries, snacks, beverages, and daily essentials to your hostel room in 10 minutes, at student-friendly prices across India.
      </p>

      {/* Why CollegeCart Exists */}
      <h2 className="text-2xl font-bold text-gray-900 mb-3">Why CollegeCart Exists</h2>
      <p className="text-gray-700 text-sm leading-relaxed mb-3">
        CollegeCart began with an ordinary hostel moment: at 11pm the room was out of milk, the nearest shop was a kilometre away, and someone walked there in the dark, bought one packet, and walked back. That trip is the reason we exist. No student should have to choose between sleep and a basic grocery run.
      </p>
      <p className="text-gray-700 text-sm leading-relaxed mb-8">
        We built the service around one promise: what you need, handed over at your hostel door, at prices that fit a student budget.
      </p>

      {/* How CollegeCart Works */}
      <h2 className="text-2xl font-bold text-gray-900 mb-3">How CollegeCart Works</h2>
      <p className="text-gray-700 text-sm leading-relaxed mb-3">
        We run our own dark store close to campus, stock it ourselves, and pack every order locally before it leaves the building. Because the store sits a short ride from the hostels, delivery does not depend on traffic or on a third-party vendor being free at that hour.
      </p>
      <ul className="list-disc pl-5 mb-8 text-gray-700 text-sm leading-relaxed space-y-1.5">
        <li>Packed locally and checked item by item before dispatch.</li>
        <li>Handed over at your hostel door, not at the main gate.</li>
        <li>Most orders arrive in about 10 minutes, payable by COD, UPI, PhonePe or Razorpay.</li>
      </ul>

      {/* Where We Are Live */}
      <h2 className="text-2xl font-bold text-gray-900 mb-3">Where We Are Live</h2>
      <p className="text-gray-700 text-sm leading-relaxed mb-3">
        CollegeCart was founded by Alok Mishra in 2026 and is live in Uttarakhand, India, at two campuses: Shivalik College, Dehradun, and Quantum University, Roorkee. Both run the same catalogue, pricing rules and refund policy, and we open a new campus only when we can stock and staff it properly.
      </p>

      {/* What We Sell */}
      <h2 className="text-2xl font-bold text-gray-900 mb-3">What We Sell</h2>
      <p className="text-gray-700 text-sm leading-relaxed mb-3">
        The catalogue covers everyday hostel needs: groceries and kitchen staples, dairy, bread, snacks, cold drinks, instant food, home and kitchen items, and personal care, plus fruits, vegetables and stationery on most campuses.
      </p>
      <div className="bg-[#FFFBF5] border border-emerald-200 rounded-2xl p-5 mb-8">
        <h3 className="font-bold text-gray-900 mb-2 text-[#0c831f]">Our Price and Refund Promise</h3>
        <ul className="list-disc pl-5 text-gray-700 text-sm leading-relaxed space-y-1.5">
          <li>No minimum order: one item or one hundred, the price stays the same.</li>
          <li>Every item is sold at MRP or below it.</li>
          <li>Missing, damaged or wrong items are refunded to the original payment method within 3–5 working days.</li>
          <li>Free delivery above ₹500; a ₹10–₹20 fee applies on smaller orders.</li>
        </ul>
      </div>

      {/* Meet Our Founder Section */}
      <section className="mb-12 bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-3xl p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Meet Our Founder</h2>
        
        <div 
          className="flex flex-col md:flex-row gap-6 items-start"
          itemScope 
          itemType="https://schema.org/Person"
        >
          {/* Founder Image */}
          <div className="flex-shrink-0">
            <div className="w-32 h-32 bg-gradient-to-br from-emerald-600 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-5xl font-bold text-white">AM</span>
            </div>
          </div>
          
          {/* Founder Info */}
          <div className="flex-1">
            <h3 
              className="text-xl font-bold text-gray-900 mb-1"
              itemProp="name"
            >
              Alok Mishra
            </h3>
            <p 
              className="text-emerald-700 font-semibold mb-4"
              itemProp="jobTitle"
            >
              Founder and CEO, CollegeCart
            </p>
            
            <div itemProp="description">
              <p className="text-gray-700 text-sm leading-relaxed mb-3">
                <span itemProp="name">Alok Mishra</span> founded <span itemProp="worksFor" itemScope itemType="https://schema.org/Organization"><span itemProp="name">CollegeCart</span></span> in 2026 with a vision to revolutionize campus delivery across India. As a student entrepreneur, Alok Mishra understood the challenges college students face in accessing daily essentials quickly and affordably.
              </p>
              <p className="text-gray-700 text-sm leading-relaxed mb-3">
                Under Alok Mishra's leadership, CollegeCart has grown to serve thousands of students at Shivalik College Dehradun and Quantum University Roorkee, delivering groceries, snacks, and daily essentials in just 10 minutes. His commitment to student-friendly pricing and lightning-fast delivery has made CollegeCart India's most trusted campus delivery platform.
              </p>
              <p className="text-gray-700 text-sm leading-relaxed">
                Alok Mishra's entrepreneurial journey with CollegeCart represents the future of campus commerce in India, combining technology, logistics, and deep understanding of student needs to create a seamless delivery experience.
              </p>
            </div>
            
            {/* Social Links */}
            <div className="flex gap-3 mt-5">
              <a 
                href="https://www.linkedin.com/in/alok-mishra-collegecart" 
                target="_blank" 
                rel="noopener noreferrer me"
                itemProp="sameAs"
                className="w-10 h-10 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-400 transition-colors"
                aria-label="Alok Mishra LinkedIn Profile"
              >
                <Linkedin className="w-5 h-5 text-gray-700" />
              </a>
              <a 
                href="https://twitter.com/AlokMishraCC" 
                target="_blank" 
                rel="noopener noreferrer me"
                itemProp="sameAs"
                className="w-10 h-10 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-400 transition-colors"
                aria-label="Alok Mishra Twitter Profile"
              >
                <Twitter className="w-5 h-5 text-gray-700" />
              </a>
              <a 
                href="https://www.facebook.com/alok.mishra.collegecart" 
                target="_blank" 
                rel="noopener noreferrer me"
                itemProp="sameAs"
                className="w-10 h-10 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-400 transition-colors"
                aria-label="Alok Mishra Facebook Profile"
              >
                <Facebook className="w-5 h-5 text-gray-700" />
              </a>
            </div>
            
            <meta itemProp="url" content="https://collegecarts.in/about" />
            <meta itemProp="nationality" content="India" />
            <meta itemProp="knowsAbout" content="Campus Delivery, Franchise Business, Student Entrepreneurship, Campus Commerce, India" />
          </div>
        </div>
      </section>

      {/* Why Choose CollegeCart */}
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Why Choose CollegeCart</h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        {[
          { icon: Zap, title: "10-Min Delivery", desc: "Fastest delivery to your hostel room, every time." },
          { icon: IndianRupee, title: "Student Prices", desc: "Low prices, exclusive offers, and heavy discounts." },
          { icon: ShieldCheck, title: "Secure Payments", desc: "COD, UPI, PhonePe, and Razorpay — all accepted." },
          { icon: Star, title: "4.9★ Rated", desc: "Loved by 10,000+ students across campuses in India." },
          { icon: Truck, title: "Live at 2 Colleges", desc: "Shivalik College & Quantum University. Expanding fast across India." },
          { icon: Users, title: "Student Community", desc: "Built for hostel life — we get what you need." },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white border border-gray-200 rounded-2xl p-5 flex gap-4 items-start shadow-sm">
            <div className="bg-emerald-50 rounded-xl p-2.5">
              <Icon className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
              <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Products & Pricing */}
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Products & Pricing</h2>
      <p className="text-gray-500 text-sm mb-5">All prices are in Indian Rupees (INR) and inclusive of taxes. Actual prices may vary by product and availability at CollegeCart India.</p>

      <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-emerald-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Category</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden sm:table-cell">Examples</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-700">Price Range</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={p.category} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-4 py-3 font-medium text-gray-900">{p.category}</td>
                <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.examples}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">{p.priceRange}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-gray-400 text-xs mt-4">
        * Delivery charges: Free on orders above ₹500. A small delivery fee of ₹10–₹20 may apply on smaller orders depending on your hostel location.
      </p>

      {/* Structured data for products */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "CollegeCart Product Categories",
        "description": "Products available for delivery on CollegeCart",
        "itemListElement": products.map((p, i) => ({
          "@type": "ListItem",
          "position": i + 1,
          "name": p.category,
          "description": `${p.examples}. Price range: ${p.priceRange} INR`
        }))
      })}} />
    </div>
  );
}
