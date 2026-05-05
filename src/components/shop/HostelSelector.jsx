import React, { useState } from "react";
import { createPortal } from "react-dom";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Building2, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function HostelSelector({ onHostelSelected, onClose, currentHostel }) {
  const [selectedHostel, setSelectedHostel] = useState(currentHostel || null);
  const [isLoading, setIsLoading] = useState(false);

  const hostels = [
    { id: "Mithali",    name: "Mithali Hostel",   icon: "🏠" },
    { id: "Gavaskar",   name: "Gavaskar Hostel",   icon: "🏢" },
    { id: "Virat",      name: "Virat Hostel",      icon: "🏛️" },
    { id: "Tendulkar",  name: "Tendulkar Hostel",  icon: "🏘️" },
    { id: "Other",      name: "Other Location",    icon: "📍" },
  ];

  const handleSubmit = async () => {
    if (!selectedHostel) return;
    setIsLoading(true);
    try {
      await User.updateMyUserData({ selected_hostel: selectedHostel });
      onHostelSelected(selectedHostel);
    } catch (error) {
      console.error("Error updating hostel:", error);
    }
    setIsLoading(false);
  };

  const handleBackdropClick = (e) => {
    // Only close if clicking the backdrop itself, not the card
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="hostel-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleBackdropClick}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          backgroundColor: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          overflowY: "auto",
        }}
      >
        <motion.div
          key="hostel-card"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: "#fff",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "480px",
            boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Header */}
          <div style={{ padding: "24px 24px 16px", borderBottom: "1px solid #f0f0f0" }}>
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  background: "#f3f4f6",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={16} color="#6b7280" />
              </button>
            )}
            <div style={{
              width: "56px", height: "56px",
              backgroundColor: "#d1fae5",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "12px",
            }}>
              <Building2 size={28} color="#059669" />
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#111827", margin: 0 }}>
              Select Your Hostel
            </h2>
            <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
              Choose your hostel to get accurate delivery & stock info
            </p>
          </div>

          {/* Hostel List */}
          <div style={{ padding: "16px 24px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {hostels.map((hostel) => {
                const isSelected = selectedHostel === hostel.id;
                return (
                  <button
                    key={hostel.id}
                    onClick={() => setSelectedHostel(hostel.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: "12px",
                      border: isSelected ? "2px solid #059669" : "2px solid #e5e7eb",
                      backgroundColor: isSelected ? "#f0fdf4" : "#fff",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "24px", lineHeight: 1 }}>{hostel.icon}</span>
                      <span style={{
                        fontSize: "15px",
                        fontWeight: isSelected ? "600" : "500",
                        color: isSelected ? "#065f46" : "#374151",
                      }}>
                        {hostel.name}
                      </span>
                    </div>
                    {isSelected && (
                      <div style={{
                        width: "22px", height: "22px",
                        backgroundColor: "#059669",
                        borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <Check size={13} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "0 24px 24px" }}>
            <button
              onClick={handleSubmit}
              disabled={!selectedHostel || isLoading}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                backgroundColor: !selectedHostel || isLoading ? "#d1d5db" : "#059669",
                color: "#fff",
                fontSize: "16px",
                fontWeight: "600",
                cursor: !selectedHostel || isLoading ? "not-allowed" : "pointer",
                transition: "background-color 0.15s ease",
              }}
            >
              {isLoading ? "Saving..." : "Confirm Hostel"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
