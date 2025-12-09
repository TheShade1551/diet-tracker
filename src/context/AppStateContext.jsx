// src/context/AppStateContext.jsx
import React, { createContext, useContext, useEffect, useReducer } from "react";
// ✅ Import centralized calculation logic
import {
  calculateDayTDEE,
  computeDayMealTotals,
  calculateEffectiveWorkout,
} from "../utils/calculations";

/* ---------------------------------------------------------------------------
   Constants & defaults
   -------------------------------------------------------------------------*/
export const MEAL_TYPES = ["lunch", "dinner", "extras"];

export const DEFAULT_FOOD_CATEGORIES = [
  "home",
  "street",
  "packaged",
  "cheat",
  "drinks",
];

export const UPDATE_DAY_WORKOUT = "UPDATE_DAY_WORKOUT";
export const UPDATE_DAY_INTENSITY = "UPDATE_DAY_INTENSITY";
export const UPDATE_DAY_WORKOUT_DESC = "UPDATE_DAY_WORKOUT_DESC";

const DEFAULT_PROFILE = {
  name: "",
  heightCm: "",
  weightKg: "",
  sex: "male",
  bmr: "",
  dailyKcalTarget: 2200,
  defaultActivityPreset: "sedentary",
  defaultActivityFactor: 1.2,
  proteinTarget: "",
};

const LOCAL_STORAGE_KEY = "diet-tracker-app-state-v1";
const todayIso = () => new Date().toISOString().slice(0, 10);

/* --------- INITIAL STATE --------- */
const initialState = {
  profile: { ...DEFAULT_PROFILE },
  foodItems: [],
  dayLogs: {},
  selectedDate: todayIso(),
  foodCategories: DEFAULT_FOOD_CATEGORIES,
};

/* --------- HELPERS --------- */

// Legacy helper kept for compatibility
export function effectiveWorkoutKcal(day) {
  return calculateEffectiveWorkout(day);
}

function loadFromStorage() {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);

    // Backfill dayLogs canonical fields
    const dayLogs = parsed.dayLogs || {};
    const profileBmr = parsed.profile?.bmr ?? null;

    Object.keys(dayLogs).forEach((date) => {
      const dl = dayLogs[date] || {};
      // snapshot BMR if missing
      if (!("bmrSnapshot" in dl)) dl.bmrSnapshot = profileBmr;
      // ensure canonical fields exist
      if (!("activities" in dl)) dl.activities = [];
      if (!("activityMode" in dl)) dl.activityMode = dl.activityMode || "manual";
      if (!("activityFactor" in dl)) dl.activityFactor = dl.activityFactor ?? parsed.profile?.defaultActivityFactor ?? 1.2;
      if (!("steps" in dl)) dl.steps = dl.steps ?? null;
      if (!("survey" in dl)) dl.survey = dl.survey ?? null;
      if (!("meals" in dl)) dl.meals = dl.meals ?? [];
      if (!("notes" in dl)) dl.notes = dl.notes ?? "";
      // Keep legacy workout fields but ensure they're numbers
      dl.workoutCalories = Number(dl.workoutCalories ?? dl.workoutKcal ?? dl.workout ?? 0);
      dl.intensityFactor = dl.intensityFactor === "" || dl.intensityFactor === null ? null : Number(dl.intensityFactor ?? 0);
    });

    return {
      ...initialState,
      ...parsed,
      profile: { ...initialState.profile, ...(parsed.profile || {}) },
      dayLogs,
      foodItems: parsed.foodItems || [],
      selectedDate: parsed.selectedDate || todayIso(),
      foodCategories: parsed.foodCategories && parsed.foodCategories.length ? parsed.foodCategories : DEFAULT_FOOD_CATEGORIES,
    };
  } catch (e) {
    console.error("loadFromStorage error", e);
    return initialState;
  }
}

function saveToStorage(state) {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // ignore
    console.error("saveToStorage error", e);
  }
}

function ensureDayLog(state, date) {
  const existing = state.dayLogs[date];
  if (existing) return existing;
  // canonical shape for a new day
  return {
    date,
    activityFactor: state.profile?.defaultActivityFactor ?? 1.2,
    activityMode: "manual", // 'manual' | 'advanced_neat' | 'advanced_full'
    bmrSnapshot: state.profile?.bmr ?? null,
    weightKg: state.profile?.weightKg ?? state.profile?.weight ?? null,
    hydrationLitres: 0,
    notes: "",
    meals: [],
    activities: [], // new: focused activities (walk/jog)
    steps: null,
    survey: null,
    // Legacy workout fields (kept for compatibility)
    workoutCalories: 0,
    intensityFactor: null,
    workoutDescription: "",
    workoutKcal: 0,
  };
}

/* --------- SELECTOR / DERIVED DATA --------- */

/**
 * Centralized Selector for Day Data
 * Returns computed stats for a specific date so components don't do the math themselves.
 * Uses calculateDayTDEE() from the new calculations.js which accepts (day, profile).
 */
export function getDayDerived(state, dateKey) {
  const day = state.dayLogs?.[dateKey] || {};
  const profile = state.profile || {};

  // Use the canonical wrapper that knows about advanced/manual modes.
  // calculateDayTDEE returns an object { tdee, maintenancePlusActivity, tef, source, ... }
  const tdeeResult = calculateDayTDEE(day, profile);
  // tdee may be at top-level or nested — be defensive
  const tdee = toNumberSafe(tdeeResult?.tdee ?? tdeeResult ?? 0);

  // Compute intake totals from day.meals (canonical)
  // computeDayMealTotals expects an array of meal entries
  const mealsArray = Array.isArray(day.meals) ? day.meals : [];
  const totals = computeDayMealTotals(mealsArray) || {};
  // our computeDayMealTotals returns { kcal, protein_g, carbs_g, fat_g } in the new utils
  const totalIntake = toNumberSafe(totals.kcal ?? totals.total ?? 0);

  // Keep legacy sign convention for net (Positive = Surplus (Ate more than burned))
  const netKcal = Math.round(totalIntake - tdee);

  return {
    tdee,
    totalIntake,
    netKcal,
    tdeeBreakdown: tdeeResult,
    workoutCalories: Number(day.workoutCalories ?? day.workoutKcal ?? 0),
    intensityFactor: day.intensityFactor,
    meals: totals,
    activities: Array.isArray(day.activities) ? day.activities : [],
    steps: day.steps ?? null,
    survey: day.survey ?? null,
    activityMode: day.activityMode ?? "manual",
  };
}

/* small helper */
function toNumberSafe(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

/* --------- REDUCER --------- */
function appReducer(state, action) {
  switch (action.type) {
    case "SET_SELECTED_DATE": {
      return { ...state, selectedDate: action.payload };
    }
    case "IMPORT_STATE": {
      return { ...action.payload };
    }
    case "UPSERT_FOOD_ITEM": {
      const { id, name, category, unitLabel, kcalPerUnit, isFavourite = false } = action.payload;
      const existingIndex = state.foodItems.findIndex((f) => f.id === id);
      if (existingIndex >= 0) {
        const updated = [...state.foodItems];
        updated[existingIndex] = { ...updated[existingIndex], name, category, unitLabel, kcalPerUnit, isFavourite };
        return { ...state, foodItems: updated };
      }
      return { ...state, foodItems: [...state.foodItems, { id, name, category, unitLabel, kcalPerUnit, isFavourite }] };
    }
    case "DELETE_FOOD_ITEM": {
      const { id } = action.payload;
      return { ...state, foodItems: state.foodItems.filter((f) => f.id !== id) };
    }
    case "ADD_FOOD_CATEGORY": {
      const raw = (action.payload || "").trim();
      if (!raw) return state;
      const existing = (state.foodCategories || []).map((c) => c.toLowerCase());
      if (existing.includes(raw.toLowerCase())) return state;
      return { ...state, foodCategories: [...(state.foodCategories || []), raw] };
    }
    case "RENAME_FOOD_CATEGORY": {
      const { oldName, newName } = action.payload || {};
      const next = (newName || "").trim();
      if (!oldName || !next || oldName === next) return state;
      const cats = state.foodCategories || [];
      if (!cats.includes(oldName)) return state;
      const updatedCategories = cats.map((c) => (c === oldName ? next : c));
      const updatedFoodItems = (state.foodItems || []).map((f) => (f.category === oldName ? { ...f, category: next } : f));
      return { ...state, foodCategories: updatedCategories, foodItems: updatedFoodItems };
    }
    case "DELETE_FOOD_CATEGORY": {
      const { name } = action.payload || {};
      if (!name) return state;
      const cats = state.foodCategories || [];
      if (!cats.includes(name)) return state;
      const updatedCategories = cats.filter((c) => c !== name);
      const updatedFoodItems = (state.foodItems || []).map((f) => (f.category === name ? { ...f, category: null } : f));
      return { ...state, foodCategories: updatedCategories, foodItems: updatedFoodItems };
    }
    case "SET_ALL_FOOD_ITEMS": {
      if (!Array.isArray(action.payload)) return state;
      return { ...state, foodItems: action.payload };
    }
    case "SET_ALL_FOOD_CATEGORIES": {
      if (!Array.isArray(action.payload)) return state;
      return { ...state, foodCategories: action.payload };
    }
    case "ADD_MEAL_ENTRY": {
      const { date, mealType, foodItemId, foodNameSnapshot, unitLabelSnapshot, kcalPerUnitSnapshot, quantity, totalKcal } = action.payload;
      const dayLog = ensureDayLog(state, date);
      const newMeal = {
        id: action.payload.id,
        mealType,
        foodItemId,
        foodNameSnapshot,
        unitLabelSnapshot,
        kcalPerUnitSnapshot,
        quantity,
        totalKcal,
      };
      const updatedDay = { ...dayLog, meals: [...dayLog.meals, newMeal] };
      return { ...state, dayLogs: { ...state.dayLogs, [date]: updatedDay } };
    }
    case "DELETE_MEAL_ENTRY": {
      const { date, mealId } = action.payload;
      const dayLog = state.dayLogs[date];
      if (!dayLog) return state;
      const updatedDay = { ...dayLog, meals: dayLog.meals.filter((m) => m.id !== mealId) };
      return { ...state, dayLogs: { ...state.dayLogs, [date]: updatedDay } };
    }
    case "UPDATE_MEAL_ENTRY": {
      const { date, mealId, quantity } = action.payload;
      const dayLog = state.dayLogs[date];
      if (!dayLog) return state;
      const updatedMeals = (dayLog.meals || []).map((m) => {
        if (m.id !== mealId) return m;
        const perUnit = m.kcalPerUnitSnapshot ?? (m.quantity ? m.totalKcal / m.quantity : 0);
        return { ...m, quantity, totalKcal: Math.round(quantity * perUnit), kcalPerUnitSnapshot: perUnit };
      });
      return { ...state, dayLogs: { ...state.dayLogs, [date]: { ...dayLog, meals: updatedMeals } } };
    }
    case "UPDATE_DAY_META": {
      const { date, patch } = action.payload;
      const dayLog = ensureDayLog(state, date);
      return { ...state, dayLogs: { ...state.dayLogs, [date]: { ...dayLog, ...patch } } };
    }
    case "SET_WORKOUT": {
      const { date, workoutCalories, intensityFactor, workoutDescription } = action.payload;
      const dayLog = ensureDayLog(state, date);
      const updatedDay = {
        ...dayLog,
        workoutCalories: Number(workoutCalories) || 0,
        intensityFactor: intensityFactor === "" || intensityFactor === null ? null : Number(intensityFactor),
        workoutDescription: workoutDescription || "",
      };
      return { ...state, dayLogs: { ...state.dayLogs, [date]: updatedDay } };
    }
    case UPDATE_DAY_WORKOUT: {
      const { date, workoutKcal } = action.payload;
      const dayLog = ensureDayLog(state, date);
      const updatedDay = { ...dayLog, workoutCalories: Number(workoutKcal) || 0 };
      return { ...state, dayLogs: { ...state.dayLogs, [date]: updatedDay } };
    }
    case UPDATE_DAY_INTENSITY: {
      const { date, intensityFactor } = action.payload;
      const dayLog = ensureDayLog(state, date);
      const val = intensityFactor === "" || intensityFactor === null ? null : Number(intensityFactor);
      const updatedDay = { ...dayLog, intensityFactor: val };
      return { ...state, dayLogs: { ...state.dayLogs, [date]: updatedDay } };
    }
    case UPDATE_DAY_WORKOUT_DESC: {
      const { date, workoutDesc } = action.payload;
      const dayLog = ensureDayLog(state, date);
      const updatedDay = { ...dayLog, workoutDescription: workoutDesc || "" };
      return { ...state, dayLogs: { ...state.dayLogs, [date]: updatedDay } };
    }
    case "UPDATE_DAY_HYDRATION": {
      const { date, hydrationLitres } = action.payload;
      const dayLog = ensureDayLog(state, date);
      return { ...state, dayLogs: { ...state.dayLogs, [date]: { ...dayLog, hydrationLitres } } };
    }
    case "UPDATE_DAY_NOTES": {
      const { date, notes } = action.payload;
      const dayLog = ensureDayLog(state, date);
      return { ...state, dayLogs: { ...state.dayLogs, [date]: { ...dayLog, notes } } };
    }
    case "UPDATE_DAY_ACTIVITIES": {
      // payload: { date, activities } where activities is array of activity objects
      const { date, activities } = action.payload;
      const dayLog = ensureDayLog(state, date);
      const updatedDay = { ...dayLog, activities: Array.isArray(activities) ? activities : dayLog.activities, activityMode: dayLog.activityMode === 'manual' ? 'advanced_full' : dayLog.activityMode };
      return { ...state, dayLogs: { ...state.dayLogs, [date]: updatedDay } };
    }
    case "UPDATE_DAY_STEPS_SURVEY": {
      // payload: { date, steps, survey } survey = { subjective, standingHours, activeCommute }
      const { date, steps, survey } = action.payload;
      const dayLog = ensureDayLog(state, date);
      const updatedDay = { ...dayLog, steps: steps ?? dayLog.steps, survey: survey ?? dayLog.survey, activityMode: dayLog.activityMode === 'manual' ? 'advanced_neat' : dayLog.activityMode };
      return { ...state, dayLogs: { ...state.dayLogs, [date]: updatedDay } };
    }
    case "UPDATE_PROFILE": {
      return { ...state, profile: { ...state.profile, ...(action.payload || {}) } };
    }
    default:
      return state;
  }
}

/* --------- CONTEXT SETUP --------- */
const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState, loadFromStorage);

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const value = { state, dispatch, getDayDerived };
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within an AppStateProvider");
  return ctx;
}

export function useProfile() {
  const { state, dispatch } = useAppState();
  const profile = state.profile || DEFAULT_PROFILE;
  const saveProfile = (patch) => {
    dispatch({ type: "UPDATE_PROFILE", payload: patch });
  };
  return { profile, saveProfile };
}
