// src/context/AppStateContext.jsx
import React, { createContext, useContext, useEffect, useReducer } from "react";

const LOCAL_STORAGE_KEY = "diet-tracker-app-state-v1";

const todayIso = () => new Date().toISOString().slice(0, 10);

// --------- INITIAL STATE ---------
const initialState = {
  profile: {
    name: "",
    heightCm: null,
    startingWeightKg: null,
    currentWeightKg: null,
    dailyKcalTarget: 2300,
    defaultActivityPreset: "sedentary", // future use
  },
  // Your personal food DB
  foodItems: [
    // example shape:
    // {
    //   id: "food-1",
    //   name: "Chapati",
    //   category: "home",
    //   unitLabel: "piece",
    //   kcalPerUnit: 80,
    // }
  ],
  // Logs keyed by date: "YYYY-MM-DD" -> { ... }
  dayLogs: {
    // "2025-11-24": {
    //   date: "2025-11-24",
    //   activityFactor: 1.2,
    //   hydrationMl: 0,
    //   workoutKcal: 0,
    //   weightKg: null,
    //   notes: "",
    //   meals: [
    //     {
    //       id: "meal-1",
    //       mealType: "lunch", // "lunch" | "dinner" | "extra"
    //       foodItemId: "food-1",
    //       foodNameSnapshot: "Chapati",    // frozen label at time of logging
    //       unitLabelSnapshot: "piece",
    //       quantity: 2,
    //       kcalPerUnitSnapshot: 80,
    //       totalKcal: 160,
    //     },
    //   ],
    // },
  },
  selectedDate: todayIso(),
};

// --------- HELPERS ---------

function loadFromStorage() {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);

    // Shallow merge so we can evolve the state shape safely
    return {
      ...initialState,
      ...parsed,
      profile: { ...initialState.profile, ...(parsed.profile || {}) },
      dayLogs: parsed.dayLogs || {},
      foodItems: parsed.foodItems || [],
      selectedDate: parsed.selectedDate || todayIso(),
    };
  } catch {
    return initialState;
  }
}

function saveToStorage(state) {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// Ensure a dayLog object always has the same structure
function ensureDayLog(state, date) {
  const existing = state.dayLogs[date];
  if (existing) return existing;

  return {
    date,
    activityFactor: 1.2,
    hydrationMl: 0,
    workoutKcal: 0,
    weightKg: null,
    notes: "",
    meals: [],
  };
}

// --------- REDUCER ---------

function appReducer(state, action) {
  switch (action.type) {
    case "SET_SELECTED_DATE": {
      return {
        ...state,
        selectedDate: action.payload,
      };
    }

    case "UPSERT_FOOD_ITEM": {
      const { id, name, category, unitLabel, kcalPerUnit } = action.payload;

      // If id exists -> update; else insert
      const existingIndex = state.foodItems.findIndex((f) => f.id === id);

      if (existingIndex >= 0) {
        const updated = [...state.foodItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          name,
          category,
          unitLabel,
          kcalPerUnit,
        };
        return { ...state, foodItems: updated };
      }

      return {
        ...state,
        foodItems: [
          ...state.foodItems,
          { id, name, category, unitLabel, kcalPerUnit },
        ],
      };
    }

    case "ADD_MEAL_ENTRY": {
      const {
        date,
        mealType,
        foodItemId,
        foodNameSnapshot,
        unitLabelSnapshot,
        kcalPerUnitSnapshot,
        quantity,
        totalKcal,
      } = action.payload;

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

      const updatedDay = {
        ...dayLog,
        meals: [...dayLog.meals, newMeal],
      };

      return {
        ...state,
        dayLogs: {
          ...state.dayLogs,
          [date]: updatedDay,
        },
      };
    }

    case "DELETE_MEAL_ENTRY": {
      const { date, mealId } = action.payload;
      const dayLog = state.dayLogs[date];
      if (!dayLog) return state;

      const updatedDay = {
        ...dayLog,
        meals: dayLog.meals.filter((m) => m.id !== mealId),
      };

      return {
        ...state,
        dayLogs: {
          ...state.dayLogs,
          [date]: updatedDay,
        },
      };
    }

    case "UPDATE_DAY_META": {
      const { date, patch } = action.payload;
      const dayLog = ensureDayLog(state, date);

      const updatedDay = {
        ...dayLog,
        ...patch,
      };

      return {
        ...state,
        dayLogs: {
          ...state.dayLogs,
          [date]: updatedDay,
        },
      };
    }

    default:
      return state;
  }
}

// --------- CONTEXT SETUP ---------

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState, loadFromStorage);

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const value = { state, dispatch };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return ctx;
}
