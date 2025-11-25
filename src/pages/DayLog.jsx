// src/pages/DayLog.jsx
import React, { useMemo, useState } from "react";
import { useAppState } from "../context/AppStateContext";
import FoodAutocomplete from "../components/FoodAutocomplete";

const MEAL_TYPES = [
  // Removed 'breakfast'
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
  const dailyTarget = state.profile.dailyKcalTarget || 0; // Needed for the header

  // Per-meal form state for adding new meals
  const [newMealFoodSearch, setNewMealFoodSearch] = useState({
    // Removed breakfast state
    lunch: "",
    dinner: "",
    extra: "",
  });
  const [newMealFoodId, setNewMealFoodId] = useState({
    // Removed breakfast state
    lunch: null,
    dinner: null,
    extra: null,
  });
  const [newQuantity, setNewQuantity] = useState({
    // Removed breakfast state
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
        activityFactor: state.profile.defaultActivityFactor ?? 1.2,
        hydrationLitres: 0,
        workoutKcal: 0,
        weightKg: null,
        notes: "",
        meals: [],
      }
    );
  }, [state.dayLogs, selectedDate, state.profile.defaultActivityFactor]);

  const hydrationLitres = dayLog.hydrationLitres ?? 0;
  const notes = dayLog.notes ?? "";
  const workoutKcal = dayLog.workoutKcal ?? 0;
  const activityFactor = dayLog.activityFactor ?? 1.2;

  const mealsByType = useMemo(() => {
    const grouped = {};
    MEAL_TYPES.forEach(type => grouped[type.id] = []);
    (dayLog.meals || []).forEach((m) => {
      // Ensure mealType is valid, default to 'extra' if unknown
      const key = MEAL_TYPES.some(t => t.id === m.mealType) ? m.mealType : 'extra'; 
      grouped[key].push(m);
    });
    return grouped;
  }, [dayLog.meals]);

  const totalIntakeKcal = (dayLog.meals || []).reduce(
    (sum, m) => sum + (m.totalKcal ?? m.kcalPerUnitSnapshot ?? 0),
    0
  );

  const netDayKcal = dailyTarget > 0 
    ? (dailyTarget * activityFactor) + workoutKcal - totalIntakeKcal 
    : 0;


  // ----- Handlers -----
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

  const handleHydrationChange = (e) => {
    dispatch({
      type: "UPDATE_DAY_HYDRATION",
      payload: {
        date: selectedDate,
        hydrationLitres: Number(e.target.value) || 0,
      },
    });
  };

  const handleNotesChange = (e) => {
    dispatch({
      type: "UPDATE_DAY_NOTES",
      payload: { date: selectedDate, notes: e.target.value },
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
    <>
      {/* 1. Page Header (Page Title + Date Picker) */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Day Log</h1>
          <p className="page-subtitle">
            Log meals, hydration, and exercise for the selected day.
          </p>
        </div>
        <div className="form-group form-group-inline">
          <label>
            <strong>Date:</strong>{" "}
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="input-date"
            />
          </label>
        </div>
      </div>

      <hr />

      {/* 2. Daily Summary Cards */}
      <div className="card-grid card-grid-3 section-spacer">
        
        {/* Card 1: Intake & Target */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Calories</span>
            <span className="card-meta">Intake vs. Net Target</span>
          </div>
          <div className="stat-value">
            {Math.round(totalIntakeKcal)} kcal
          </div>
          <div className="stat-label">
            Target Net: {netDayKcal > 0 ? "+" : ""}
            {Math.round(netDayKcal)} kcal
          </div>
        </div>

        {/* Card 2: Hydration & Notes */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Hydration & Notes</span>
          </div>
          <div className="stat-value">
            {hydrationLitres.toFixed(1)} L
          </div>
          <div className="stat-label">
            Notes: {notes ? "Logged" : "None"}
          </div>
        </div>
        
        {/* Card 3: Physical Stats (Weight & Workout) */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Physical Stats</span>
          </div>
          <div className="stat-value">
            {dayLog.weightKg ? `${dayLog.weightKg.toFixed(1)} kg` : "—"}
          </div>
          <div className="stat-label">
            Workout: {workoutKcal} kcal
          </div>
        </div>
      </div>

      <hr />

      {/* 3. Day Meta Section (Inputs) */}
      <section className="section-spacer">
        <h2 className="section-title">Day Details (Inputs)</h2>
        <div className="card-grid card-grid-4">
          
          {/* Activity Factor */}
          <div className="card form-card">
            <div className="card-header">Activity Factor</div>
            <label className="form-group">
              <input
                type="number"
                step="0.1"
                min="1.0"
                value={activityFactor}
                onChange={(e) =>
                  handleMetaChange({
                    activityFactor: Number(e.target.value) || 1.2,
                  })
                }
                className="input-full"
              />
              <small className="muted">Default: {state.profile.defaultActivityFactor}</small>
            </label>
            </div>

            {/* Workout Kcal */}
            <div className="card form-card">
            <div className="card-header">Workout kcal (manual)</div>
            <label className="form-group">
              <input
                type="number"
                min="0"
                value={workoutKcal}
                onChange={(e) =>
                  handleMetaChange({
                    workoutKcal: Number(e.target.value) || 0,
                  })
                }
                className="input-full"
              />
            </label>
            </div>

            {/* Weight */}
            <div className="card form-card">
            <div className="card-header">Weight (kg)</div>
            <label className="form-group">
              <input
                type="number"
                step="0.1"
                min="0"
                value={dayLog.weightKg ?? ""}
                onChange={(e) =>
                  handleMetaChange({
                    weightKg: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="input-full"
              />
            </label>
            </div>

            {/* Hydration */}
            <div className="card form-card">
            <div className="card-header">Water (Litres)</div>
            <label className="form-group">
              <input
                type="number"
                step="0.1"
                min="0"
                value={hydrationLitres}
                onChange={handleHydrationChange}
                className="input-full"
              />
            </label>
          </div>
          
        </div>
      </section>

      <hr />
      
      {/* 4. Notes Section */}
      <section className="section-spacer">
        <h2 className="section-title">Notes</h2>
        <textarea
          value={notes}
          onChange={handleNotesChange}
          className="textarea-full"
          placeholder="Add any notes about your day, mood, or activities here..."
        />
      </section>

      <hr />

      {/* 5. Meals sections (Now maps over Lunch, Dinner, Extras only) */}
      {MEAL_TYPES.map((meal) => {
        const mealEntries = mealsByType[meal.id] || [];
        const mealTotalKcal = mealEntries.reduce((sum, m) => sum + m.totalKcal, 0);

        return (
          <section key={meal.id} className="section-spacer">
            <h2 className="section-title">{meal.label} ({mealTotalKcal} kcal)</h2>

            {/* Quick Add favourites */}
            {favouriteFoods.length > 0 && (
              <div className="btn-row wrap-buttons">
                <strong>Quick Add:</strong>
                {favouriteFoods.map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    onClick={() => handleQuickAddFavourite(meal.id, food)}
                    className="btn-secondary btn-small"
                  >
                    {food.name}
                  </button>
                ))}
              </div>
            )}

            {/* Meal list */}
            {mealEntries.length === 0 ? (
              <p className="muted">No entries yet for {meal.label}.</p>
            ) : (
              <table className="data-table meal-table">
                <thead>
                  <tr>
                    <th className="text-left">Food</th>
                    <th className="text-right">Qty</th>
                    <th className="text-left">Unit</th>
                    <th className="text-right">kcal / unit</th>
                    <th className="text-right">Total kcal</th>
                    <th className="text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mealEntries.map((m) => {
                    const isEditing = editingMealId === m.id;
                    return (
                      <tr key={m.id} className={isEditing ? 'editing-row' : ''}>
                        <td>{m.foodNameSnapshot}</td>
                        <td className="text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={editingQuantity}
                              onChange={(e) =>
                                setEditingQuantity(e.target.value)
                              }
                              className="input-small text-right"
                            />
                          ) : (
                            m.quantity
                          )}
                        </td>
                        <td>{m.unitLabelSnapshot}</td>
                        <td className="text-right">
                          {m.kcalPerUnitSnapshot}
                        </td>
                        <td className="text-right">{m.totalKcal}</td>
                        <td className="btn-row">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveEditMeal(m)}
                                className="btn-primary btn-small"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditMeal}
                                className="btn-secondary btn-small"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditMeal(m)}
                                className="btn-secondary btn-small"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMeal(m.id)}
                                className="btn-danger btn-small"
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
              className="add-meal-form"
            >
              <div className="form-row-compact">
                <div className="form-group food-autocomplete-container">
                  <FoodAutocomplete
                    foods={allFoods}
                    value={newMealFoodSearch[meal.id]}
                    onChangeText={(text) => {
                      setNewMealFoodSearch((prev) => ({
                        ...prev,
                        [meal.id]: text,
                      }));
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

                <div className="form-group">
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
                      className="input-small text-right"
                    />
                  </label>
                </div>

                <button type="submit" className="btn-primary">Add</button>
              </div>

              <small className="muted form-help-text">
                Can’t find a food? Add it first in the <strong>Foods</strong> tab.
              </small>

              {newMealFoodId[meal.id] && (
                <div className="form-selection-info">
                  Selected:{" "}
                  <strong>
                    {
                      allFoods.find(
                        (f) => f.id === newMealFoodId[meal.id]
                      )?.name
                    }
                  </strong>
                  (Unit:{" "}
                  {
                    allFoods.find(
                      (f) => f.id === newMealFoodId[meal.id]
                    )?.unitLabel
                  })
                </div>
              )}
            </form>
          </section>
        );
      })}
    </>
  );
}