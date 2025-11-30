// src/pages/Stats.jsx
import React, { useMemo, useState } from "react";
import { useAppState } from "../context/AppStateContext";
import {
  dateToKey,
  fmtNum,
  computeDayMealTotals,
  computeTDEEForDay,
  calculateEffectiveWorkout,
  formatIF,
} from "../utils/calculations";
import { Calendar as CalendarIcon, Download } from "lucide-react";

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

export default function Stats() {
  const { state } = useAppState();
  const { profile, dayLogs } = state;

  const [pickedDate, setPickedDate] = useState("");
  const [pageSize, setPageSize] = useState(7);
  const [page, setPage] = useState(0);

  // ---------- Build per-day stats ----------
  const allDays = useMemo(() => {
    const entries = Object.values(dayLogs || {});

    const mapped = entries
      .map((day) => {
        const date = dateToKey(day.date || day.dateKey);
        if (!date) return null;

        const totals = computeDayMealTotals(day);
        const baseTdee = computeTDEEForDay(day, profile);
        const effectiveWorkout = calculateEffectiveWorkout(day);
        const tdee = baseTdee + effectiveWorkout;

        const deficit = tdee - totals.total; // +ve = under target
        const estDeltaKg = -(deficit / 7700); // rough rule of thumb

        const activityFactor =
          day.activityFactor ?? profile.defaultActivityFactor ?? 1.2;
        const workoutCalories =
          Number(day.workoutCalories ?? day.workoutKcal ?? 0);
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
          total: totals.total,
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

    // newest first – so latest date is closest to the frozen columns
    mapped.sort((a, b) => new Date(b.date) - new Date(a.date));
    return mapped;
  }, [dayLogs, profile]);

  // ---------- Filter + pagination ----------
  const filteredDays = useMemo(() => {
    if (!pickedDate) return allDays;
    return allDays.filter((d) => d.date === pickedDate);
  }, [allDays, pickedDate]);

  const totalColumns = filteredDays.length || 0;
  const totalPages = totalColumns ? Math.ceil(totalColumns / pageSize) : 1;
  const safePage = Math.min(page, Math.max(0, totalPages - 1));

  const startIdx = safePage * pageSize;
  const endIdx = startIdx + pageSize;
  const pageDays = filteredDays.slice(startIdx, endIdx); // desktop view slice
  const mobileDays = filteredDays; // mobile sees ALL available days

  const hasData = !!filteredDays.length;

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
    const workoutDays = allDays.filter(
      (d) => d.workoutCalories > 0
    ).length;

    return {
      daysLogged,
      avgIntake: totalIntake / daysLogged,
      avgDeficit: totalDeficit / daysLogged,
      estTotalDeltaKg,
      workoutDays,
    };
  }, [allDays]);

  // ---------- Group + row config ----------
  const groups = [
    {
      id: "nutrition",
      label: "Nutrition",
      colorClass: "cat-nutrition",
      rows: [
        { key: "target", label: "Target", field: "tdee", unit: "kcal" },
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

  return (
    <div className="page stats-page">
      {/* Header */}
      <header className="stats-header">
        <div>
          <h1 className="stats-title">Stats</h1>
          <p className="stats-subtitle">
            Frozen metrics on the left, days sliding across on the right.
          </p>
        </div>

        <div className="stats-header-pill">
          <span>{summary.daysLogged} days logged</span>
        </div>
      </header>

      {/* Summary metrics */}
      <section className="stats-summary-card">
        <div className="stats-summary-grid">
          <div className="stats-summary-item">
            <div className="stats-summary-label">Avg intake</div>
            <div className="stats-summary-value">
              {fmtNum(summary.avgIntake)} kcal
            </div>
            <div className="stats-summary-sub">
              Based on all logged days
            </div>
          </div>

          <div className="stats-summary-item">
            <div className="stats-summary-label">Avg deficit</div>
            <div className="stats-summary-value">
              {summary.avgDeficit >= 0 ? "+" : ""}
              {fmtNum(summary.avgDeficit)} kcal
            </div>
            <div className="stats-summary-sub">
              Positive = under target
            </div>
          </div>

          <div className="stats-summary-item">
            <div className="stats-summary-label">Estimated change</div>
            <div className="stats-summary-value">
              {summary.estTotalDeltaKg >= 0 ? "+" : ""}
              {summary.estTotalDeltaKg.toFixed(1)} kg
            </div>
            <div className="stats-summary-sub">
              Rough total over all logged days
            </div>
          </div>

          <div className="stats-summary-item">
            <div className="stats-summary-label">Workout days</div>
            <div className="stats-summary-value">
              {summary.workoutDays}
            </div>
            <div className="stats-summary-sub">
              Days with any workout burn
            </div>
          </div>
        </div>
      </section>

      {/* Matrix table card */}
      <section className="stats-table-card">
        {/* Controls */}
        <div className="stats-controls">
          <div className="stats-controls-left">
            <span className="rows-label">
              <span>Columns per view</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
              >
                <option value={5}>5</option>
                <option value={7}>7</option>
                <option value={10}>10</option>
              </select>
            </span>
          </div>

          <div className="stats-controls-right">
            <div className="custom-date-picker">
              <CalendarIcon
                size={16}
                className="calendar-icon-overlay"
              />
              <input
                type="date"
                className="input-date-hidden-ui"
                value={pickedDate}
                onChange={(e) => {
                  setPickedDate(e.target.value || "");
                  setPage(0);
                }}
              />
            </div>

            {pickedDate && (
              <button
                type="button"
                className="stats-small-btn"
                onClick={handleClearDate}
              >
                Clear filter
              </button>
            )}

            <button
              type="button"
              className="stats-export-btn"
              onClick={handleExport}
              disabled={!hasData}
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>

        {!hasData ? (
          <div className="stats-empty-matrix">
            No stats yet. Log a few days of meals and workouts to see the
            matrix.
          </div>
        ) : (
          <>
            {/* Desktop: paged slice */}
            <div className="stats-table-wrapper stats-table-desktop">
              <table className="stats-unified-table">
                <thead>
                  <tr>
                    <th className="header-corner-1 col-category" />
                    <th className="header-corner-2 col-metric">Metric</th>
                    {pageDays.map((day) => {
                      const header = formatHeaderDate(day.date);
                      return (
                        <th
                          key={day.date}
                          className="date-header-cell"
                        >
                          <button
                            type="button"
                            className="date-header-btn"
                          >
                            <span className="date-weekday">
                              {header.weekday}
                            </span>
                            <span className="date-full">
                              {header.label}
                            </span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) =>
                    group.rows.map((row, rowIndex) => (
                      <tr key={`${group.id}-${row.key}`}>
                        {rowIndex === 0 && (
                          <td
                            className={`col-category ${group.colorClass}`}
                            rowSpan={group.rows.length}
                          >
                            <span className="vertical-text">
                              {group.label}
                            </span>
                          </td>
                        )}

                        <td className="col-metric">{row.label}</td>

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
                              key={`${group.id}-${row.key}-${day.date}`}
                              className={`data-cell ${colorClass}`}
                              title={tooltip || ""}
                            >
                              {value}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile: ALL days, continuous horizontal scroll */}
            <div className="stats-table-wrapper stats-table-mobile">
              <table className="stats-unified-table">
                <thead>
                  <tr>
                    <th className="header-corner-1 col-category" />
                    <th className="header-corner-2 col-metric">Metric</th>
                    {mobileDays.map((day) => {
                      const header = formatHeaderDate(day.date);
                      return (
                        <th
                          key={day.date}
                          className="date-header-cell"
                        >
                          <button
                            type="button"
                            className="date-header-btn"
                          >
                            <span className="date-weekday">
                              {header.weekday}
                            </span>
                            <span className="date-full">
                              {header.label}
                            </span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) =>
                    group.rows.map((row, rowIndex) => (
                      <tr key={`${group.id}-${row.key}`}>
                        {rowIndex === 0 && (
                          <td
                            className={`col-category ${group.colorClass}`}
                            rowSpan={group.rows.length}
                          >
                            <span className="vertical-text">
                              {group.label}
                            </span>
                          </td>
                        )}

                        <td className="col-metric">{row.label}</td>

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
                              key={`${group.id}-${row.key}-${day.date}`}
                              className={`data-cell ${colorClass}`}
                              title={tooltip || ""}
                            >
                              {value}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Desktop pagination (hidden on mobile via CSS) */}
            <div className="stats-pagination">
              <div className="pagination-info">
                {totalColumns === 0 ? (
                  "No days"
                ) : (
                  <>
                    Showing{" "}
                    <strong>
                      {startIdx + 1}–{Math.min(endIdx, totalColumns)}
                    </strong>{" "}
                    of <strong>{totalColumns}</strong> days
                  </>
                )}
              </div>
              <div className="pagination-actions">
                <button
                  type="button"
                  className="stats-small-btn"
                  onClick={() =>
                    setPage((p) => Math.max(0, p - 1))
                  }
                  disabled={safePage === 0}
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  className="stats-small-btn"
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
            </div>
          </>
        )}
      </section>
    </div>
  );
}