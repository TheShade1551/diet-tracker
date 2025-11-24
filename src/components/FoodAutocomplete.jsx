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
    setIsOpen(true);
  };

  const handleSelect = (food) => {
    onSelectFood(food);
    setIsOpen(false);
  };

  const showList = isOpen && suggestions.length > 0;

  // 2. Suggestions list is “white on white” Fix
  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
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
            background: "#fff",
            border: "1px solid #ccc",
            zIndex: 10,
            maxHeight: "200px",
            overflowY: "auto",
            fontSize: 14,
          }}
        >
          {suggestions.map((food) => (
            <div
              key={food.id}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur killing the click
                handleSelect(food);
              }}
              style={{ padding: "4px 8px", cursor: "pointer" }}
            >
              <div>{food.name}</div>
              <div style={{ opacity: 0.7 }}>
                {food.category} · {food.unitLabel} · {food.kcalPerUnit} kcal/
                {food.unitLabel}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}