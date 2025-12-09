// calculations.js
// Advanced TDEE & Activity utilities for Diet Tracker
// Pure functions: compute EAT (net), NEAT, Advanced AF, TEF, and TDEE
// Default constants are tuned but can be exposed in Settings for calibration.

// --- Helpers ---------------------------------------------------------------
function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
function round(x) {
  return Math.round(x);
}

// --- Compatibility helpers (Restored for UI compatibility) -----------------

// Converts a Date or date-like value into the YYYY-MM-DD key used by the app.
export function dateToKey(d) {
  try {
    if (!d) return new Date().toISOString().slice(0, 10);
    const dt = (d instanceof Date) ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return new Date().toISOString().slice(0, 10);
    return dt.toISOString().slice(0, 10);
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}

// Format numeric value with optional decimals; returns '-' for null/undefined
export function fmtNum(value, decimals = 0) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// UI helper: show formatted number or '-' (keeps previous signature used in UI)
export function formatIF(value, decimals = 0) {
  return fmtNum(value, decimals);
}

// --- Constants (tuneable) -------------------------------------------------
export const WALK_KCAL_PER_KG_PER_KM = 0.78; // kcal per kg per km (walking)
export const RUN_KCAL_PER_KG_PER_KM = 1.00;  // kcal per kg per km (running/jogging)

// Standard activity factor presets (include TEF usually). We'll expose AF_noTEF = AF_standard * 0.9
export const AF_STANDARD = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};
export const AF_NO_TEF = Object.fromEntries(
  Object.entries(AF_STANDARD).map(([k, v]) => [k, Number((v * 0.9).toFixed(3))])
);

// step-to-kcal constant base (per kg scaling)
// stepKcalPerStep = STEP_KCAL_CONST * weight_kg  ==> ~0.04 kcal/step at 70kg
export const STEP_KCAL_CONST = 0.00057;

// TEF ratio default (10%)
export const DEFAULT_TEF_RATIO = 0.10;

// --- BMR share -------------------------------------------------------------
/**
 * Amount of BMR burned during an activity of duration `duration_min`.
 * @param {number} bmr - daily BMR in kcal/day
 * @param {number} duration_min - minutes of activity
 * @returns {number} kcal of BMR attributable to that duration
 */
export function bmrShareDuring(bmr, duration_min) {
  const B = toNum(bmr, 0);
  const d = toNum(duration_min, 0);
  return (B * (d / 1440)); // 1440 minutes/day
}

// --- Distance-based gross kcal ------------------------------------------------
/**
 * gross walk kcal from distance (km)
 * gross_kcal_walk = distance_km * weight_kg * WALK_KCAL_PER_KG_PER_KM
 */
export function grossKcalWalkFromDistance({ distance_km, weight_kg }) {
  const d = toNum(distance_km, 0);
  const w = toNum(weight_kg, 70);
  return d * w * WALK_KCAL_PER_KG_PER_KM;
}

/**
 * gross jog/run kcal from distance (km)
 * gross_kcal_run = distance_km * weight_kg * RUN_KCAL_PER_KG_PER_KM
 */
export function grossKcalJogFromDistance({ distance_km, weight_kg }) {
  const d = toNum(distance_km, 0);
  const w = toNum(weight_kg, 70);
  return d * w * RUN_KCAL_PER_KG_PER_KM;
}

// --- Estimate distance from duration+intensity (if ever needed) -----------
// Provide a fallback if you ever want to estimate distance from duration & intensity.
// For the current plan, activities without distance will be treated as NEAT-only.
export const SPEED_RANGES = {
  walk: { base: 3.0, max: 6.0 },  // km/h
  jog:  { base: 6.0, max: 10.0 }, // km/h
};

export function estimateDistanceFromDurationAndIntensity({ activityType = 'walk', duration_min = 0, intensity = 50 }) {
  const t = (activityType || 'walk').toLowerCase();
  const range = SPEED_RANGES[t] || SPEED_RANGES['walk'];
  const s = clamp01(toNum(intensity, 50) / 100);
  const speed_kmh = range.base + s * (range.max - range.base);
  const hours = toNum(duration_min, 0) / 60.0;
  return speed_kmh * hours; // distance_km
}

// --- Net EAT (gross - BMR share) ------------------------------------------
function netFromGrossAndBmr(gross_kcal, bmr, duration_min) {
  const gross = toNum(gross_kcal, 0);
  const bshare = bmrShareDuring(bmr, duration_min);
  const val = gross - bshare;
  return Math.max(0, round(val));
}

// --- Activity-specific calculators -----------------------------------------
/**
 * Compute EAT for a walk activity entry.
 * activity: { duration_min, distance_km?, intensity? }
 * profile: { weight_kg, bmr }
 * Returns { gross, net, bmr_share }
 */
export function computeEAT_walk(activity = {}, profile = {}) {
  const duration_min = toNum(activity.duration_min, 0);
  const weight_kg = toNum(profile.weight_kg, profile.weight || 70);
  const bmr = toNum(profile.bmr, 0);

  let gross = 0;
  if (activity.distance_km != null) {
    gross = grossKcalWalkFromDistance({ distance_km: activity.distance_km, weight_kg });
  } else {
    // default fallback (not preferred): estimate distance from duration & intensity
    const distance = estimateDistanceFromDurationAndIntensity({ activityType: 'walk', duration_min, intensity: activity.intensity });
    gross = grossKcalWalkFromDistance({ distance_km: distance, weight_kg });
  }

  const bshare = bmrShareDuring(bmr, duration_min);
  const net = netFromGrossAndBmr(gross, bmr, duration_min);
  return { gross: round(gross), net, bmr_share: round(bshare) };
}

/**
 * Compute EAT for a jog activity entry.
 * Returns { gross, net, bmr_share }
 */
export function computeEAT_jog(activity = {}, profile = {}) {
  const duration_min = toNum(activity.duration_min, 0);
  const weight_kg = toNum(profile.weight_kg, profile.weight || 70);
  const bmr = toNum(profile.bmr, 0);

  let gross = 0;
  if (activity.distance_km != null) {
    gross = grossKcalJogFromDistance({ distance_km: activity.distance_km, weight_kg });
  } else {
    const distance = estimateDistanceFromDurationAndIntensity({ activityType: 'jog', duration_min, intensity: activity.intensity });
    gross = grossKcalJogFromDistance({ distance_km: distance, weight_kg });
  }

  const bshare = bmrShareDuring(bmr, duration_min);
  const net = netFromGrossAndBmr(gross, bmr, duration_min);
  return { gross: round(gross), net, bmr_share: round(bshare) };
}

/**
 * Dispatcher for activity types (walk|jog). Returns { gross, net, bmr_share }
 */
export function computeEATForActivity(activity = {}, profile = {}) {
  if (!activity || !activity.type) return { gross: 0, net: 0, bmr_share: 0 };
  const t = (activity.type || '').toLowerCase();
  if (t === 'walk') return computeEAT_walk(activity, profile);
  if (t === 'jog' || t === 'jogging' || t === 'run') return computeEAT_jog(activity, profile);
  // Fallback: treat unknown as walk
  return computeEAT_walk(activity, profile);
}

/**
 * Sum EAT across activities array. Returns totals and details.
 */
export function sumEATFromActivities(activities = [], profile = {}) {
  const arr = activities || [];
  let totalGross = 0;
  let totalNet = 0;
  let totalBmrShare = 0;
  const details = [];

  arr.forEach((a) => {
    const r = computeEATForActivity(a, profile);
    totalGross += toNum(r.gross, 0);
    totalNet += toNum(r.net, 0);
    totalBmrShare += toNum(r.bmr_share, 0);
    details.push(Object.assign({ id: a.id ?? null, type: a.type ?? null }, r));
  });

  return {
    totalGross: round(totalGross),
    totalNet: round(totalNet),
    totalBmrShare: round(totalBmrShare),
    details,
  };
}

// --- NEAT estimators ------------------------------------------------------
/**
 * Map survey answers to a NEAT percentage of BMR (fraction).
 * survey: { subjective (0..100), standingHours, activeCommute (bool) }
 * returns fraction (e.g., 0.13 means 13% of BMR)
 */
export function neatPercentFromSurvey({ subjective = 50, standingHours = 0, activeCommute = false } = {}) {
  const s = Math.max(0, Math.min(100, toNum(subjective, 50)));
  let basePct;
  if (s <= 20) basePct = 0.06;
  else if (s <= 40) basePct = 0.09;
  else if (s <= 60) basePct = 0.13;
  else if (s <= 80) basePct = 0.20;
  else basePct = 0.30;

  const standingAdj = (toNum(standingHours, 0) >= 5) ? 0.03 : (toNum(standingHours, 0) >= 2 ? 0.01 : 0);
  const commuteAdj = activeCommute ? 0.02 : 0;
  const pct = Math.max(0.03, Math.min(0.5, basePct + standingAdj + commuteAdj));
  return pct;
}

/**
 * Compute NEAT in kcal using steps and/or survey.
 * options: { steps, weight_kg, survey }.
 * If both steps & survey present: blended estimate (0.6*steps + 0.4*survey_kcal).
 */
export function computeNEAT({ steps = null, weight_kg = null, survey = null, bmr = null } = {}) {
  const w = toNum(weight_kg, null);
  const BMR = toNum(bmr, 0);
  const neatSteps = (steps != null && w != null) ? round((toNum(steps, 0) * (STEP_KCAL_CONST * w))) : null;

  let neatSurvey = null;
  if (survey) {
    const pct = neatPercentFromSurvey(survey);
    // require BMR to compute; if not provided use weight->approximate BMR heuristic?
    const baseBmr = BMR || 0;
    neatSurvey = round(pct * baseBmr);
  }

  if (neatSteps != null && neatSurvey != null) {
    return round(0.6 * neatSteps + 0.4 * neatSurvey);
  } else if (neatSteps != null) {
    return neatSteps;
  } else if (neatSurvey != null) {
    return neatSurvey;
  }

  // fallback: small NEAT estimate (10% of BMR)
  return round(0.10 * BMR);
}

// --- Advanced Activity Factor & TDEE -------------------------------------
/**
 * Compute advanced AF and breakdown.
 * options: { bmr, weight_kg, activities = [], steps = null, survey = null }
 * returns { afAdvanced, neat, eat (totalNet), maintenancePlusActivity }
 */
export function computeAdvancedActivityFactor({ bmr, weight_kg, activities = [], steps = null, survey = null } = {}) {
  const BMR = toNum(bmr, 0);
  const profile = { weight_kg, bmr };
  const eatResult = sumEATFromActivities(activities, profile);
  const EAT_net = toNum(eatResult.totalNet, 0);

  // ensure survey has bmr if available for neat calculation
  const neat = computeNEAT({ steps, weight_kg, survey, bmr: BMR });

  const af = BMR > 0 ? (BMR + neat + EAT_net) / BMR : 1.0;
  return {
    afAdvanced: Number(af.toFixed(3)),
    neat: round(neat),
    eat: round(EAT_net),
    maintenancePlusActivity: round(BMR + neat + EAT_net),
    eatDetails: eatResult.details,
  };
}

/**
 * Compute TDEE given AF (which excludes TEF) and TEF from intake.
 * returns { maintenancePlusActivity, tef, tdee }
 */
export function computeTDEEfromAFandTEF({ bmr, activityFactor = 1.0, intakeKcal = null, tefRatio = DEFAULT_TEF_RATIO } = {}) {
  const BMR = toNum(bmr, 0);
  const AF = Number(activityFactor) || 1.0;
  const maintenancePlusActivity = round(BMR * AF); // = BMR + NEAT + EAT
  const tef = round(toNum(intakeKcal, 0) * Number(tefRatio));
  const tdee = round(maintenancePlusActivity + tef);
  return { maintenancePlusActivity, tef, tdee };
}

// --- Convenience compatibility wrappers (keep old imports working) --------
/**
 * Legacy wrapper: calculateDayTDEE(day, profile)
 * Attempts to mirror previous behavior where possible.
 * New semantics: prefer explicit day overrides, else compute based on activityMode.
 */
export function calculateDayTDEE(day = {}, profile = {}) {
  // If day explicitly provides a 'tdee' or 'TDEE' use it
  const override = day.tdee ?? day.TDEE ?? day.caloriesTarget ?? null;
  if (override != null) return { tdee: toNum(override, 0), source: 'override' };

  // profile BMR fallback
  const bmr = toNum(profile.bmr ?? profile.BMR ?? 0, 0);
  const weight_kg = toNum(profile.weight_kg ?? profile.weight ?? 0, 0);

  const activityMode = day.activityMode ?? 'manual';
  const intakeKcal = day.intake_kcal ?? (day.totals && day.totals.total) ?? null;

  if (activityMode === 'manual') {
    // manual AF value from day or profile
    const afManual = toNum(day.activityFactor ?? profile.defaultActivityFactor ?? AF_NO_TEF.moderately_active, AF_NO_TEF.moderately_active);
    const res = computeTDEEfromAFandTEF({ bmr, activityFactor: afManual, intakeKcal });
    return { ...res, source: 'manual', activityFactor: afManual };
  }

  if (activityMode === 'advanced_neat') {
    const neat = computeNEAT({ steps: day.steps ?? null, weight_kg, survey: day.survey ?? null, bmr });
    const af = bmr > 0 ? (bmr + neat) / bmr : 1.0;
    const res = computeTDEEfromAFandTEF({ bmr, activityFactor: af, intakeKcal });
    return { ...res, source: 'advanced_neat', afComputed: af, neat };
  }

  // advanced_full or default
  const activities = day.activities ?? [];
  const eatRes = sumEATFromActivities(activities, { weight_kg, bmr });
  const neat = computeNEAT({ steps: day.steps ?? null, weight_kg, survey: day.survey ?? null, bmr });
  const af = bmr > 0 ? (bmr + neat + eatRes.totalNet) / bmr : 1.0;
  const res = computeTDEEfromAFandTEF({ bmr, activityFactor: af, intakeKcal });
  return { ...res, source: 'advanced_full', afComputed: af, neat, eat: eatRes };
}

/**
 * Legacy wrapper: calculateEffectiveWorkout(day)
 * If the day had simple workoutKcal/workoutCalories, scale by intensityFactor if present.
 */
export function calculateEffectiveWorkout(day = {}) {
  const raw = toNum(day.workoutCalories ?? day.workoutKcal ?? day.workout ?? 0, 0);
  const ifactor = (day.intensityFactor === undefined || day.intensityFactor === null) ? 1.0 : Number(day.intensityFactor || 1.0);
  return round(raw * ifactor);
}

/**
 * Robust Wrapper: computeDayMealTotals(dayOrLogs, dateStr)
 * Handles both the legacy day object (containing .meals) and the new logs array.
 */
export function computeDayMealTotals(dayOrLogs, dateStr = null) {
  // 1. Handle legacy "day" object input (has .meals)
  if (dayOrLogs && typeof dayOrLogs === "object" && !Array.isArray(dayOrLogs) && ("meals" in dayOrLogs || "totals" in dayOrLogs)) {
     const meals = dayOrLogs.meals ?? [];
     return computeDayMealTotals(meals, dateStr);
  }

  // 2. Handle standard array input
  let list = [];
  if (Array.isArray(dayOrLogs)) {
    list = dayOrLogs;
  } else if (typeof dayOrLogs === 'object' && dateStr && Array.isArray(dayOrLogs[dateStr])) {
    // Legacy support for object keyed by date (logs[dateStr])
    list = dayOrLogs[dateStr];
  }

  // Calculate totals
  const totals = list.reduce((acc, m) => {
    // Robust access: checks totalKcal, kcal, or kcalPerServing
    acc.kcal += toNum(m.totalKcal ?? m.kcal ?? m.kcalPerServing ?? 0, 0);
    acc.protein_g += toNum(m.protein_g ?? 0, 0);
    acc.carbs_g += toNum(m.carbs_g ?? 0, 0);
    acc.fat_g += toNum(m.fat_g ?? 0, 0);
    return acc;
  }, { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

  return {
    kcal: round(totals.kcal),
    protein_g: round(totals.protein_g),
    carbs_g: round(totals.carbs_g),
    fat_g: round(totals.fat_g),
  };
}

// End of calculations.js