// src/pages/Dashboard.jsx
import React from "react";
import { useAppState } from "../context/AppStateContext";
import { Link } from "react-router-dom"; // Import Link for Quick actions

// Using totalKcal with fallback to kcalPerUnitSnapshot
function calcDayIntake(day) {
  if (!day || !day.meals) return 0;
  return day.meals.reduce(
    (sum, m) => sum + (m.totalKcal ?? m.kcalPerUnitSnapshot ?? 0), 
    0
  );
}

export default function Dashboard() {
  const { state } = useAppState();
  const { profile, dayLogs } = state;

  const dailyTarget = Number(profile.dailyKcalTarget) || 0;

  const allDays = Object.values(dayLogs || {});

  // Only count days where you actually did *something*
  const effectiveDays = allDays.filter((day) => {
    if (!day) return false;
    const hasMeals = day.meals && day.meals.length > 0;
    const hasWorkout = !!day.workoutKcal;
    // Updated check to prioritize hydrationLitres
    const hasHydration = !!day.hydrationLitres || !!day.hydrationMl; 
    const hasNotes = !!day.notes;
    const hasWeight = day.weightKg !== null && day.weightKg !== undefined;
    return hasMeals || hasWorkout || hasHydration || hasNotes || hasWeight;
  });

  const daysCount = effectiveDays.length; // Not used in the new UI, but kept

  // Today’s log
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayLog = dayLogs[todayIso] || {}; 
  
  // Derived values for the dashboard cards
  const todayIntake = calcDayIntake(todayLog);
  const todayWorkout = todayLog?.workoutKcal || 0;
  const netKcal = dailyTarget > 0 
    ? (dailyTarget + todayWorkout) - todayIntake 
    : 0;
  const todayHydration = todayLog.hydrationLitres ?? 0;

  // Totals for effective days
  let totalIntakeAllTime = 0;
  let totalWorkoutAllTime = 0;
  let totalTargetAllTime = 0;

  for (const day of effectiveDays) {
    const intake = calcDayIntake(day); 
    const workout = day.workoutKcal || 0;

    totalIntakeAllTime += intake;
    totalWorkoutAllTime += workout;
    totalTargetAllTime += dailyTarget;
  }

  const allTimeNetDeficit =
    totalTargetAllTime + totalWorkoutAllTime - totalIntakeAllTime;

  // Simple streak: how many *consecutive* days at or below target
  const sortedDays = [...effectiveDays].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );
  let currentStreak = 0;
  for (let i = sortedDays.length - 1; i >= 0; i--) {
    const day = sortedDays[i]; 
    const intake = calcDayIntake(day);
    const workout = day.workoutKcal || 0;
    const dayDeficit = (dailyTarget + workout) - intake;
    if (dayDeficit >= 0) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Today’s summary, streaks and all-time stats for your journey.
          </p>
        </div>
      </div>

      <div className="card-grid card-grid-3 section-spacer">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Today’s net</span>
            <span className="card-meta">calories vs target</span>
          </div>
          <div className="stat-value">
            {/* Show + for surplus, or nothing if deficit/zero */}
            {netKcal > 0 ? "+" : ""}
            {Math.round(netKcal)} kcal
          </div>
          <div className="stat-label">
            Intake {Math.round(todayIntake)} · Burn {Math.round(todayWorkout)} · Target{" "}
            {dailyTarget}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Hydration</span>
          </div>
          <div className="stat-value">
            {todayHydration.toFixed(1)} L
          </div>
          <div className="stat-label">Logged for this day</div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Streak</span>
          </div>
          <div className="stat-value">{currentStreak} days</div>
          <div className="stat-label">Days at or under target</div>
        </div>
      </div>

      <div className="card-grid card-grid-2 section-spacer">
        <div className="card">
          <div className="card-header">
            <span className="card-title">All-time net deficit</span>
          </div>
          <div className="stat-value">
            {/* Show + for overall deficit, or nothing if surplus/zero */}
            {allTimeNetDeficit > 0 ? "+" : ""}
            {Math.round(allTimeNetDeficit)} kcal
          </div>
          <div className="stat-label">
            Roughly {(allTimeNetDeficit / 7700).toFixed(2)} kg worth of energy.
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Quick actions</span>
          </div>
          <div className="btn-row">
            <Link to="/day-log">
              <button className="btn-primary">Go to Today’s Log</button>
            </Link>
            <Link to="/foods" style={{ marginLeft: '0.5rem' }}>
              <button>Add New Food</button>
            </Link>
          </div>
          <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
            Use the Day Log to add meals, water and notes. Use Foods to expand your
            personal database.
          </p>
        </div>
      </div>
    </>
  );
}