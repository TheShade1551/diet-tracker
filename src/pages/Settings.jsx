// src/pages/Settings.jsx
import React, { useState } from "react";
import { useProfile, useAppState } from "../context/AppStateContext";
import {
  Save,
  Download,
  Upload,
  AlertTriangle,
  User,
  Activity,
  Database,
  CheckCircle,
  XCircle,
} from "lucide-react";

import "../styles/Settings.css";

// --- DATA HELPERS ---

const CURRENT_APP_VERSION = "1.0";
const APP_STATE_KEY = "diet-tracker-app-state-v1";

const downloadJsonFile = (data, filename) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ✅ Sanitize function for backward compatibility
const sanitizeImportedState = (state) => {
  // 1. Ensure Profile Exists
  state.profile = state.profile || {};

  // Fix Missing BMR
  if (!("bmr" in state.profile) || state.profile.bmr === undefined) {
    state.profile.bmr = null;
  }

  // ✅ Fix Missing Calorie Target
  if (
    !("dailyCalorieTarget" in state.profile) ||
    state.profile.dailyCalorieTarget === undefined
  ) {
    const defaultBMR = Number(state.profile.bmr || 0);
    const defaultAF = Number(state.profile.defaultActivityFactor || 1.2);
    const defaultTDEE = Math.round(defaultBMR * defaultAF);

    state.profile.dailyCalorieTarget =
      state.profile.dailyKcalTarget !== undefined
        ? state.profile.dailyKcalTarget - defaultTDEE
        : 0;

    if (state.profile.dailyKcalTarget) delete state.profile.dailyKcalTarget;
  }

  // 2. Standardize Day Logs
  const logs = state.dayLogs || state.days || {};
  state.dayLogs = logs;
  if (state.days) delete state.days;

  const defaultAF = Number(state.profile.defaultActivityFactor) || 1.2;
  const profileBmr = state.profile.bmr ?? null;

  Object.keys(state.dayLogs).forEach((date) => {
    const d = state.dayLogs[date];
    if (!d) return;

    if (!("workoutCalories" in d)) {
      d.workoutCalories = d.workoutKcal ? Number(d.workoutKcal) : 0;
    }

    if (!("intensityFactor" in d)) {
      d.intensityFactor = null;
    }

    if (!("activityFactor" in d)) {
      d.activityFactor = defaultAF;
    }
    
    // ✅ NEW: Backfill bmrSnapshot if missing during import
    if (!("bmrSnapshot" in d)) {
      d.bmrSnapshot = profileBmr;
    }
  });

  return state;
};

const validateImportData = (data) => {
  if (!data || typeof data !== "object") {
    return { valid: false, message: "File is empty or corrupted." };
  }
  if (!data.meta || !data.state) {
    return { valid: false, message: "Invalid file structure." };
  }
  if (data.meta.app !== "diet-tracker") {
    return { valid: false, message: "File is not a valid Diet Tracker backup." };
  }

  if (data.meta.version !== CURRENT_APP_VERSION) {
    console.warn(
      `Version mismatch: Imported V${data.meta.version}, app V${CURRENT_APP_VERSION}.`
    );
  }

  const logs = data.state.dayLogs || data.state.days || {};
  const summary = {
    version: data.meta.version,
    exportedAt: data.meta.exportedAt
      ? new Date(data.meta.exportedAt).toLocaleString()
      : "N/A",
    foodItemsCount: data.state.foodItems ? data.state.foodItems.length : 0,
    dayLogsCount: Object.keys(logs).length,
  };

  return { valid: true, summary, state: data.state, version: data.meta.version };
};

export default function Settings() {
  const { state, dispatch } = useAppState();
  const { profile, saveProfile } = useProfile();

  const [form, setForm] = useState({
    name: profile.name || "",
    heightCm: profile.heightCm ?? "",
    weightKg: profile.weightKg ?? "",
    sex: profile.sex || "male",
    bmr: profile.bmr ?? "",
    defaultActivityPreset: profile.defaultActivityPreset || "sedentary",
    defaultActivityFactor: profile.defaultActivityFactor ?? 1.2,
    proteinTarget: profile.proteinTarget ?? "",
    dailyCalorieTarget: profile.dailyCalorieTarget ?? 0,
  });

  const [feedback, setFeedback] = useState(null);
  const [importData, setImportData] = useState(null);
  const [importError, setImportError] = useState(null);

  // --- Derived previews ---
  const currentBmr = Number(form.bmr) || 0;
  const currentAf = Number(form.defaultActivityFactor) || 1.2;
  const previewTDEE = Math.round(currentBmr * currentAf);
  const previewDailyTarget =
    previewTDEE + (Number(form.dailyCalorieTarget) || 0);

  // --- Handlers ---

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === "defaultActivityPreset") {
        let newFactor = 1.2;
        if (value === "sedentary") newFactor = 1.2;
        if (value === "light") newFactor = 1.375;
        if (value === "moderate") newFactor = 1.55;
        if (value === "college") newFactor = 1.725;
        if (value !== "custom") next.defaultActivityFactor = newFactor;
      }

      return next;
    });
    setFeedback(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const toNumberOrEmpty = (v) =>
      v === "" ? "" : Number.isNaN(Number(v)) ? "" : Number(v);

    const calorieTarget = Number.isNaN(Number(form.dailyCalorieTarget))
      ? 0
      : Number(form.dailyCalorieTarget);

    const calculatedTDEE = Math.round(
      Number(form.bmr || 0) * (Number(form.defaultActivityFactor) || 1.2)
    );

    saveProfile({
      ...form,
      heightCm: toNumberOrEmpty(form.heightCm),
      weightKg: toNumberOrEmpty(form.weightKg),
      bmr: toNumberOrEmpty(form.bmr),
      defaultActivityFactor: Number(form.defaultActivityFactor) || 1.2,
      proteinTarget: toNumberOrEmpty(form.proteinTarget),
      dailyCalorieTarget: calorieTarget,
      // Legacy support
      dailyKcalTarget: calculatedTDEE + calorieTarget,
    });

    setFeedback({
      type: "success",
      message: "Profile settings saved successfully.",
    });
  };

  const handleExport = (isPreImportBackup = false) => {
    const data = {
      meta: {
        version: CURRENT_APP_VERSION,
        app: "diet-tracker",
        exportedAt: new Date().toISOString(),
      },
      state: state,
    };

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 15);
    const filename = `diet-tracker-${
      isPreImportBackup ? "backup" : "export"
    }-${timestamp}.json`;

    try {
      downloadJsonFile(data, filename);
      if (!isPreImportBackup) {
        setFeedback({
          type: "success",
          message: `Data exported as ${filename}`,
        });
      }
      return { success: true, filename };
    } catch (error) {
      console.error("Export failed:", error);
      setFeedback({
        type: "error",
        message: "Export failed. Please try again.",
      });
      return { success: false, error };
    }
  };

  const handleFileChange = (event) => {
    setImportData(null);
    setImportError(null);
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rawData = JSON.parse(e.target.result);
        const result = validateImportData(rawData);
        if (result.valid) setImportData(result);
        else setImportError(result.message);
      } catch (error) {
        setImportError("Invalid JSON file.");
      }
      event.target.value = null;
    };
    reader.readAsText(file);
  };

  const performImport = (doBackup) => {
    if (!importData) return;

    if (doBackup) {
      const backup = handleExport(true);
      if (!backup.success) {
        setFeedback({
          type: "error",
          message: "Backup failed. Import cancelled.",
        });
        return;
      }
    }

    try {
      const cleanState = sanitizeImportedState(importData.state);
      dispatch({ type: "IMPORT_STATE", payload: cleanState });
      setImportData(null);
      setFeedback({
        type: "success",
        message: `Import successful (v${importData.version})`,
      });
    } catch (e) {
      console.error(e);
      setFeedback({
        type: "error",
        message: "Import failed due to an internal error.",
      });
    }
  };

  const handleCancelImport = () => {
    setImportData(null);
    setImportError(null);
  };

  // ✅ Hard reset: clear app state & reload
  const handleHardReset = () => {
    const sure = window.confirm(
      "This will delete ALL your Diet Tracker data on this device (profile, foods, logs). This cannot be undone. Continue?"
    );
    if (!sure) return;

    try {
      window.localStorage.removeItem(APP_STATE_KEY);
      window.location.reload();
    } catch (e) {
      console.error(e);
      setFeedback({
        type: "error",
        message:
          "Reset failed. You can also clear browser storage for this site manually.",
      });
    }
  };

  // --- RENDER ---

  return (
    <div className="page settings-page">
      {/* Header */}
      <header className="settings-header">
        <h1 className="settings-title">
          <User size={20} className="settings-title-icon" />
          <span>Settings</span>
        </h1>

        <div className="settings-header-pill">
          Local profile v{CURRENT_APP_VERSION}
        </div>
      </header>

      {/* Feedback */}
      {feedback && (
        <div
          className={`settings-feedback settings-feedback-${feedback.type}`}
        >
          <div className="settings-feedback-icon">
            {feedback.type === "success" ? (
              <CheckCircle size={18} />
            ) : (
              <XCircle size={18} />
            )}
          </div>
          <div className="settings-feedback-text">{feedback.message}</div>
        </div>
      )}

      {/* Main grid */}
      <div className="settings-grid">
        {/* LEFT: Profile & Targets */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title-row">
              <span className="settings-card-icon">
                <User size={18} />
              </span>
              <div>
                <h2 className="settings-card-title">Profile & Targets</h2>
                <p className="settings-card-subtitle">
                  Your personal info, BMR, and calorie goals.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="settings-form">
            {/* Personal info */}
            <div className="settings-section">
              <div className="settings-section-title">Personal</div>
              <div className="settings-fields">
                <div className="settings-field">
                  <label htmlFor="name">Name</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Optional, for motivation"
                  />
                </div>

                <div className="settings-field-row">
                  <div className="settings-field">
                    <label htmlFor="sex">Sex</label>
                    <select
                      id="sex"
                      name="sex"
                      value={form.sex}
                      onChange={handleChange}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="settings-field">
                    <label htmlFor="heightCm">Height (cm)</label>
                    <input
                      id="heightCm"
                      name="heightCm"
                      type="number"
                      inputMode="decimal"
                      value={form.heightCm}
                      onChange={handleChange}
                      placeholder="170"
                    />
                  </div>

                  <div className="settings-field">
                    <label htmlFor="weightKg">Current Weight (kg)</label>
                    <input
                      id="weightKg"
                      name="weightKg"
                      type="number"
                      inputMode="decimal"
                      value={form.weightKg}
                      onChange={handleChange}
                      placeholder="70"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Metabolism & goals */}
            <div className="settings-section">
              <div className="settings-section-title">Metabolism & Goals</div>
              <div className="settings-fields">
                <div className="settings-field">
                  <label htmlFor="bmr">Base BMR (kcal)</label>
                  <input
                    id="bmr"
                    name="bmr"
                    type="number"
                    inputMode="decimal"
                    value={form.bmr}
                    onChange={handleChange}
                    placeholder="e.g. 1600"
                  />
                  <p className="settings-help">
                    Calories burned at rest. If you don't know it, use a
                    BMR calculator online.
                  </p>
                </div>

                <div className="settings-field-row">
                  <div className="settings-field">
                    <label htmlFor="proteinTarget">Protein Target (g)</label>
                    <input
                      id="proteinTarget"
                      name="proteinTarget"
                      type="number"
                      inputMode="decimal"
                      value={form.proteinTarget}
                      onChange={handleChange}
                      placeholder="e.g. 120"
                    />
                  </div>

                  <div className="settings-field">
                    <label htmlFor="defaultActivityPreset">
                      Activity Level
                    </label>
                    <select
                      id="defaultActivityPreset"
                      name="defaultActivityPreset"
                      value={form.defaultActivityPreset}
                      onChange={handleChange}
                    >
                      <option value="sedentary">Sedentary (1.2)</option>
                      <option value="light">Lightly Active (1.375)</option>
                      <option value="moderate">Moderately Active (1.55)</option>
                      <option value="college">Very Active (1.725)</option>
                      <option value="custom">Custom factor</option>
                    </select>
                  </div>

                  <div className="settings-field">
                    <label htmlFor="defaultActivityFactor">
                      Factor Multiplier
                    </label>
                    <input
                      id="defaultActivityFactor"
                      name="defaultActivityFactor"
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={form.defaultActivityFactor}
                      onChange={handleChange}
                      disabled={form.defaultActivityPreset !== "custom"}
                    />
                    <p className="settings-help">
                      Auto-set from activity level unless you choose "
                      custom".
                    </p>
                  </div>
                </div>

                <div className="settings-field">
                  <label htmlFor="dailyCalorieTarget">
                    Calorie Deficit / Surplus Target (kcal)
                  </label>
                  <input
                    id="dailyCalorieTarget"
                    name="dailyCalorieTarget"
                    type="number"
                    inputMode="decimal"
                    value={form.dailyCalorieTarget}
                    onChange={handleChange}
                    placeholder="-500 for fat loss, +200 for slow gain"
                  />
                  <p className="settings-help">
                    Example: -500 sets your goal to TDEE minus 500 kcal.
                  </p>
                </div>
              </div>
            </div>

            {/* Preview row */}
            <div className="settings-preview-row">
              <div className="settings-preview-card">
                <div className="settings-preview-label">
                  Estimated TDEE (Maintenance)
                </div>
                <div className="settings-preview-sub">
                  Base BMR × Activity Factor
                </div>
                <div className="settings-preview-value">
                  {Number.isFinite(previewTDEE) ? previewTDEE : "--"} kcal
                </div>
              </div>

              <div className="settings-preview-card">
                <div className="settings-preview-label">
                  Total Daily Calorie Goal
                </div>
                <div className="settings-preview-sub">
                  TDEE + Deficit / Surplus
                </div>
                <div className="settings-preview-value">
                  {Number.isFinite(previewDailyTarget)
                    ? previewDailyTarget
                    : "--"}{" "}
                  kcal
                </div>
              </div>
            </div>

            <div className="settings-actions">
              <button type="submit" className="btn-primary settings-btn-save">
                <Save size={16} />
                Save Profile
              </button>
            </div>
          </form>
        </section>

        {/* RIGHT: Data management + reset */}
        <section className="settings-card settings-card-right">
          <div className="settings-card-header">
            <div className="settings-card-title-row">
              <span className="settings-card-icon">
                <Database size={18} />
              </span>
              <div>
                <h2 className="settings-card-title">Data & Backup</h2>
                <p className="settings-card-subtitle">
                  Export, import, or reset your local data.
                </p>
              </div>
            </div>
          </div>

          <div className="settings-fields">
            {/* Export */}
            <div className="settings-block">
              <div className="settings-block-header">
                <span className="settings-block-title">
                  <Download size={16} />
                  Export Data
                </span>
                <span className="settings-badge">Recommended monthly</span>
              </div>
              <p className="settings-help">
                Downloads your profile, food items, and day logs as a JSON file.
              </p>
              <button
                type="button"
                className="btn-primary btn-export"
                onClick={() => handleExport(false)}
              >
                Export JSON
              </button>
            </div>

            {/* Import */}
            <div className="settings-block">
              <div className="settings-block-header">
                <span className="settings-block-title">
                  <Upload size={16} />
                  Import Data
                </span>
              </div>
              <p className="settings-help">
                Restore a previous backup. You can optionally create a backup
                before importing.
              </p>

              {importError && (
                <div className="settings-import-error">
                  <XCircle size={14} />
                  <span>{importError}</span>
                </div>
              )}

              <label className="btn-secondary btn-import">
                <Upload size={14} />
                Select JSON File
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            {/* Danger Zone / Reset */}
            <div className="settings-block settings-danger-card">
              <div className="settings-block-header">
                <span className="settings-block-title">
                  <AlertTriangle size={16} />
                  Danger Zone
                </span>
              </div>
              <p className="settings-help">
                Reset the app back to a fresh state on this device. This removes
                all local logs, foods, and profile data.
              </p>
              <button
                type="button"
                className="settings-btn-danger"
                onClick={handleHardReset}
              >
                Reset all data on this device
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Import confirmation modal */}
      {importData && (
        <div
          className="settings-modal-backdrop"
          onClick={handleCancelImport}
        >
          <div
            className="settings-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-modal-header">
              <h2>Confirm Import</h2>
            </div>

            <div className="settings-modal-body">
              {importData.version !== CURRENT_APP_VERSION && (
                <div className="settings-import-warning">
                  <AlertTriangle size={16} />
                  <span>
                    Version mismatch: file is v{importData.version}, app is v
                    {CURRENT_APP_VERSION}. Import is still allowed.
                  </span>
                </div>
              )}

              <ul className="settings-modal-list">
                <li>
                  <strong>Exported:</strong> {importData.summary.exportedAt}
                </li>
                <li>
                  <strong>Foods:</strong> {importData.summary.foodItemsCount}{" "}
                  items
                </li>
                <li>
                  <strong>History:</strong> {importData.summary.dayLogsCount}{" "}
                  days logged
                </li>
              </ul>

              <p className="settings-help">
                Choose whether to create a backup of your current data before
                replacing it.
              </p>
            </div>

            <div className="settings-modal-actions">
              <button
                type="button"
                className="btn-primary btn-modal-blue"
                onClick={() => performImport(true)}
              >
                <Download size={14} />
                Backup &amp; Import (Recommended)
              </button>
              <button
                type="button"
                className="btn-modal-red"
                onClick={() => performImport(false)}
              >
                <AlertTriangle size={14} />
                Overwrite (No Backup)
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancelImport}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}