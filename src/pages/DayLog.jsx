// src/pages/DayLog.jsx
import React, { useMemo, useState } from "react";
import { useAppState } from "../context/AppStateContext";
import FoodAutocomplete from "../components/FoodAutocomplete"; // 1. Added Import

const MEAL_TYPES = [
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "extra", label: "Extras / Snacks" },
];

function generateId(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ----------------------------------------------------
// NOTE: AddMealForm Component has been removed/merged
// ----------------------------------------------------

export default function DayLog() {
  const { state, dispatch } = useAppState();

  const selectedDate = state.selectedDate;
  
  // 2. Add New Local State for the Add Meal form
  const [newMealFoodSearch, setNewMealFoodSearch] = useState("");
  const [newMealFoodId, setNewMealFoodId] = useState(null);
  const [newQuantity, setNewQuantity] = useState("1"); // Added quantity state for the new form

  // 3.1 Get favourite foods from state
  const allFoods = state.foodItems || [];
  const favouriteFoods = allFoods.filter((f) => f.isFavourite);

  // 3.2 Extract a helper for “actually add a meal” (Updated ID generation)
  const addMealEntry = (mealType, food, qty) => {
    const quantityNumber = Number(qty);
    if (!food || !quantityNumber || quantityNumber <= 0) return;

    const totalKcal = Math.round(quantityNumber * food.kcalPerUnit);

    dispatch({
      type: "ADD_MEAL_ENTRY",
      payload: {
        id: window.crypto?.randomUUID ? window.crypto.randomUUID() : generateId("meal"),
        date: selectedDate,
        mealType,
        foodItemId: food.id,
        foodNameSnapshot: food.name,
        unitLabelSnapshot: food.unitLabel,
        kcalPerUnitSnapshot: food.kcalPerUnit,
        quantity: quantityNumber,
        totalKcal,
      },
    });
  };

  // 3.3 Add Quick Add handler
  const handleQuickAddFavourite = (mealType, food) => {
    // Optional sugar: also set autocomplete/quantity visually (not required, but good UX)
    setNewMealFoodSearch(food.name);
    setNewMealFoodId(food.id);
    setNewQuantity("1");
    
    // Add the meal entry
    addMealEntry(mealType, food, 1);
  };
  
  // 2.3 Make sure handleAddMeal uses the selected food
  const handleAddMeal = (e, mealType) => {
    e.preventDefault();
    
    const quantity = parseFloat(newQuantity) || 0;
    
    if (!newMealFoodId) {
      alert("Pick a food from your Foods database first.");
      return;
    }

    const food = allFoods.find((f) => f.id === newMealFoodId);
    if (!food) {
      alert("Selected food not found. Try again.");
      return;
    }
    
    if (quantity <= 0) {
        alert("Quantity must be greater than zero.");
        return;
    }

    addMealEntry(mealType, food, quantity);

    // Reset the form state
    setNewMealFoodSearch("");
    setNewMealFoodId(null);
    setNewQuantity("1"); 
  };
  
  // --- Memoized Values & Handlers (existing code) ---

  // Get the day log, falling back to an empty object
  const dayLog = useMemo(() => {
    return (
      state.dayLogs[selectedDate] || {
        date: selectedDate,
        activityFactor: 1.2,
        hydrationLitres: 0,
        workoutKcal: 0,
        weightKg: null,
        notes: "",
        meals: [],
      }
    );
  }, [state.dayLogs, selectedDate]);

  // Extract new/updated fields
  const hydrationLitres = dayLog.hydrationLitres ?? 0;
  const notes = dayLog.notes ?? "";


  const mealsByType = useMemo(() => {
    const grouped = { lunch: [], dinner: [], extra: [] };
    (dayLog.meals || []).forEach((m) => {
      if (!grouped[m.mealType]) grouped[m.mealType] = [];
      grouped[m.mealType].push(m);
    });
    return grouped;
  }, [dayLog.meals]);

  const totalIntakeKcal = (dayLog.meals || []).reduce(
    (sum, m) => sum + (m.totalKcal ?? m.kcalPerUnitSnapshot ?? 0),
    0
  );

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    if (!newDate) return;
    dispatch({ type: "SET_SELECTED_DATE", payload: newDate });
  };

  const handleMetaChange = (patch) => {
    dispatch({
      type: "UPDATE_DAY_META",
      payload: { date: selectedDate, patch },
    });
  };

  const handleDeleteMeal = (mealId) => {
    dispatch({
      type: "DELETE_MEAL_ENTRY",
      payload: { date: selectedDate, mealId },
    });
  };

  return (
    <div>
      <h1>Day Log</h1>

      {/* Top controls: date + summary */}
      <section style={{ marginBottom: "1rem" }}>
        <label>
          Date:{" "}
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
          />
        </label>

        <div style={{ marginTop: "0.5rem" }}>
          <strong>Total intake:</strong> {totalIntakeKcal} kcal
        </div>
      </section>

      {/* Day Meta (Activity & Workout Kcal remain here, Hydration/Notes moved/updated) */}
      <section style={{ marginBottom: "1rem" }}>
        <h2>Day meta</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <label>
            Activity factor:{" "}
            <input
              type="number"
              step="0.01"
              min="1"
              max="2.5"
              value={dayLog.activityFactor}
              onChange={(e) =>
                handleMetaChange({
                  activityFactor: Number(e.target.value) || 1.2,
                })
              }
              style={{ width: "80px" }}
            />
          </label>
          
          <label>
            Workout kcal (manual):{" "}
            <input
              type="number"
              min="0"
              value={dayLog.workoutKcal}
              onChange={(e) =>
                handleMetaChange({
                  workoutKcal: Number(e.target.value) || 0,
                })
              }
              style={{ width: "100px" }}
            />
          </label>

          <label>
            Weight (kg):{" "}
            <input
              type="number"
              min="0"
              step="0.1"
              value={dayLog.weightKg ?? ""}
              onChange={(e) =>
                handleMetaChange({
                  weightKg: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
              style={{ width: "80px" }}
            />
          </label>
        </div>
      </section>

      {/* Meals sections */}
      {MEAL_TYPES.map((meal) => (
        <section key={meal.id} style={{ marginBottom: "1.5rem" }}>
          <h2>{meal.label}</h2>

          {/* Quick Add buttons (from previous step) */}
          {favouriteFoods.length > 0 && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.9rem", marginBottom: "0.75rem" }}>
              <div>Quick add favourites:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.25rem" }}>
                {favouriteFoods.map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    onClick={() => handleQuickAddFavourite(meal.id, food)} 
                    style={{ padding: "0.25rem 0.5rem", cursor: "pointer" }}
                  >
                    {food.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Meal List */}
          {(mealsByType[meal.id] || []).length === 0 ? (
            <p style={{ fontSize: "0.9rem", opacity: 0.7 }}>
              No entries yet.
            </p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: "0.5rem",
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Food</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>kcal/unit</th>
                  <th>Total kcal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mealsByType[meal.id].map((m) => (
                  <tr key={m.id}>
                    <td>{m.foodNameSnapshot}</td>
                    <td style={{ textAlign: "center" }}>{m.quantity}</td>
                    <td style={{ textAlign: "center" }}>
                      {m.unitLabelSnapshot}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {m.kcalPerUnitSnapshot}
                    </td>
                    <td style={{ textAlign: "center" }}>{m.totalKcal}</td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteMeal(m.id)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* NEW Autocomplete Add Meal Form */}
          <form onSubmit={(e) => handleAddMeal(e, meal.id)} style={{ marginTop: "0.5rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: 'center' }}>
              
              {/* 2.2 Use <FoodAutocomplete /> in the form */}
              <FoodAutocomplete
                foods={allFoods}
                value={newMealFoodSearch}
                onChangeText={(text) => {
                  setNewMealFoodSearch(text);
                  setNewMealFoodId(null); // reset selection if user starts typing again
                }}
                onSelectFood={(food) => {
                  setNewMealFoodSearch(food.name);
                  setNewMealFoodId(food.id);
                }}
                placeholder="Search saved foods…"
              />
              
              {/* Quantity input remains */}
              <input
                type="number"
                min="0.1"
                step="0.1"
                placeholder="Qty"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                style={{ width: "80px" }}
              />
              
              <button type="submit" disabled={!newMealFoodId || parseFloat(newQuantity) <= 0}>
                Add
              </button>
            </div>
            {newMealFoodId && (
                <p style={{ fontSize: "0.8rem", opacity: 0.8, marginTop: "0.25rem" }}>
                    Selected: {allFoods.find(f => f.id === newMealFoodId)?.name} (Unit: {allFoods.find(f => f.id === newMealFoodId)?.unitLabel})
                </p>
            )}
          </form>
        </section>
      ))}
      
      {/* ------------------------------------------------ */}
      {/* NEW UI FOR HYDRATION AND NOTES (existing code) */}
      {/* ------------------------------------------------ */}

      <hr style={{ margin: "1.5rem 0" }} />

      <section>
        <h2>Hydration</h2>
        <label>
          Water (litres) for this day:{" "}
          <input
            type="number"
            min="0"
            step="0.1"
            value={hydrationLitres}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_DAY_HYDRATION",
                payload: {
                  date: selectedDate,
                  hydrationLitres: Number(e.target.value) || 0,
                },
              })
            }
          />
        </label>
      </section>

      <section style={{ marginTop: "1rem" }}>
        <h2>Notes</h2>
        <textarea
          rows={3}
          placeholder="How did you feel today? Hunger, mood, sleep, whatever..."
          value={notes}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_DAY_NOTES",
              payload: { date: selectedDate, notes: e.target.value },
            })
          }
          style={{ width: "100%", maxWidth: "500px" }}
        />
      </section>
    </div>
  );
}