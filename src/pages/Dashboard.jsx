// src/pages/Dashboard.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useAppState } from "../context/AppStateContext";
import { 
  computeDayMealTotals, 
} from "../utils/calculations";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Droplet, 
  Activity, 
  ArrowRight, 
  Plus,
  History
} from "lucide-react";

// Import separate CSS
import "../styles/Dashboard.css";

export default function Dashboard() {
  // ✅ 1. Get the centralized selector
  const { state, getDayDerived } = useAppState();
  const { dayLogs, profile } = state;

  // --- 2. Today's Data (Using Context Logic) ---
  const todayIso = new Date().toISOString().slice(0, 10);
  
  // Use the central helper to get consistent math
  const { 
    tdee: todayLimit,      // This is Base TDEE + Effective Workout
    totalIntake: todayIntake, 
    netKcal: todayNetState, // (Intake - Limit). Positive = Surplus, Negative = Deficit
    workoutCalories: todayWorkoutRaw, // Raw log
    intensityFactor 
  } = getDayDerived(state, todayIso);

  // Dashboard "Deficit" view: We want Positive = Good (Calories Left)
  const todayDeficit = -todayNetState; 
  
  const todayHydration = dayLogs[todayIso]?.hydrationLitres ?? 0;

  // Progress bar calc (capped at 100%)
  // Use safe denominator to avoid divide-by-zero
  const progressPercent = Math.min(100, (todayIntake / (todayLimit || 2000)) * 100);

  // --- 3. All-Time & Streak Data (Iterative) ---
  const allDays = Object.values(dayLogs || {});
  
  const effectiveDays = allDays.filter((day) => {
    if (!day) return false;
    const totals = computeDayMealTotals(day);
    return totals.total > 0 || !!day.hydrationLitres || day.weightKg != null;
  });

  // Aggregates
  let totalIntakeAllTime = 0;
  let totalBurnAllTime = 0;

  effectiveDays.forEach(day => {
    const { tdee, totalIntake } = getDayDerived(state, day.date);
    totalIntakeAllTime += totalIntake;
    totalBurnAllTime += tdee;
  });

  const allTimeNetDeficit = totalBurnAllTime - totalIntakeAllTime;

  // Streak Logic
  const sortedDays = [...effectiveDays].sort((a, b) => new Date(a.date) - new Date(b.date));
  let currentStreak = 0;
  
  // Iterate backwards from most recent entry
  for (let i = sortedDays.length - 1; i >= 0; i--) {
    const d = sortedDays[i];
    const { tdee, totalIntake } = getDayDerived(state, d.date);
    
    // Success = You didn't overeat (Deficit >= 0)
    if ((tdee - totalIntake) >= 0) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  return (
    <div className="dashboard-page">
      
      {/* Header */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">
          <LayoutDashboard size={32} className="text-blue" /> 
          Dashboard
        </h1>
        <p className="dashboard-subtitle">
          Today’s summary, streaks, and journey stats.
        </p>
      </div>

      {/* 1. HERO CARD: Today's Status */}
      <section className="dash-hero-grid">
        <div className="dash-card">
          <div className="dc-header">
            <span className="dc-title"><Activity size={18}/> Net Deficit (Today)</span>
            {todayDeficit >= 0 ? (
                <span className="text-green" style={{fontWeight:'700'}}>On Track</span>
            ) : (
                <span className="text-red" style={{fontWeight:'700'}}>Over Limit</span>
            )}
          </div>
          
          <div className="hero-value-row">
            <div className="dc-value">
                {todayDeficit > 0 ? "+" : ""}
                {Math.round(todayDeficit)}
                <span style={{fontSize:'1.2rem', color:'#a0aec0', marginLeft:'5px'}}>kcal left</span>
            </div>
          </div>

          {/* Visual progress bar */}
          <div className="progress-bar-bg">
            <div 
                className="progress-bar-fill" 
                style={{ 
                    width: `${progressPercent}%`,
                    background: todayDeficit >= 0 ? '#3182ce' : '#e53e3e'
                }}
            />
          </div>

          <div className="dc-footer" style={{marginTop:'1rem', display:'flex', justifyContent:'space-between'}}>
            <span>Intake: <strong>{Math.round(todayIntake)}</strong></span>
            {/* ✅ Using derived TDEE (Base + Workout) */}
            <span>Target (TDEE): <strong>{Math.round(todayLimit)}</strong></span>
          </div>
        </div>
      </section>

      {/* 2. THE TRIO ROW: Hydration, Streak, All-Time */}
      <section className="dash-grid-3">
        
        {/* Hydration */}
        <div className="dash-card">
          <div className="dc-header">
            <span className="dc-title"><Droplet size={16}/> Hydration</span>
          </div>
          <div className="dc-value text-blue">
            {todayHydration.toFixed(1)} <span style={{fontSize:'1rem', color:'#a0aec0'}}>L</span>
          </div>
          <div className="dc-footer">
            Logged today
          </div>
        </div>

        {/* Streak */}
        <div className="dash-card">
          <div className="dc-header">
            <span className="dc-title"><TrendingUp size={16}/> Streak</span>
          </div>
          <div className="dc-value text-orange">
            {currentStreak} <span style={{fontSize:'1rem', color:'#a0aec0'}}>days</span>
          </div>
          <div className="dc-footer">
            At or under limit
          </div>
        </div>

        {/* All Time Deficit */}
        <div className="dash-card">
          <div className="dc-header">
            <span className="dc-title"><History size={16}/> All-Time Deficit</span>
          </div>
          <div className="dc-value">
            {allTimeNetDeficit > 0 ? "+" : ""}
            {Math.round(allTimeNetDeficit)}
          </div>
          <div className="dc-footer">
            Est. <strong className={allTimeNetDeficit >= 0 ? "text-green" : "text-red"}>
                {(allTimeNetDeficit / 7700).toFixed(2)} kg
            </strong> {allTimeNetDeficit >= 0 ? "lost" : "gained"}
          </div>
        </div>

      </section>

      {/* 3. ACTIONS ROW */}
      <section className="dash-actions dash-card">
        <div className="dc-header">
            <span className="dc-title">Quick Actions</span>
        </div>
        <div className="dash-btn-row">
            <Link to="/day-log" style={{textDecoration:'none'}}>
              <button className="dash-btn dash-btn-primary">
                Go to Today’s Log <ArrowRight size={18}/>
              </button>
            </Link>
            <Link to="/foods" style={{textDecoration:'none'}}>
              <button className="dash-btn dash-btn-secondary">
                <Plus size={18}/> Add New Food
              </button>
            </Link>
        </div>
      </section>

    </div>
  );
}