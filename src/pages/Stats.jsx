// src/pages/Stats.jsx
import React, { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../context/AppStateContext";
import {
  X,
  Calendar as CalendarIcon,
  ArrowRight,
  Download,
} from "lucide-react";

import "../styles/Stats.css";

import {
  dateToKey,
  fmtNum,
  computeDayMealTotals,
  computeTDEEForDay,
  calculateEffectiveWorkout,
  safeGet,
} from "../utils/calculations";

export default function Stats() {
  const { state } = useAppState();
  const navigate = useNavigate();

  const profile = state?.profile ?? {};
  const dateInputRef = useRef(null);

  // --- Local UI state ---
  const [pickedDate, setPickedDate] = useState("");
  const [pageSize, setPageSize] = useState(7); // columns at a time
  const [page, setPage] = useState(0);

  // --- Source data (backwards compatible with older keys) ---
  const rawDays =
    state?.days ??
    state?.dayLogs ??
    state?.dayLogEntries ??
    state?.entries ??
    state?.logs ??
    [];

  // --- Build per-day stats rows (used as columns in matrix) ---
  const rows = useMemo(() => {
    const arr = Array.isArray(rawDays)
      ? [...rawDays]
      : Object.values(rawDays || {});

    const mapped = arr.map((d, idx) => {
      const rawDate =
        d.date ??
        d.day ??
        d.dateString ??
        d.isoDate ??
        d.loggedAt ??
        d.key ??
        "";

      const dateKey = dateToKey(rawDate);

      const { lunch, dinner, extras, total } = computeDayMealTotals(d);

      const baseTdee = computeTDEEForDay(d, profile);
      const effectiveWorkout = calculateEffectiveWorkout(d);
      const dailyTarget = baseTdee + effectiveWorkout;

      const activityFactor =
        safeGet(d, "activityFactor") ??
        profile?.defaultActivityFactor ??
        "-";

      const workoutKcal = d.workoutCalories ?? d.workoutKcal ?? 0;
      const intensityFactorDisplay =
        workoutKcal > 0 && d.intensityFactor
          ? Number(d.intensityFactor).toFixed(2)
          : "-";

      const deficit = dailyTarget - total;
      const gainLossKg = -(deficit / 7700);

      const getMealText = (type) => {
        if (!d.meals) return "";
        return d.meals
          .filter((m) => (m.mealType || "").toLowerCase() === type)
          .map((m) => `${m.foodNameSnapshot} (${m.totalKcal})`)
          .join(", ");
      };

      return {
        id: d.id ?? d.key ?? idx,
        date: dateKey,
        // nutrition
        tdee: dailyTarget,
        total,
        deficit,
        gainLossKg,
        // activity
        activityFactor,
        intensityFactor: intensityFactorDisplay,
        workoutKcal,
        effectiveWorkout,
        // meals
        lunch,
        dinner,
        extras,
        // CSV helper text
        lunchText: d.meals ? getMealText("lunch") : "",
        dinnerText: d.meals ? getMealText("dinner") : "",
        extrasText: d.meals
          ? getMealText("extra") || getMealText("extras")
          : "",
      };
    });

    mapped.sort((a, b) => {
      if (a.date && b.date) {
        const ad = new Date(a.date).getTime();
        const bd = new Date(b.date).getTime();
        if (!Number.isNaN(ad) && !Number.isNaN(bd)) return bd - ad;
      }
      return 0;
    });

    if (pickedDate) {
      return mapped.filter((r) => r.date === pickedDate);
    }
    return mapped;
  }, [rawDays, profile, pickedDate]);

  // --- Pagination (per columns) ---
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice(page * pageSize, (page + 1) * pageSize);

  const hasData = visible.length > 0;

  // --- ADDED: Height synchronization effect ---
  useEffect(() => {
    // This ensures the grid rows stay synchronized
    const syncHeights = () => {
      // The CSS grid should handle this, but this is a backup
      requestAnimationFrame(() => {
        // Force reflow to ensure CSS grid calculates correctly
        const matrix = document.querySelector('.stats-matrix');
        if (matrix) {
          matrix.style.display = 'none';
          matrix.offsetHeight; // Trigger reflow
          matrix.style.display = 'grid';
        }
      });
    };

    syncHeights();
    window.addEventListener('resize', syncHeights);
    
    return () => window.removeEventListener('resize', syncHeights);
  }, [visible, matrixRows]); // Re-run when data changes

  // --- Navigation / actions ---

  const handleOpenDayLog = () => {
    if (pickedDate) navigate(`/day-log?date=${pickedDate}`);
  };

  const clearFilter = () => {
    setPickedDate("");
    setPage(0);
  };

  const handleDateWrapperClick = () => {
    if (dateInputRef.current?.showPicker) {
      dateInputRef.current.showPicker();
    } else if (dateInputRef.current) {
      dateInputRef.current.focus();
    }
  };

  const handleColumnClick = (date) => {
    if (date) navigate(`/day-log?date=${date}`);
  };

  // --- Export helpers (still classic "rows" CSV/JSON) ---

  function downloadCSV() {
    if (!rows.length) return;

    const headers = [
      "Date",
      "Target",
      "AF",
      "IF",
      "Workout",
      "Lunch_kcal",
      "Dinner_kcal",
      "Extras_kcal",
      "Total_kcal",
      "Deficit",
      "EstWeightChangeKg",
      "Lunch_Items",
      "Dinner_Items",
      "Extras_Items",
    ];

    const csvRows = [headers.join(",")];

    rows.forEach((r) => {
      const row = [
        `"${String(r.date || "")}"`,
        r.tdee,
        r.activityFactor,
        r.intensityFactor,
        r.effectiveWorkout,
        r.lunch,
        r.dinner,
        r.extras,
        r.total,
        r.deficit,
        r.gainLossKg.toFixed(4),
        `"${(r.lunchText || "").replace(/"/g, '""')}"`,
        `"${(r.dinnerText || "").replace(/"/g, '""')}"`,
        `"${(r.extrasText || "").replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diet-stats-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diet-stats-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Summary metrics for current filter (all rows, not just page) ---

  const allTime = useMemo(() => {
    const totalDays = rows.length;
    const totalDeficit = rows.reduce(
      (s, r) => s + (r.deficit || 0),
      0
    );
    const totalGainKg = rows.reduce(
      (s, r) => s + (r.gainLossKg || 0),
      0
    );
    const totalCaloriesConsumed = rows.reduce(
      (s, r) => s + (r.total || 0),
      0
    );
    return {
      totalDays,
      totalDeficit,
      totalGainKg,
      totalCaloriesConsumed,
    };
  }, [rows]);

  const estKgChange = allTime.totalGainKg;
  const estKgClass =
    estKgChange < 0 ? "stats-chip-loss" : estKgChange > 0 ? "stats-chip-gain" : "";

  // --- Matrix row metadata (left panel + right rows share this) ---

  const matrixRows = [
    { type: "header", key: "header" },

    { type: "group", key: "g-nutrition", label: "Nutrition" },
    { type: "metric", key: "target", label: "Target", field: "tdee", unit: "kcal" },
    { type: "metric", key: "total", label: "Total", field: "total", unit: "kcal" },
    {
      type: "metric",
      key: "deficit",
      label: "Deficit",
      field: "deficit",
      unit: "kcal",
      color: (v) => (v >= 0 ? "text-green" : "text-red"),
      prefix: (v) => (v > 0 ? "+" : ""),
    },
    {
      type: "metric",
      key: "est",
      label: "Est.",
      field: "gainLossKg",
      unit: "kg",
      decimals: 3,
      color: (v) =>
        v < 0 ? "stats-chip-loss" : v > 0 ? "stats-chip-gain" : "",
      prefix: (v) => (v > 0 ? "+" : ""),
    },

    { type: "group", key: "g-activity", label: "Activity" },
    { type: "metric", key: "af", label: "AF", field: "activityFactor" },
    { type: "metric", key: "if", label: "IF", field: "intensityFactor" },
    {
      type: "metric",
      key: "workout",
      label: "Workout",
      field: "effectiveWorkout",
      unit: "kcal",
    },

    { type: "group", key: "g-meals", label: "Meals" },
    {
      type: "metric",
      key: "lunch",
      label: "Lunch",
      field: "lunch",
      unit: "kcal",
      titleField: "lunchText",
    },
    {
      type: "metric",
      key: "dinner",
      label: "Dinner",
      field: "dinner",
      unit: "kcal",
      titleField: "dinnerText",
    },
    {
      type: "metric",
      key: "extras",
      label: "Extras",
      field: "extras",
      unit: "kcal",
      titleField: "extrasText",
    },
  ];

  const formatCell = (rowMeta, day) => {
    if (!day) return "";
    const { field, unit, decimals, prefix, color, titleField } = rowMeta;
    if (!field) return "";

    let raw = day[field];
    if (raw === null || raw === undefined || raw === "") return "-";

    let num = Number(raw);
    if (!Number.isFinite(num)) return raw;

    const absPrefix = prefix ? prefix(num) : "";
    const valueText =
      decimals != null ? num.toFixed(decimals) : fmtNum(num);
    const unitText = unit ? ` ${unit}` : "";

    return {
      text: `${absPrefix}${valueText}${unitText}`,
      className: color ? color(num) : "",
      title: titleField ? day[titleField] || "" : "",
    };
  };

  // --- Render ---

  return (
    <div className="page stats-page">
      {/* Header */}
      <header className="stats-header">
        <div>
          <h1 className="stats-title">Daily Stats</h1>
          <p className="stats-subtitle">
            Inspect your daily targets, intake, activity, and meal splits across time.
          </p>
        </div>
        <div className="stats-header-pill">
          <span>History</span>
          <span>{rows.length} days</span>
        </div>
      </header>

      {/* Summary strip */}
      <section className="card stats-summary-card">
        <div className="stats-summary-grid">
          <div className="stats-summary-item">
            <div className="stats-summary-label">Entries</div>
            <div className="stats-summary-value">
              {allTime.totalDays || 0}
            </div>
            <div className="stats-summary-sub">Logged days</div>
          </div>

          <div className="stats-summary-item">
            <div className="stats-summary-label">Net Deficit</div>
            <div className="stats-summary-value">
              {fmtNum(allTime.totalDeficit)} kcal
            </div>
            <div className="stats-summary-sub">
              Target minus intake across all filtered days.
            </div>
          </div>

          <div className="stats-summary-item">
            <div className="stats-summary-label">Est. Weight Change</div>
            <div className={`stats-summary-value ${estKgClass}`}>
              {estKgChange > 0 ? "+" : ""}
              {estKgChange.toFixed(3)} kg
            </div>
            <div className="stats-summary-sub">
              Based on ~7700 kcal per kg.
            </div>
          </div>

          <div className="stats-summary-item">
            <div className="stats-summary-label">Total Intake</div>
            <div className="stats-summary-value">
              {fmtNum(allTime.totalCaloriesConsumed)} kcal
            </div>
            <div className="stats-summary-sub">
              Sum of all logged daily calories.
            </div>
          </div>
        </div>
      </section>

      {/* Matrix / table card */}
      <section className="card stats-table-card">
        {/* Controls */}
        <div className="stats-controls">
          <div className="stats-controls-left">
            <div
              className="custom-date-picker"
              onClick={handleDateWrapperClick}
            >
              <CalendarIcon
                size={16}
                className="calendar-icon-overlay"
              />
              <input
                ref={dateInputRef}
                type="date"
                value={pickedDate}
                onChange={(e) => {
                  setPickedDate(e.target.value);
                  setPage(0);
                }}
                className="input-date-hidden-ui"
              />
            </div>

            {pickedDate && (
              <>
                <button
                  type="button"
                  className="btn-ghost stats-small-btn"
                  onClick={handleOpenDayLog}
                >
                  Open Day Log
                  <ArrowRight size={14} />
                </button>

                <button
                  type="button"
                  className="btn-ghost stats-small-btn"
                  onClick={clearFilter}
                >
                  <X size={14} />
                  Clear
                </button>
              </>
            )}
          </div>

          <div className="stats-controls-right">
            <div className="rows-label">
              Columns:
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={7}>7</option>
                <option value={10}>10</option>
              </select>
            </div>

            <button
              type="button"
              className="btn-ghost stats-export-btn"
              onClick={downloadCSV}
              disabled={!rows.length}
            >
              <Download size={14} />
              CSV
            </button>

            <button
              type="button"
              className="btn-ghost stats-export-btn"
              onClick={downloadJSON}
              disabled={!rows.length}
            >
              JSON
            </button>
          </div>
        </div>

        {/* MATRIX: left frozen panel + right scrollable */}
        {!hasData ? (
          <div className="stats-empty-matrix">
            {pickedDate
              ? `No entry found for ${pickedDate}. Use Day Log to create or edit that day.`
              : "No history yet. Log a few days to see stats here."}
          </div>
        ) : (
          // CHANGED: Added key prop for proper re-renders
          <div key={`matrix-${visible.length}-${page}`} className="stats-matrix">
            {/* Left frozen column */}
            <div className="stats-matrix-left">
              {matrixRows.map((r) => {
                if (r.type === "header") {
                  return (
                    <div
                      key={r.key}
                      className="stats-left-cell stats-left-header"
                    >
                      Metric
                    </div>
                  );
                }
                if (r.type === "group") {
                  return (
                    <div
                      key={r.key}
                      className="stats-left-cell stats-left-group"
                    >
                      {r.label}
                    </div>
                  );
                }
                return (
                  <div
                    key={r.key}
                    className="stats-left-cell stats-left-label"
                  >
                    {r.label}
                  </div>
                );
              })}
            </div>

            {/* Right scrollable panel */}
            <div className="stats-matrix-right">
              <div className="stats-matrix-scroll">
                <div className="stats-matrix-inner">
                  {matrixRows.map((r) => {
                    if (r.type === "header") {
                      return (
                        <div
                          key={r.key}
                          className="stats-row stats-row-header"
                        >
                          {visible.map((day) => (
                            <button
                              key={day.id}
                              type="button"
                              className="stats-cell stats-cell-date"
                              onClick={() => handleColumnClick(day.date)}
                            >
                              {String(day.date || "").slice(5)}
                            </button>
                          ))}
                        </div>
                      );
                    }

                    if (r.type === "group") {
                      return (
                        <div
                          key={r.key}
                          className="stats-row stats-row-group"
                        >
                          {visible.map((day) => (
                            <div
                              key={day.id}
                              className="stats-cell stats-cell-group"
                            />
                          ))}
                        </div>
                      );
                    }

                    // metric row
                    return (
                      <div key={r.key} className="stats-row stats-row-metric">
                        {visible.map((day) => {
                          const cell = formatCell(r, day);
                          if (!cell || !cell.text) {
                            return (
                              <div
                                key={day.id}
                                className="stats-cell stats-cell-empty"
                              >
                                -
                              </div>
                            );
                          }
                          return (
                            <div
                              key={day.id}
                              className={`stats-cell stats-cell-value ${
                                cell.className || ""
                              }`}
                              title={cell.title || ""}
                            >
                              {cell.text}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pagination footer */}
        {rows.length > pageSize && (
          <div className="pagination stats-pagination">
            <div>
              Page {page + 1} / {pageCount} • {rows.length} days
            </div>
            <div className="pagination-buttons">
              <button
                type="button"
                className="btn-ghost stats-small-btn"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Prev
              </button>
              <button
                type="button"
                className="btn-ghost stats-small-btn"
                onClick={() =>
                  setPage((p) => Math.min(pageCount - 1, p + 1))
                }
                disabled={page >= pageCount - 1}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}