// src/context/AppStateContext.jsx
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
} from "react";

const STORAGE_KEY = "diet-tracker-state-v1";

const todayISO = new Date().toISOString().slice(0, 10);

// ---------- State shape (v1) ----------
// {
//   userProfile: { ... },
//   foods: [ { id, name, category, unitLabel, kcalPerUnit, notes, isFavorite, createdAt } ],
//   days: {
//     "2025-11-24": {
//       date: "2025-11-24",
//       activityFactor: 1.4,
//       workoutKcal: 0,
//       waterMl: 0,
//       weightKg: null,
//       notes: "",
//       meals: {
//         lunch: [ { id, foodId, label, quantity, kcalTotal } ],
//         dinner: [ ... ],
//         extras: [ ... ],
//       },
//     },
//     ...
//   },
//   ui: {
//     selectedDate: "YYYY-MM-DD",
//     lastVisitedPage: "dashboard" | "day" | "foods" | "trends" | "settings",
//   }
// }

// ---------- Helpers ----------

function createInitialState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Simple versioning hook for future migrations
      return {
        ...parsed,
        ui: {
          selectedDate: parsed?.ui?.selectedDate || todayISO,
          lastVisitedPage: parsed?.ui?.lastVisitedPage || "dashboard",
        },
      };
    }
  } catch (e) {
    console.warn("Failed to load diet-tracker state from localStorage:", e);
  }

  // Fresh install defaults
  return {
    userProfile: {
      name: "Sagar",
      heightCm: null,
      startWeightKg: null,
      currentWeightKg: null,
      createdAt: todayISO,
      defaultActivityPreset: "sedentary", // "sedentary" | "college" | "custom"
      customActivityFactor: 1.4,
      dailyKcalTarget: null, // we’ll compute/ask later
      proteinGramTarget: null, // optional
    },
    foods: [],
    days: {},
    ui: {
      selectedDate: todayISO,
      lastVisitedPage: "dashboard",
    },
  };
}

function persistState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save diet-tracker state to localStorage:", e);
  }
}

function createEmptyDay(date, activityFactorFromProfile = 1.4) {
  return {
    date,
    activityFactor: activityFactorFromProfile,
    workoutKcal: 0,
    waterMl: 0,
    weightKg: null,
    notes: "",
    meals: {
      lunch: [],
      dinner: [],
      extras: [],
    },
  };
}

function generateId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Actions ----------

const ACTIONS = {
  SET_USER_PROFILE: "SET_USER_PROFILE",
  UPDATE_USER_PROFILE: "UPDATE_USER_PROFILE",

  ADD_FOOD: "ADD_FOOD",
  UPDATE_FOOD: "UPDATE_FOOD",
  DELETE_FOOD: "DELETE_FOOD",
  TOGGLE_FOOD_FAVORITE: "TOGGLE_FOOD_FAVORITE",

  SET_SELECTED_DATE: "SET_SELECTED_DATE",
  UPSERT_DAY: "UPSERT_DAY", // replace or create a full day object

  ADD_MEAL_ENTRY: "ADD_MEAL_ENTRY",
  UPDATE_MEAL_ENTRY: "UPDATE_MEAL_ENTRY",
  DELETE_MEAL_ENTRY: "DELETE_MEAL_ENTRY",

  UPDATE_DAY_FIELD: "UPDATE_DAY_FIELD", // water, notes, activityFactor, workoutKcal, weightKg

  SET_LAST_VISITED_PAGE: "SET_LAST_VISITED_PAGE",
};

// ---------- Reducer ----------

function appStateReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_USER_PROFILE: {
      return {
        ...state,
        userProfile: { ...action.payload },
      };
    }

    case ACTIONS.UPDATE_USER_PROFILE: {
      return {
        ...state,
        userProfile: {
          ...state.userProfile,
          ...action.payload,
        },
      };
    }

    case ACTIONS.ADD_FOOD: {
      const newFood = {
        id: generateId("food"),
        name: action.payload.name,
        category: action.payload.category || "home",
        unitLabel: action.payload.unitLabel || "unit",
        kcalPerUnit: Number(action.payload.kcalPerUnit) || 0,
        notes: action.payload.notes || "",
        isFavorite: !!action.payload.isFavorite,
        createdAt: new Date().toISOString(),
      };
      return {
        ...state,
        foods: [...state.foods, newFood],
      };
    }

    case ACTIONS.UPDATE_FOOD: {
      const { id, updates } = action.payload;
      return {
        ...state,
        foods: state.foods.map((f) =>
          f.id === id ? { ...f, ...updates } : f
        ),
      };
    }

    case ACTIONS.DELETE_FOOD: {
      const id = action.payload;
      return {
        ...state,
        foods: state.foods.filter((f) => f.id !== id),
      };
    }

    case ACTIONS.TOGGLE_FOOD_FAVORITE: {
      const id = action.payload;
      return {
        ...state,
        foods: state.foods.map((f) =>
          f.id === id ? { ...f, isFavorite: !f.isFavorite } : f
        ),
      };
    }

    case ACTIONS.SET_SELECTED_DATE: {
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedDate: action.payload,
        },
      };
    }

    case ACTIONS.SET_LAST_VISITED_PAGE: {
      return {
        ...state,
        ui: {
          ...state.ui,
          lastVisitedPage: action.payload,
        },
      };
    }

    case ACTIONS.UPSERT_DAY: {
      const day = action.payload;
      return {
        ...state,
        days: {
          ...state.days,
          [day.date]: day,
        },
      };
    }

    case ACTIONS.UPDATE_DAY_FIELD: {
      const { date, field, value } = action.payload;
      const existing = state.days[date] || createEmptyDay(date);
      return {
        ...state,
        days: {
          ...state.days,
          [date]: {
            ...existing,
            [field]: value,
          },
        },
      };
    }

    case ACTIONS.ADD_MEAL_ENTRY: {
      const { date, mealType, entry } = action.payload; // mealType: "lunch" | "dinner" | "extras"
      const existing = state.days[date] || createEmptyDay(date);
      const newEntry = {
        id: generateId("meal"),
        ...entry,
      };
      return {
        ...state,
        days: {
          ...state.days,
          [date]: {
            ...existing,
            meals: {
              ...existing.meals,
              [mealType]: [...existing.meals[mealType], newEntry],
            },
          },
        },
      };
    }

    case ACTIONS.UPDATE_MEAL_ENTRY: {
      const { date, mealType, entryId, updates } = action.payload;
      const existing = state.days[date];
      if (!existing) return state;
      return {
        ...state,
        days: {
          ...state.days,
          [date]: {
            ...existing,
            meals: {
              ...existing.meals,
              [mealType]: existing.meals[mealType].map((m) =>
                m.id === entryId ? { ...m, ...updates } : m
              ),
            },
          },
        },
      };
    }

    case ACTIONS.DELETE_MEAL_ENTRY: {
      const { date, mealType, entryId } = action.payload;
      const existing = state.days[date];
      if (!existing) return state;
      return {
        ...state,
        days: {
          ...state.days,
          [date]: {
            ...existing,
            meals: {
              ...existing.meals,
              [mealType]: existing.meals[mealType].filter(
                (m) => m.id !== entryId
              ),
            },
          },
        },
      };
    }

    default:
      return state;
  }
}

// ---------- Context & Provider ----------

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(appStateReducer, undefined, createInitialState);

  useEffect(() => {
    persistState(state);
  }, [state]);

  // We can later wrap dispatch with helper functions if we want
  const value = { state, dispatch, ACTIONS };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used inside <AppStateProvider>");
  }
  return ctx;
}