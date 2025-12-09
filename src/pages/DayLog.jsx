// src/pages/DayLog.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { 
  useAppState, 
} from "../context/AppStateContext";
import FoodAutocomplete from "../components/FoodAutocomplete";

// Icons
import { 
  Calendar, Activity, Droplet, Scale, 
  Utensils, Moon, Coffee, Plus, Save, X,
  Flame, Zap, TrendingUp, ChevronDown
} from "lucide-react";

import "../styles/DayLog.css"; 

const MEAL_TYPES = [
  { id: "lunch", label: "Lunch", icon: <Utensils size={18} /> },
  { id: "dinner", label: "Dinner", icon: <Moon size={18} /> },
  { id: "extra", label: "Snacks", icon: <Coffee size={18} /> },
];

// --- Helpers ---
function generateId(prefix) {
  if (window.crypto?. randomUUID) return `${prefix}-${window.crypto. randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const isValidDateString = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// --- Calorie Ring Component ---
function CalorieRing({ intake, target }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const percentage = target > 0 ? Math.min((intake / target) * 100, 150) : 0;
  const offset = circumference - (percentage / 100) * circumference;
  
  let ringClass = "";
  if (percentage > 100) ringClass = "over-target";
  else if (percentage >= 85) ringClass = "near-target";

  return (
    <div className="calorie-ring-container">
      <svg className="calorie-ring-svg" viewBox="0 0 100 100">
        <circle className="calorie-ring-bg" cx="50" cy="50" r={radius} />
        <circle 
          className={`calorie-ring-progress ${ringClass}`}
          cx="50" 
          cy="50" 
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="calorie-ring-center">
        <div className="calorie-ring-value">{Math.round(intake)}</div>
        <div className="calorie-ring-label">kcal</div>
      </div>
    </div>
  );
}

// --- Main Component ---
export default function DayLog() {
  const { state, dispatch, getDayDerived } = useAppState();
  const location = useLocation();

  // URL Date Sync
  useEffect(() => {
    const params = new URLSearchParams(location. search);
    const queryDate = params.get("date");
    if (queryDate && isValidDateString(queryDate)) {
      dispatch({ type: "SET_SELECTED_DATE", payload:  queryDate });
    }
  }, [location.search, dispatch]);

  const selectedDate = state.selectedDate;
  const derived = getDayDerived(state, selectedDate);
  const { tdee, totalIntake, netKcal } = derived;

  // Form States
  const [newMealFoodSearch, setNewMealFoodSearch] = useState({ lunch: "", dinner: "", extra: "" });
  const [newMealFoodId, setNewMealFoodId] = useState({ lunch: null, dinner: null, extra: null });
  const [newQuantity, setNewQuantity] = useState({ lunch: "1", dinner: "1", extra: "1" });
  const [editingMealId, setEditingMealId] = useState(null);
  const [editingQuantity, setEditingQuantity] = useState("");
  const [activeMealId, setActiveMealId] = useState("lunch");
  
  // Mobile:  breakdown toggle
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const allFoods = state.foodItems || [];
  const favouriteFoods = allFoods.filter((f) => f.isFavourite);

  // --- Handlers ---
  const addMealEntry = (mealType, food, qty) => {
    const quantityNumber = Number(qty);
    if (! food || !quantityNumber || quantityNumber <= 0) return;
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
    setNewMealFoodSearch((prev) => ({ ...prev, [mealType]: food. name }));
    setNewMealFoodId((prev) => ({ ...prev, [mealType]:  food.id }));
    addMealEntry(mealType, food, 1);
  };

  const handleAddMeal = (e, mealType) => {
    e.preventDefault();
    const quantity = parseFloat(newQuantity[mealType] || "0");
    const foodId = newMealFoodId[mealType];
    const food = allFoods.find((f) => f.id === foodId);
    if (! food || quantity <= 0) return alert("Please select a valid food and quantity.");
    
    addMealEntry(mealType, food, quantity);
    setNewMealFoodSearch((prev) => ({ ...prev, [mealType]: "" }));
    setNewMealFoodId((prev) => ({ ...prev, [mealType]: null }));
    setNewQuantity((prev) => ({ ...prev, [mealType]: "1" }));
  };

  const handleSaveEditMeal = (meal) => {
    const qty = parseFloat(editingQuantity);
    if (!qty || qty <= 0) return alert("Quantity must be > 0");
    dispatch({ type: "UPDATE_MEAL_ENTRY", payload: { date: selectedDate, mealId: meal.id, quantity: qty } });
    setEditingMealId(null);
    setEditingQuantity("");
  };

  // --- Derived Data ---
  const dayLog = useMemo(() => state.dayLogs[selectedDate] || {
    date: selectedDate, activityFactor: state.profile.defaultActivityFactor ??  1.2,
    hydrationLitres: 0, weightKg: null, notes: "", meals: [],
    activityMode: "manual"
  }, [state.dayLogs, selectedDate, state.profile]);

  const mealsByType = useMemo(() => {
    const grouped = {}; 
    MEAL_TYPES.forEach(t => grouped[t.id] = []);
    (dayLog.meals || []).forEach(m => {
      const key = MEAL_TYPES.some(t => t.id === m.mealType) ? m.mealType : 'extra';
      grouped[key].push(m);
    });
    return grouped;
  }, [dayLog.meals]);

  const activeMealKcal = (mealsByType[activeMealId] || []).reduce(
    (sum, m) => sum + (m.totalKcal ??  0),
    0
  );

  // --- Meta Handlers ---
  const updateMeta = (patch) => dispatch({ type: "UPDATE_DAY_META", payload: { date: selectedDate, patch } });

  // --- TDEE Breakdown values ---
  const breakdown = derived.tdeeBreakdown || {};
  const bmrVal = Math.round(dayLog.bmrSnapshot ??  state.profile.bmr ??  0);
  const afDisplay = breakdown.afComputed ??  dayLog.activityFactor ??  state.profile.defaultActivityFactor ??  1.2;
  const neat = breakdown.neat ?? 0;
  const eatNet = (breakdown.eat && (typeof breakdown.eat. totalNet !== "undefined" ? breakdown.eat.totalNet :  breakdown.eat)) ?? breakdown.eat ??  0;
  const maintenance = breakdown.maintenancePlusActivity ?? Math.round(bmrVal * afDisplay);
  const tef = breakdown.tef ?? Math.round((totalIntake || 0) * 0.10);
  const tdeeVal = breakdown.tdee ?? Math.round(maintenance + tef);

  const currentMode = dayLog.activityMode ??  "manual";

  return (
    <div className="daylog-page">
      
      {/* 1. Header */}
      <div className="daylog-header">
        <div className="daylog-title">
          <h1><Calendar size={28} className="text-blue" /> Day Log</h1>
          <p className="daylog-subtitle">Track your nutrition and progress. </p>
        </div>
        <div className="date-input-group">
          <label>Selected Date</label>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => e.target.value && dispatch({ type: "SET_SELECTED_DATE", payload: e. target.value })} 
            className="styled-date-input"
          />
        </div>
      </div>

      {/* 2. Hero Card */}
      <section className="hero-card">
        
        {/* ========== MOBILE LAYOUT ========== */}
        <div className="mobile-hero">
          {/* Top:  Ring + Key Stats */}
          <div className="mobile-hero-top">
            <CalorieRing intake={totalIntake || 0} target={tdee || 2000} />
            
            <div className="mobile-hero-stats">
              <div className="mobile-stat-row">
                <span className="mobile-stat-label">Target</span>
                <span className="mobile-stat-value">{Math.round(tdee || 0)} kcal</span>
              </div>
              <div className="mobile-stat-row">
                <span className="mobile-stat-label">Net</span>
                <span className={`mobile-stat-value ${netKcal >= 0 ?  "text-green" : "text-red"}`}>
                  {netKcal >= 0 ? "+" : ""}{Math.round(netKcal)}
                </span>
              </div>
              <div className="mobile-stat-row">
                <span className="mobile-stat-label">AF</span>
                <span className="mobile-stat-value">{Number(afDisplay).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats:  Hydration, Weight, EAT */}
          <div className="mobile-quick-stats">
            <div className="mobile-quick-stat">
              <Droplet size={16} className="mobile-quick-stat-icon" />
              <div className="mobile-quick-stat-value">{(dayLog.hydrationLitres ??  0).toFixed(1)} L</div>
              <div className="mobile-quick-stat-label">Hydration</div>
            </div>
            <div className="mobile-quick-stat">
              <Scale size={16} className="mobile-quick-stat-icon" />
              <div className="mobile-quick-stat-value">{dayLog.weightKg ??  "--"} kg</div>
              <div className="mobile-quick-stat-label">Weight</div>
            </div>
            <div className="mobile-quick-stat">
              <Zap size={16} className="mobile-quick-stat-icon" />
              <div className="mobile-quick-stat-value">{eatNet}</div>
              <div className="mobile-quick-stat-label">EAT (net)</div>
            </div>
          </div>

          {/* Activity Mode */}
          <div className="mobile-activity-row">
            <span className="mobile-activity-label">
              <Activity size={12} /> Mode
            </span>
            <div className="mobile-mode-pills">
              <label className={`mobile-mode-pill ${currentMode === "manual" ? "is-active" : ""}`}>
                <input type="radio" name="mobileMode" checked={currentMode === "manual"} onChange={() => updateMeta({ activityMode: "manual" })} />
                Manual
              </label>
              <label className={`mobile-mode-pill ${currentMode === "advanced_neat" ? "is-active" :  ""}`}>
                <input type="radio" name="mobileMode" checked={currentMode === "advanced_neat"} onChange={() => updateMeta({ activityMode: "advanced_neat" })} />
                NEAT
              </label>
              <label className={`mobile-mode-pill ${currentMode === "advanced_full" ? "is-active" :  ""}`}>
                <input type="radio" name="mobileMode" checked={currentMode === "advanced_full"} onChange={() => updateMeta({ activityMode: "advanced_full" })} />
                Full
              </label>
            </div>
          </div>

          {/* Manual AF Input */}
          <div className="mobile-af-row">
            <label>Manual AF</label>
            <input
              type="number"
              step="0.01"
              min="0.8"
              max="2.5"
              value={Number(dayLog.activityFactor ??  state.profile.defaultActivityFactor ??  1.2)}
              onChange={(e) => updateMeta({ activityFactor: Number(e.target.value) || 1.0 })}
              disabled={currentMode !== "manual"}
            />
          </div>

          {/* Collapsible TDEE Breakdown */}
          <button 
            type="button" 
            className="mobile-breakdown-toggle"
            onClick={() => setBreakdownOpen(!breakdownOpen)}
          >
            <span className="mobile-breakdown-toggle-left">
              <Flame size={14} /> TDEE Breakdown
            </span>
            <span className="mobile-breakdown-toggle-right">
              <span className="mobile-tdee-badge">{tdeeVal} kcal</span>
              <ChevronDown size={16} className={`mobile-breakdown-chevron ${breakdownOpen ? "is-open" : ""}`} />
            </span>
          </button>

          <div className={`mobile-breakdown-content ${breakdownOpen ? "is-open" : ""}`}>
            <div className="mobile-breakdown-list">
              <div className="mobile-breakdown-item">
                <span className="mobile-breakdown-item-label">BMR</span>
                <span className="mobile-breakdown-item-value">{bmrVal} kcal</span>
              </div>
              <div className="mobile-breakdown-item">
                <span className="mobile-breakdown-item-label">Maintenance</span>
                <span className="mobile-breakdown-item-value">{maintenance} kcal</span>
              </div>
              <div className="mobile-breakdown-item">
                <span className="mobile-breakdown-item-label">NEAT</span>
                <span className="mobile-breakdown-item-value">{neat} kcal</span>
              </div>
              <div className="mobile-breakdown-item">
                <span className="mobile-breakdown-item-label">ΣEAT (net)</span>
                <span className="mobile-breakdown-item-value">{eatNet} kcal</span>
              </div>
              <div className="mobile-breakdown-item">
                <span className="mobile-breakdown-item-label">TEF (10%)</span>
                <span className="mobile-breakdown-item-value">{tef} kcal</span>
              </div>
              <div className="mobile-breakdown-item is-total">
                <span className="mobile-breakdown-item-label">TDEE</span>
                <span className="mobile-breakdown-item-value">{tdeeVal} kcal</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mobile-actions">
            <a href="/activity" className="hero-btn hero-btn-primary">
              <TrendingUp size={14} /> Activity
            </a>
            <button
              type="button"
              className="hero-btn hero-btn-secondary"
              onClick={() => {
                dispatch({ type: "UPDATE_DAY_META", payload:  { date: selectedDate, patch:  { activityFactor: dayLog.activityFactor ??  state.profile.defaultActivityFactor } } });
              }}
            >
              Recompute
            </button>
          </div>
        </div>

        {/* ========== DESKTOP LAYOUT ========== */}
        {/* Column 1: Calories Summary */}
        <div className="hero-col">
          <div className="hero-col-header">
            <Flame size={14} /> Calories
          </div>
          
          <div className="hero-primary-stat">
            <div className="hero-primary-value">{Math.round(totalIntake || 0)} kcal</div>
            <div className="hero-primary-sub">
              Net: <span className={netKcal >= 0 ?  "text-green" : "text-red"}>
                {netKcal >= 0 ? "+" :  ""}{Math.round(netKcal)}
              </span> • Target: {Math.round(tdee || 0)}
            </div>
          </div>

          <div className="hero-secondary-stats">
            <div className="hero-secondary-item">
              <span className="hero-secondary-label"><Droplet size={12} /> Hydration</span>
              <span className="hero-secondary-value">{(dayLog.hydrationLitres ?? 0).toFixed(1)} L</span>
              <span className="hero-secondary-hint">
                {dayLog.hydrationLitres >= 3 ? "Great job!" : "Keep drinking water. "}
              </span>
            </div>
            
            <div className="hero-secondary-item">
              <span className="hero-secondary-label"><Scale size={12} /> Weight</span>
              <span className="hero-secondary-value">{dayLog.weightKg ?? "--"} kg</span>
            </div>
            
            <div className="hero-secondary-item">
              <span className="hero-secondary-label"><Zap size={12} /> EAT (net)</span>
              <span className="hero-secondary-value">{eatNet} kcal</span>
            </div>
          </div>
        </div>

        {/* Column 2: Activity Factor Controls */}
        <div className="hero-col">
          <div className="hero-col-header">
            <Activity size={14} /> Activity Factor
          </div>

          <div className="activity-mode-group">
            <span className="activity-mode-label">Mode</span>
            <div className="activity-mode-options">
              <label className={`activity-mode-option ${currentMode === "manual" ? "is-active" : ""}`}>
                <input type="radio" name="activityMode" checked={currentMode === "manual"} onChange={() => updateMeta({ activityMode:  "manual" })} />
                Manual
              </label>
              <label className={`activity-mode-option ${currentMode === "advanced_neat" ? "is-active" : ""}`}>
                <input type="radio" name="activityMode" checked={currentMode === "advanced_neat"} onChange={() => updateMeta({ activityMode: "advanced_neat" })} />
                NEAT
              </label>
              <label className={`activity-mode-option ${currentMode === "advanced_full" ?  "is-active" : ""}`}>
                <input type="radio" name="activityMode" checked={currentMode === "advanced_full"} onChange={() => updateMeta({ activityMode: "advanced_full" })} />
                Full
              </label>
            </div>
          </div>

          <div className="manual-af-group">
            <label>Manual AF</label>
            <input
              type="number"
              step="0.01"
              min="0.8"
              max="2.5"
              value={Number(dayLog.activityFactor ?? state.profile.defaultActivityFactor ??  1.2)}
              onChange={(e) => updateMeta({ activityFactor: Number(e.target.value) || 1.0 })}
              disabled={currentMode !== "manual"}
            />
            <p className="manual-af-hint">
              Use Manual for quick logging. Choose NEAT or Full to auto-calculate from activities.
            </p>
          </div>

          <div className="hero-actions">
            <a href="/activity" className="hero-btn hero-btn-primary">
              <TrendingUp size={14} /> Activity Tab
            </a>
            <button
              type="button"
              className="hero-btn hero-btn-secondary"
              onClick={() => {
                dispatch({ type:  "UPDATE_DAY_META", payload: { date: selectedDate, patch: { activityFactor:  dayLog.activityFactor ??  state.profile.defaultActivityFactor } } });
              }}
            >
              Recompute
            </button>
          </div>
        </div>

        {/* Column 3: TDEE Breakdown */}
        <div className="hero-col">
          <div className="hero-col-header">
            <Flame size={14} /> TDEE Breakdown
          </div>

          <div className="breakdown-list">
            <div className="breakdown-row">
              <span className="breakdown-row-label">BMR</span>
              <span className="breakdown-row-value">{bmrVal} kcal</span>
            </div>
            <div className="breakdown-row">
              <span className="breakdown-row-label">Activity Factor</span>
              <span className="breakdown-row-value">{Number(afDisplay).toFixed(3)}</span>
            </div>
            <div className="breakdown-row">
              <span className="breakdown-row-label">Maintenance</span>
              <span className="breakdown-row-value">{maintenance} kcal</span>
            </div>
            <div className="breakdown-row">
              <span className="breakdown-row-label">NEAT</span>
              <span className="breakdown-row-value">{neat} kcal</span>
            </div>
            <div className="breakdown-row">
              <span className="breakdown-row-label">ΣEAT (net)</span>
              <span className="breakdown-row-value">{eatNet} kcal</span>
            </div>
            <div className="breakdown-row">
              <span className="breakdown-row-label">TEF (10%)</span>
              <span className="breakdown-row-value">{tef} kcal</span>
            </div>
            
            <div className="breakdown-divider"></div>
            
            <div className="breakdown-row is-total">
              <span className="breakdown-row-label">TDEE</span>
              <span className="breakdown-row-value">{tdeeVal} kcal</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Notes */}
      <section>
        <textarea 
          className="notes-textarea"
          placeholder="Daily notes, mood, or reflection..."
          value={dayLog. notes}
          onChange={(e) => dispatch({ type: "UPDATE_DAY_NOTES", payload: { date: selectedDate, notes: e. target.value } })}
        />
      </section>

      {/* 5. Meal Sections */}
      <section className="meal-tabs-card">
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
                      onClick={() => handleQuickAddFavourite(meal. id, f)}
                    >
                      + {f.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Table */}
              {entries.length > 0 ?  (
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
                                  onChange={(e) => setEditingQuantity(e.target.value)}
                                  step="0.25"
                                />
                              ) : (
                                m.quantity
                              )}
                            </td>
                            <td>{m.unitLabelSnapshot}</td>
                            <td className="text-right">{m.kcalPerUnitSnapshot}</td>
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
                <div className="muted" style={{ textAlign: "center", padding: "1rem" }}>
                  No items logged yet.
                </div>
              )}

              {/* Add form */}
              <form onSubmit={(e) => handleAddMeal(e, meal. id)} className="add-meal-container">
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
                        setNewMealFoodSearch((p) => ({ ...p, [meal. id]: f. name }));
                        setNewMealFoodId((p) => ({ ...p, [meal.id]: f.id }));
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
                      onChange={(e) => setNewQuantity((p) => ({ ...p, [meal.id]: e.target.value }))}
                    />
                  </div>
                  <button type="submit" className="btn-primary">
                    <Plus size={18} />
                  </button>
                </div>
                {newMealFoodId[meal.id] && (
                  <div style={{ fontSize: "0.85rem", color: "#718096", marginTop: "0.5rem" }}>
                    Unit: {allFoods.find((f) => f.id === newMealFoodId[meal.id])?.unitLabel}
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