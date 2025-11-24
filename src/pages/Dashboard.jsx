// src/pages/Dashboard.jsx
import React, { useMemo } from "react";
import { useAppState } from "../context/AppStateContext";

export default function Dashboard() {
  const { state } = useAppState();

  // Step 1: get today's date key in YYYY-MM-DD format
  const todayKey = new Date().toISOString().slice(0, 10);

  // Step 2: safely read dayLogs (in case it's undefined)
  const todayLog = state.dayLogs?.[todayKey];

  // Step 3: compute today's total intake
  const totalToday = useMemo(() => {
    if (!todayLog || !todayLog.meals) return 0;
    return todayLog.meals.reduce((sum, m) => sum + (m.totalKcal || 0), 0);
  }, [todayLog]);

  return (
    <div>
      <h1>Dashboard</h1>

      <h2>Today</h2>
      <p>
        Calories in: <strong>{totalToday}</strong> kcal
      </p>
    </div>
  );
}
