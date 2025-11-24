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
  
  // 1. Fix: Per-meal state (keyed by meal type)
  const [newMealFoodSearch, setNewMealFoodSearch] = useState({
    lunch: "",
    dinner: "",
    extra: "",
  });
  const [newMealFoodId, setNewMealFoodId] = useState({
    lunch: null,
    dinner: null,
    extra: null,
  });
  const [newQuantity, setNewQuantity] = useState({
    lunch: "1",
    dinner: "1",
    extra: "1",
  });
  
  // 4.2 Add simple edit UI in DayLog state
  const [editingMealId, setEditingMealId] = useState(null);
  const [editingQuantity, setEditingQuantity] = useState("");


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

  // 1. Update handleQuickAddFavourite to use per-meal state
  const handleQuickAddFavourite = (mealType, food) => {
    // keep form in sync for that meal only
    setNewMealFoodSearch((prev) => ({ ...prev, [mealType]: food.name }));
    setNewMealFoodId((prev) => ({ ...prev, [mealType]: food.id }));
    setNewQuantity((prev) => ({ ...prev, [mealType]: "1" }));

    // actually add with quantity 1
    addMealEntry(mealType, food, 1);
  };
  
  // 1. Update handleAddMeal to read/write per-meal values
  const handleAddMeal = (e, mealType) => {
    e.preventDefault();
    
    const quantity = parseFloat(newQuantity[mealType] || "0");
    const foodId = newMealFoodId[mealType];

    if (!foodId) {
      alert("Pick a food from your Foods database first.");
      return;
    }

    const food = allFoods.find((f) => f.id === foodId);
    if (!food) {
      alert("Selected food not found. Try again.");
      return;
    }
    
    if (quantity <= 0) {
      alert("Quantity must be greater than zero.");
      return;
    }

    addMealEntry(mealType, food, quantity);

    // reset just this meal’s form
    setNewMealFoodSearch((prev) => ({ ...prev, [mealType]: "" }));
    setNewMealFoodId((prev) => ({ ...prev, [mealType]: null }));
    setNewQuantity((prev) => ({ ...prev, [mealType]: "1" }));
  };
  
  // --- Memoized Values & Handlers (existing code) ---
  
  // 4.2 Start/Cancel/Save handlers for editing meals
  const startEditMeal = (meal) => {
    setEditingMealId(meal.id);
    setEditingQuantity(String(meal.quantity ?? 1));
  };
  
  const cancelEditMeal = () => {
    setEditingMealId(null);
    setEditingQuantity("");
  };
  
  const handleSaveEditMeal = (meal) => {
    const qty = parseFloat(editingQuantity);
    if (!qty || qty <= 0) {
      alert("Quantity must be greater than zero.");
      return;
    }

    dispatch({
      type: "UPDATE_MEAL_ENTRY",
      payload: { date: selectedDate, mealId: meal.id, quantity: qty },
    });

    cancelEditMeal();
  };


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
    // If we delete the meal being edited, cancel the edit mode
    if (editingMealId === mealId) {
      cancelEditMeal();
    }
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
                  // 4.2 Conditional row for editing
                  <tr key={m.id}>
                    <td>{m.foodNameSnapshot}</td>

                    {editingMealId === m.id ? (
                      <>
                        <td>
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            value={editingQuantity}
                            onChange={(e) => setEditingQuantity(e.target.value)}
                            style={{ width: "70px" }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>{m.unitLabelSnapshot}</td>
                        <td style={{ textAlign: "center" }}>{m.kcalPerUnitSnapshot}</td>
                        <td style={{ textAlign: "center" }}>{m.totalKcal}</td>
                        <td style={{ textAlign: "center" }}>
                          <button type="button" onClick={() => handleSaveEditMeal(m)}>
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditMeal}
                            style={{ marginLeft: "0.25rem" }}
                          >
                            Cancel
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ textAlign: "center" }}>{m.quantity}</td>
                        <td style={{ textAlign: "center" }}>
                          {m.unitLabelSnapshot}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {m.kcalPerUnitSnapshot}
                        </td>
                        <td style={{ textAlign: "center" }}>{m.totalKcal}</td>
                        <td style={{ textAlign: "center" }}>
                          <button type="button" onClick={() => startEditMeal(m)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMeal(m.id)}
                            style={{ marginLeft: "0.25rem" }}
                          >
                            ✕
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 1. JSX for Add Meal Form updated to use per-meal state */}
          <form
            onSubmit={(e) => handleAddMeal(e, meal.id)}
            style={{ marginTop: "0.5rem" }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: 'center' }}>
              
              <FoodAutocomplete
                foods={allFoods}
                value={newMealFoodSearch[meal.id] || ""}
                onChangeText={(text) => {
                  setNewMealFoodSearch((prev) => ({
                    ...prev,
                    [meal.id]: text,
                  }));
                  // if user starts typing again, clear selected food for this meal
                  setNewMealFoodId((prev) => ({
                    ...prev,
                    [meal.id]: null,
                  }));
                }}
                onSelectFood={(food) => {
                  setNewMealFoodSearch((prev) => ({
                    ...prev,
                    [meal.id]: food.name,
                  }));
                  setNewMealFoodId((prev) => ({
                    ...prev,
                    [meal.id]: food.id,
                  }));
                }}
                placeholder="Search saved foods…"
              />

              {/* Quantity input */}
              <input
                type="number"
                step="0.25"
                min="0"
                value={newQuantity[meal.id] || "1"}
                onChange={(e) =>
                  setNewQuantity((prev) => ({
                    ...prev,
                    [meal.id]: e.target.value,
                  }))
                }
                style={{ width: "80px", marginLeft: "0.5rem" }}
              />

              <button 
                type="submit" 
                disabled={!newMealFoodId[meal.id] || parseFloat(newQuantity[meal.id] || '0') <= 0}
                style={{ marginLeft: "0.5rem" }}
              >
                Add
              </button>
            </div>
            
            {/* Small helper text for creating new foods (3. Inline creation decision) */}
            <div style={{ fontSize: 12, marginTop: "0.25rem", opacity: 0.7 }}>
              Can’t find a food? Add it in the <a href="/foods">Foods</a> tab first.
            </div>

            {newMealFoodId[meal.id] && (
                <p style={{ fontSize: "0.8rem", opacity: 0.8, marginTop: "0.25rem" }}>
                    Selected: {allFoods.find(f => f.id === newMealFoodId[meal.id])?.name} (Unit: {allFoods.find(f => f.id === newMealFoodId[meal.id])?.unitLabel})
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