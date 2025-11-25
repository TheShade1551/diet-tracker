import React, { useState } from "react";
import { useProfile, useAppState } from "../context/AppStateContext.jsx"; // FIXED: Added .jsx extension

// Utility function to trigger a file download with JSON data
const downloadJsonFile = (data, filename) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Create a temporary link element to trigger the download
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // Clean up the URL object
  URL.revokeObjectURL(url);
};

// --- DATA VALIDATION / SUMMARY HELPERS ---

// Hardcoded current version for validation
const CURRENT_APP_VERSION = "1.0"; 

const validateImportData = (data) => {
  if (!data || typeof data !== 'object') {
    return { valid: false, message: "File is empty or corrupted." };
  }
  if (!data.meta || !data.state) {
    return { valid: false, message: "Invalid file structure. Missing 'meta' or 'state' properties." };
  }
  if (data.meta.app !== "diet-tracker") {
    return { valid: false, message: "File is not a valid Diet Tracker backup." };
  }

  // Version check (soft warning)
  if (data.meta.version !== CURRENT_APP_VERSION) {
    console.warn(`Version mismatch: Imported data is V${data.meta.version}, app is V${CURRENT_APP_VERSION}. Attempting import.`);
  }

  // Generate summary for preview
  const summary = {
    version: data.meta.version,
    exportedAt: data.meta.exportedAt ? new Date(data.meta.exportedAt).toLocaleString() : 'N/A',
    foodItemsCount: data.state.foodItems ? data.state.foodItems.length : 0,
    dayLogsCount: data.state.dayLogs ? Object.keys(data.state.dayLogs).length : 0,
  };
  
  return { valid: true, summary, state: data.state, version: data.meta.version };
};


export default function Settings() {
  const { state, dispatch } = useAppState(); // Get the entire app state and dispatch
  const { profile, saveProfile } = useProfile();

  const [form, setForm] = useState({
    name: profile.name || "",
    heightCm: profile.heightCm ?? "",
    weightKg: profile.weightKg ?? "",
    sex: profile.sex || "male",
    dailyKcalTarget: profile.dailyKcalTarget ?? 2200,
    defaultActivityPreset: profile.defaultActivityPreset || "sedentary",
    defaultActivityFactor: profile.defaultActivityFactor ?? 1.2,
    proteinTarget: profile.proteinTarget ?? "",
  });
  
  // State for simple in-page feedback messages
  const [feedback, setFeedback] = useState(null);
  // State for imported data (triggers the preview modal)
  const [importData, setImportData] = useState(null);
  const [importError, setImportError] = useState(null);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setFeedback(null); // Clear feedback on input change
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const toNumberOrEmpty = (v) =>
      v === "" ? "" : Number.isNaN(Number(v)) ? "" : Number(v);

    saveProfile({
      ...form,
      heightCm: toNumberOrEmpty(form.heightCm),
      weightKg: toNumberOrEmpty(form.weightKg),
      dailyKcalTarget:
        toNumberOrEmpty(form.dailyKcalTarget) || 2200,
      defaultActivityFactor:
        Number(form.defaultActivityFactor) || 1.2,
      proteinTarget: toNumberOrEmpty(form.proteinTarget),
    });

    setFeedback({ type: 'success', message: 'Profile settings saved successfully!' });
  };
  
  const handleExport = (isPreImportBackup = false) => {
    // 1. Build the full data structure including metadata
    const data = {
      meta: {
        version: CURRENT_APP_VERSION,
        app: "diet-tracker",
        exportedAt: new Date().toISOString(),
      },
      state: state, // Export the full state from AppStateContext
    };

    // 2. Generate the dated filename
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    
    let filename;
    if (isPreImportBackup) {
      filename = `diet-tracker-backup-before-import-${yyyy}${mm}${dd}-${hh}${min}.json`;
    } else {
      filename = `diet-tracker-backup-${yyyy}${mm}${dd}-${hh}${min}.json`;
    }

    // 3. Trigger the download
    try {
      downloadJsonFile(data, filename);
      if (!isPreImportBackup) {
        setFeedback({ type: 'success', message: `Data successfully exported as ${filename}` });
      }
      return { success: true, filename };
    } catch (error) {
       console.error("Export failed:", error);
       if (!isPreImportBackup) {
         setFeedback({ type: 'error', message: 'Failed to export data. Check console for details.' });
       }
       return { success: false, error };
    }
  };
  
  // --- IMPORT HANDLERS ---
  
  const handleFileChange = (event) => {
    setImportData(null);
    setImportError(null);
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rawData = JSON.parse(e.target.result);
        const validationResult = validateImportData(rawData);
        
        if (validationResult.valid) {
          setImportData(validationResult);
        } else {
          setImportError(validationResult.message);
          event.target.value = null; // Clear file input
        }
      } catch (error) {
        setImportError("Error parsing JSON file. Please ensure it is valid.");
        console.error("JSON Parse Error:", error);
        event.target.value = null; // Clear file input
      }
    };
    reader.readAsText(file);
  };
  
  const performImport = (doBackup) => {
    if (!importData) return;
    
    // 1. (Optional) Perform Automatic Backup
    if (doBackup) {
      const backupResult = handleExport(true); // true means it's a pre-import backup
      if (!backupResult.success) {
        setFeedback({ type: 'error', message: `Backup failed (${backupResult.filename}). Import canceled.` });
        setImportData(null); // Close modal
        return;
      }
      setFeedback({ type: 'success', message: `Current state backed up as ${backupResult.filename}` });
    }

    // 2. Dispatch IMPORT_STATE action to replace the app state
    try {
        dispatch({ type: "IMPORT_STATE", payload: importData.state });
        
        // 3. Cleanup and Notification
        setImportData(null);
        setFeedback({ 
            type: 'success', 
            message: `Data import successful! App state replaced with V${importData.version} data.` 
        });
        // Clear file input manually
        document.getElementById('import-file-input').value = null;
    } catch (e) {
        setFeedback({ type: 'error', message: 'An internal error occurred during state replacement.' });
        console.error("State replacement failed:", e);
    }
  };
  
  const handleCancelImport = () => {
    setImportData(null);
    setImportError(null);
    // Clear file input manually
    document.getElementById('import-file-input').value = null;
  };

  const isVersionMismatch = importData?.version !== CURRENT_APP_VERSION;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Profile Settings</h1>
        <p className="page-subtitle">
          Manage your personal details and calorie/macro goals.
        </p>
      </div>

      <hr />
      
      {/* Feedback Message Box */}
      {feedback && (
        <div 
          className={`p-3 mb-4 rounded-lg text-sm transition-opacity duration-300 ${
            feedback.type === 'success' 
              ? 'bg-green-100 text-green-800 border border-green-300' 
              : 'bg-red-100 text-red-800 border border-red-300'
          }`}
          role="alert"
        >
          {feedback.message}
        </div>
      )}


      {/* 2. Settings Form Card (Profile) */}
      <section className="section-spacer mb-6">
        <div className="card bg-white p-6 rounded-xl shadow-lg">
          <form onSubmit={handleSubmit} className="settings-form space-y-4">
            {/* ... (Profile fields remain the same) ... */}
            <h2 className="section-title text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="form-group md:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-600">Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  className="input-full mt-1 block w-full border border-gray-300 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="form-group">
                <label htmlFor="sex" className="block text-sm font-medium text-gray-600">Sex</label>
                <select
                  id="sex"
                  name="sex"
                  value={form.sex}
                  onChange={handleChange}
                  className="input-full mt-1 block w-full border border-gray-300 rounded-lg p-2 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label htmlFor="heightCm" className="block text-sm font-medium text-gray-600">Height (cm)</label>
                <input
                  id="heightCm"
                  name="heightCm"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.heightCm}
                  onChange={handleChange}
                  className="input-full mt-1 block w-full border border-gray-300 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="form-group">
                <label htmlFor="weightKg" className="block text-sm font-medium text-gray-600">Current Weight (kg)</label>
                <input
                  id="weightKg"
                  name="weightKg"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.weightKg}
                  onChange={handleChange}
                  className="input-full mt-1 block w-full border border-gray-300 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <hr className="form-divider my-6 border-t border-gray-200" />

            <h2 className="section-title text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Daily Goals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label htmlFor="dailyKcalTarget" className="block text-sm font-medium text-gray-600">Daily Calorie Target (kcal)</label>
                <input
                  id="dailyKcalTarget"
                  name="dailyKcalTarget"
                  type="number"
                  min="1"
                  step="1"
                  value={form.dailyKcalTarget}
                  onChange={handleChange}
                  className="input-full mt-1 block w-full border border-gray-300 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="form-group">
                <label htmlFor="proteinTarget" className="block text-sm font-medium text-gray-600">Protein Target (g, optional)</label>
                <input
                  id="proteinTarget"
                  name="proteinTarget"
                  type="number"
                  min="0"
                  step="1"
                  value={form.proteinTarget}
                  onChange={handleChange}
                  className="input-full mt-1 block w-full border border-gray-300 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            
            <hr className="form-divider my-6 border-t border-gray-200" />

            <h2 className="section-title text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Activity Level</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label htmlFor="defaultActivityPreset" className="block text-sm font-medium text-gray-600">Default Activity Preset</label>
                <select
                  id="defaultActivityPreset"
                  name="defaultActivityPreset"
                  value={form.defaultActivityPreset}
                  onChange={handleChange}
                  className="input-full mt-1 block w-full border border-gray-300 rounded-lg p-2 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="sedentary">Sedentary (1.2)</option>
                  <option value="light">Lightly Active (1.375)</option>
                  <option value="moderate">Moderately Active (1.55)</option>
                  <option value="college">Very Active (1.725)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="defaultActivityFactor" className="block text-sm font-medium text-gray-600">Custom Activity Factor</label>
                <input
                  id="defaultActivityFactor"
                  name="defaultActivityFactor"
                  type="number"
                  min="1.0"
                  step="0.05"
                  value={form.defaultActivityFactor}
                  onChange={handleChange}
                  className="input-full mt-1 block w-full border border-gray-300 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={form.defaultActivityPreset !== 'custom'}
                />
                <p className="muted text-xs text-gray-500 mt-1">Used for daily TDEE calculation.</p>
              </div>
            </div>

            <div className="btn-row flex justify-end pt-4">
              <button type="submit" className="btn-primary bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out">
                Save Profile
              </button>
            </div>
          </form>
        </div>
      </section>
      
      {/* 3. Export/Import Card */}
      <section className="section-spacer">
        <div className="card bg-white p-6 rounded-xl shadow-lg">
          <h2 className="section-title text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Data Management</h2>
          
          {/* Export Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border-b pb-4 mb-4">
            <div className="mb-2 sm:mb-0">
              <h3 className="text-lg font-medium text-gray-800">Export Application Data</h3>
              <p className="text-sm text-gray-500">Download a JSON file containing all your app data for backup.</p>
            </div>
            <button 
              onClick={() => handleExport(false)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out flex items-center shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export Data (.json)
            </button>
          </div>
          
          {/* Import Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 pt-4">
            <div className="mb-2 sm:mb-0">
              <h3 className="text-lg font-medium text-gray-800">Import Application Data</h3>
              <p className="text-sm text-gray-500">Restore your app state from a previously exported JSON file.</p>
              {importError && (
                <p className="text-sm text-red-600 font-semibold mt-1">Error: {importError}</p>
              )}
            </div>
            
            <label className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out flex items-center cursor-pointer shrink-0">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 7.5l-4.5 4.5m4.5-10.5V16.5" />
               </svg>
              Select Import File
              <input
                id="import-file-input"
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </section>
      
      {/* Import Confirmation Modal */}
      {importData && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={handleCancelImport}>
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-indigo-700 mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 mr-2">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.03 2.03a.75.75 0 0 0 1.06.02L15.36 10.186Z" clipRule="evenodd" />
                </svg>
                Confirm Data Import
            </h3>
            
            {isVersionMismatch && (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-3 rounded-lg mb-4 text-sm font-medium">
                ⚠️ **Version Warning:** The imported file is version V{importData.version}, but the app is V{CURRENT_APP_VERSION}. Importing may cause unexpected behavior. Proceed with caution.
              </div>
            )}
            
            <p className="text-gray-600 mb-4">
                You are about to replace your current application data with the content of the selected file.
                <span className="font-semibold text-red-600"> This action is irreversible without a prior backup.</span>
            </p>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
                <h4 className="font-semibold text-gray-700 mb-2">File Summary:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                    <li><span className="font-medium">Export Date:</span> {importData.summary.exportedAt}</li>
                    <li><span className="font-medium">File Version:</span> V{importData.summary.version}</li>
                    <li><span className="font-medium">Food Items:</span> {importData.summary.foodItemsCount} </li>
                    <li><span className="font-medium">Day Logs:</span> {importData.summary.dayLogsCount} days</li>
                </ul>
            </div>
            
            <div className="flex flex-col space-y-3">
                <button 
                  onClick={() => performImport(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition duration-150 ease-in-out"
                >
                  Backup Current Data & Import (Recommended)
                </button>
                <button 
                  onClick={() => performImport(false)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition duration-150 ease-in-out"
                >
                  Import (Overwrite without Backup)
                </button>
                <button 
                  onClick={handleCancelImport}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-4 rounded-lg transition duration-150 ease-in-out"
                >
                  Cancel
                </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}