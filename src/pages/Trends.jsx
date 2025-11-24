// src/pages/Trends.jsx
import React, { useMemo, useState } from "react";
import { useAppState } from "../context/AppStateContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function calcDayIntake(day) {
  if (!day || !day.meals) return 0;
  return day.meals.reduce((sum, m) => sum + (m.totalKcal || 0), 0);
}

export default function Trends() {
  const { state, dispatch } = useAppState();
  const { profile, dayLogs, selectedDate } = state;

  const dailyTarget = Number(profile.dailyKcalTarget) || 0;

  // Local weight input state (kg)
  const [weightInput, setWeightInput] = useState("");

  // Derived data: calories vs target per day
  const calorieSeries = useMemo(() => {
    const days = Object.values(dayLogs || {});
    const sorted = days
      .filter((d) => d && d.date)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    return sorted.map((day) => {
      const intake = calcDayIntake(day);
      return {
        date: day.date,
        intake,
        target: dailyTarget,
      };
    });
  }, [dayLogs, dailyTarget]);

  // Derived data: weight history
  const weightSeries = useMemo(() => {
    const days = Object.values(dayLogs || {});
    const withWeight = days.filter(
      (d) =>
        d &&
        d.date &&
        d.weightKg !== null &&
        d.weightKg !== undefined &&
        d.weightKg !== ""
    );
    const sorted = withWeight.sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    );
    return sorted.map((day) => ({
      date: day.date,
      weight: Number(day.weightKg),
    }));
  }, [dayLogs]);

  const handleSelectedDateChange = (e) => {
    const newDate = e.target.value;
    if (!newDate) return;
    dispatch({ type: "SET_SELECTED_DATE", payload: newDate });
  };

  const handleSaveWeight = () => {
    const v = Number(weightInput);
    if (!selectedDate || isNaN(v) || v <= 0) return;

    dispatch({
      type: "UPDATE_DAY_META",
      payload: {
        date: selectedDate,
        patch: { weightKg: v },
      },
    });

    // You can keep the value or clear it; I prefer keeping so you see what you last entered.
    // setWeightInput("");
  };

  const hasCalorieData = calorieSeries.length > 0;
  const hasWeightData = weightSeries.length > 0;

  return (
    <div>
      <h1>Trends</h1>

      {/* Weight logging controls */}
      <section>
        <h2>Log Weight</h2>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            Date:&nbsp;
            <input
              type="date"
              value={selectedDate}
              onChange={handleSelectedDateChange}
            />
          </label>
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>
            Weight (kg):&nbsp;
            <input
              type="number"
              step="0.1"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
            />
          </label>
        </div>
        <button onClick={handleSaveWeight}>Save weight for selected date</button>
        <p style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
          Tip: pick any date (past or today) and log your weight so the graph
          lines up with your calorie data.
        </p>
      </section>

      {/* Calories vs target chart */}
      <section style={{ marginTop: "2rem" }}>
        <h2>Calories vs Target</h2>
        {!hasCalorieData ? (
          <p>No data yet. Log a few days of meals and come back!</p>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={calorieSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="intake"
                  name="Intake"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  name="Target"
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Weight chart */}
      <section style={{ marginTop: "2rem" }}>
        <h2>Weight Trend</h2>
        {!hasWeightData ? (
          <p>No weight data yet. Log your weight above to see the graph.</p>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={weightSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="weight" name="Weight (kg)" dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}