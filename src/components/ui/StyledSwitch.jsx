import React from "react";

export default function StyledSwitch({ checked, onCheckedChange, id }) {
  return (
    <div className="styled-switch">
      <input
        type="checkbox"
        id={id}
        checked={!!checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
      />
      <label htmlFor={id} className="label" />
      <style>{`
        .styled-switch {
          display: flex;
          align-items: center;
        }
        .styled-switch input {
          display: none;
        }
        .styled-switch .label {
          height: 28px;
          width: 48px;
          background-color: #e5e7eb;
          border-radius: 14px;
          border: 1px solid #d1d5db;
          display: flex;
          align-items: center;
          cursor: pointer;
          position: relative;
          transition: background-color 0.25s ease;
          flex-shrink: 0;
          will-change: background-color;
          -webkit-font-smoothing: antialiased;
        }
        .styled-switch input:checked ~ .label {
          background-color: #0c831f;
          border-color: #0c831f;
        }
        .styled-switch input:checked ~ .label::before {
          left: 24px;
          background-color: #111;
          background-image: linear-gradient(315deg, #000000 0%, #2a2a2a 70%);
        }
        .styled-switch .label::before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background-color: #fff;
          background-image: linear-gradient(130deg, #9a9a9a 10%, #ffffff 45%, #7a7a7a 62%);
          left: 3px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
          transition: left 0.25s ease, background 0.25s ease;
          will-change: left;
        }
      `}</style>
    </div>
  );
}
