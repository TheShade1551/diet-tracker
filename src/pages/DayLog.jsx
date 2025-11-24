// src/pages/DayLog.jsx
import React, { useMemo, useState } from "react";
import { useAppState } from "../context/AppStateContext";

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

// Small reusable form for adding one meal entry
function AddMealForm({ mealType, date }) {
  const { state, dispatch } = useAppState();
  const [foodName, setFoodName] = useState("");
  const [category, setCategory] = useState("home"); // home | street | drink | cheat etc (for future)
  const [unitLabel, setUnitLabel] = useState("plate");
  const [kcalPerUnit, setKcalPerUnit] = useState("");
  const [quantity, setQuantity] = useState("1");

  const isValid =
    foodName.trim() !== "" &&
    unitLabel.trim() !== "" &&
    Number(kcalPerUnit) > 0 &&
    Number(quantity) > 0;

  const handleAdd = (e) => {
    e.preventDefault();
    if (!isValid) return;

    const kcalPerUnitNum = Number(kcalPerUnit);
    const quantityNum = Number(quantity);

    const totalKcal = Math.round(kcalPerUnitNum * quantityNum);

    // 1) See if a foodItem already exists with same name + unit
    const existing = state.foodItems.find(
      (f) =>
        f.name.toLowerCase() === foodName.trim().toLowerCase() &&
        f.unitLabel.toLowerCase() === unitLabel.trim().toLowerCase()
    );

    let foodId;

    if (existing) {
      foodId = existing.id;

      // Optional: keep kcalPerUnit in sync if you tweak it over time
      if (
        existing.kcalPerUnit !== kcalPerUnitNum ||
        existing.category !== category
      ) {
        dispatch({
          type: "UPSERT_FOOD_ITEM",
          payload: {
            id: existing.id,
            name: existing.name,
            category,
            unitLabel: existing.unitLabel,
            kcalPerUnit: kcalPerUnitNum,
          },
        });
      }
    } else {
      foodId = generateId("food");
      dispatch({
        type: "UPSERT_FOOD_ITEM",
        payload: {
          id: foodId,
          name: foodName.trim(),
          category,
          unitLabel: unitLabel.trim(),
          kcalPerUnit: kcalPerUnitNum,
        },
      });
    }

    // 2) Add meal entry (snapshot fields so if you later tweak DB, log still shows what was logged)
    dispatch({
      type: "ADD_MEAL_ENTRY",
      payload: {
        id: generateId("meal"),
        date,
        mealType,
        foodItemId: foodId,
        foodNameSnapshot: foodName.trim(),
        unitLabelSnapshot: unitLabel.trim(),
        kcalPerUnitSnapshot: kcalPerUnitNum,
        quantity: quantityNum,
        totalKcal,
      },
    });

    // Clear form
    setFoodName("");
    setKcalPerUnit("");
    setQuantity("1");
  };

  return (
    <form onSubmit={handleAdd} style={{ marginTop: "0.5rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <input
          type="text"
          placeholder="Food name"
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Category (home/street/cheat/drink)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <input
          type="text"
          placeholder="Unit (plate, piece...)"
          value={unitLabel}
          onChange={(e) => setUnitLabel(e.target.value)}
          style={{ width: "120px" }}
        />
        <input
          type="number"
          min="0"
          placeholder="kcal per unit"
          value={kcalPerUnit}
          onChange={(e) => setKcalPerUnit(e.target.value)}
          style={{ width: "120px" }}
        />
        <input
          type="number"
          min="0.1"
          step="0.1"
          placeholder="Qty"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          style={{ width: "80px" }}
        />
        <button type="submit" disabled={!isValid}>
          Add
        </button>
      </div>
    </form>
  );
}

export default function DayLog() {
  const { state, dispatch } = useAppState();

  const selectedDate = state.selectedDate;
  
  // Get the day log, falling back to an empty object
  const dayLog = useMemo(() => {
    return (
      state.dayLogs[selectedDate] || {
        date: selectedDate,
        activityFactor: 1.2,
        // Old hydrationMl is replaced by hydrationLitres in state
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

          {/* Hydration (ml) input removed from here */}
          
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

        {/* Notes textarea removed from here */}
      </section>

      {/* Meals sections */}
      {MEAL_TYPES.map((meal) => (
        <section key={meal.id} style={{ marginBottom: "1.5rem" }}>
          <h2>{meal.label}</h2>

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

          <AddMealForm mealType={meal.id} date={selectedDate} />
        </section>
      ))}
      
      {/* ------------------------------------------------ */}
      {/* NEW UI FOR HYDRATION AND NOTES */}
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