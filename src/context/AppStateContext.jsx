// src/context/AppStateContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
} from "react";

// --- NEW: Central definition of meal types (Breakfast removed) ---
export const MEAL_TYPES = ["lunch", "dinner", "extras"];

const DEFAULT_PROFILE = {
  name: "",
  heightCm: "",
  weightKg: "",
  sex: "male", // or "female"/"other"
  dailyKcalTarget: 2200,
  defaultActivityPreset: "sedentary", // "sedentary" | "college" | "custom"
  defaultActivityFactor: 1.2,
  proteinTarget: "",
};

const LOCAL_STORAGE_KEY = "diet-tracker-app-state-v1";

const todayIso = () => new Date().toISOString().slice(0, 10);

// --------- INITIAL STATE ---------
const initialState = {
  profile: {
    ...DEFAULT_PROFILE,
  },
  foodItems: [],
  dayLogs: {},
  selectedDate: todayIso(),
};

// --------- HELPERS ---------

function loadFromStorage() {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return initialState;

    const parsed = JSON.parse(raw);

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

function ensureDayLog(state, date) {
  const existing = state.dayLogs[date];
  if (existing) return existing;

  return {
    date,
    activityFactor: state.profile?.defaultActivityFactor ?? 1.2,
    workoutKcal: 0,
    weightKg: null,
    hydrationLitres: 0,
    notes: "",
    meals: [], // Flexible array structure
  };
}

// --------- REDUCER ---------

// --------- REDUCER ---------

function appReducer(state, action) {
  switch (action.type) {
    case "SET_SELECTED_DATE": {
      return {
        ...state,
        selectedDate: action.payload,
      };
    }

    // --- NEW: Handle importing/overwriting the entire state ---
    case "IMPORT_STATE": {
      // The payload is expected to be the new, full state object
      // We perform a full overwrite as required for an import
      return {
        ...action.payload,
        // Optional: Retain the current selectedDate if the imported state doesn't have it, 
        // or always use the imported date if provided. 
        // For simplicity and full overwrite, we just return the payload:
      };
    }
    // ---------------------------------------------------------

    case "UPSERT_FOOD_ITEM": {
      const {
        id,
        name,
        category,
        unitLabel,
        kcalPerUnit,
        isFavourite = false,
      } = action.payload;

      const existingIndex = state.foodItems.findIndex((f) => f.id === id);

      if (existingIndex >= 0) {
        const updated = [...state.foodItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          name,
          category,
          unitLabel,
          kcalPerUnit,
          isFavourite,
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
            isFavourite,
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

    case "UPDATE_MEAL_ENTRY": {
      const { date, mealId, quantity } = action.payload;
      const dayLog = state.dayLogs[date];
      if (!dayLog) return state;

      const updatedMeals = (dayLog.meals || []).map((m) => {
        if (m.id !== mealId) return m;

        const perUnit =
          m.kcalPerUnitSnapshot ??
          (m.quantity ? m.totalKcal / m.quantity : 0);

        const newQuantity = quantity;
        const newTotalKcal = Math.round(newQuantity * perUnit);

        return {
          ...m,
          quantity: newQuantity,
          totalKcal: newTotalKcal,
          kcalPerUnitSnapshot: perUnit,
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

    case "UPDATE_DAY_HYDRATION": {
      const { date, hydrationLitres } = action.payload;
      const dayLogs = { ...state.dayLogs };
      const existing = dayLogs[date] || ensureDayLog(state, date);

      dayLogs[date] = {
        ...existing,
        hydrationLitres,
      };

      return { ...state, dayLogs };
    }

    case "UPDATE_DAY_NOTES": {
      const { date, notes } = action.payload;
      const dayLogs = { ...state.dayLogs };
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

export function useProfile() {
  const { state, dispatch } = useAppState();
  const profile = state.profile || DEFAULT_PROFILE;

  const saveProfile = (patch) => {
    dispatch({ type: "UPDATE_PROFILE", payload: patch });
  };

  return { profile, saveProfile };
}