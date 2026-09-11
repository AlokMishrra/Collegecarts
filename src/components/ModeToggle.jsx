import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function ModeToggle() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMeals = location.pathname === "/meals";

  const handleToggle = (mode) => {
    if (mode === "meals") {
      navigate("/meals");
    } else {
      navigate("/Shop");
    }
  };

  return (
    <div
      className="flex items-center bg-gray-100 rounded-full p-0.5 relative"
      style={{ width: "200px", height: "36px" }}
    >
      {/* Sliding pill background */}
      <div
        className="absolute top-0.5 bottom-0.5 rounded-full transition-all duration-300 ease-in-out"
        style={{
          width: "calc(50% - 2px)",
          left: isMeals ? "calc(50% + 1px)" : "2px",
          background: isMeals
            ? "linear-gradient(135deg, #f97316, #ef4444)"
            : "linear-gradient(135deg, #10b981, #059669)",
          boxShadow: isMeals
            ? "0 2px 8px rgba(249, 115, 22, 0.4)"
            : "0 2px 8px rgba(16, 185, 129, 0.4)",
        }}
      />

      {/* Shop button */}
      <button
        onClick={() => handleToggle("shop")}
        className={`relative z-10 flex-1 text-sm font-semibold rounded-full py-1.5 transition-colors duration-300 ${
          !isMeals ? "text-white" : "text-gray-500 hover:text-gray-700"
        }`}
        style={{ border: "none", background: "transparent", cursor: "pointer" }}
      >
        Shop
      </button>

      {/* Meals button */}
      <button
        onClick={() => handleToggle("meals")}
        className={`relative z-10 flex-1 text-sm font-semibold rounded-full py-1.5 transition-colors duration-300 ${
          isMeals ? "text-white" : "text-gray-500 hover:text-gray-700"
        }`}
        style={{ border: "none", background: "transparent", cursor: "pointer" }}
      >
        Meals
      </button>
    </div>
  );
}
