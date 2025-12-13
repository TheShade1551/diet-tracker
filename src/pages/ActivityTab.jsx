// src/pages/ActivityTab.jsx

import React, { useEffect, useState, useMemo } from "react";
import { useAppState } from "../context/AppStateContext";
import { computeEATForActivity, sumEATFromActivities, computeNEAT, computeAdvancedActivityFactor } from "../utils/calculations";
import "../styles/ActivityTab.css";

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

  // Determine weight to use: day-level first, then profile fallbacks
  const effectiveWeightKg = useMemo(() => {
    return Number(day.weightKg ?? profile.weight_kg ?? profile.weight ?? 0) || 0;
  }, [day.weightKg, profile.weight_kg, profile.weight]);

  const bmrSnapshot = useMemo(() => Number(day.bmrSnapshot ?? profile.bmr ?? 0), [day.bmrSnapshot, profile.bmr]);

  const effectiveProfile = useMemo(() => ({ ...profile, weight_kg: effectiveWeightKg, bmr: bmrSnapshot }), [profile, effectiveWeightKg, bmrSnapshot]);

  const previewSteps = useMemo(() => steps === "" ? null : Number(steps), [steps]);

  // computed preview of totals (pass effective weight & bmr snapshot)
  const eatTotals = useMemo(() => {
    return sumEATFromActivities(activities, effectiveProfile);
  }, [activities, effectiveProfile]);

  // compute NEAT preview from local steps/survey for quick feedback
  const neatPreview = useMemo(() => {
    const survey = { subjective: Number(subjective), standingHours: Number(standingHours), activeCommute: !!activeCommute };
    return computeNEAT({ steps: previewSteps, weight_kg: effectiveWeightKg, survey, bmr: bmrSnapshot, profile: effectiveProfile });
  }, [previewSteps, subjective, standingHours, activeCommute, effectiveWeightKg, bmrSnapshot, effectiveProfile]);

  // compute Advanced AF preview combining current activities + NEAT
  const advAFPreview = useMemo(() => {
    const survey = { subjective: Number(subjective), standingHours: Number(standingHours), activeCommute: !!activeCommute };
    return computeAdvancedActivityFactor({
      bmr: bmrSnapshot,
      weight_kg: effectiveWeightKg,
      activities,
      steps: previewSteps,
      survey,
      profile: effectiveProfile,
    });
  }, [activities, previewSteps, subjective, standingHours, activeCommute, effectiveWeightKg, bmrSnapshot, effectiveProfile]);

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
    // Make sure the UI recomputes DayLog by also updating steps/survey if present
    const stepsVal = steps === "" ? null : Number(steps);
    const survey = { subjective: Number(subjective), standingHours: Number(standingHours), activeCommute: !!activeCommute };
    dispatch({ type: "UPDATE_DAY_STEPS_SURVEY", payload: { date, steps: stepsVal, survey } });
    console.log("Activities saved", activities);
  }

  function saveStepsSurvey() {
    const survey = { subjective: Number(subjective), standingHours: Number(standingHours), activeCommute: !!activeCommute };
    const stepsVal = steps === "" ? null : Number(steps);
    dispatch({ type: "UPDATE_DAY_STEPS_SURVEY", payload: { date, steps: stepsVal, survey } });
    console.log("Saved steps/survey", stepsVal, survey);
  }

  function getTypeBadgeClass(type) {
    if (type === "walk") return "activity-type-badge activity-type-badge-walk";
    if (type === "jog") return "activity-type-badge activity-type-badge-jog";
    return "activity-type-badge activity-type-badge-default";
  }

  return (
    <div className="activity-page">
      {/* Header */}
      <div className="activity-header">
        <div className="activity-header-left">
          <h1 className="activity-title">
            <span className="activity-title-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </span>
            Activity Log
          </h1>
          <p className="activity-subtitle">Track your focused activities and daily movement</p>
        </div>
        <div className="activity-actions">
          <button className="activity-btn activity-btn-secondary" onClick={() => addEmptyActivity("walk")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/>
            </svg>
            Add Walk
          </button>
          <button className="activity-btn activity-btn-secondary" onClick={() => addEmptyActivity("jog")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="17" cy="5" r="1"/><path d="M8 20h4l2-4"/><path d="M14 16 8 8l-3 5"/><path d="m21 12-4-3-5 7"/>
            </svg>
            Add Jog
          </button>
          <button className="activity-btn activity-btn-success" onClick={saveActivities}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/>
            </svg>
            Save Activities
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="activity-info-banner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        Activities without distance will be treated as NEAT-only and won't count as EAT. 
      </div>

      {/* Activities List */}
      <div className="activity-list">
        {activities.length === 0 ? (
          <div className="activity-empty">
            <div className="activity-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <p className="activity-empty-text">
              No activities logged yet for <span className="activity-empty-date">{date}</span>
            </p>
            <p className="activity-empty-text">Click "Add Walk" or "Add Jog" to get started!</p>
          </div>
        ) : (
          activities.map((a) => {
            const preview = computeEATForActivity(a, effectiveProfile);
            return (
              <div key={a.id} className="activity-entry">
                <div className="activity-entry-header">
                  <div className="activity-entry-type">
                    <span className={getTypeBadgeClass(a.type)}>
                      {a.type === "walk" && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/>
                        </svg>
                      )}
                      {a.type === "jog" && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="17" cy="5" r="1"/><path d="M8 20h4l2-4"/><path d="M14 16 8 8l-3 5"/><path d="m21 12-4-3-5 7"/>
                        </svg>
                      )}
                      {a.type?.toUpperCase() || 'ACTIVITY'}
                    </span>
                  </div>
                  <button className="activity-btn activity-btn-danger" onClick={() => removeActivity(a.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Remove
                  </button>
                </div>

                <div className="activity-form-grid">
                  <div className="activity-field">
                    <label className="activity-field-label">Duration (min)</label>
                    <input 
                      type="number" 
                      className="activity-input" 
                      value={a.duration_min} 
                      onChange={(e) => updateActivity(a.id, { duration_min: Number(e.target.value) })} 
                      placeholder="30"
                    />
                  </div>

                  <div className="activity-field">
                    <label className="activity-field-label">Distance (km)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="activity-input" 
                      value={a.distance_km ?? ''} 
                      onChange={(e) => updateActivity(a.id, { distance_km: e.target.value === '' ? null : Number(e.target.value) })} 
                      placeholder="Optional"
                    />
                  </div>

                  <div className="activity-field">
                    <label className="activity-field-label">Intensity (0-100)</label>
                    <div className="activity-range-wrapper">
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        className="activity-range" 
                        value={a.intensity} 
                        onChange={(e) => updateActivity(a.id, { intensity: Number(e.target.value) })} 
                      />
                      <span className="activity-range-value">{a.intensity}%</span>
                    </div>
                  </div>

                  <div className="activity-field">
                    <label className="activity-field-label">Notes</label>
                    <input 
                      className="activity-input" 
                      value={a.notes} 
                      onChange={(e) => updateActivity(a.id, { notes: e.target.value })} 
                      placeholder="Optional notes..."
                    />
                  </div>
                </div>

                <div className="activity-preview">
                  <div className="activity-preview-stat">
                    Gross:  <strong>{preview.gross} kcal</strong>
                  </div>
                  <div className="activity-preview-stat">
                    BMR Share: <strong>{preview.bmr_share} kcal</strong>
                  </div>
                  <div className="activity-preview-stat activity-preview-stat-highlight">
                    Net EAT: <strong>{preview.net} kcal</strong>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <hr className="activity-divider" />

      {/* NEAT Section */}
      <div className="neat-section">
        <div className="neat-section-header">
          <span className="neat-section-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M2 12h20"/>
            </svg>
          </span>
          <h3 className="neat-section-title">NEAT (Steps & Quick Survey)</h3>
        </div>

        <div className="neat-form-grid">
          <div className="activity-field">
            <label className="activity-field-label">Steps (optional)</label>
            <input 
              type="number" 
              className="activity-input" 
              value={steps ?? ''} 
              onChange={(e) => setSteps(e.target.value)} 
              placeholder="e.g. 8000"
            />
          </div>

          <div className="activity-field">
            <label className="activity-field-label">Subjective Activity (0-100)</label>
            <div className="activity-range-wrapper">
              <input 
                type="range" 
                min="0" 
                max="100" 
                className="activity-range" 
                value={subjective} 
                onChange={(e) => setSubjective(Number(e.target.value))} 
              />
              <span className="activity-range-value">{subjective}%</span>
            </div>
          </div>

          <div className="activity-field">
            <label className="activity-field-label">Hours Standing (approx)</label>
            <select 
              className="activity-select" 
              value={standingHours} 
              onChange={(e) => setStandingHours(e.target.value)}
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2-5</option>
              <option value={5}>5+</option>
            </select>
          </div>

          <div className="activity-field">
            <label className="activity-field-label">Active Commute</label>
            <div className="neat-checkbox-field">
              <input 
                type="checkbox" 
                className="neat-checkbox" 
                id="activeCommute"
                checked={activeCommute} 
                onChange={(e) => setActiveCommute(e.target.checked)} 
              />
              <label className="neat-checkbox-label" htmlFor="activeCommute">Yes, I commute actively</label>
            </div>
          </div>
        </div>

        <div className="neat-save-row">
          <button className="activity-btn activity-btn-primary" onClick={saveStepsSurvey}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/>
            </svg>
            Save Steps & Survey
          </button>
        </div>
      </div>

      <hr className="activity-divider" />

      {/* Totals Preview */}
      <div className="totals-section">
        <div className="totals-header">
          <span className="totals-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </span>
          <h3 className="totals-title">Totals Preview</h3>
        </div>

        <div className="totals-grid">
          <div className="totals-stat">
            <span className="totals-stat-label">Total Net EAT</span>
            <span className="totals-stat-value">
              {eatTotals.totalNet}
              <span className="totals-stat-unit">kcal</span>
            </span>
          </div>
          <div className="totals-stat">
            <span className="totals-stat-label">NEAT</span>
            <span className="totals-stat-value">
              {neatPreview}
              <span className="totals-stat-unit">kcal</span>
            </span>
          </div>
          <div className="totals-stat">
            <span className="totals-stat-label">Advanced AF</span>
            <span className="totals-stat-value">
              {advAFPreview.afAdvanced?.toFixed(3) ?? '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="activity-footer">
        <button className="activity-btn activity-btn-success" onClick={saveActivities}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/>
          </svg>
          Save Activities & Compute AF
        </button>
        <button 
          className="activity-btn activity-btn-ghost" 
          onClick={() => { setActivities([]); dispatch({ type: 'UPDATE_DAY_ACTIVITIES', payload: { date, activities: [] } }); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Clear Activities
        </button>
      </div>
    </div>
  );
}