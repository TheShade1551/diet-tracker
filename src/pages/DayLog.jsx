// src/pages/DayLog.jsx
import React, { useMemo, useState } from "react";
import { useAppState } from "../context/AppStateContext";
import FoodAutocomplete from "../components/FoodAutocomplete";

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

export default function DayLog() {
  const { state, dispatch } = useAppState();
  const selectedDate = state.selectedDate;

  // Per-meal form state for adding new meals
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

  // Inline edit state
  const [editingMealId, setEditingMealId] = useState(null);
  const [editingQuantity, setEditingQuantity] = useState("");

  const allFoods = state.foodItems || [];
  const favouriteFoods = allFoods.filter((f) => f.isFavourite);

  const addMealEntry = (mealType, food, qty) => {
    const quantityNumber = Number(qty);
    if (!food || !quantityNumber || quantityNumber <= 0) return;

    const totalKcal = Math.round(quantityNumber * food.kcalPerUnit);

    dispatch({
      type: "ADD_MEAL_ENTRY",
      payload: {
        id: window.crypto?.randomUUID
          ? window.crypto.randomUUID()
          : generateId("meal"),
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

  const handleQuickAddFavourite = (mealType, food) => {
    // keep the form visually in sync for that meal
    setNewMealFoodSearch((prev) => ({ ...prev, [mealType]: food.name }));
    setNewMealFoodId((prev) => ({ ...prev, [mealType]: food.id }));
    setNewQuantity((prev) => ({ ...prev, [mealType]: "1" }));

    addMealEntry(mealType, food, 1);
  };

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

  // ----- Inline edit helpers -----
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
      payload: {
        date: selectedDate,
        mealId: meal.id,
        quantity: qty,
      },
    });

    cancelEditMeal();
  };

  // ----- Derived day data -----
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

    if (editingMealId === mealId) {
      cancelEditMeal();
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Day Log</h1>

      {/* Top controls: date + summary */}
      <div style={{ marginBottom: "1rem" }}>
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
      </div>

      {/* Day Meta */}
      <section style={{ marginBottom: "1rem" }}>
        <h2>Day meta</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <label>
            Activity factor:{" "}
            <input
              type="number"
              step="0.1"
              value={dayLog.activityFactor ?? 1.2}
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
              value={dayLog.workoutKcal ?? 0}
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
              step="0.1"
              value={dayLog.weightKg ?? ""}
              onChange={(e) =>
                handleMetaChange({
                  weightKg: e.target.value ? Number(e.target.value) : null,
                })
              }
              style={{ width: "80px" }}
            />
          </label>
        </div>
      </section>

      {/* Meals sections */}
      {MEAL_TYPES.map((meal) => {
        const mealEntries = mealsByType[meal.id] || [];

        return (
          <section key={meal.id} style={{ marginBottom: "1.5rem" }}>
            <h2>{meal.label}</h2>

            {/* Quick Add favourites */}
            {favouriteFoods.length > 0 && (
              <div style={{ marginBottom: "0.5rem" }}>
                <div style={{ marginBottom: "0.25rem" }}>
                  <strong>Quick add favourites:</strong>
                </div>
                {favouriteFoods.map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    onClick={() => handleQuickAddFavourite(meal.id, food)}
                    style={{
                      padding: "0.25rem 0.5rem",
                      cursor: "pointer",
                      marginRight: "0.25rem",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {food.name}
                  </button>
                ))}
              </div>
            )}

            {/* Meal list */}
            {mealEntries.length === 0 ? (
              <p>No entries yet.</p>
            ) : (
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  maxWidth: "600px",
                }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Food</th>
                    <th style={{ textAlign: "right" }}>Qty</th>
                    <th style={{ textAlign: "left" }}>Unit</th>
                    <th style={{ textAlign: "right" }}>kcal / unit</th>
                    <th style={{ textAlign: "right" }}>Total kcal</th>
                    <th style={{ textAlign: "left" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mealEntries.map((m) => {
                    const isEditing = editingMealId === m.id;
                    return (
                      <tr key={m.id}>
                        <td>{m.foodNameSnapshot}</td>
                        <td style={{ textAlign: "right" }}>
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={editingQuantity}
                              onChange={(e) =>
                                setEditingQuantity(e.target.value)
                              }
                              style={{ width: "70px" }}
                            />
                          ) : (
                            m.quantity
                          )}
                        </td>
                        <td>{m.unitLabelSnapshot}</td>
                        <td style={{ textAlign: "right" }}>
                          {m.kcalPerUnitSnapshot}
                        </td>
                        <td style={{ textAlign: "right" }}>{m.totalKcal}</td>
                        <td>
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveEditMeal(m)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditMeal}
                                style={{ marginLeft: "0.25rem" }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditMeal(m)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMeal(m.id)}
                                style={{ marginLeft: "0.25rem" }}
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Add meal form for this meal type */}
            <form
              onSubmit={(e) => handleAddMeal(e, meal.id)}
              style={{ marginTop: "0.5rem", maxWidth: "600px" }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 250px" }}>
                  <FoodAutocomplete
                    foods={allFoods}
                    value={newMealFoodSearch[meal.id]}
                    onChangeText={(text) => {
                      setNewMealFoodSearch((prev) => ({
                        ...prev,
                        [meal.id]: text,
                      }));
                      // If user starts typing again, clear selection for this meal
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
                </div>

                <label>
                  Qty:{" "}
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={newQuantity[meal.id]}
                    onChange={(e) =>
                      setNewQuantity((prev) => ({
                        ...prev,
                        [meal.id]: e.target.value,
                      }))
                    }
                    style={{ width: "80px" }}
                  />
                </label>

                <button type="submit">Add</button>
              </div>

              <small style={{ display: "block", marginTop: "0.25rem" }}>
                Can’t find a food? Add it first in the <strong>Foods</strong>{" "}
                tab.
              </small>

              {newMealFoodId[meal.id] && (
                <div style={{ marginTop: "0.25rem", fontSize: "0.9rem" }}>
                  Selected:{" "}
                  {
                    allFoods.find(
                      (f) => f.id === newMealFoodId[meal.id]
                    )?.name
                  }{" "}
                  (Unit:{" "}
                  {
                    allFoods.find(
                      (f) => f.id === newMealFoodId[meal.id]
                    )?.unitLabel
                  }
                  )
                </div>
              )}
            </form>
          </section>
        );
      })}

      <hr />

      {/* Hydration & Notes */}
      <section style={{ marginTop: "1rem" }}>
        <h2>Hydration</h2>
        <label>
          Water (litres) for this day:{" "}
          <input
            type="number"
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
          value={notes}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_DAY_NOTES",
              payload: { date: selectedDate, notes: e.target.value },
            })
          }
          style={{ width: "100%", maxWidth: "500px", minHeight: "80px" }}
        />
      </section>
    </div>
  );
}