// src/pages/Trends.jsx
import React, { useMemo, useState } from "react";
import { useAppState } from "../context/AppStateContext";
import {
  computeDayMealTotals,
  computeTDEEForDay,
  calculateEffectiveWorkout,
} from "../utils/calculations";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { TrendingUp, Scale, Save } from "lucide-react";

import "../styles/Trends.css";

const formatDateLabel = (iso) => {
  if (!iso) return "";
  // show MM-DD
  return iso.slice(5);
};

const formatTooltipDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function Trends() {
  const { state, dispatch } = useAppState();
  const { profile, dayLogs, selectedDate } = state;

  const [weightInput, setWeightInput] = useState("");
  const [range, setRange] = useState("30"); // "7" | "30" | "all"

  // ------- Build full series from day logs -------

  const allCalorieSeries = useMemo(() => {
    const days = Object.values(dayLogs || {});
    const sorted = days
      .filter((d) => d && d.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return sorted.map((day) => {
      const { lunch, dinner, extras, total } = computeDayMealTotals(day);

      const baseTdee = computeTDEEForDay(day, profile);
      const workout = calculateEffectiveWorkout(day);
      const dynamicTarget = baseTdee + workout;

      return {
        date: day.date,
        intake: Math.round(total),
        target: Math.round(dynamicTarget),
        lunch: Math.round(lunch),
        dinner: Math.round(dinner),
        extras: Math.round(extras),
      };
    });
  }, [dayLogs, profile]);

  const allWeightSeries = useMemo(() => {
    const days = Object.values(dayLogs || {});
    const withWeight = days.filter(
      (d) => d && d.date && d.weightKg != null && d.weightKg !== ""
    );
    const sorted = withWeight.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    return sorted.map((day) => ({
      date: day.date,
      weight: Number(day.weightKg),
    }));
  }, [dayLogs]);

  // ------- Range filtering (7 / 30 / all) -------

  const sliceByRange = (series) => {
    if (!series || series.length === 0) return [];
    if (range === "all") return series;
    const n = range === "7" ? 7 : 30;
    if (series.length <= n) return series;
    return series.slice(series.length - n);
  };

  const calorieSeries = sliceByRange(allCalorieSeries);
  const weightSeries = sliceByRange(allWeightSeries);

  const hasCalorieData = calorieSeries.length > 1;
  const hasWeightData = weightSeries.length > 1;

  // ------- Handlers -------

  const handleDateChange = (e) => {
    dispatch({ type: "SET_SELECTED_DATE", payload: e.target.value });
  };

  const handleSaveWeight = () => {
    const v = Number(weightInput);
    if (!selectedDate || Number.isNaN(v) || v <= 0) return;
    dispatch({
      type: "UPDATE_DAY_META",
      payload: {
        date: selectedDate,
        patch: { weightKg: v },
      },
    });
    setWeightInput("");
    // Keeping simple alert for now; could be replaced with toast later
    alert(`Saved ${v}kg for ${selectedDate}`);
  };

  const canSaveWeight =
    selectedDate && weightInput && !Number.isNaN(Number(weightInput));

  // ------- UI -------

  return (
    <div className="page trends-page">
      {/* Header */}
      <header className="trends-header">
        <div>
          <h1 className="trends-title">
            <TrendingUp size={22} />
            Health Trends
          </h1>
          <p className="trends-subtitle">
            Visualize your calorie adherence and weight progress over time.
          </p>
        </div>

        <div className="trends-range-toggle">
          <span className="trends-range-label">View</span>
          {[
            { key: "7", label: "7 days" },
            { key: "30", label: "30 days" },
            { key: "all", label: "All time" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={
                "trends-range-pill" +
                (range === opt.key ? " trends-range-pill-active" : "")
              }
              onClick={() => setRange(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {/* Weight logging card */}
      <section className="trends-card">
        <div className="section-title">
          <Scale size={18} />
          Log Weight Check-in
        </div>

        <div className="weight-log-grid">
          <div className="form-group">
            <label htmlFor="trend-date">Date</label>
            <input
              id="trend-date"
              type="date"
              className="trends-input"
              value={selectedDate || ""}
              onChange={handleDateChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="trend-weight">Weight (kg)</label>
            <input
              id="trend-weight"
              type="number"
              inputMode="decimal"
              className="trends-input"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="e.g. 72.5"
            />
          </div>

          <button
            type="button"
            className="btn-save-weight"
            onClick={handleSaveWeight}
            disabled={!canSaveWeight}
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </section>

      {/* Calorie chart card */}
      <section className="trends-card">
        <div className="section-title">
          <TrendingUp size={18} />
          Calorie Intake vs. Target (TDEE)
        </div>

        {!hasCalorieData ? (
          <div className="empty-chart-msg">
            Not enough data yet. Log meals for at least two days to see your
            trend line.
          </div>
        ) : (
          <>
            {/* Main line chart */}
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={calorieSeries} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(203,213,225,0.6)"
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    minTickGap={16}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip
                    labelFormatter={formatTooltipDate}
                    formatter={(value, name) => {
                      if (name === "intake") return [`${value} kcal`, "Intake"];
                      if (name === "target")
                        return [`${value} kcal`, "Dynamic TDEE"];
                      return [value, name];
                    }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow:
                        "0 4px 10px -1px rgba(15,23,42,0.18)",
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(val) =>
                      val === "intake"
                        ? "Intake"
                        : val === "target"
                        ? "Dynamic TDEE"
                        : val
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="intake"
                    stroke="#2b7fb6"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="#ea580c"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="4 4"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Stacked bar "volume" chart */}
            <div className="chart-volume-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calorieSeries} stackOffset="none">
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    minTickGap={20}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    hide
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip
                    labelFormatter={formatTooltipDate}
                    formatter={(value, name) => {
                      if (name === "lunch") return [`${value} kcal`, "Lunch"];
                      if (name === "dinner") return [`${value} kcal`, "Dinner"];
                      if (name === "extras") return [`${value} kcal`, "Extras"];
                      return [value, name];
                    }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow:
                        "0 4px 10px -1px rgba(15,23,42,0.18)",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="lunch"
                    stackId="meals"
                    fill="#2b7fb6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="dinner"
                    stackId="meals"
                    fill="#ea580c"
                  />
                  <Bar
                    dataKey="extras"
                    stackId="meals"
                    fill="#16a34a"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-volume-legend">
              <span className="legend-dot legend-lunch" />
              <span>Lunch</span>
              <span className="legend-dot legend-dinner" />
              <span>Dinner</span>
              <span className="legend-dot legend-extras" />
              <span>Extras</span>
            </div>
          </>
        )}
      </section>

      {/* Weight chart card */}
      <section className="trends-card">
        <div className="section-title">
          <Scale size={18} />
          Weight History
        </div>

        {!hasWeightData ? (
          <div className="empty-chart-msg">
            No weight trend yet. Log your weight on different days to see the
            curve.
          </div>
        ) : (
          <div className="chart-container chart-container-weight">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightSeries} margin={{ left: 0, right: 12 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(203,213,225,0.6)"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  minTickGap={16}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v) => `${v} kg`}
                  width={55}
                />
                <Tooltip
                  labelFormatter={formatTooltipDate}
                  formatter={(value) => [`${value} kg`, "Weight"]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow:
                      "0 4px 10px -1px rgba(15,23,42,0.18)",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
