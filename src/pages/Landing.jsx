import React from "react";
import { Link } from "react-router-dom";
import { useSEO } from "@/lib/useSEO";
import { ROUTE_META } from "@/route-meta";
import {
  Clock, ShoppingBasket, Wallet, MapPin, Star, Truck, ShieldCheck,
  Apple, Milk, Cookie, Sandwich, Cable, ArrowRight, Phone, Mail,
} from "lucide-react";

const CATEGORIES = [
  { name: "Fruits & Vegetables", to: "/Categories", icon: Apple },
  { name: "Dairy, Bread & Eggs", to: "/Categories", icon: Milk },
  { name: "Snacks & Chocolates", to: "/Categories", icon: Cookie },
  { name: "Instant Food & Bakery", to: "/Categories", icon: Sandwich },
  { name: "Cold Drinks & Juices", to: "/Categories", icon: Cable },
  { name: "Home & Kitchen", to: "/Categories", icon: ShoppingBasket },
];

const STEPS = [
  { n: "1", t: "Pick your hostel", d: "Choose your hostel and room once. We remember it for every order after that." },
  { n: "2", t: "Fill your cart", d: "Add fresh fruit, milk, bread, snacks and daily essentials at student-friendly prices." },
  { n: "3", t: "Doorstep in 10 minutes", d: "A rider brings the order straight to your hostel block. Pay online or in cash." },
];

const QUESTIONS = [
  {
    q: "How fast is CollegeCart delivery?",
    a: "Most orders reach your hostel room in about 10 minutes. Delivery time depends on how far your hostel is from our dark store and on how busy the evening rush is, and you can watch the order move on a live map from the moment it is placed.",
  },
  {
    q: "Which campuses does CollegeCart deliver to?",
    a: "CollegeCart is live at Shivalik College and Quantum University, delivering to every hostel block on campus. If your college is not listed yet, tell us on the contact page and we will add it when we open your city.",
  },
  {
    q: "Is there a minimum order value?",
    a: "No. There is no minimum basket size, so you can order a single packet of chips or a full week of groceries in the same trip. Any delivery fee that applies is shown in the cart before you pay, never afterwards.",
  },
  {
    q: "What payment methods can I use?",
    a: "You can pay with UPI, cards, netbanking and wallets through Razorpay, or choose cash on delivery when it is available for your hostel. Every payment is processed over an encrypted connection and you get a receipt for each order.",
  },
  {
    q: "What if something in my order is missing or damaged?",
    a: "Open the order in the app and raise a request from the order screen. Missing, damaged or wrong items are refunded to your original payment method, and support replies during store hours on working days.",
  },
];

const LEGAL_LINKS = [
  { label: "About us", to: "/AboutUs" },
  { label: "Contact", to: "/ContactUs" },
  { label: "Privacy policy", to: "/PrivacyPolicy" },
  { label: "Terms & conditions", to: "/TermsConditions" },
  { label: "Refunds & cancellations", to: "/RefundsCancellations" },
];

export default function Landing() {
  useSEO({ ...ROUTE_META["/"], noindex: true });

  return (
    <div className="min-h-screen bg-[#FFFBF5] text-slate-900">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0c831f] to-[#064e12] text-white">
        <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/10" aria-hidden="true" />
        <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-white/5" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:py-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            10-minute delivery
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Groceries delivered to your hostel room in 10 minutes
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-emerald-50 sm:text-lg">
            CollegeCart is the campus convenience store that comes to you. Fresh fruit,
            milk, bread, eggs, snacks, cold drinks and everyday essentials — picked,
            packed and carried to your hostel block in about ten minutes, at prices
            built for students.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/Shop"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#0c831f] shadow-lg transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              Start shopping
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/Categories"
              className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              Browse categories
            </Link>
          </div>

          <dl className="mt-10 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { k: "Average delivery", v: "10 min" },
              { k: "Minimum order", v: "₹0" },
              { k: "Campuses live", v: "2" },
              { k: "Products", v: "1000+" },
            ].map((s) => (
              <div key={s.k}>
                <dt className="text-xs uppercase tracking-wider text-emerald-100/80">{s.k}</dt>
                <dd className="mt-1 text-2xl font-extrabold">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          What can you order from CollegeCart?
        </h2>
        <p className="mt-3 max-w-3xl text-slate-600 leading-relaxed">
          Everything a hostel room actually runs out of. The full catalogue is split
          into the same categories you would find in a neighbourhood kirana, so you
          can find milk, atta, noodles or a phone charger without scrolling through
          the whole store.
        </p>
        <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map(({ name, to, icon: Icon }) => (
            <Link
              key={name}
              to={to}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-3 py-6 text-center transition hover:border-[#0c831f] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#0c831f]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#0c831f]">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-xs font-semibold leading-snug text-slate-700 group-hover:text-[#0c831f]">
                {name}
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-6">
          <Link
            to="/Shop"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0c831f] hover:underline"
          >
            See the full shop
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </p>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="border-y border-emerald-100 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            How does CollegeCart deliver in 10 minutes?
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-emerald-100 bg-[#FFFBF5] p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0c831f] text-sm font-extrabold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 text-lg font-bold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why students pick us ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Why do students order from CollegeCart?
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Truck, t: "10-minute delivery", d: "Stocked from a dark store on campus, so there is no inter-city parcel waiting to arrive." },
            { icon: Wallet, t: "Student pricing", d: "MRP or below on everyday items, with combo deals that make a single snack run cheaper." },
            { icon: MapPin, t: "Hostel-door drop", d: "Give your block and room number once. Riders know the campus and hand it to you directly." },
            { icon: ShieldCheck, t: "Refundable orders", d: "Missing, damaged or wrong items are refunded to your original payment method." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-emerald-100 bg-white p-5">
              <Icon className="h-6 w-6 text-[#0c831f]" aria-hidden="true" />
              <h3 className="mt-3 font-bold">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{d}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-6 rounded-2xl border border-emerald-100 bg-white p-6">
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="h-5 w-5 fill-[#0c831f] text-[#0c831f]" aria-hidden="true" />
            ))}
            <span className="ml-1 text-sm font-semibold text-slate-700">Loved by students on campus</span>
          </div>
          <p className="text-sm text-slate-600">
            Live at <strong className="text-slate-800">Shivalik College</strong> and{" "}
            <strong className="text-slate-800">Quantum University</strong>.
          </p>
        </div>
      </section>

      {/* ── Answers ──────────────────────────────────────────────────── */}
      <section className="border-t border-emerald-100 bg-white">
        <div className="mx-auto max-w-4xl px-5 py-14">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            CollegeCart delivery, prices and refunds — answered
          </h2>
          <div className="mt-8 space-y-8">
            {QUESTIONS.map(({ q, a }) => (
              <article key={q}>
                <h3 className="text-lg font-bold text-slate-900">{q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust / contact ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              Who runs CollegeCart?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              CollegeCart was founded by <strong>Alok Mishra</strong> in 2025 after
              watching classmates walk a kilometre for a packet of milk at 11pm. It
              is built and run by students who understand hostel life: small rooms,
              tight budgets and no patience for a two-day delivery window.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Orders are packed from our own dark store, so what you see on the
              product page is what actually ships. Every price is the MRP or lower,
              and stock levels are refreshed on the shop page every minute.
            </p>
            <Link
              to="/AboutUs"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#0c831f] hover:underline"
            >
              Read the full story
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-6">
            <h2 className="text-xl font-extrabold">Need a hand?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Order problems, refunds, a missing item or a bulk request for your
              hostel — reach the team directly.
            </p>
            <ul className="mt-5 space-y-3 text-sm">
              <li className="flex items-center gap-3 text-slate-700">
                <Phone className="h-4 w-4 text-[#0c831f]" aria-hidden="true" />
                <a href="tel:+917248316506" className="hover:text-[#0c831f] hover:underline">
                  +91 72483 16506
                </a>
              </li>
              <li className="flex items-center gap-3 text-slate-700">
                <Mail className="h-4 w-4 text-[#0c831f]" aria-hidden="true" />
                <a href="mailto:contact@collegecarts.in" className="hover:text-[#0c831f] hover:underline">
                  contact@collegecarts.in
                </a>
              </li>
            </ul>
            <Link
              to="/ContactUs"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c831f] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0a6b19] focus:outline-none focus:ring-2 focus:ring-[#0c831f] focus:ring-offset-2"
            >
              Contact support
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Site links ───────────────────────────────────────────────── */}
      <nav aria-label="Footer" className="border-t border-emerald-100 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
            <li>
              <Link to="/Shop" className="font-semibold text-slate-800 hover:text-[#0c831f]">Shop</Link>
            </li>
            <li>
              <Link to="/Categories" className="font-semibold text-slate-800 hover:text-[#0c831f]">Categories</Link>
            </li>
            {LEGAL_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="hover:text-[#0c831f] hover:underline">{l.label}</Link>
              </li>
            ))}
            <li>
              <Link to="/login" className="hover:text-[#0c831f] hover:underline">Sign in</Link>
            </li>
          </ul>
        </div>
      </nav>
    </div>
  );
}
