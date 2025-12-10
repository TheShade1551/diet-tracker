// src/components/stats/DailyStatsMatrix.jsx
import React, { useMemo, useState } from "react";
import { useAppState } from "../../context/AppStateContext";
import {
  dateToKey,
  fmtNum,
  computeDayMealTotals,
} from "../../utils/calculations";
import { Calendar as CalendarIcon, Download } from "lucide-react";
import "../../styles/stats/DailyStatsMatrix.css";

// Small helper from Stats.jsx
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

// Metric groups (restored to original from Stats.jsx)
const METRIC_GROUPS = [
  {
    id: "nutrition",
    label: "Nutrition",
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
        key: "neatKcal",
        label: "NEAT",
        field: "neatKcal",
        unit: "kcal",
      },
      {
        key: "eatNetKcal",
        label: "EAT (net)",
        field: "eatNetKcal",
        unit: "kcal",
      },
      {
        key: "tefKcal",
        label: "TEF",
        field: "tefKcal",
        unit: "kcal",
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

export default function DailyStatsMatrix() {
  const { state, getDayDerived } = useAppState();
  const { profile, dayLogs } = state;

  const [pickedDate, setPickedDate] = useState("");
  const [pageSize, setPageSize] = useState(7);
  const [page, setPage] = useState(0);
  const [sortState, setSortState] = useState({
    metricKey: null,
    direction: null,
  });

  const allMetricRows = useMemo(
    () =>
      METRIC_GROUPS.flatMap((g) =>
        g.rows.map((r) => ({
          ...r,
          groupId: g.id,
        }))
      ),
    []
  );

  // Build allDays (restored to original logic from Stats.jsx, newest first)
  const allDays = useMemo(() => {
    const entries = Object.values(dayLogs || {});
    const mapped = entries
      .map((day) => {
        const date = dateToKey(day.date || day.dateKey);
        if (!date) return null;

        const derived = getDayDerived(state, date);
        const { tdee, totalIntake, tdeeBreakdown } = derived;
        const totals = computeDayMealTotals(day);

        const deficit = tdee - totalIntake;
        // Negative = weight loss (matches your old logic)
        const estDeltaKg = -(deficit / 7700);

        const activityFactor =
          day.activityFactor ?? profile.defaultActivityFactor ?? 1.2;

        // Pull NEAT / EAT / TEF from the breakdown (restored)
        const neatKcal = safeNum(tdeeBreakdown?.neat ?? 0);

        let eatNetKcal = 0;
        if (tdeeBreakdown?.eat) {
          if (typeof tdeeBreakdown.eat === "number") {
            eatNetKcal = tdeeBreakdown.eat;
          } else if (typeof tdeeBreakdown.eat.totalNet !== "undefined") {
            eatNetKcal = tdeeBreakdown.eat.totalNet;
          } else if (typeof tdeeBreakdown.eat.total !== "undefined") {
            eatNetKcal = tdeeBreakdown.eat.total;
          }
        }

        const tefKcal = safeNum(
          tdeeBreakdown?.tef ??
            Math.round((totalIntake || 0) * 0.1) // 10% TEF fallback
        );

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
          neatKcal,
          eatNetKcal,
          tefKcal,
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

  // Helper function (restored from original)
  function safeNum(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }

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

    METRIC_GROUPS.forEach((group) => {
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
          No stats yet. Log a few days of meals and workouts to see the matrix.
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
                  {METRIC_GROUPS.map((group) =>
                    group.rows.map((row, rowIndex) => {
                      const isActive = sortState.metricKey === row.key;
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
                              onClick={() => handleMetricSortToggle(row.key)}
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
                            const value = formatCellValue(row, rawValue);
                            const colorClass = row.color
                              ? row.color(rawValue)
                              : "";
                            const tooltip =
                              row.tooltipField && day[row.tooltipField];

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
                    {Math.min(endIdx, totalColumns)} of {totalColumns} days
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
                  {METRIC_GROUPS.map((group) =>
                    group.rows.map((row, rowIndex) => {
                      const isActive = sortState.metricKey === row.key;
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
                              onClick={() => handleMetricSortToggle(row.key)}
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
                            const value = formatCellValue(row, rawValue);
                            const colorClass = row.color
                              ? row.color(rawValue)
                              : "";
                            const tooltip =
                              row.tooltipField && day[row.tooltipField];

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
  );
}