// src/pages/Trends.jsx
import React from "react";
import { useAppState } from "../context/AppStateContext";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

function buildChartData(dayLogs) {
  if (!dayLogs) return [];

  return Object.entries(dayLogs)
    .map(([date, log]) => {
      const meals = log.meals || [];

      const totalIntake = meals.reduce(
        (sum, m) => sum + (m.totalKcal || 0),
        0
      );

      const workout = log.workoutKcal || 0;
      const net = totalIntake - workout;

      // If literally nothing happened this day, skip it
      if (totalIntake === 0 && workout === 0) return null;

      return {
        date,
        // show only MM-DD on axis for now
        label: date.slice(5),
        intake: totalIntake,
        burn: workout,
        net,
        weightKg:
          typeof log.weightKg === "number" ? log.weightKg : undefined,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default function Trends() {
  const {
    state: { dayLogs },
  } = useAppState();

  const chartData = React.useMemo(
    () => buildChartData(dayLogs),
    [dayLogs]
  );

  if (!chartData.length) {
    return (
      <div>
        <h2>Trends</h2>
        <p>No data yet. Log a few days of meals and come back!</p>
      </div>
    );
  }

  const weightData = chartData.filter(
    (d) => typeof d.weightKg === "number"
  );

  return (
    <div>
      <h2>Trends</h2>

      {/* Calories chart */}
      <div style={{ width: "100%", height: 320, marginTop: 16 }}>
        <h3>Calories: intake, burn, net</h3>
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="intake" name="Intake" />
            <Line type="monotone" dataKey="burn" name="Burn" />
            <Line type="monotone" dataKey="net" name="Net" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Weight chart (only if we have any weight entries) */}
      {weightData.length > 0 && (
        <div style={{ width: "100%", height: 320, marginTop: 32 }}>
          <h3>Weight trend</h3>
          <ResponsiveContainer>
            <LineChart data={weightData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="weightKg"
                name="Weight (kg)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Simple textual summary so we have something even if charts misbehave later */}
      <h3 style={{ marginTop: 32 }}>Summary</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Intake (kcal)</th>
            <th>Burn (kcal)</th>
            <th>Net (kcal)</th>
            <th>Weight (kg)</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{d.intake}</td>
              <td>{d.burn}</td>
              <td>{d.net}</td>
              <td>{d.weightKg ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}