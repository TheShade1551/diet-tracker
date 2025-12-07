// src/context/AppStateContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
} from "react";

// ✅ Import centralized calculation logic
import { 
  calculateDayTDEE, 
  computeDayMealTotals,
  calculateEffectiveWorkout 
} from "../utils/calculations";

export const MEAL_TYPES = ["lunch", "dinner", "extras"];

// ✅ NEW: Default categories
export const DEFAULT_FOOD_CATEGORIES = [
  "home",
  "street",
  "packaged",
  "cheat",
  "drinks",
];

// --- ACTION TYPES ---
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

// --------- INITIAL STATE ---------
const initialState = {
  profile: { ...DEFAULT_PROFILE },
  foodItems: [],
  dayLogs: {}, 
  selectedDate: todayIso(),
  foodCategories: DEFAULT_FOOD_CATEGORIES, // ✅ NEW
};

// --------- HELPERS ---------

// ✅ Helper: Calculates effective calories (Legacy/Internal use)
export function effectiveWorkoutKcal(day) {
  return calculateEffectiveWorkout(day);
}

function loadFromStorage() {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    
    // ✅ NEW: Backfill bmrSnapshot for existing dayLogs if missing
    const dayLogs = parsed.dayLogs || {};
    const profileBmr = parsed.profile?.bmr ?? null;
    Object.keys(dayLogs).forEach((date) => {
      if (dayLogs[date] && !('bmrSnapshot' in dayLogs[date])) {
        dayLogs[date].bmrSnapshot = profileBmr;
      }
    });
    
    return {
      ...initialState,
      ...parsed,
      profile: {
        ...initialState.profile,
        ...(parsed.profile || {}),
      },
      dayLogs,
      foodItems: parsed.foodItems || [],
      selectedDate: parsed.selectedDate || todayIso(),
      // ✅ NEW: Hydrate categories or fallback to default
      foodCategories:
        parsed.foodCategories && parsed.foodCategories.length
          ? parsed.foodCategories
          : DEFAULT_FOOD_CATEGORIES,
    };
  } catch {
    return initialState;
  }
}

function saveToStorage(state) {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function ensureDayLog(state, date) {
  const existing = state.dayLogs[date];
  if (existing) return existing;

  return {
    date,
    activityFactor: state.profile?.defaultActivityFactor ?? 1.2,
    bmrSnapshot: state.profile?.bmr ?? null, // ✅ NEW: Snapshot BMR at creation time
    weightKg: null,
    hydrationLitres: 0,
    notes: "",
    meals: [], 
    
    // ✅ STRICT SHAPE: Default Workout Fields
    workoutCalories: 0,       // Number
    intensityFactor: null,    // null or Number
    workoutDescription: "",   // String
    
    workoutKcal: 0, // Legacy support
  };
}

// --------- SELECTOR / DERIVED DATA ---------

/**
 * ✅ NEW: Centralized Selector for Day Data
 * Returns all computed stats for a specific date so components 
 * don't have to redo the math manually.
 */
export function getDayDerived(state, dateKey) {
  const day = state.dayLogs?.[dateKey] || {};
  const profile = state.profile || {};

  // 1. Get factors - Use bmrSnapshot if available, fallback to current profile.bmr
  const bmr = Number(day.bmrSnapshot ?? profile.bmr) || 0;
  const activityFactor = Number(day.activityFactor ?? profile.defaultActivityFactor ?? 1.2);
  const workoutCalories = Number(day.workoutCalories ?? day.workoutKcal ?? 0);
  const intensityFactor = day.intensityFactor; // can be null

  // 2. Compute TDEE (Base + Workout * Intensity)
  const tdee = calculateDayTDEE({ 
    bmr, 
    activityFactor, 
    workoutCalories, 
    intensityFactor 
  });

  // 3. Compute Intake
  const totals = computeDayMealTotals(day);
  const totalIntake = totals.total;

  // 4. Compute Net (Surplus/Deficit)
  // Convention: Positive = Surplus (Ate more than burned)
  // Convention: Negative = Deficit (Burned more than ate)
  const netKcal = Math.round(totalIntake - tdee);

  return { 
    tdee, 
    totalIntake, 
    netKcal, 
    workoutCalories, 
    intensityFactor,
    // Also return breakdown if needed
    meals: totals 
  };
}

// --------- REDUCER ---------

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
      return {
        ...state,
        foodItems: [...state.foodItems, { id, name, category, unitLabel, kcalPerUnit, isFavourite }],
      };
    }

    // ✅ NEW: Delete Food Item
    case "DELETE_FOOD_ITEM": {
      const { id } = action.payload;
      return {
        ...state,
        foodItems: state.foodItems.filter((f) => f.id !== id),
      };
    }

    // ✅ NEW: Add Category
    case "ADD_FOOD_CATEGORY": {
      const raw = (action.payload || "").trim();
      if (!raw) return state;

      const existing = (state.foodCategories || []).map((c) => c.toLowerCase());
      if (existing.includes(raw.toLowerCase())) {
        // Already exists (case-insensitive) – no-op
        return state;
      }

      return {
        ...state,
        foodCategories: [...(state.foodCategories || []), raw],
      };
    }

    // ✅ NEW: Rename Category
    case "RENAME_FOOD_CATEGORY": {
      const { oldName, newName } = action.payload || {};
      const next = (newName || "").trim();
      if (!oldName || !next || oldName === next) return state;

      const cats = state.foodCategories || [];
      if (!cats.includes(oldName)) return state;

      const updatedCategories = cats.map((c) =>
        c === oldName ? next : c
      );

      const updatedFoodItems = (state.foodItems || []).map((f) =>
        f.category === oldName ? { ...f, category: next } : f
      );

      return {
        ...state,
        foodCategories: updatedCategories,
        foodItems: updatedFoodItems,
      };
    }

    // ✅ NEW: Delete Category (nullify items)
    case "DELETE_FOOD_CATEGORY": {
      const { name } = action.payload || {};
      if (!name) return state;

      const cats = state.foodCategories || [];
      if (!cats.includes(name)) return state;

      const updatedCategories = cats.filter((c) => c !== name);

      const updatedFoodItems = (state.foodItems || []).map((f) =>
        f.category === name ? { ...f, category: null } : f
      );

      return {
        ...state,
        foodCategories: updatedCategories,
        foodItems: updatedFoodItems,
      };
    }

    // --- ADD THIS: replace all food items (for import) ---
    case "SET_ALL_FOOD_ITEMS": {
      if (!Array.isArray(action.payload)) return state;
      return { ...state, foodItems: action.payload };
    }
    // --- ADD THIS: replace all food categories (for import) ---
    case "SET_ALL_FOOD_CATEGORIES": {
      if (!Array.isArray(action.payload)) return state;
      return { ...state, foodCategories: action.payload };
    }

    case "ADD_MEAL_ENTRY": {
      const { date, mealType, foodItemId, foodNameSnapshot, unitLabelSnapshot, kcalPerUnitSnapshot, quantity, totalKcal } = action.payload;
      const dayLog = ensureDayLog(state, date);
      const newMeal = { id: action.payload.id, mealType, foodItemId, foodNameSnapshot, unitLabelSnapshot, kcalPerUnitSnapshot, quantity, totalKcal };
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
        intensityFactor: (intensityFactor === "" || intensityFactor === null) 
          ? null 
          : Number(intensityFactor),
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
      const val = (intensityFactor === "" || intensityFactor === null) ? null : Number(intensityFactor);
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

    case "UPDATE_PROFILE": {
      return { ...state, profile: { ...state.profile, ...(action.payload || {}) } };
    }

    default:
      return state;
  }
}

// --------- CONTEXT SETUP ---------
const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState, loadFromStorage);
  useEffect(() => { saveToStorage(state); }, [state]);
  
  // ✅ Exposed getDayDerived here
  const value = { state, dispatch, getDayDerived }; 

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within an AppStateProvider");
  return ctx;
}

export function useProfile() {
  const { state, dispatch } = useAppState();
  const profile = state.profile || DEFAULT_PROFILE;
  const saveProfile = (patch) => { dispatch({ type: "UPDATE_PROFILE", payload: patch }); };
  return { profile, saveProfile };
}