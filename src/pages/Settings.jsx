// src/pages/Settings.jsx
import React, { useState } from "react";
import { useProfile, useAppState } from "../context/AppStateContext";
import { 
  Save, Download, Upload, AlertTriangle, 
  User, Activity, Database, CheckCircle, XCircle 
} from "lucide-react";

import "../styles/Settings.css";

// --- DATA HELPERS ---
const CURRENT_APP_VERSION = "1.0"; 

const downloadJsonFile = (data, filename) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ✅ NEW: Sanitize function for backward compatibility
const sanitizeImportedState = (state) => {
  // 1. Ensure Profile Exists
  state.profile = state.profile || {};
  
  // Fix Missing BMR
  if (!("bmr" in state.profile) || state.profile.bmr === undefined) {
    state.profile.bmr = null; 
  }

  // 2. Standardize Day Logs
  // Support legacy backups that might have used 'days' instead of 'dayLogs'
  const logs = state.dayLogs || state.days || {};
  state.dayLogs = logs;
  
  // Remove legacy key if it existed to keep state clean
  if (state.days) delete state.days;

  const defaultAF = Number(state.profile.defaultActivityFactor) || 1.2;

  // Iterate through every day to ensure new fields exist
  Object.keys(state.dayLogs).forEach(date => {
    const d = state.dayLogs[date];
    if (!d) return;

    // Fix Workout Calories
    if (!("workoutCalories" in d)) {
        // Try to recover from legacy 'workoutKcal' if it exists, else 0
        d.workoutCalories = d.workoutKcal ? Number(d.workoutKcal) : 0;
    }

    // Fix Intensity Factor
    if (!("intensityFactor" in d)) {
        d.intensityFactor = null;
    }

    // Fix Activity Factor
    if (!("activityFactor" in d)) {
        d.activityFactor = defaultAF;
    }
  });

  return state;
};

const validateImportData = (data) => {
  if (!data || typeof data !== 'object') return { valid: false, message: "File is empty or corrupted." };
  if (!data.meta || !data.state) return { valid: false, message: "Invalid file structure." };
  if (data.meta.app !== "diet-tracker") return { valid: false, message: "File is not a valid Diet Tracker backup." };

  if (data.meta.version !== CURRENT_APP_VERSION) {
    console.warn(`Version mismatch: Imported V${data.meta.version}, app V${CURRENT_APP_VERSION}.`);
  }

  // Check if using dayLogs or days for count
  const logs = data.state.dayLogs || data.state.days || {};

  const summary = {
    version: data.meta.version,
    exportedAt: data.meta.exportedAt ? new Date(data.meta.exportedAt).toLocaleString() : 'N/A',
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
  });
  
  const [feedback, setFeedback] = useState(null);
  const [importData, setImportData] = useState(null);
  const [importError, setImportError] = useState(null);

  // Dynamic TDEE Preview
  const currentBmr = Number(form.bmr) || 0;
  const currentAf = Number(form.defaultActivityFactor) || 1.2;
  const previewTDEE = Math.round(currentBmr * currentAf);

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
    const toNumberOrEmpty = (v) => v === "" ? "" : Number.isNaN(Number(v)) ? "" : Number(v);

    saveProfile({
      ...form,
      heightCm: toNumberOrEmpty(form.heightCm),
      weightKg: toNumberOrEmpty(form.weightKg),
      bmr: toNumberOrEmpty(form.bmr),
      defaultActivityFactor: Number(form.defaultActivityFactor) || 1.2,
      proteinTarget: toNumberOrEmpty(form.proteinTarget),
      // Legacy support
      dailyKcalTarget: Math.round(Number(form.bmr || 0) * (Number(form.defaultActivityFactor) || 1.2)) || 2200
    });

    setFeedback({ type: 'success', message: 'Profile settings saved successfully!' });
  };
  
  const handleExport = (isPreImportBackup = false) => {
    const data = {
      meta: { version: CURRENT_APP_VERSION, app: "diet-tracker", exportedAt: new Date().toISOString() },
      state: state,
    };
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 15);
    const filename = `diet-tracker-${isPreImportBackup ? 'backup' : 'export'}-${timestamp}.json`;

    try {
      downloadJsonFile(data, filename);
      if (!isPreImportBackup) setFeedback({ type: 'success', message: `Data exported as ${filename}` });
      return { success: true, filename };
    } catch (error) {
       console.error("Export failed:", error);
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
    
    // 1. Backup Logic
    if (doBackup) {
      const backup = handleExport(true);
      if (!backup.success) {
        setFeedback({ type: 'error', message: "Backup failed. Import cancelled." });
        return;
      }
    }

    try {
        // 2. Sanitize Data before import
        const cleanState = sanitizeImportedState(importData.state);

        // 3. Dispatch Import
        dispatch({ type: "IMPORT_STATE", payload: cleanState });
        
        setImportData(null);
        setFeedback({ type: 'success', message: `Import successful (V${importData.version})` });
    } catch (e) {
        console.error(e);
        setFeedback({ type: 'error', message: 'Import failed due to an internal error.' });
    }
  };
  
  const handleCancelImport = () => {
    setImportData(null);
    setImportError(null);
  };

  return (
    <div className="settings-page">
      
      {/* Header */}
      <div className="settings-header">
        <h1 className="settings-title">Profile Settings</h1>
        <p className="settings-subtitle">
          Manage your personal details, BMR configuration, and data backups.
        </p>
      </div>
      
      {/* Feedback Box */}
      {feedback && (
        <div className={`feedback-box ${feedback.type === 'success' ? 'feedback-success' : 'feedback-error'}`}>
          {feedback.type === 'success' ? <CheckCircle size={20}/> : <XCircle size={20}/>}
          {feedback.message}
        </div>
      )}

      {/* 1. Profile Form */}
      <section className="settings-card">
        <form onSubmit={handleSubmit}>
          
          {/* Personal Info */}
          <div className="section-title"><User size={20}/> Personal Information</div>
          <div className="form-grid-3">
            <div className="form-group span-2">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" type="text" value={form.name} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="sex">Sex</label>
              <select id="sex" name="sex" value={form.sex} onChange={handleChange}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          
          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="heightCm">Height (cm)</label>
              <input id="heightCm" name="heightCm" type="number" min="0" step="0.1" value={form.heightCm} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="weightKg">Current Weight (kg)</label>
              <input id="weightKg" name="weightKg" type="number" min="0" step="0.1" value={form.weightKg} onChange={handleChange} />
            </div>
          </div>

          <hr className="form-divider" />

          {/* Metabolism & Goals */}
          <div className="section-title"><Activity size={20}/> Metabolism & Goals</div>
          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="bmr">Base BMR (kcal)</label>
              <input
                id="bmr" name="bmr" type="number" min="500" step="1" placeholder="e.g. 1800"
                value={form.bmr} onChange={handleChange}
              />
              <p className="muted-text">Calories burned at rest.</p>
            </div>
            <div className="form-group">
              <label htmlFor="proteinTarget">Protein Target (g)</label>
              <input id="proteinTarget" name="proteinTarget" type="number" min="0" step="1" value={form.proteinTarget} onChange={handleChange} />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="defaultActivityPreset">Activity Level</label>
              <select id="defaultActivityPreset" name="defaultActivityPreset" value={form.defaultActivityPreset} onChange={handleChange}>
                <option value="sedentary">Sedentary (1.2)</option>
                <option value="light">Lightly Active (1.375)</option>
                <option value="moderate">Moderately Active (1.55)</option>
                <option value="college">Very Active (1.725)</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="defaultActivityFactor">Factor Multiplier</label>
              <input
                id="defaultActivityFactor" name="defaultActivityFactor" type="number" min="1.0" step="0.05"
                value={form.defaultActivityFactor} onChange={handleChange}
                disabled={form.defaultActivityPreset !== 'custom'}
              />
            </div>
          </div>

          {/* Live Preview */}
          <div className="tdee-preview-box">
              <div>
                  <span className="tdee-label">Your Daily Target (TDEE)</span>
                  <span className="tdee-sub">Base BMR × Activity Factor</span>
              </div>
              <div className="tdee-value">
                  {previewTDEE} kcal
              </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="submit" className="btn-save">
              <Save size={18} /> Save Profile
            </button>
          </div>
        </form>
      </section>
      
      {/* 2. Data Management */}
      <section className="settings-card">
        <div className="section-title"><Database size={20}/> Data Management</div>
        
        {/* Export */}
        <div className="action-row">
          <div className="action-info">
            <h3>Export Data</h3>
            <p>Download a backup of your logs and foods.</p>
          </div>
          <button onClick={() => handleExport(false)} className="btn-export">
            <Download size={18}/> Export JSON
          </button>
        </div>
        
        {/* Import */}
        <div className="action-row">
          <div className="action-info">
            <h3>Import Data</h3>
            <p>Restore from a backup file.</p>
            {importError && (<p style={{color:'#e53e3e', fontWeight:600, marginTop:'0.25rem'}}>Error: {importError}</p>)}
          </div>
          <label className="btn-import-label">
            <Upload size={18}/> Select File
            <input id="import-file-input" type="file" accept=".json" onChange={handleFileChange} style={{display:'none'}} />
          </label>
        </div>
      </section>
      
      {/* Import Modal */}
      {importData && (
        <div className="modal-overlay" onClick={handleCancelImport}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
                <AlertTriangle size={24} color="#2b6cb0"/> Confirm Import
            </div>
            
            {importData.version !== CURRENT_APP_VERSION && (
              <div className="modal-warning">
                ⚠️ Version Mismatch: File is V{importData.version}, App is V{CURRENT_APP_VERSION}.
              </div>
            )}
            
            <div className="modal-summary">
                <ul style={{listStyle:'none', padding:0, margin:0}}>
                    <li><strong>Exported:</strong> {importData.summary.exportedAt}</li>
                    <li><strong>Foods:</strong> {importData.summary.foodItemsCount} items</li>
                    <li><strong>History:</strong> {importData.summary.dayLogsCount} days logged</li>
                </ul>
            </div>
            
            <div className="modal-actions">
                <button onClick={() => performImport(true)} className="btn-modal btn-modal-blue">
                    Backup & Import (Recommended)
                </button>
                <button onClick={() => performImport(false)} className="btn-modal btn-modal-red">
                    Overwrite (No Backup)
                </button>
                <button onClick={handleCancelImport} className="btn-modal btn-modal-gray">
                    Cancel
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}