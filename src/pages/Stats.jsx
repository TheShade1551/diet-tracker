// src/pages/Stats.jsx
import React, { useMemo, useState } from "react";
// ✅ FIXED: Import the hook, not the context object
import { useAppState } from "../context/AppStateContext"; 
import "../styles/Stats.css";

// --- Helper Functions (Preserved) ---

function safeGet(obj, ...keys) {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
    if (obj && obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

function getTotalCaloriesForDay(day) {
  // Try various likely structures
  if (typeof day.totalCalories === "number") return day.totalCalories;
  if (typeof day.total_kcal === "number") return day.total_kcal;
  if (typeof day.total === "number") return day.total;
  // Maybe stored as summary totals:
  if (day.summary && typeof day.summary.totalCalories === "number")
    return day.summary.totalCalories;

  // Fallback: sum meals & extras if present:
  let sum = 0;
  const addFromList = (list) => {
    if (!Array.isArray(list)) return;
    for (const m of list) {
      const t = m.totalKcal ?? m.total_kcal ?? m.kcal ?? m.calories ?? m.cal;
      if (typeof t === "number") sum += t;
      else if (typeof m.quantity === "number" && typeof m.kcalPerUnit === "number")
        sum += m.quantity * m.kcalPerUnit;
    }
  };
  addFromList(day.lunch || []);
  addFromList(day.dinner || []);
  addFromList(day.extras || []);
  // some versions keep a meals array
  addFromList(day.meals || []);
  return sum || 0;
}

function getTDEE(day, profile) {
  // Try day.tdee or day.TDEE etc.
  const tdee =
    day.tdee ??
    day.TDEE ??
    safeGet(day, "tdee") ??
    safeGet(day, "TDEE") ??
    safeGet(day, "caloriesTarget") ??
    undefined;
  if (typeof tdee === "number") return tdee;

  // Try to compute from activityFactor and BMR (if available)
  const af =
    safeGet(day, "activityFactor") ??
    safeGet(day, "activity_factor") ??
    safeGet(day, "activity") ??
    profile?.defaultActivityFactor ??
    profile?.activityFactor;
  const bmr =
    profile?.bmr ??
    profile?.BMR ??
    profile?.calculatedBmr ??
    profile?.basalMetabolicRate;

  if (typeof bmr === "number" && typeof af === "number") return Math.round(bmr * af);

  // Last fallback: use profile.dailyKcalTarget or 2500
  return profile?.dailyKcalTarget ?? profile?.dailyKcal ?? 2500;
}

function getWorkoutCalories(day) {
  return (
    day.workoutCalories ??
    day.workout_calories ??
    safeGet(day, "workout", "calories") ??
    safeGet(day, "workout", "cal") ??
    day.workoutKcal ??
    0
  );
}

// --- Main Component ---

export default function Stats() {
  // ✅ FIXED: Use the custom hook
  const { state } = useAppState();
  
  const profile = state?.profile ?? {};
  
  // try several names where days may be stored:
  const rawDays =
    state?.days ??
    state?.dayLogs ??
    state?.dayLogEntries ??
    state?.entries ??
    state?.logs ??
    [];

  const [filterText, setFilterText] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    // Ensure we have a sorted array, descending by date
    const arr = Array.isArray(rawDays) ? [...rawDays] : Object.values(rawDays || {});
    // Normalize and map into predictable shape
    const mapped = arr.map((d, idx) => {
      // date may be stored as dateString, iso, key etc.
      const date =
        d.date ??
        d.day ??
        d.dateString ??
        d.isoDate ??
        d.loggedAt ??
        d.createdAt ??
        d.key ??
        "";

      const totalCalories = getTotalCaloriesForDay(d);
      const tdee = getTDEE(d, profile);
      const activityFactor =
        safeGet(d, "activityFactor") ??
        safeGet(d, "activity_factor") ??
        safeGet(d, "af") ??
        profile?.defaultActivityFactor ??
        "";
      const intensityFactor =
        safeGet(d, "intensityFactor") ??
        safeGet(d, "intensity_factor") ??
        safeGet(d, "if") ??
        "";
      const workoutCalories = getWorkoutCalories(d);
      // Meal breakdown strings:
      const lunchK =
        Array.isArray(d.lunch) && d.lunch.length
          ? d.lunch.map((m) => `${m.name || m.food || ""} (${m.totalKcal ?? m.kcal ?? ""})`).join(", ")
          : d.lunchSummary ?? "";
      const dinnerK =
        Array.isArray(d.dinner) && d.dinner.length
          ? d.dinner.map((m) => `${m.name || m.food || ""} (${m.totalKcal ?? m.kcal ?? ""})`).join(", ")
          : d.dinnerSummary ?? "";
      const extrasK =
        Array.isArray(d.extras) && d.extras.length
          ? d.extras.map((m) => `${m.name || m.food || ""} (${m.totalKcal ?? m.kcal ?? ""})`).join(", ")
          : d.extrasSummary ?? "";

      const deficit = Math.round((tdee + (workoutCalories || 0)) - (totalCalories || 0));
      const gainLossKcal = -deficit; // positive -> surplus (gain)
      const gainLossKg = +(gainLossKcal / 7700).toFixed(3);

      return {
        id: d.id ?? d.key ?? idx,
        date,
        tdee,
        activityFactor,
        intensityFactor,
        workoutCalories,
        lunchText: lunchK,
        dinnerText: dinnerK,
        extrasText: extrasK,
        totalCalories,
        deficit,
        gainLossKg,
        raw: d,
      };
    });

    // Sort by date (try ISO) fallback to original order
    mapped.sort((a, b) => {
      if (a.date && b.date) {
        const ad = new Date(a.date).getTime();
        const bd = new Date(b.date).getTime();
        if (!isNaN(ad) && !isNaN(bd)) return bd - ad;
      }
      return 0;
    });

    // filter
    return mapped.filter((r) => {
      if (!filterText) return true;
      const ft = filterText.toLowerCase();
      return (
        (r.date && String(r.date).toLowerCase().includes(ft)) ||
        (r.lunchText && r.lunchText.toLowerCase().includes(ft)) ||
        (r.dinnerText && r.dinnerText.toLowerCase().includes(ft)) ||
        (r.extrasText && r.extrasText.toLowerCase().includes(ft))
      );
    });
  }, [rawDays, profile, filterText]);

  // pagination
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice(page * pageSize, (page + 1) * pageSize);

  function downloadCSV() {
    const headers = [
      "Sr",
      "Date",
      "TDEE",
      "ActivityFactor",
      "IntensityFactor",
      "WorkoutCalories",
      "Lunch",
      "Dinner",
      "Extras",
      "TotalCalories",
      "Deficit_kcal",
      "GainLoss_kg",
    ];
    const csvRows = [headers.join(",")];
    visible.forEach((r, i) => {
      const row = [
        i + 1 + page * pageSize,
        `"${String(r.date || "")}"`,
        r.tdee ?? "",
        r.activityFactor ?? "",
        r.intensityFactor ?? "",
        r.workoutCalories ?? "",
        `"${(r.lunchText || "").replace(/"/g, '""')}"`,
        `"${(r.dinnerText || "").replace(/"/g, '""')}"`,
        `"${(r.extrasText || "").replace(/"/g, '""')}"`,
        r.totalCalories ?? 0,
        r.deficit ?? 0,
        r.gainLossKg ?? 0,
      ];
      csvRows.push(row.join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diet-stats-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diet-stats-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // All-time summaries:
  const allTime = useMemo(() => {
    const totalDays = rows.length;
    const totalDeficit = rows.reduce((s, r) => s + (r.deficit || 0), 0);
    const totalGainKg = rows.reduce((s, r) => s + (r.gainLossKg || 0), 0);
    const totalCaloriesConsumed = rows.reduce((s, r) => s + (r.totalCalories || 0), 0);
    return { totalDays, totalDeficit, totalGainKg, totalCaloriesConsumed };
  }, [rows]);

  return (
    <div className="stats-page container-card">
      <header className="stats-header">
        <h2>All-time summary</h2>
        <div className="summary-row">
          <div>Days logged: <strong>{allTime.totalDays}</strong></div>
          <div>Net deficit (kcal): <strong>{allTime.totalDeficit}</strong></div>
          <div>Estimated weight change (kg): <strong>{allTime.totalGainKg.toFixed(3)}</strong></div>
          <div>Total Cals consumed: <strong>{allTime.totalCaloriesConsumed}</strong></div>
        </div>
      </header>

      <div className="stats-controls">
        <div className="left">
          <input placeholder="Filter (date/meal text)" value={filterText} onChange={(e)=>{setFilterText(e.target.value); setPage(0);}}/>
          <label>Rows:
            <select value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(0); }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>
        <div className="right">
          <button onClick={downloadCSV}>Export CSV</button>
          <button onClick={downloadJSON}>Export JSON</button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Sr.</th>
              <th>Date</th>
              <th>TDEE</th>
              <th>AF</th>
              <th>IF</th>
              <th>Workout (kcal)</th>
              <th>Lunch</th>
              <th>Dinner</th>
              <th>Extras</th>
              <th>Total kcal</th>
              <th>Deficit (kcal)</th>
              <th>Gain/Loss (kg)</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={r.id ?? i}>
                <td>{i + 1 + page * pageSize}</td>
                <td>{String(r.date ?? "").slice(0, 10)}</td>
                <td>{r.tdee}</td>
                <td>{r.activityFactor}</td>
                <td>{r.intensityFactor}</td>
                <td>{r.workoutCalories}</td>
                <td className="cell-text">{r.lunchText}</td>
                <td className="cell-text">{r.dinnerText}</td>
                <td className="cell-text">{r.extrasText}</td>
                <td>{r.totalCalories}</td>
                <td>{r.deficit}</td>
                <td className={r.gainLossKg > 0 ? "surplus" : "loss"}>{r.gainLossKg}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={12} style={{textAlign:"center", padding:"1rem"}}>No rows to show</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <div>Page {page + 1} / {pageCount}</div>
        <div>
          <button disabled={page <= 0} onClick={()=>setPage(p => Math.max(0, p-1))}>Prev</button>
          <button disabled={page >= pageCount-1} onClick={()=>setPage(p => Math.min(pageCount-1, p+1))}>Next</button>
        </div>
      </div>
    </div>
  );
}