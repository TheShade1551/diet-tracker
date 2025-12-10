// src/components/stats/TDEEDecomposition.jsx
import React, { useMemo, useState } from "react";
import { useAppState } from "../../context/AppStateContext";
import { dateToKey } from "../../utils/calculations";
import { TrendingUp } from "lucide-react"; // Not used but if needed for icon
import "../../styles/stats/TDEEDecomposition.css";

// Simple helpers (copied from Stats.jsx)
function isoDaysRange(endIso, count) {
  const end = new Date(endIso);
  const arr = [];
  for (let i = count - 1; i >= 0; --i) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    arr.push(d.toISOString().slice(0, 10));
  }
  return arr;
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

const STACK_COLORS = {
  bmr: "#f97316", // orange
  neat: "#60a5fa", // blue
  eat: "#34d399", // green
  tef: "#a78bfa", // purple
};

export default function TDEEDecomposition() {
  const { state, getDayDerived } = useAppState();
  const { profile, dayLogs } = state;

  const defaultAF = profile?.defaultActivityFactor ?? 1.2;

  const [showDecomposition, setShowDecomposition] = useState(true);
  const [decompositionDays, setDecompositionDays] = useState(14);

  // Latest logged date key across all day logs
  const latestLoggedDateKey = useMemo(() => {
    const keys = Object.keys(dayLogs || {});
    if (!keys.length) return null;

    const normalized = keys
      .map((k) => dateToKey(k))
      .filter(Boolean)
      .sort((a, b) => new Date(a) - new Date(b)); // oldest -> newest

    if (!normalized.length) return null;
    return normalized[normalized.length - 1]; // newest
  }, [dayLogs]);

  // Base date for decomposition window
  const baseDecompositionDate =
    latestLoggedDateKey ||
    state.selectedDate ||
    new Date().toISOString().slice(0, 10);

  const decompositionDateKeys = useMemo(
    () => isoDaysRange(baseDecompositionDate, decompositionDays),
    [baseDecompositionDate, decompositionDays]
  );

  const decompositionRows = useMemo(() => {
    return decompositionDateKeys.map((dk) => {
      const derived = getDayDerived(state, dk) || {};
      const breakdown = derived.tdeeBreakdown || {};

      const bmr = safeNum(
        breakdown.bmr ||
          breakdown.bmrSnapshot ||
          state.dayLogs?.[dk]?.bmrSnapshot ||
          profile?.bmr ||
          0
      );

      const af = safeNum(
        breakdown.afComputed ??
          state.dayLogs?.[dk]?.activityFactor ??
          profile?.defaultActivityFactor ??
          1.2
      );

      const neat = safeNum(breakdown.neat ?? 0);

      let eatNet = 0;
      if (breakdown.eat) {
        if (typeof breakdown.eat === "number") eatNet = breakdown.eat;
        else if (typeof breakdown.eat.totalNet !== "undefined")
          eatNet = breakdown.eat.totalNet;
        else if (typeof breakdown.eat.total !== "undefined")
          eatNet = breakdown.eat.total;
      }

      const maintenance = safeNum(
        breakdown.maintenancePlusActivity ?? Math.round(bmr * af)
      );
      const tef = safeNum(
        breakdown.tef ??
          Math.round((derived.totalIntake || 0) * 0.1 /* 10% TEF */)
      );
      const tdee = safeNum(breakdown.tdee ?? maintenance + tef);
      const intake = safeNum(derived.totalIntake ?? 0);

      return {
        dateKey: dk,
        bmr,
        af,
        neat,
        eatNet,
        maintenance,
        tef,
        tdee,
        intake,
      };
    });
  }, [state, decompositionDateKeys, getDayDerived, profile]);

  // Display rows: reverse to show most recent at top (newest first)
  const displayDecompositionRows = useMemo(
    () => [...decompositionRows].reverse(),
    [decompositionRows]
  );

  // AF polyline points for mini line chart (left: oldest, right: newest)
  const afPoints = useMemo(() => {
    const minAF = 0.8;
    const maxAF = 2.0;
    const w = 100;
    const h = 60;
    const n = decompositionRows.length;
    if (n === 0) {
      const baselineNormalized = (defaultAF - minAF) / (maxAF - minAF);
      const baselineY = h - baselineNormalized * h;
      return { points: "", w, h, baselineY };
    }

    const dx = w / Math.max(1, n - 1);
    const pts = decompositionRows
      .map((r, i) => {
        const x = i * dx;
        const clamped = Math.max(minAF, Math.min(maxAF, r.af));
        const y = h - ((clamped - minAF) / (maxAF - minAF)) * h;
        return `${x},${y}`;
      })
      .join(" ");

    const baselineNormalized = (defaultAF - minAF) / (maxAF - minAF);
    const baselineY = h - baselineNormalized * h;

    return { points: pts, w, h, baselineY };
  }, [decompositionRows, defaultAF]);

  const latestAF =
    decompositionRows.length > 0
      ? decompositionRows[decompositionRows.length - 1].af
      : null;

  return (
    <div className="stats-card stats-card-decomposition">
      <div className="stats-card-header">
        <div>
          <div className="stats-card-title">TDEE decomposition</div>
          <div className="stats-card-sub">
            How BMR, NEAT, EAT and TEF add up for recent days.
          </div>
        </div>
        <div className="stats-card-controls">
          <select
            className="stats-decomposition-select"
            value={decompositionDays}
            onChange={(e) => setDecompositionDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            type="button"
            className="stats-toggle-btn"
            onClick={() => setShowDecomposition((s) => !s)}
          >
            {showDecomposition ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {showDecomposition && (
        <>
          {/* AF Trend mini chart */}
          <div className="stats-af-card">
            <div className="stats-af-header">
              <div className="stats-af-title">
                Activity factor trend
              </div>
              <div className="stats-af-meta">
                <span>
                  Baseline AF {defaultAF.toFixed(2)}
                </span>
                <span className="stats-af-dot">•</span>
                <span>
                  Latest AF {latestAF != null ? latestAF.toFixed(2) : "-"}
                </span>
              </div>
            </div>
            <div className="stats-af-body">
              <div className="stats-af-scale">
                <span>2.0</span>
                <span>1.4</span>
                <span>0.8</span>
              </div>
              <div className="stats-af-chart">
                <svg
                  viewBox={`0 0 ${afPoints.w} ${afPoints.h}`}
                  className="stats-af-svg"
                >
                  {/* baseline */}
                  <line
                    x1="0"
                    x2={afPoints.w}
                    y1={afPoints.baselineY}
                    y2={afPoints.baselineY}
                    className="stats-af-baseline"
                  />
                  {/* AF line */}
                  {afPoints.points && (
                    <polyline
                      points={afPoints.points}
                      className="stats-af-poly"
                      fill="none"
                    />
                  )}
                </svg>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="stats-stack-legend">
            <div className="legend-item">
              <span
                className="legend-swatch"
                style={{ backgroundColor: STACK_COLORS.bmr }}
              />
              <span>BMR</span>
            </div>
            <div className="legend-item">
              <span
                className="legend-swatch"
                style={{ backgroundColor: STACK_COLORS.neat }}
              />
              <span>NEAT</span>
            </div>
            <div className="legend-item">
              <span
                className="legend-swatch"
                style={{ backgroundColor: STACK_COLORS.eat }}
              />
              <span>EAT</span>
            </div>
            <div className="legend-item">
              <span
                className="legend-swatch"
                style={{ backgroundColor: STACK_COLORS.tef }}
              />
              <span>TEF</span>
            </div>
          </div>

          {/* Stacked bars: most recent at top */}
          <div className="stats-bars-grid">
            {displayDecompositionRows.map((r) => {
              const total = Math.max(
                1,
                r.bmr + r.neat + r.eatNet + r.tef
              );
              const pctBmr = (r.bmr / total) * 100;
              const pctNeat = (r.neat / total) * 100;
              const pctEAT = (r.eatNet / total) * 100;
              const pctTef = (r.tef / total) * 100;

              const dateObj = new Date(r.dateKey);
              const dayLabel = dateObj.toLocaleDateString(undefined, {
                weekday: "short",
              });
              const dateLabel = dateObj.toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
              });

              return (
                <div key={r.dateKey} className="stats-bar-row">
                  <div className="stats-bar-label">
                    <div className="sbl-day">{dayLabel}</div>
                    <div className="sbl-date">{dateLabel}</div>
                  </div>
                  <div className="stats-bar-track">
                    <div
                      className="stats-bar-segment"
                      style={{
                        width: `${pctBmr}%`,
                        backgroundColor: STACK_COLORS.bmr,
                      }}
                    />
                    <div
                      className="stats-bar-segment"
                      style={{
                        width: `${pctNeat}%`,
                        backgroundColor: STACK_COLORS.neat,
                      }}
                    />
                    <div
                      className="stats-bar-segment"
                      style={{
                        width: `${pctEAT}%`,
                        backgroundColor: STACK_COLORS.eat,
                      }}
                    />
                    <div
                      className="stats-bar-segment"
                      style={{
                        width: `${pctTef}%`,
                        backgroundColor: STACK_COLORS.tef,
                      }}
                    />
                  </div>
                  <div className="stats-bar-meta">
                    <span>{r.tdee ? `${r.tdee} kcal` : "-"}</span>
                    <span>AF {r.af.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed table: most recent at top */}
          {decompositionRows.length > 0 && (
            <details className="stats-breakdown-details">
              <summary>View detailed daily breakdown</summary>
              <div className="stats-breakdown-table-wrapper">
                <table className="stats-breakdown-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>BMR</th>
                      <th>NEAT</th>
                      <th>EAT</th>
                      <th>TEF</th>
                      <th>TDEE</th>
                      <th>AF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayDecompositionRows.map((r) => (
                      <tr key={r.dateKey}>
                        <td>{r.dateKey}</td>
                        <td>{Math.round(r.bmr)}</td>
                        <td>{Math.round(r.neat)}</td>
                        <td>{Math.round(r.eatNet)}</td>
                        <td>{Math.round(r.tef)}</td>
                        <td>{Math.round(r.tdee)}</td>
                        <td>{r.af.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}

      {!showDecomposition && (
        <p className="stats-muted">
          Decomposition hidden. Toggle “Show” to see AF trend and breakdown by
          BMR / NEAT / EAT / TEF.
        </p>
      )}
    </div>
  );
}