// src/pages/Trends.jsx
import React, { useMemo, useState } from "react";
import { useAppState } from "../context/AppStateContext";
import { 
  computeDayMealTotals, 
  computeTDEEForDay, 
  calculateEffectiveWorkout 
} from "../utils/calculations";
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
import { TrendingUp, Scale, Save } from "lucide-react";

import "../styles/Trends.css";

export default function Trends() {
  const { state, dispatch } = useAppState();
  const { profile, dayLogs, selectedDate } = state;

  // Local weight input state
  const [weightInput, setWeightInput] = useState("");

  // 1. Prepare Calorie Series (Dynamic TDEE)
  const calorieSeries = useMemo(() => {
    const days = Object.values(dayLogs || {});
    // Sort by date
    const sorted = days
      .filter((d) => d && d.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return sorted.map((day) => {
      // Actual Intake
      const { total: intake } = computeDayMealTotals(day);
      
      // Dynamic Target = Base TDEE + Effective Workout
      const baseTdee = computeTDEEForDay(day, profile);
      const workout = calculateEffectiveWorkout(day);
      const dynamicTarget = baseTdee + workout;

      return {
        date: day.date,
        intake: Math.round(intake),
        target: Math.round(dynamicTarget),
      };
    });
  }, [dayLogs, profile]);

  // 2. Prepare Weight Series
  const weightSeries = useMemo(() => {
    const days = Object.values(dayLogs || {});
    const withWeight = days.filter(
      (d) => d && d.date && d.weightKg != null && d.weightKg !== ""
    );
    
    const sorted = withWeight.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return sorted.map((day) => ({
      date: day.date,
      weight: Number(day.weightKg),
    }));
  }, [dayLogs]);

  // Handlers
  const handleDateChange = (e) => {
    dispatch({ type: "SET_SELECTED_DATE", payload: e.target.value });
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

    setWeightInput("");
    alert(`Saved ${v}kg for ${selectedDate}`);
  };

  const hasCalorieData = calorieSeries.length > 1;
  const hasWeightData = weightSeries.length > 1;

  return (
    <div className="trends-page">
      
      {/* Header */}
      <div className="trends-header">
        <h1 className="trends-title">
          <TrendingUp size={32} color="#3182ce" /> Health Trends
        </h1>
        <p className="trends-subtitle">
          Visualize your calorie adherence and weight progress over time.
        </p>
      </div>

      {/* 1. Weight Logger */}
      <section className="trends-card">
        <div className="section-title"><Scale size={20}/> Log Weight Check-in</div>
        
        <div className="weight-log-grid">
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="trends-input"
            />
          </div>
          
          <div className="form-group">
            <label>Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 75.5"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              className="trends-input"
            />
          </div>
          
          <button 
            onClick={handleSaveWeight} 
            className="btn-save-weight"
            disabled={!selectedDate || !weightInput}
          >
            <Save size={18} /> Save
          </button>
        </div>
      </section>

      {/* 2. Calorie Chart */}
      <section className="trends-card">
        <div className="section-title">Calorie Intake vs. Target (TDEE)</div>
        
        {!hasCalorieData ? (
          <div className="empty-chart-msg">
            Not enough data yet. Log meals for at least two days to see your trend line.
          </div>
        ) : (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={calorieSeries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis 
                    dataKey="date" 
                    stroke="#718096" 
                    tick={{fontSize: 12}}
                    tickFormatter={(str) => str.slice(5)} // Show MM-DD only
                />
                <YAxis stroke="#718096" tick={{fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Legend />
                
                {/* Intake Line */}
                <Line
                  type="monotone"
                  dataKey="intake"
                  name="Intake"
                  stroke="#3182ce"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
                
                {/* Dynamic Target Line (TDEE) */}
                <Line
                  type="monotone"
                  dataKey="target"
                  name="Target (TDEE)"
                  stroke="#e53e3e"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* 3. Weight Chart */}
      <section className="trends-card">
        <div className="section-title">Weight History</div>
        
        {!hasWeightData ? (
          <div className="empty-chart-msg">
            No weight trend yet. Log your weight on different days to see the curve.
          </div>
        ) : (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightSeries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis 
                    dataKey="date" 
                    stroke="#718096" 
                    tick={{fontSize: 12}}
                    tickFormatter={(str) => str.slice(5)}
                />
                <YAxis 
                    stroke="#718096" 
                    domain={['auto', 'auto']} // Auto-scale to show weight changes clearly
                    tick={{fontSize: 12}} 
                />
                <Tooltip 
                  formatter={(value) => [`${value} kg`, "Weight"]}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="weight"
                  name="Weight (kg)"
                  stroke="#38a169" /* Green */
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#38a169' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

    </div>
  );
}