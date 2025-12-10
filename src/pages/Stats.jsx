// src/pages/Stats.jsx
import React, { useMemo } from "react";
import { useAppState } from "../context/AppStateContext";
import { fmtNum, dateToKey } from "../utils/calculations";
import { TrendingUp, Activity } from "lucide-react";
import TDEEDecomposition from "../components/stats/TDEEDecomposition";
import DailyStatsMatrix from "../components/stats/DailyStatsMatrix";
import "../styles/Stats.css";

export default function Stats() {
  const { state, getDayDerived } = useAppState();
  const { dayLogs } = state;

  // Summary metrics for hero section (restored to original: no workoutDays)
  const summary = useMemo(() => {
    const entries = Object.entries(dayLogs || {});
    if (!entries.length) {
      return {
        daysLogged: 0,
        avgIntake: 0,
        avgDeficit: 0,
        estTotalDeltaKg: 0,
      };
    }

    let daysLogged = 0;
    let totalIntake = 0;
    let totalDeficit = 0;
    let estTotalDeltaKg = 0;

    for (const [dateKey, day] of entries) {
      if (!day) continue;

      const date = dateToKey(dateKey);
      if (!date) continue;

      const derived = getDayDerived(state, date) || {};
      const tdee = derived.tdee || 0;
      const total = derived.totalIntake || 0;

      const deficit = tdee - total;
      const estDeltaKg = -(deficit / 7700);

      daysLogged += 1;
      totalIntake += total;
      totalDeficit += deficit;
      estTotalDeltaKg += estDeltaKg;
    }

    return {
      daysLogged,
      avgIntake: daysLogged ? totalIntake / daysLogged : 0,
      avgDeficit: daysLogged ? totalDeficit / daysLogged : 0,
      estTotalDeltaKg,
    };
  }, [dayLogs, state, getDayDerived]);

  return (
    <div className="stats-page">
      {/* Header */}
      <header className="stats-header">
        <div className="stats-title-row">
          <div className="stats-title-left">
            <span className="stats-title-icon">
              <TrendingUp size={18} />
            </span>
            <div>
              <h1 className="stats-title">Stats</h1>
              <p className="stats-subtitle">
                Track your progress with detailed breakdowns and trends.
              </p>
            </div>
          </div>
          <div className="stats-header-meta">
            <span className="stats-header-pill">
              <Activity size={14} />
              {summary.daysLogged} days logged
            </span>
          </div>
        </div>
      </header>

      {/* Summary metrics (restored to 3 cards, no workout) */}
      <section className="stats-summary-grid">
        <div className="stats-summary-card">
          <div className="ssc-label">Avg intake</div>
          <div className="ssc-value">
            {fmtNum(summary.avgIntake)} <span className="ssc-unit">kcal</span>
          </div>
          <div className="ssc-sub">Based on all logged days</div>
        </div>

        <div className="stats-summary-card">
          <div className="ssc-label">Avg deficit</div>
          <div
            className={`ssc-value ${
              summary.avgDeficit >= 0 ? "text-green" : "text-red"
            }`}
          >
            {summary.avgDeficit >= 0 ? "+" : ""}
            {fmtNum(summary.avgDeficit)}
            <span className="ssc-unit"> kcal</span>
          </div>
          <div className="ssc-sub">Positive = under target</div>
        </div>

        <div className="stats-summary-card">
          <div className="ssc-label">Estimated change</div>
          <div
            className={`ssc-value ${
              summary.estTotalDeltaKg <= 0 ? "text-green" : "text-red"
            }`}
          >
            {summary.estTotalDeltaKg >= 0 ? "+" : ""}
            {summary.estTotalDeltaKg.toFixed(1)}
            <span className="ssc-unit"> kg</span>
          </div>
          <div className="ssc-sub">Rough total over all logged days</div>
        </div>
      </section>

      {/* Main layout: left = decomposition, right = matrix */}
      <section className="stats-main-layout">
        <div className="stats-left">
          <TDEEDecomposition />
        </div>
        <div className="stats-right">
          <DailyStatsMatrix />
        </div>
      </section>
    </div>
  );
}