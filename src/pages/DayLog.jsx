// src/pages/DayLog.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { 
  useAppState, 
  effectiveWorkoutKcal,
  UPDATE_DAY_WORKOUT,
  UPDATE_DAY_INTENSITY,
  UPDATE_DAY_WORKOUT_DESC 
} from "../context/AppStateContext";
import FoodAutocomplete from "../components/FoodAutocomplete";

// Icons for UI Polish
import { 
  Calendar, Activity, Droplet, Scale, 
  Utensils, Moon, Coffee, Plus, Save, X 
} from "lucide-react";

// Import separate CSS
import "../styles/DayLog.css"; 

const MEAL_TYPES = [
  { id: "lunch", label: "Lunch", icon: <Utensils size={18} /> },
  { id: "dinner", label: "Dinner", icon: <Moon size={18} /> },
  { id: "extra", label: "Snacks", icon: <Coffee size={18} /> }, // ✅ FIXED: Changed from "Extras / Snacks"
];

// --- Helpers ---
function generateId(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const isValidDateString = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// --- Sub-Component: Workout Box ---
function WorkoutBox({ day, dispatch }) {
  const [localKcal, setLocalKcal] = useState(day?.workoutCalories ?? "");
  const [localDesc, setLocalDesc] = useState(day?.workoutDescription ?? "");

  useEffect(() => {
    setLocalKcal(day?.workoutCalories ?? "");
    setLocalDesc(day?.workoutDescription ?? "");
  }, [day?.date, day?.workoutCalories, day?.workoutDescription]);

  const handleKcalBlur = () => dispatch({ type: UPDATE_DAY_WORKOUT, payload: { date: day.date, workoutKcal: localKcal } });
  const handleDescBlur = () => dispatch({ type: UPDATE_DAY_WORKOUT_DESC, payload: { date: day.date, workoutDesc: localDesc } });
  const handleIntensityChange = (e) => dispatch({ type: UPDATE_DAY_INTENSITY, payload: { date: day.date, intensityFactor: e.target.value } });

  return (
    <div className="meta-card workout-card">
      <label className="meta-label text-orange">
        <Activity size={18} /> Workout <small className="muted" style={{ fontWeight: 400, marginLeft: 'auto' }}>(Auto-saved)</small>
      </label>
      
      <div className="form-row-responsive" style={{ gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <small className="muted">Burn (kcal)</small>
          <input 
            type="number" min="0" className="input-full" placeholder="0" 
            value={localKcal}
            onChange={(e) => setLocalKcal(e.target.value)}
            onBlur={handleKcalBlur}
          />
        </div>
        <div style={{ flex: 1 }}>
          <small className="muted">Intensity</small>
          <select className="input-full" value={day?.intensityFactor ?? ""} onChange={handleIntensityChange}>
            <option value="">— None —</option>
            <option value="0.5">0.5 — Light Recovery</option>
            <option value="0.8">0.8 — Light Effort</option>
            <option value="1.0">1.0 — Moderate</option>
            <option value="1.2">1.2 — Hard Training</option>
            <option value="1.5">1.5 — Intense Athlete</option>
          </select>
        </div>
      </div>

      {(Number(localKcal) > 0 || localDesc) && (
        <div>
          <small className="muted">Note</small>
          <input 
            type="text" maxLength="60" className="input-full" placeholder="e.g. Chest Day, 5k Run"
            value={localDesc}
            onChange={(e) => setLocalDesc(e.target.value)}
            onBlur={handleDescBlur}
          />
        </div>
      )}
    </div>
  );
}

// --- Main Component ---
export default function DayLog() {
  const { state, dispatch, getDayDerived } = useAppState();
  const location = useLocation();

  // URL Date Sync
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryDate = params.get("date");
    if (queryDate && isValidDateString(queryDate)) {
      dispatch({ type: "SET_SELECTED_DATE", payload: queryDate });
    }
  }, [location.search, dispatch]);

  const selectedDate = state.selectedDate;
  const { tdee, totalIntake, netKcal } = getDayDerived(state, selectedDate);

  // Form States
  const [newMealFoodSearch, setNewMealFoodSearch] = useState({ lunch: "", dinner: "", extra: "" });
  const [newMealFoodId, setNewMealFoodId] = useState({ lunch: null, dinner: null, extra: null });
  const [newQuantity, setNewQuantity] = useState({ lunch: "1", dinner: "1", extra: "1" });
  const [editingMealId, setEditingMealId] = useState(null);
  const [editingQuantity, setEditingQuantity] = useState("");

  // NEW: which meal tab is active
  const [activeMealId, setActiveMealId] = useState("lunch");

  // Active meal meta
  const activeMealDef =
    MEAL_TYPES.find((m) => m.id === activeMealId) || MEAL_TYPES[0];

  const allFoods = state.foodItems || [];
  const favouriteFoods = allFoods.filter((f) => f.isFavourite);

  // --- Handlers ---
  const addMealEntry = (mealType, food, qty) => {
    const quantityNumber = Number(qty);
    if (!food || !quantityNumber || quantityNumber <= 0) return;
    dispatch({
      type: "ADD_MEAL_ENTRY",
      payload: {
        id: generateId("meal"),
        date: selectedDate, mealType, foodItemId: food.id,
        foodNameSnapshot: food.name, unitLabelSnapshot: food.unitLabel,
        kcalPerUnitSnapshot: food.kcalPerUnit, quantity: quantityNumber,
        totalKcal: Math.round(quantityNumber * food.kcalPerUnit),
      },
    });
  };

  const handleQuickAddFavourite = (mealType, food) => {
    setNewMealFoodSearch((prev) => ({ ...prev, [mealType]: food.name }));
    setNewMealFoodId((prev) => ({ ...prev, [mealType]: food.id }));
    addMealEntry(mealType, food, 1);
  };

  const handleAddMeal = (e, mealType) => {
    e.preventDefault();
    const quantity = parseFloat(newQuantity[mealType] || "0");
    const foodId = newMealFoodId[mealType];
    const food = allFoods.find((f) => f.id === foodId);
    if (!food || quantity <= 0) return alert("Please select a valid food and quantity.");
    
    addMealEntry(mealType, food, quantity);
    setNewMealFoodSearch((prev) => ({ ...prev, [mealType]: "" }));
    setNewMealFoodId((prev) => ({ ...prev, [mealType]: null }));
    setNewQuantity((prev) => ({ ...prev, [mealType]: "1" }));
  };

  const handleSaveEditMeal = (meal) => {
    const qty = parseFloat(editingQuantity);
    if (!qty || qty <= 0) return alert("Quantity must be > 0");
    dispatch({ type: "UPDATE_MEAL_ENTRY", payload: { date: selectedDate, mealId: meal.id, quantity: qty } });
    setEditingMealId(null); setEditingQuantity("");
  };

  // --- Derived Data ---
  const dayLog = useMemo(() => state.dayLogs[selectedDate] || {
    date: selectedDate, activityFactor: state.profile.defaultActivityFactor ?? 1.2,
    hydrationLitres: 0, weightKg: null, notes: "", meals: [],
    workoutCalories: 0, intensityFactor: null, workoutDescription: ""
  }, [state.dayLogs, selectedDate, state.profile]);

  const effectiveWorkout = effectiveWorkoutKcal(dayLog);
  
  const mealsByType = useMemo(() => {
    const grouped = {}; 
    MEAL_TYPES.forEach(t => grouped[t.id] = []);
    (dayLog.meals || []).forEach(m => {
      const key = MEAL_TYPES.some(t => t.id === m.mealType) ? m.mealType : 'extra';
      grouped[key].push(m);
    });
    return grouped;
  }, [dayLog.meals]);

  // Active meal kcal
  const activeMealKcal = (mealsByType[activeMealId] || []).reduce(
    (sum, m) => sum + (m.totalKcal ?? 0),
    0
  );

  // --- Meta Handlers ---
  const updateMeta = (patch) => dispatch({ type: "UPDATE_DAY_META", payload: { date: selectedDate, patch } });

  return (
    <div className="daylog-page">
      
      {/* 1. Header */}
      <div className="daylog-header">
        <div className="daylog-title">
          <h1><Calendar size={28} className="text-blue" /> Day Log</h1>
          <p className="daylog-subtitle">Track your nutrition and progress.</p>
        </div>
        <div className="date-input-group">
          <label>Selected Date</label>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => e.target.value && dispatch({ type: "SET_SELECTED_DATE", payload: e.target.value })} 
            className="styled-date-input"
          />
        </div>
      </div>

      {/* 2. ✅ FIXED: Consolidated Hero Stats + Inputs Card */}
      {/* ------------------ REPLACE THIS BLOCK WITH THE FOLLOWING ------------------ */}

      {/* HERO: summary + activity controls */}
      <section className="hero-card grid lg:grid-cols-3 gap-4 p-4 rounded shadow-sm bg-white">
        {/* Col 1: Summary numbers */}
        <div className="col-span-1">
          <h3 className="text-lg font-semibold">Calories</h3>
          <div className="mt-2">
            <div className="text-2xl font-bold">{Math.round(totalIntake || 0)} kcal</div>
            <div className="text-sm text-slate-600">Net: {netKcal < 0 ? "" : "+"}{Math.round(netKcal)} • Target (TDEE): {Math.round(tdee || 0)}</div>
          </div>

          <div className="mt-4">
            <div className="text-sm text-slate-500">Hydration</div>
            <div className="text-base">{(dayLog.hydrationLitres ?? 0).toFixed(1)} L</div>
            <div className="text-xs text-slate-400">{dayLog.hydrationLitres >= 3 ? "Great job!" : "Keep drinking water."}</div>
          </div>

          <div className="mt-3">
            <div className="text-sm text-slate-500">Weight</div>
            <div className="text-base">{dayLog.weightKg ?? "--"} kg</div>
          </div>

          <div className="mt-3">
            <div className="text-sm text-slate-500">Workout Burn</div>
            <div className="text-base">{effectiveWorkout ?? 0} kcal</div>
          </div>
        </div>

        {/* Col 2: Activity / AF controls */}
        <div className="col-span-1">
          <h3 className="text-lg font-semibold">Activity Factor</h3>

          <div className="mt-2">
            <label className="block text-sm">Mode</label>
            <div className="mt-1 flex gap-2">
              <label className="inline-flex items-center">
                <input type="radio" name="activityMode" checked={(dayLog.activityMode ?? "manual") === "manual"} onChange={() => updateMeta({ activityMode: "manual" })} />
                <span className="ml-2 text-sm">Manual</span>
              </label>
              <label className="inline-flex items-center">
                <input type="radio" name="activityMode" checked={(dayLog.activityMode ?? "") === "advanced_neat"} onChange={() => updateMeta({ activityMode: "advanced_neat" })} />
                <span className="ml-2 text-sm">Advanced · NEAT</span>
              </label>
              <label className="inline-flex items-center">
                <input type="radio" name="activityMode" checked={(dayLog.activityMode ?? "") === "advanced_full"} onChange={() => updateMeta({ activityMode: "advanced_full" })} />
                <span className="ml-2 text-sm">Advanced · Full</span>
              </label>
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-sm">Manual AF (if manual)</label>
            <input
              type="number"
              step="0.01"
              min="0.8"
              max="2.5"
              value={Number(dayLog.activityFactor ?? state.profile.defaultActivityFactor ?? 1.2)}
              onChange={(e) => updateMeta({ activityFactor: Number(e.target.value) || 1.0 })}
              className="mt-1 p-2 border rounded w-full"
            />
            <div className="text-xs text-slate-400 mt-1">
              Tip: pick Manual for quick days. Choose Advanced to calculate AF from activities & NEAT.
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <a href="/activity" className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">Open Activity Tab</a>
            <button
              className="px-3 py-1 rounded bg-gray-100"
              onClick={() => {
                // quick recompute: set same meta to force update
                dispatch({ type: "UPDATE_DAY_META", payload: { date: selectedDate, patch: { activityFactor: dayLog.activityFactor ?? state.profile.defaultActivityFactor } } });
              }}
            >
              Recompute
            </button>
          </div>
        </div>

        {/* Col 3: Breakdown (from tdeeBreakdown if available) */}
        <div className="col-span-1">
          <h3 className="text-lg font-semibold">TDEE Breakdown</h3>
          <div className="mt-2 text-sm space-y-2">
            {/* defensive access — tdeeBreakdown may be a nested object in getDayDerived result */}
            {typeof getDayDerived === "function" && (() => {
              const breakdown = (getDayDerived && getDayDerived(state, selectedDate)?.tdeeBreakdown) || {};
              // fallback values
              const afDisplay = breakdown.afComputed ?? dayLog.activityFactor ?? state.profile.defaultActivityFactor ?? 1.2;
              const neat = breakdown.neat ?? 0;
              const eatNet = (breakdown.eat && (typeof breakdown.eat.totalNet !== "undefined" ? breakdown.eat.totalNet : breakdown.eat)) ?? breakdown.eat ?? 0;
              const maintenance = breakdown.maintenancePlusActivity ?? Math.round((dayLog.bmrSnapshot ?? state.profile.bmr ?? 0) * afDisplay);
              const tef = breakdown.tef ?? Math.round((totalIntake || 0) * 0.10);
              const tdeeVal = breakdown.tdee ?? Math.round(maintenance + tef);
              return (
                <div>
                  <div className="flex justify-between"><div>BMR</div><div>{Math.round(dayLog.bmrSnapshot ?? state.profile.bmr ?? 0)} kcal</div></div>
                  <div className="flex justify-between"><div>AF</div><div>{Number(afDisplay).toFixed(3)}</div></div>
                  <div className="flex justify-between"><div>Maintenance (BMR + NEAT)</div><div>{maintenance} kcal</div></div>
                  <div className="flex justify-between"><div>NEAT</div><div>{neat} kcal</div></div>
                  <div className="flex justify-between"><div>ΣEAT (net)</div><div>{eatNet} kcal</div></div>
                  <div className="flex justify-between"><div>TEF (10%)</div><div>{tef} kcal</div></div>
                  <hr className="my-2" />
                  <div className="flex justify-between font-semibold"><div>TDEE</div><div>{tdeeVal} kcal</div></div>
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      {/* ------------------ END REPLACEMENT ------------------ */}

      {/* 3. Workout Section */}
      <section>
        <WorkoutBox day={dayLog} dispatch={dispatch} />
      </section>

      {/* 4. Notes */}
      <section>
        <textarea 
          className="notes-textarea"
          placeholder="Daily notes, mood, or reflection..."
          value={dayLog.notes}
          onChange={(e) => dispatch({ type: "UPDATE_DAY_NOTES", payload: { date: selectedDate, notes: e.target.value } })}
        />
      </section>

      {/* 5. Meal Sections – single top bar tabs */}
      <section className="meal-tabs-card">
        {/* ✅ FIXED: Responsive Top bar */}
        <div className="meal-topbar">
          <div className="meal-top-tabs">
            {MEAL_TYPES.map((meal) => {
              const isActive = activeMealId === meal.id;
              return (
                <button
                  key={meal.id}
                  type="button"
                  className={`meal-top-tab ${isActive ? "is-active" : ""}`}
                  onClick={() => setActiveMealId(meal.id)}
                >
                  <span className="meal-top-tab-icon">{meal.icon}</span>
                  <span className="meal-top-tab-label">{meal.label}</span>
                </button>
              );
            })}
          </div>

          <span className="meal-kcal-badge">
            {activeMealKcal} kcal
          </span>
        </div>

        {/* Active meal content below the top bar */}
        {MEAL_TYPES.map((meal) => {
          const entries = mealsByType[meal.id] || [];
          if (meal.id !== activeMealId) return null;

          return (
            <div key={meal.id} className="meal-tab-content">
              {/* Quick Add chips */}
              {favouriteFoods.length > 0 && (
                <div className="quick-add-row">
                  <span className="quick-add-label">Quick add:</span>
                  {favouriteFoods.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="chip-btn"
                      onClick={() => handleQuickAddFavourite(meal.id, f)}
                    >
                      + {f.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Table */}
              {entries.length > 0 ? (
                <div className="table-responsive">
                  <table className="data-table meal-table">
                    <thead>
                      <tr>
                        <th className="text-left">Food</th>
                        <th className="text-right">Qty</th>
                        <th className="text-left">Unit</th>
                        <th className="text-right">Kcal</th>
                        <th className="text-right">Total</th>
                        <th className="text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((m) => {
                        const isEd = editingMealId === m.id;
                        return (
                          <tr key={m.id}>
                            <td className="meal-col-food">{m.foodNameSnapshot}</td>
                            <td className="text-right">
                              {isEd ? (
                                <input
                                  type="number"
                                  className="input-small text-right"
                                  value={editingQuantity}
                                  onChange={(e) =>
                                    setEditingQuantity(e.target.value)
                                  }
                                  step="0.25"
                                />
                              ) : (
                                m.quantity
                              )}
                            </td>
                            <td>{m.unitLabelSnapshot}</td>
                            <td className="text-right">
                              {m.kcalPerUnitSnapshot}
                            </td>
                            <td className="text-right">
                              <strong>{m.totalKcal}</strong>
                            </td>
                            <td className="btn-row">
                              {isEd ? (
                                <>
                                  <button
                                    className="btn-primary btn-small"
                                    onClick={() => handleSaveEditMeal(m)}
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    className="btn-secondary btn-small"
                                    onClick={() => {
                                      setEditingMealId(null);
                                      setEditingQuantity("");
                                    }}
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="btn-secondary btn-small"
                                    onClick={() => {
                                      setEditingMealId(m.id);
                                      setEditingQuantity(String(m.quantity));
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn-danger btn-small"
                                    onClick={() =>
                                      dispatch({
                                        type: "DELETE_MEAL_ENTRY",
                                        payload: {
                                          date: selectedDate,
                                          mealId: m.id,
                                        },
                                      })
                                    }
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
                </div>
              ) : (
                <div
                  className="muted"
                  style={{ textAlign: "center", padding: "1rem" }}
                >
                  No items logged yet.
                </div>
              )}

              {/* Add form */}
              <form
                onSubmit={(e) => handleAddMeal(e, meal.id)}
                className="add-meal-container"
              >
                <div className="form-row-compact">
                  <div style={{ flex: 2 }}>
                    <FoodAutocomplete
                      foods={allFoods}
                      value={newMealFoodSearch[meal.id]}
                      onChangeText={(txt) => {
                        setNewMealFoodSearch((p) => ({ ...p, [meal.id]: txt }));
                        setNewMealFoodId((p) => ({ ...p, [meal.id]: null }));
                      }}
                      onSelectFood={(f) => {
                        setNewMealFoodSearch((p) => ({
                          ...p,
                          [meal.id]: f.name,
                        }));
                        setNewMealFoodId((p) => ({
                          ...p,
                          [meal.id]: f.id,
                        }));
                      }}
                      placeholder="Search food..."
                    />
                  </div>
                  <div style={{ width: "100px" }}>
                    <input
                      type="number"
                      className="input-full"
                      placeholder="Qty"
                      step="0.25"
                      value={newQuantity[meal.id]}
                      onChange={(e) =>
                        setNewQuantity((p) => ({
                          ...p,
                          [meal.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <button type="submit" className="btn-primary">
                    <Plus size={18} />
                  </button>
                </div>
                {newMealFoodId[meal.id] && (
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "#718096",
                      marginTop: "0.5rem",
                    }}
                  >
                    Unit:{" "}
                    {
                      allFoods.find(
                        (f) => f.id === newMealFoodId[meal.id]
                      )?.unitLabel
                    }
                  </div>
                )}
              </form>
            </div>
          );
        })}
      </section>
    </div>
  );
}