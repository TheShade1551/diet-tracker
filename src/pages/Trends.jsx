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
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
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

/**
 * Small reusable 7 / 30 / all toggle used inside each card.
 */
function RangeToggle({ value, onChange }) {
  const options = [
    { key: "7", label: "7 days" },
    { key: "30", label: "30 days" },
    { key: "all", label: "All time" },
  ];

  return (
    <div className="chart-range-toggle">
      <span className="chart-range-label">View</span>
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className={
            "chart-range-pill" +
            (value === opt.key ? " chart-range-pill-active" : "")
          }
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Custom tooltip for weight chart so we can show time of day.
 */
function WeightTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload;
  const time = point.time || "—";
  const value = point.weight;

  return (
    <div className="trends-tooltip">
      <div className="trends-tooltip-label">{formatTooltipDate(label)}</div>
      <div className="trends-tooltip-row">
        <span>Time</span>
        <span>{time}</span>
      </div>
      <div className="trends-tooltip-row">
        <span>Weight</span>
        <span>{value} kg</span>
      </div>
    </div>
  );
}

/**
 * Custom tooltip for merged calorie chart
 */
function CalorieTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="trends-tooltip">
      <div className="trends-tooltip-label">{formatTooltipDate(label)}</div>
      <div className="trends-tooltip-row">
        <span>Intake</span>
        <span>{p.intake} kcal</span>
      </div>
      <div className="trends-tooltip-row">
        <span>Dynamic TDEE</span>
        <span>{p.target} kcal</span>
      </div>
      <div className="trends-tooltip-divider" />
      <div className="trends-tooltip-row">
        <span>Lunch</span>
        <span>{p.lunch} kcal</span>
      </div>
      <div className="trends-tooltip-row">
        <span>Dinner</span>
        <span>{p.dinner} kcal</span>
      </div>
      <div className="trends-tooltip-row">
        <span>Extras</span>
        <span>{p.extras} kcal</span>
      </div>
    </div>
  );
}

export default function Trends() {
  const { state, dispatch } = useAppState();
  const { profile, dayLogs, selectedDate } = state;

  const [weightInput, setWeightInput] = useState("");
  const [weightTimeInput, setWeightTimeInput] = useState("");
  const [calorieRange, setCalorieRange] = useState("30");
  const [weightRange, setWeightRange] = useState("30");

  // ------- Build full series from day logs -------

  const allCalorieSeries = useMemo(() => {
    const days = Object.values(dayLogs || {});
    const sorted = days
      .filter((d) => d && d.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const scaleFactor = 0.4; // dial bar heights down but keep ratios

    return sorted.map((day) => {
      const { lunch, dinner, extras, total } = computeDayMealTotals(day);

      const baseTdee = computeTDEEForDay(day, profile);
      const workout = calculateEffectiveWorkout(day);
      const dynamicTarget = baseTdee + workout;

      // Store rounded kcal in variables
      const lunchKcal = Math.round(lunch);
      const dinnerKcal = Math.round(dinner);
      const extrasKcal = Math.round(extras);

      return {
        date: day.date,
        intake: Math.round(total),
        target: Math.round(dynamicTarget),

        // raw values (for tooltip, ratios, etc.)
        lunch: lunchKcal,
        dinner: dinnerKcal,
        extras: extrasKcal,

        // scaled versions used only for bar height
        lunchBar: lunchKcal * scaleFactor,
        dinnerBar: dinnerKcal * scaleFactor,
        extrasBar: extrasKcal * scaleFactor,
      };
    });
  }, [dayLogs, profile]); // End of allCalorieSeries useMemo

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
      time: day.weightTime || null,
    }));
  }, [dayLogs]);

  // ------- Range filtering (per chart) -------

  const sliceByRange = (series, range) => {
    if (!series || series.length === 0) return [];
    if (range === "all") return series;
    const n = range === "7" ? 7 : 30;
    if (series.length <= n) return series;
    return series.slice(series.length - n);
  };

  const calorieSeries = sliceByRange(allCalorieSeries, calorieRange);
  const weightSeries = sliceByRange(allWeightSeries, weightRange);

  const hasCalorieData = calorieSeries.length > 1;
  const hasWeightData = weightSeries.length > 1;

  // Dynamic zoom for weight chart so it isn't flat
  const weightDomain = useMemo(() => {
    if (!hasWeightData) return [0, "auto"];
    const vals = weightSeries.map((d) => d.weight);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const padding = span * 0.3;
    return [Math.max(0, min - padding), max + padding];
  }, [hasWeightData, weightSeries]);

  // ------- Handlers -------

  const handleDateChange = (e) => {
    dispatch({ type: "SET_SELECTED_DATE", payload: e.target.value });
  };

  const handleSaveWeight = () => {
    const v = Number(weightInput);
    if (!selectedDate || Number.isNaN(v) || v <= 0) return;

    const patch = { weightKg: v };
    if (weightTimeInput) patch.weightTime = weightTimeInput;

    dispatch({
      type: "UPDATE_DAY_META",
      payload: {
        date: selectedDate,
        patch,
      },
    });
    setWeightInput("");
    setWeightTimeInput("");
    alert(
      `Saved ${v}kg${weightTimeInput ? " at " + weightTimeInput : ""} for ${
        selectedDate
      }`
    );
  };

  const canSaveWeight =
    selectedDate && weightInput && !Number.isNaN(Number(weightInput));

  // ------- RENDER -------

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
            Track how consistently you hit your targets and how your weight is
            moving over time.
          </p>
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
            <p className="muted-text">Logs weight for the currently selected day.</p>
          </div>

          <div className="form-group">
            <label htmlFor="trend-time">Time</label>
            <input
              id="trend-time"
              type="time"
              className="trends-input"
              value={weightTimeInput}
              onChange={(e) => setWeightTimeInput(e.target.value)}
            />
            <p className="muted-text">Optional check-in time.</p>
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
        <div className="trends-card-header-row">
          <div className="section-title">
            <TrendingUp size={18} />
            Calorie Intake vs. Target (TDEE)
          </div>
          <RangeToggle value={calorieRange} onChange={setCalorieRange} />
        </div>

        {!hasCalorieData ? (
          <div className="empty-chart-msg">
            Not enough data yet. Log meals for at least two days to see your
            trend line.
          </div>
        ) : (
          <>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={calorieSeries}
                  margin={{ left: 0, right: 12, top: 10, bottom: 6 }}
                >
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
                  {/* Left axis: calories for lines */}
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => `${v}`}
                  />
                  {/* Right axis: stacked meals (hidden, just for scaling) */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    hide
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip content={<CalorieTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(val) => {
                      if (val === "intake") return "Intake";
                      if (val === "target") return "Dynamic TDEE";
                      if (val === "lunch") return "Lunch";
                      if (val === "dinner") return "Dinner";
                      if (val === "extras") return "Extras";
                      return val;
                    }}
                  />
                  {/* Stacked bars, like volume but under the lines */}
                  <Bar
                    yAxisId="right"
                    dataKey="lunchBar"
                    stackId="meals"
                    fill="#b7ded2"     // lunch: soft teal
                    barSize={14}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="dinnerBar"
                    stackId="meals"
                    fill="#f6a6b2"     // dinner: soft pink
                    barSize={14}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="extrasBar"
                    stackId="meals"
                    fill="#f7c297"     // extras: warm apricot
                    barSize={14}
                  />
                  {/* Lines on top */}
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="intake"
                    stroke="#2b7fb6"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="target"
                    stroke="#ea580c"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="4 4"
                  />
                </ComposedChart>
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
        <div className="trends-card-header-row">
          <div className="section-title">
            <Scale size={18} />
            Weight History
          </div>
          <RangeToggle value={weightRange} onChange={setWeightRange} />
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
                  domain={weightDomain}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v) => `${v} kg`}
                  width={55}
                />
                <Tooltip content={<WeightTooltip />} />
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