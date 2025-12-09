import React, { useEffect, useState } from "react";
import { useAppState } from "../context/AppStateContext";
import { computeEATForActivity, sumEATFromActivities } from "../utils/calculations";

// Simple UUID helper for client-side ids
function uid(prefix = "act") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ActivityTab() {
  const { state, dispatch, getDayDerived } = useAppState();
  const date = state.selectedDate;
  const day = state.dayLogs?.[date] || {};
  const profile = state.profile || {};

  // Local editable activities list (mirrors day.activities)
  const [activities, setActivities] = useState(Array.isArray(day.activities) ? day.activities : []);

  // NEAT survey state (steps + survey fields)
  const [steps, setSteps] = useState(day.steps ?? "");
  const [subjective, setSubjective] = useState(day.survey?.subjective ?? 50);
  const [standingHours, setStandingHours] = useState(day.survey?.standingHours ?? 0);
  const [activeCommute, setActiveCommute] = useState(day.survey?.activeCommute ?? false);

  useEffect(() => {
    // Keep local activities synced when changing selectedDate externally
    setActivities(Array.isArray(day.activities) ? day.activities : []);
    setSteps(day.steps ?? "");
    setSubjective(day.survey?.subjective ?? 50);
    setStandingHours(day.survey?.standingHours ?? 0);
    setActiveCommute(day.survey?.activeCommute ?? false);
  }, [date]);

  // computed preview of totals
  const eatTotals = sumEATFromActivities(activities, { weight_kg: profile.weight_kg, bmr: profile.bmr });

  function addEmptyActivity(type = "walk") {
    const a = {
      id: uid(),
      type,
      duration_min: 30,
      distance_km: null,
      intensity: 50,
      notes: "",
    };
    setActivities((s) => [...s, a]);
  }

  function updateActivity(id, patch) {
    setActivities((s) => s.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function removeActivity(id) {
    setActivities((s) => s.filter((a) => a.id !== id));
  }

  function saveActivities() {
    // dispatch update to day log and set activityMode to advanced_full if activities exist
    dispatch({ type: "UPDATE_DAY_ACTIVITIES", payload: { date, activities } });
    // give user feedback via console for now
    console.log("Activities saved", activities);
  }

  function saveStepsSurvey() {
    const survey = { subjective: Number(subjective), standingHours: Number(standingHours), activeCommute: !!activeCommute };
    const stepsVal = steps === "" ? null : Number(steps);
    dispatch({ type: "UPDATE_DAY_STEPS_SURVEY", payload: { date, steps: stepsVal, survey } });
    console.log("Saved steps/survey", stepsVal, survey);
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-3">Activity Tab — Log focused activities</h2>

      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <button className="px-3 py-1 bg-slate-200 rounded" onClick={() => addEmptyActivity("walk")}>Add Walk</button>
          <button className="px-3 py-1 bg-slate-200 rounded" onClick={() => addEmptyActivity("jog")}>Add Jog</button>
          <button className="px-3 py-1 bg-green-500 text-white rounded" onClick={saveActivities}>Save Activities</button>
        </div>
        <p className="text-sm text-slate-600">Activities without distance will be treated as NEAT-only and won't count as EAT.</p>
      </div>

      <div className="mb-6">
        {activities.length === 0 && <div className="text-sm text-slate-500">No activities logged yet for {date}.</div>}
        {activities.map((a) => {
          const preview = computeEATForActivity(a, { weight_kg: profile.weight_kg, bmr: profile.bmr });
          return (
            <div key={a.id} className="mb-3 p-3 border rounded">
              <div className="flex justify-between items-center mb-2">
                <strong>{a.type?.toUpperCase() || 'ACT'}</strong>
                <button className="text-red-600" onClick={() => removeActivity(a.id)}>Remove</button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">Duration (min)
                  <input type="number" className="w-full mt-1 p-1 border rounded" value={a.duration_min} onChange={(e) => updateActivity(a.id, { duration_min: Number(e.target.value) })} />
                </label>

                <label className="text-xs">Distance (km)
                  <input type="number" step="0.01" className="w-full mt-1 p-1 border rounded" value={a.distance_km ?? ''} onChange={(e) => updateActivity(a.id, { distance_km: e.target.value === '' ? null : Number(e.target.value) })} />
                </label>

                <label className="text-xs">Intensity (0-100)
                  <input type="range" min="0" max="100" className="w-full mt-1" value={a.intensity} onChange={(e) => updateActivity(a.id, { intensity: Number(e.target.value) })} />
                </label>

                <label className="text-xs">Notes
                  <input className="w-full mt-1 p-1 border rounded" value={a.notes} onChange={(e) => updateActivity(a.id, { notes: e.target.value })} />
                </label>
              </div>

              <div className="mt-2 text-sm text-slate-700">
                <div>Preview: gross <strong>{preview.gross} kcal</strong> — BMR share <strong>{preview.bmr_share} kcal</strong> — net EAT <strong>{preview.net} kcal</strong></div>
              </div>
            </div>
          );
        })}
      </div>

      <hr className="my-4" />

      <div className="mb-4">
        <h3 className="font-medium">NEAT (steps & quick survey)</h3>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <label className="text-xs">Steps (optional)
            <input type="number" className="w-full mt-1 p-1 border rounded" value={steps ?? ''} onChange={(e) => setSteps(e.target.value)} />
          </label>

          <label className="text-xs">Subjective activity (0-100)
            <input type="range" min="0" max="100" className="w-full mt-1" value={subjective} onChange={(e) => setSubjective(Number(e.target.value))} />
          </label>

          <label className="text-xs">Hours standing (approx)
            <select className="w-full mt-1 p-1 border rounded" value={standingHours} onChange={(e) => setStandingHours(e.target.value)}>
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2-5</option>
              <option value={5}>5+</option>
            </select>
          </label>

          <label className="text-xs flex items-center">Active commute
            <input type="checkbox" className="ml-2" checked={activeCommute} onChange={(e) => setActiveCommute(e.target.checked)} />
          </label>
        </div>

        <div className="mt-3">
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={saveStepsSurvey}>Save Steps & Survey</button>
        </div>
      </div>

      <hr className="my-4" />

      <div className="mb-4">
        <h3 className="font-medium">Totals preview</h3>
        <div className="mt-2 text-sm">
          <div>Total gross kcal from activities: <strong>{eatTotals.totalGross}</strong></div>
          <div>Total net EAT (activities): <strong>{eatTotals.totalNet}</strong></div>
          <div>Total BMR share during activities: <strong>{eatTotals.totalBmrShare}</strong></div>
        </div>
      </div>

      <div className="mt-6">
        <button className="px-3 py-1 bg-green-600 text-white rounded mr-2" onClick={saveActivities}>Save activities & compute AF</button>
        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => { setActivities([]); dispatch({ type: 'UPDATE_DAY_ACTIVITIES', payload: { date, activities: [] } }); }}>Clear activities</button>
      </div>
    </div>
  );
}