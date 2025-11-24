// src/pages/Dashboard.jsx
import React from "react";
import { useAppState } from "../context/AppStateContext";

function calcDayIntake(day) {
  if (!day || !day.meals) return 0;
  return day.meals.reduce((sum, m) => sum + (m.totalKcal || 0), 0);
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
    const hasHydration = !!day.hydrationMl;
    const hasNotes = !!day.notes;
    const hasWeight = day.weightKg !== null && day.weightKg !== undefined;
    return hasMeals || hasWorkout || hasHydration || hasNotes || hasWeight;
  });

  const daysCount = effectiveDays.length;

  // Today’s log
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayLog = dayLogs[todayIso];
  const todayIntake = calcDayIntake(todayLog);
  const todayWorkout = todayLog?.workoutKcal || 0;
  const todayNetDeficit =
    dailyTarget > 0 ? (dailyTarget + todayWorkout) - todayIntake : 0;

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
    <div>
      <h1>Dashboard</h1>

      <section>
        <h2>Today</h2>
        <p>Date: {todayIso}</p>
        <p>Daily target: {dailyTarget || "—"} kcal</p>
        <p>Intake so far: {todayIntake} kcal</p>
        <p>Workout: {todayWorkout} kcal</p>
        <p>
          Net today (target + workout - intake):{" "}
          {Math.round(todayNetDeficit)} kcal{" "}
          {todayNetDeficit >= 0 ? "(deficit)" : "(surplus)"}
        </p>
      </section>

      <section>
        <h2>All-time summary</h2>
        <p>Logged days: {daysCount}</p>
        <p>Total intake: {Math.round(totalIntakeAllTime)} kcal</p>
        <p>Total workouts: {Math.round(totalWorkoutAllTime)} kcal</p>
        <p>Total target (logged days): {Math.round(totalTargetAllTime)} kcal</p>
        <p>
          All-time net (target + workouts − intake):{" "}
          {Math.round(allTimeNetDeficit)} kcal{" "}
          {allTimeNetDeficit >= 0 ? "(overall deficit)" : "(overall surplus)"}
        </p>
      </section>

      <section>
        <h2>Streak</h2>
        <p>Days at or under target (most recent streak): {currentStreak}</p>
      </section>

      <section>
        <h2>Quick links</h2>
        <ul>
          <li>Use Day Log to add meals for any date.</li>
          <li>Use Trends to see calories vs. target and weight graphs.</li>
          <li>Use Settings to adjust your daily target and profile.</li>
        </ul>
      </section>
    </div>
  );
}