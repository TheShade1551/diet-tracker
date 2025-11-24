// src/pages/Settings.jsx
import React, { useState } from "react";
import { useProfile } from "../context/AppStateContext";

export default function Settings() {
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
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

    // simple feedback for now
    alert("Profile saved!");
  };

  return (
    <div>
      <h1>Settings</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Name:{" "}
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
            />
          </label>
        </div>

        <div>
          <label>
            Height (cm):{" "}
            <input
              name="heightCm"
              value={form.heightCm}
              onChange={handleChange}
            />
          </label>
        </div>

        <div>
          <label>
            Current Weight (kg):{" "}
            <input
              name="weightKg"
              value={form.weightKg}
              onChange={handleChange}
            />
          </label>
        </div>

        <div>
          <label>
            Sex:{" "}
            <select
              name="sex"
              value={form.sex}
              onChange={handleChange}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other / Prefer not to say</option>
            </select>
          </label>
        </div>

        <div>
          <label>
            Daily Calorie Target (kcal):{" "}
            <input
              name="dailyKcalTarget"
              value={form.dailyKcalTarget}
              onChange={handleChange}
            />
          </label>
        </div>

        <div>
          <label>
            Default Activity Preset:{" "}
            <select
              name="defaultActivityPreset"
              value={form.defaultActivityPreset}
              onChange={handleChange}
            >
              <option value="sedentary">Sedentary</option>
              <option value="college">College / Mixed</option>
              <option value="custom">Custom</option>
            </select>
          </label>
        </div>

        <div>
          <label>
            Default Activity Factor:{" "}
            <input
              name="defaultActivityFactor"
              value={form.defaultActivityFactor}
              onChange={handleChange}
            />
          </label>
        </div>

        <div>
          <label>
            Protein Target (g, optional):{" "}
            <input
              name="proteinTarget"
              value={form.proteinTarget}
              onChange={handleChange}
            />
          </label>
        </div>

        <button type="submit">Save profile</button>
      </form>
    </div>
  );
}