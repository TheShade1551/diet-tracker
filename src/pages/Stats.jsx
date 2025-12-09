// src/pages/Stats.jsx
import React, { useMemo, useState } from "react";
import { useAppState } from "../context/AppStateContext";
import {
  dateToKey,
  fmtNum,
  computeDayMealTotals,
  formatIF,
} from "../utils/calculations";
import {
  Calendar as CalendarIcon,
  Download,
  TrendingUp,
  Activity,
} from "lucide-react";
import "../styles/Stats.css";

const formatHeaderDate = (iso) => {
  if (!iso) return { weekday: "", label: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { weekday: "", label: iso };
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
    label: d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  };
};

// Helper to generate date range ending at `endIso`
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

// Colors for stacked bars (used inline)
const STACK_COLORS = {
  bmr: "#f97316", // orange
  neat: "#60a5fa", // blue
  eat: "#34d399", // green
  tef: "#a78bfa", // purple
};

export default function Stats() {
  const { state, getDayDerived } = useAppState();
  const { profile, dayLogs } = state;

  const [pickedDate, setPickedDate] = useState("");
  const [pageSize, setPageSize] = useState(7);
  const [page, setPage] = useState(0);

  // TDEE decomposition controls
  const [showDecomposition, setShowDecomposition] = useState(true);
  const [decompositionDays, setDecompositionDays] = useState(14);

  // Sorting state for matrix table
  const [sortState, setSortState] = useState({
    metricKey: null,
    direction: null,
  });

  // --- Metric groups for the matrix table ---
  const groups = [
    {
      id: "nutrition",
      label: "Nutrition",
      colorClass: "cat-nutrition",
      rows: [
        { key: "target", label: "Target (TDEE)", field: "tdee", unit: "kcal" },
        {
          key: "total",
          label: "Total intake",
          field: "total",
          unit: "kcal",
        },
        {
          key: "deficit",
          label: "Deficit",
          field: "deficit",
          unit: "kcal",
          prefix: (v) => (v > 0 ? "+" : ""),
          color: (v) => (v >= 0 ? "text-green" : "text-red"),
        },
        {
          key: "estDelta",
          label: "Est. Δ weight",
          field: "estDeltaKg",
          unit: "kg",
          formatter: (v) =>
            v === null || v === undefined ? "-" : v.toFixed(2),
          prefix: (v) => (v > 0 ? "+" : ""),
          color: (v) => (v <= 0 ? "text-green" : "text-red"),
        },
      ],
    },
    {
      id: "activity",
      label: "Activity",
      colorClass: "cat-activity",
      rows: [
        {
          key: "activityFactor",
          label: "Activity factor",
          field: "activityFactor",
          formatter: (v) =>
            v === null || v === undefined ? "-" : v.toFixed(2),
        },
        {
          key: "workout",
          label: "Workout burn",
          field: "workoutCalories",
          unit: "kcal",
        },
        {
          key: "intensity",
          label: "Intensity factor",
          field: "intensityDisplay",
          formatter: (v) => v ?? "-",
        },
      ],
    },
    {
      id: "meals",
      label: "Meals",
      colorClass: "cat-meals",
      rows: [
        {
          key: "lunch",
          label: "Lunch",
          field: "lunch",
          unit: "kcal",
          tooltipField: "lunchText",
        },
        {
          key: "dinner",
          label: "Dinner",
          field: "dinner",
          unit: "kcal",
          tooltipField: "dinnerText",
        },
        {
          key: "extras",
          label: "Extras",
          field: "extras",
          unit: "kcal",
          tooltipField: "extrasText",
        },
      ],
    },
  ];

  const allMetricRows = useMemo(
    () =>
      groups.flatMap((g) =>
        g.rows.map((r) => ({
          ...r,
          groupId: g.id,
        }))
      ),
    [groups]
  );

  // ---------- Build per-day stats (for matrix table) ----------
  const allDays = useMemo(() => {
    const entries = Object.values(dayLogs || {});
    const mapped = entries
      .map((day) => {
        const date = dateToKey(day.date || day.dateKey);
        if (!date) return null;

        const { tdee, totalIntake } = getDayDerived(state, date);
        const totals = computeDayMealTotals(day);

        const deficit = tdee - totalIntake;
        // Negative = weight loss (matches your old logic)
        const estDeltaKg = -(deficit / 7700);

        const activityFactor =
          day.activityFactor ?? profile.defaultActivityFactor ?? 1.2;
        const workoutCalories = Number(
          day.workoutCalories ?? day.workoutKcal ?? 0
        );
        const intensityFactor =
          day.intensityFactor === undefined ? null : day.intensityFactor;
        const intensityDisplay = formatIF(intensityFactor);

        const meals = day.meals || [];
        const mealText = (type) =>
          meals
            .filter((m) => (m.mealType || "").toLowerCase() === type)
            .map((m) => `${m.foodNameSnapshot} (${m.totalKcal} kcal)`)
            .join(", ");

        return {
          date,
          tdee,
          total: totalIntake,
          deficit,
          estDeltaKg,
          activityFactor,
          workoutCalories,
          intensityFactor,
          intensityDisplay,
          lunch: totals.lunch,
          dinner: totals.dinner,
          extras: totals.extras,
          lunchText: mealText("lunch"),
          dinnerText: mealText("dinner"),
          extrasText: mealText("extra"),
        };
      })
      .filter(Boolean);

    mapped.sort((a, b) => new Date(b.date) - new Date(a.date));
    return mapped;
  }, [dayLogs, state, profile, getDayDerived]);

  // ---------- TDEE Decomposition Data ----------
  const selectedDate =
    state.selectedDate || new Date().toISOString().slice(0, 10);

  const decompositionDateKeys = useMemo(
    () => isoDaysRange(selectedDate, decompositionDays),
    [selectedDate, decompositionDays]
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

  // AF polyline points for mini-line chart
  const afPoints = useMemo(() => {
    const minAF = 0.8;
    const maxAF = 2.0;
    const w = 100;
    const h = 60;
    const n = decompositionRows.length;
    if (n === 0) return { points: "", w, h };

    const dx = w / Math.max(1, n - 1);
    const pts = decompositionRows
      .map((r, i) => {
        const x = i * dx;
        const clamped = Math.max(minAF, Math.min(maxAF, r.af));
        const y = h - ((clamped - minAF) / (maxAF - minAF)) * h;
        return `${x},${y}`;
      })
      .join(" ");

    return { points: pts, w, h };
  }, [decompositionRows]);

  // ---------- Filter + sorting + pagination for matrix ----------
  const filteredDays = useMemo(() => {
    if (!pickedDate) return allDays;
    return allDays.filter((d) => d.date === pickedDate);
  }, [allDays, pickedDate]);

  const sortedDays = useMemo(() => {
    const { metricKey, direction } = sortState;
    if (!metricKey || !direction) return filteredDays;

    const rowCfg = allMetricRows.find((r) => r.key === metricKey);
    if (!rowCfg) return filteredDays;

    const field = rowCfg.field;
    const sorted = [...filteredDays];

    sorted.sort((a, b) => {
      const av = a[field];
      const bv = b[field];

      const aNum =
        av === null || av === undefined || av === "" ? NaN : Number(av);
      const bNum =
        bv === null || bv === undefined || bv === "" ? NaN : Number(bv);

      let cmp;
      if (!Number.isNaN(aNum) || !Number.isNaN(bNum)) {
        cmp = (aNum || 0) - (bNum || 0);
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      }

      if (direction === "desc") cmp = -cmp;
      return cmp;
    });

    return sorted;
  }, [filteredDays, sortState, allMetricRows]);

  const totalColumns = sortedDays.length || 0;
  const totalPages = totalColumns ? Math.ceil(totalColumns / pageSize) : 1;
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const startIdx = safePage * pageSize;
  const endIdx = startIdx + pageSize;

  const pageDays = sortedDays.slice(startIdx, endIdx);
  const mobileDays = sortedDays;
  const hasData = !!sortedDays.length;

  // ---------- Summary metrics ----------
  const summary = useMemo(() => {
    if (!allDays.length) {
      return {
        daysLogged: 0,
        avgIntake: 0,
        avgDeficit: 0,
        estTotalDeltaKg: 0,
        workoutDays: 0,
      };
    }

    const daysLogged = allDays.length;
    const totalIntake = allDays.reduce(
      (acc, d) => acc + (d.total || 0),
      0
    );
    const totalDeficit = allDays.reduce(
      (acc, d) => acc + (d.deficit || 0),
      0
    );
    const estTotalDeltaKg = allDays.reduce(
      (acc, d) => acc + (d.estDeltaKg || 0),
      0
    );
    const workoutDays = allDays.filter((d) => d.workoutCalories > 0).length;

    return {
      daysLogged,
      avgIntake: totalIntake / daysLogged,
      avgDeficit: totalDeficit / daysLogged,
      estTotalDeltaKg,
      workoutDays,
    };
  }, [allDays]);

  // ---------- Helpers / Handlers ----------
  const formatCellValue = (rowConfig, rawValue) => {
    if (rawValue === null || rawValue === undefined || rawValue === "") {
      return "-";
    }
    const v = Number.isFinite(rawValue) ? rawValue : rawValue;
    const formatted = rowConfig.formatter
      ? rowConfig.formatter(v)
      : fmtNum(v);
    const prefix = rowConfig.prefix ? rowConfig.prefix(v) : "";
    const unit = rowConfig.unit ? ` ${rowConfig.unit}` : "";
    return `${prefix}${formatted}${unit}`;
  };

  const handleClearDate = () => {
    setPickedDate("");
    setPage(0);
  };

  const handleMetricSortToggle = (rowKey) => {
    setPage(0);
    setSortState((prev) => {
      if (prev.metricKey === rowKey) {
        if (prev.direction === "desc") {
          return { metricKey: rowKey, direction: "asc" };
        }
        if (prev.direction === "asc") {
          return { metricKey: null, direction: null };
        }
        return { metricKey: rowKey, direction: "desc" };
      }
      return { metricKey: rowKey, direction: "desc" };
    });
  };

  const handleExport = () => {
    if (!pageDays.length) return;

    const headers = ["Metric / Date", ...pageDays.map((d) => d.date)];
    const rowsCsv = [];

    groups.forEach((group) => {
      group.rows.forEach((row) => {
        const label = `${group.label} – ${row.label}`;
        const values = pageDays.map((day) => {
          const value = day[row.field];
          return formatCellValue(row, value);
        });
        rowsCsv.push([label, ...values].join(","));
      });
    });

    const csv = [headers.join(","), ...rowsCsv].join("\n");
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diet-tracker-stats.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const latestAF =
    decompositionRows.length > 0
      ? decompositionRows[decompositionRows.length - 1].af
      : null;

  // ---------- Render ----------
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

      {/* Summary metrics */}
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

        <div className="stats-summary-card">
          <div className="ssc-label">Workout days</div>
          <div className="ssc-value">{summary.workoutDays}</div>
          <div className="ssc-sub">Days with any workout burn</div>
        </div>
      </section>

      <section className="stats-main-layout">
        {/* Left column: TDEE decomposition */}
        <div className="stats-left">
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
                  onChange={(e) =>
                    setDecompositionDays(Number(e.target.value))
                  }
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
                        Baseline AF{" "}
                        {(profile?.defaultActivityFactor ?? 1.2).toFixed(2)}
                      </span>
                      <span className="stats-af-dot">•</span>
                      <span>
                        Latest AF{" "}
                        {latestAF != null ? latestAF.toFixed(2) : "-"}
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
                          y1={(afPoints.h * 0.4)}
                          y2={(afPoints.h * 0.4)}
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

                {/* Stacked bars */}
                <div className="stats-bars-grid">
                  {decompositionRows.map((r) => {
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

                {/* Detailed table */}
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
                          {decompositionRows.map((r) => (
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
                Decomposition hidden. Toggle “Show” to see AF trend and
                breakdown by BMR / NEAT / EAT / TEF.
              </p>
            )}
          </div>
        </div>

        {/* Right column: Matrix table */}
        <div className="stats-right">
          <div className="stats-card stats-card-matrix">
            <div className="stats-card-header">
              <div>
                <div className="stats-card-title">Daily matrix</div>
                <div className="stats-card-sub">
                  Compare days across nutrition, activity and meals.
                </div>
              </div>
              <div className="stats-card-controls stats-card-controls--matrix">
                <div className="stats-control-group">
                  <span className="stats-control-label">Columns per view</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(0);
                    }}
                    className="stats-select"
                  >
                    <option value={5}>5</option>
                    <option value={7}>7</option>
                    <option value={10}>10</option>
                  </select>
                </div>

                <div className="stats-control-group stats-control-date">
                  <CalendarIcon size={14} className="stats-control-icon" />
                  <input
                    type="date"
                    value={pickedDate}
                    onChange={(e) => {
                      setPickedDate(e.target.value || "");
                      setPage(0);
                    }}
                  />
                  {pickedDate && (
                    <button
                      type="button"
                      className="stats-link-btn"
                      onClick={handleClearDate}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="stats-export-btn"
                  onClick={handleExport}
                >
                  <Download size={14} />
                  Export CSV
                </button>
              </div>
            </div>

            {!hasData ? (
              <div className="stats-empty">
                No stats yet. Log a few days of meals and workouts to see the
                matrix.
              </div>
            ) : (
              <>
                {/* Desktop: paginated view */}
                <div className="stats-matrix-desktop">
                  <div className="stats-table-wrapper">
                    <table className="stats-matrix-table">
                      <thead>
                        <tr>
                          <th className="sticky-col">Metric</th>
                          {pageDays.map((day) => {
                            const header = formatHeaderDate(day.date);
                            return (
                              <th key={day.date}>
                                <div className="stats-col-header">
                                  <span className="stats-col-weekday">
                                    {header.weekday}
                                  </span>
                                  <span className="stats-col-date">
                                    {header.label}
                                  </span>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((group) =>
                          group.rows.map((row, rowIndex) => {
                            const isActive =
                              sortState.metricKey === row.key;
                            const activeDir = sortState.direction;

                            return (
                              <tr key={`${group.id}-${row.key}`}>
                                {rowIndex === 0 && (
                                  <td
                                    className="sticky-col stats-metric-group"
                                    rowSpan={group.rows.length}
                                  >
                                    {group.label}
                                  </td>
                                )}
                                <td className="sticky-col stats-metric-name">
                                  <button
                                    type="button"
                                    className="stats-metric-sort-btn"
                                    onClick={() =>
                                      handleMetricSortToggle(row.key)
                                    }
                                  >
                                    {row.label}
                                    {isActive && activeDir && (
                                      <span className="stats-sort-indicator">
                                        {activeDir === "asc" ? "▲" : "▼"}
                                      </span>
                                    )}
                                  </button>
                                </td>
                                {pageDays.map((day) => {
                                  const rawValue = day[row.field];
                                  const value = formatCellValue(
                                    row,
                                    rawValue
                                  );
                                  const colorClass = row.color
                                    ? row.color(rawValue)
                                    : "";
                                  const tooltip =
                                    row.tooltipField &&
                                    day[row.tooltipField];

                                  return (
                                    <td
                                      key={day.date + row.key}
                                      className={`stats-metric-cell ${colorClass}`}
                                      title={tooltip || ""}
                                    >
                                      {value}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="stats-pagination">
                    {totalColumns === 0 ? (
                      <span>No days</span>
                    ) : (
                      <>
                        <span className="stats-pagination-summary">
                          Showing {startIdx + 1}–
                          {Math.min(endIdx, totalColumns)} of {totalColumns}{" "}
                          days
                        </span>
                        <div className="stats-pagination-controls">
                          <button
                            type="button"
                            onClick={() =>
                              setPage((p) => Math.max(0, p - 1))
                            }
                            disabled={safePage === 0}
                          >
                            ← Prev
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPage((p) =>
                                Math.min(totalPages - 1, p + 1)
                              )
                            }
                            disabled={safePage >= totalPages - 1}
                          >
                            Next →
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Mobile: horizontal scroll all days */}
                <div className="stats-matrix-mobile">
                  <div className="stats-table-wrapper">
                    <table className="stats-matrix-table">
                      <thead>
                        <tr>
                          <th className="sticky-col">Metric</th>
                          {mobileDays.map((day) => {
                            const header = formatHeaderDate(day.date);
                            return (
                              <th key={day.date}>
                                <div className="stats-col-header">
                                  <span className="stats-col-weekday">
                                    {header.weekday}
                                  </span>
                                  <span className="stats-col-date">
                                    {header.label}
                                  </span>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((group) =>
                          group.rows.map((row, rowIndex) => {
                            const isActive =
                              sortState.metricKey === row.key;
                            const activeDir = sortState.direction;

                            return (
                              <tr key={`${group.id}-${row.key}-mobile`}>
                                {rowIndex === 0 && (
                                  <td
                                    className="sticky-col stats-metric-group"
                                    rowSpan={group.rows.length}
                                  >
                                    {group.label}
                                  </td>
                                )}
                                <td className="sticky-col stats-metric-name">
                                  <button
                                    type="button"
                                    className="stats-metric-sort-btn"
                                    onClick={() =>
                                      handleMetricSortToggle(row.key)
                                    }
                                  >
                                    {row.label}
                                    {isActive && activeDir && (
                                      <span className="stats-sort-indicator">
                                        {activeDir === "asc" ? "▲" : "▼"}
                                      </span>
                                    )}
                                  </button>
                                </td>
                                {mobileDays.map((day) => {
                                  const rawValue = day[row.field];
                                  const value = formatCellValue(
                                    row,
                                    rawValue
                                  );
                                  const colorClass = row.color
                                    ? row.color(rawValue)
                                    : "";
                                  const tooltip =
                                    row.tooltipField &&
                                    day[row.tooltipField];

                                  return (
                                    <td
                                      key={day.date + row.key}
                                      className={`stats-metric-cell ${colorClass}`}
                                      title={tooltip || ""}
                                    >
                                      {value}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
