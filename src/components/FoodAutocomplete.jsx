// src/components/FoodAutocomplete.jsx
import React, { useState, useMemo } from "react";

/**
 * Props:
 * - foods: array of { id, name, category, unitLabel, kcalPerUnit }
 * - value: current text in the input
 * - onChangeText: (string) => void
 * - onSelectFood: (foodObj) => void
 * - placeholder?: string
 */
export default function FoodAutocomplete({
  foods,
  value,
  onChangeText,
  onSelectFood,
  placeholder = "Search food…",
}) {
  const [isOpen, setIsOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = (value || "").trim().toLowerCase();
    if (!q) return [];
    return foods
      .filter((f) => f.name.toLowerCase().includes(q))
      .slice(0, 8); // limit to 8 suggestions
  }, [foods, value]);

  const handleChange = (e) => {
    const next = e.target.value;
    onChangeText(next);
    if (next.trim()) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelect = (food) => {
    onSelectFood(food);
    setIsOpen(false);
  };

  const showList = isOpen && suggestions.length > 0;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        value={value}
        onChange={handleChange}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        onBlur={() => {
          // small delay so a click on suggestion still registers
          setTimeout(() => setIsOpen(false), 150);
        }}
        placeholder={placeholder}
        style={{ width: "100%" }}
      />

      {showList && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "#ffffff",
            color: "#111111",
            border: "1px solid #ccc",
            zIndex: 20,
            maxHeight: "200px",
            overflowY: "auto",
            fontSize: 14,
          }}
        >
          {suggestions.map((food) => (
            <div
              key={food.id}
              onMouseDown={(e) => {
                // prevent blur from input before click
                e.preventDefault();
                handleSelect(food);
              }}
              style={{
                padding: "4px 8px",
                cursor: "pointer",
                backgroundColor: "#ffffff",
              }}
            >
              <div>{food.name}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {food.category} · {food.unitLabel} ·{" "}
                {food.kcalPerUnit} kcal/{food.unitLabel}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}