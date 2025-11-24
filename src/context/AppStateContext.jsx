// src/context/AppStateContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
} from "react";

const DEFAULT_PROFILE = {
  name: "",
  heightCm: "",
  weightKg: "",
  sex: "male", // or "female"/"other"
  dailyKcalTarget: 2200, // can tweak later
  defaultActivityPreset: "sedentary", // "sedentary" | "college" | "custom"
  defaultActivityFactor: 1.2,
  proteinTarget: "", // optional, can stay empty
};

const LOCAL_STORAGE_KEY = "diet-tracker-app-state-v1";

const todayIso = () => new Date().toISOString().slice(0, 10);

// --------- INITIAL STATE ---------
const initialState = {
  // Basic user profile (v1)
  profile: {
    ...DEFAULT_PROFILE,
  },

  // Your personal food DB
  foodItems: [
    // example shape:
    // {
    //   id: "food-1",
    //   name: "Chapati",
    //   category: "home",
    //   unitLabel: "piece",
    //   kcalPerUnit: 80,
    //   isFavourite: false, // NEW field example
    // }
  ],

  // Logs keyed by date: "YYYY-MM-DD" -> { ... }
  dayLogs: {
    // Example updated shape:
    // "2025-11-24": {
    //   date: "2025-11-24",
    //   activityFactor: 1.2,
    //   hydrationLitres: 0, // NEW: hydration now in Litres
    //   workoutKcal: 0,
    //   weightKg: null,
    //   notes: "", // NEW
    //   meals: [ ... ],
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
      profile: {
        ...initialState.profile,
        ...(parsed.profile || {}),
      },
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

  // UPDATED DEFAULT SHAPE
  return {
    date,
    activityFactor: state.profile?.defaultActivityFactor ?? 1.2,
    workoutKcal: 0,
    weightKg: null,
    // Note: hydrationMl from old examples is replaced by hydrationLitres
    hydrationLitres: 0, // NEW field
    notes: "", // NEW field
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

    // UPDATED: Accept and save isFavourite
    case "UPSERT_FOOD_ITEM": {
      const {
        id,
        name,
        category,
        unitLabel,
        kcalPerUnit,
        isFavourite = false, // NEW: Default to false if missing
      } = action.payload;

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
          isFavourite, // NEW: Save the new value
        };
        return { ...state, foodItems: updated };
      }

      return {
        ...state,
        foodItems: [
          ...state.foodItems,
          {
            id,
            name,
            category,
            unitLabel,
            kcalPerUnit,
            isFavourite, // NEW: Save the new value
          },
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
    
    // 4.1 ADDED: UPDATE_MEAL_ENTRY to allow editing quantity
    case "UPDATE_MEAL_ENTRY": {
      const { date, mealId, quantity } = action.payload;
      const dayLog = state.dayLogs[date];
      if (!dayLog) return state;

      const updatedMeals = (dayLog.meals || []).map((m) => {
        if (m.id !== mealId) return m;

        // Safely recompute totalKcal
        const perUnit =
          m.kcalPerUnitSnapshot ??
          (m.quantity ? m.totalKcal / m.quantity : 0);

        const newQuantity = quantity;
        const newTotalKcal = Math.round(newQuantity * perUnit);

        return {
          ...m,
          quantity: newQuantity,
          totalKcal: newTotalKcal,
          kcalPerUnitSnapshot: perUnit, // ensure we have it going forward
        };
      });

      const updatedDay = { ...dayLog, meals: updatedMeals };

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

    // NEW ACTION: Update Hydration
    case "UPDATE_DAY_HYDRATION": {
      const { date, hydrationLitres } = action.payload;
      const dayLogs = { ...state.dayLogs };
      
      // Use existing or the full default object
      const existing = dayLogs[date] || ensureDayLog(state, date); 

      dayLogs[date] = {
        ...existing,
        hydrationLitres,
      };

      return { ...state, dayLogs };
    }

    // NEW ACTION: Update Notes
    case "UPDATE_DAY_NOTES": {
      const { date, notes } = action.payload;
      const dayLogs = { ...state.dayLogs };
      
      // Use existing or the full default object
      const existing = dayLogs[date] || ensureDayLog(state, date);

      dayLogs[date] = {
        ...existing,
        notes,
      };

      return { ...state, dayLogs };
    }
    
    case "UPDATE_PROFILE": {
      return {
        ...state,
        profile: {
          ...state.profile,
          ...(action.payload || {}),
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

// Convenience hook just for profile logic
export function useProfile() {
  const { state, dispatch } = useAppState();
  const profile = state.profile || DEFAULT_PROFILE;

  const saveProfile = (patch) => {
    dispatch({ type: "UPDATE_PROFILE", payload: patch });
  };

  return { profile, saveProfile };
}