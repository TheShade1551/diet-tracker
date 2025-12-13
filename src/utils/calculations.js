// src/utils/calculations.js
// Merged compatibility file: legacy helpers + advanced TDEE / Activity utilities
// This file provides both the old helper exports (dateToKey, fmtNum, computeDayMealTotals, formatIF, calculateDayTDEE)
// and the new advanced functions (EAT calculators, NEAT, computeAdvancedActivityFactor, computeTDEEfromAFandTEF).

// ---------- Generic helpers ----------
function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function round(x) { return Math.round(x); }

// safeNum: return 0 for non-finite values
export function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

// csvQuote: quote and escape string for CSV fields
export function csvQuote(v = "") {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

// ---------- Legacy helpers (kept for compatibility) ----------
export function safeGet(obj, ...keys) {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
    if (obj && obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

export function dateToKey(d) {
  try {
    if (!d) return new Date().toISOString().slice(0, 10);
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return new Date().toISOString().slice(0, 10);
    return dt.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function fmtNum(v) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return Math.round(n);
}

export function formatIF(ifactor) {
  if (ifactor == null || ifactor === "" || ifactor === 0) return "-";
  return Number(ifactor).toFixed(2);
}

// ---------- Legacy meal/workout helpers ----------
export function calculateEffectiveWorkout(day) {
  if (!day) return 0;
  const raw = Number(day.workoutCalories ?? day.workoutKcal ?? day.workout ?? 0);
  if (day.intensityFactor == null || day.intensityFactor === 0) return Math.round(raw);
  return Math.round(raw * Number(day.intensityFactor || 1.0));
}

export function sumMealEntries(entries) {
  return (entries || []).reduce((acc, e) => {
    if (typeof e.totalKcal === 'number') return acc + e.totalKcal;
    const qty = Number(e.quantity ?? 0);
    const per = Number(e.kcalPerUnit ?? e.kcal_per_unit ?? 0);
    return acc + qty * per;
  }, 0);
}

export function computeDayMealTotals(dayOrMeals) {
  // Accept either a day object (with .meals) or an array of meal entries
  const day = (dayOrMeals && !Array.isArray(dayOrMeals) && dayOrMeals.meals) ? dayOrMeals : null;
  const entries = Array.isArray(dayOrMeals) ? dayOrMeals : (day ? day.meals : []);
  if (!entries || !Array.isArray(entries)) return { lunch: 0, dinner: 0, extras: 0, total: 0 };

  const sumByType = (type) => {
    return sumMealEntries(entries.filter(m => (m.mealType || "").toLowerCase() === type));
  };

  const lunch = sumByType('lunch');
  const dinner = sumByType('dinner');
  const extras = sumByType('extra') + sumByType('extras') + sumByType('snack');
  return { lunch: round(lunch), dinner: round(dinner), extras: round(extras), total: round(lunch + dinner + extras) };
}

// ---------- Legacy TDEE (kept for compatibility) ----------
export function computeTDEEForDay(day, profile = {}) {
  const explicitTdee = day?.tdee ?? day?.TDEE ?? safeGet(day, "caloriesTarget");
  if (typeof explicitTdee === "number" && !Number.isNaN(explicitTdee)) return Math.round(explicitTdee);

  const bmr = Number(profile.bmr ?? profile.BMR ?? profile.calculatedBmr ?? 0) || 0;
  if (!bmr) return Math.round(profile.dailyKcalTarget ?? 2500);

  const activityFactor = Number(day.activityFactor ?? profile.defaultActivityFactor ?? 1.2);
  return Math.round(bmr * activityFactor);
}

export function calculateDayTDEE({ bmr = 0, activityFactor = 1.0, workoutCalories = 0, intensityFactor = null } = {}) {
  const bmrNum = Number(bmr) || 0;
  const af = Number(activityFactor) || 1.0;
  const wc = Number(workoutCalories) || 0;
  const ifactor = (intensityFactor === null || intensityFactor === 0) ? 1.0 : Number(intensityFactor);
  const tdee = (bmrNum * af) + (wc * ifactor);
  return Math.round(tdee);
}

// ---------- New advanced TDEE / Activity utilities (our design) ----------

// Tuneable constants
export const WALK_KCAL_PER_KG_PER_KM = 0.78;
export const RUN_KCAL_PER_KG_PER_KM = 1.00;
export const STEP_KCAL_CONST = 0.00057;
export const DEFAULT_TEF_RATIO = 0.10;

// add this after existing constants
export function getConstFromProfile(profile) {
  const p = profile ?? {};
  return {
    WALK_KCAL_PER_KG_PER_KM: toNum(p.WALK_KCAL_PER_KG_PER_KM ?? p.walkKcalPerKgPerKm ?? WALK_KCAL_PER_KG_PER_KM),
    RUN_KCAL_PER_KG_PER_KM: toNum(p.RUN_KCAL_PER_KG_PER_KM ?? p.runKcalPerKgPerKm ?? RUN_KCAL_PER_KG_PER_KM),
    STEP_KCAL_CONST: Number(p.STEP_KCAL_CONST ?? p.stepKcalConst ?? STEP_KCAL_CONST),
    DEFAULT_TEF_RATIO: Number(p.DEFAULT_TEF_RATIO ?? p.defaultTefRatio ?? DEFAULT_TEF_RATIO),
  };
}

// BMR share
export function bmrShareDuring(bmr, duration_min) {
  const B = toNum(bmr, 0);
  const d = toNum(duration_min, 0);
  return (B * (d / 1440));
}

// Distance-based gross kcal
export function grossKcalWalkFromDistance({ distance_km, weight_kg, profile } = {}) {
  const d = toNum(distance_km, 0);
  const w = toNum(weight_kg, 70);
  const c = getConstFromProfile(profile);
  return d * w * c.WALK_KCAL_PER_KG_PER_KM;
}

export function grossKcalJogFromDistance({ distance_km, weight_kg, profile } = {}) {
  const d = toNum(distance_km, 0);
  const w = toNum(weight_kg, 70);
  const c = getConstFromProfile(profile);
  return d * w * c.RUN_KCAL_PER_KG_PER_KM;
}

// Optional speed estimator (not required if distance is always provided)
export const SPEED_RANGES = { walk: { base: 3.0, max: 6.0 }, jog: { base: 6.0, max: 10.0 } };
export function estimateDistanceFromDurationAndIntensity({ activityType = 'walk', duration_min = 0, intensity = 50 } = {}) {
  const t = (activityType || 'walk').toLowerCase();
  const range = SPEED_RANGES[t] || SPEED_RANGES['walk'];
  const s = clamp01(toNum(intensity, 50) / 100);
  const speed_kmh = range.base + s * (range.max - range.base);
  const hours = toNum(duration_min, 0) / 60.0;
  return speed_kmh * hours;
}

function netFromGrossAndBmr(gross_kcal, bmr, duration_min) {
  const gross = toNum(gross_kcal, 0);
  const bshare = bmrShareDuring(bmr, duration_min);
  const val = gross - bshare;
  return Math.max(0, round(val));
}

export function computeEAT_walk(activity = {}, profile = {}) {
  const duration_min = toNum(activity.duration_min, 0);
  const weight_kg = toNum(profile.weight_kg, profile.weight || 70);
  const bmr = toNum(profile.bmr, 0);

  let gross = 0;
  if (activity.distance_km != null) {
    gross = grossKcalWalkFromDistance({ distance_km: activity.distance_km, weight_kg, profile });
    // apply a gentle intensity scaling (intensity: 0..100 -> scale near 1.0)
    // default intensity = 50 -> scale 1.0
    const intensity = toNum(activity.intensity, 50);
    const scale = 1 + (intensity - 50) / 400; // +-12.5% at extremes
    const clampedScale = Math.max(0.75, Math.min(1.30, scale));
    gross = gross * clampedScale;
  } else {
    // fallback: estimate distance from duration & intensity
    const distance = estimateDistanceFromDurationAndIntensity({ activityType: 'walk', duration_min, intensity: activity.intensity });
    gross = grossKcalWalkFromDistance({ distance_km: distance, weight_kg, profile });
  }

  const bshare = bmrShareDuring(bmr, duration_min);
  const net = netFromGrossAndBmr(gross, bmr, duration_min);
  return { gross: round(gross), net, bmr_share: round(bshare) };
}

// REPLACE computeEAT_jog with this
export function computeEAT_jog(activity = {}, profile = {}) {
  const duration_min = toNum(activity.duration_min, 0);
  const weight_kg = toNum(profile.weight_kg, profile.weight || 70);
  const bmr = toNum(profile.bmr, 0);

  let gross = 0;
  if (activity.distance_km != null) {
    gross = grossKcalJogFromDistance({ distance_km: activity.distance_km, weight_kg, profile });
    // gentle intensity scaling for jogging as well
    const intensity = toNum(activity.intensity, 50);
    const scale = 1 + (intensity - 50) / 300; // slightly stronger effect for running
    const clampedScale = Math.max(0.75, Math.min(1.35, scale));
    gross = gross * clampedScale;
  } else {
    const distance = estimateDistanceFromDurationAndIntensity({ activityType: 'jog', duration_min, intensity: activity.intensity });
    gross = grossKcalJogFromDistance({ distance_km: distance, weight_kg, profile });
  }

  const bshare = bmrShareDuring(bmr, duration_min);
  const net = netFromGrossAndBmr(gross, bmr, duration_min);
  return { gross: round(gross), net, bmr_share: round(bshare) };
}

export function computeEATForActivity(activity = {}, profile = {}) {
  if (!activity || !activity.type) return { gross: 0, net: 0, bmr_share: 0 };
  const t = (activity.type || '').toLowerCase();
  if (t === 'walk') return computeEAT_walk(activity, profile);
  if (t === 'jog' || t === 'jogging' || t === 'run') return computeEAT_jog(activity, profile);
  return computeEAT_walk(activity, profile);
}

export function sumEATFromActivities(activities, profile = {}) {
  let effectiveActivities = activities;
  let effectiveProfile = profile;
  if (typeof activities === 'object' && activities !== null && 'activities' in activities) {
    effectiveActivities = activities.activities;
    effectiveProfile = activities.profile || profile;
  }

  // Defensive normalization
  const arr = Array.isArray(effectiveActivities)
    ? effectiveActivities
    : effectiveActivities && typeof effectiveActivities === "object"
    ? // if it's a single activity object or keyed object, convert to array
      Array.isArray(Object.values(effectiveActivities)) && Object.values(effectiveActivities).length
      ? Object.values(effectiveActivities)
      : [effectiveActivities]
    : [];

  // Optional debug - remove after you verify
  if (typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production") {
    if (!Array.isArray(activities)) {
      // console.warn("[sumEATFromActivities] normalized activities:", activities, "->", arr);
    }
  }

  let totalGross = 0, totalNet = 0, totalBmrShare = 0;
  const details = [];

  arr.forEach((a) => {
    const r = computeEATForActivity(a, effectiveProfile);
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

// NEAT estimators
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

export function computeNEAT({ steps = null, weight_kg = null, survey = null, bmr = null, profile = null } = {}) {
  const c = getConstFromProfile(profile);
  // console.log("[computeNEAT] STEP_CONST:", c.STEP_KCAL_CONST, "profileProvided:", !!profile);
  const STEP_CONST = c.STEP_KCAL_CONST ?? STEP_KCAL_CONST;

  const neatSteps = (steps != null && weight_kg != null)
    ? Math.round(steps * (STEP_CONST * weight_kg))
    : null;

  const pct = neatPercentFromSurvey(survey);
  const neatSurvey = (bmr != null) ? Math.round(pct * bmr) : null;

  if (neatSteps != null && neatSurvey != null) return Math.round(0.75 * neatSteps + 0.25 * neatSurvey);
  if (neatSteps != null) return neatSteps;
  if (neatSurvey != null) return neatSurvey;
  return 0;
}

// Advanced AF & TDEE
export function computeAdvancedActivityFactor({ bmr, weight_kg, activities = [], steps = null, survey = null, profile = {} } = {}) {
  const BMR = toNum(bmr, 0);
  // merge weight_kg and bmr into profile if not present
  const effectiveProfile = { ...profile, weight_kg: profile.weight_kg ?? weight_kg, bmr: profile.bmr ?? bmr };
  const eatResult = sumEATFromActivities(activities, effectiveProfile);
  const EAT_net = toNum(eatResult.totalNet, 0);
  const neat = computeNEAT({ steps, weight_kg: effectiveProfile.weight_kg, survey, bmr: BMR, profile: effectiveProfile });
  const af = BMR > 0 ? (BMR + neat + EAT_net) / BMR : 1.0;
  return { afAdvanced: Number(af.toFixed(3)), neat: round(neat), eat: round(EAT_net), maintenancePlusActivity: round(BMR + neat + EAT_net), eatDetails: eatResult.details };
}

export function computeTDEEfromAFandTEF({ bmr, activityFactor = 1.0, intakeKcal = null, tefRatio, profile = {} } = {}) {
  const BMR = toNum(bmr, 0);
  const AF = Number(activityFactor) || 1.0;
  const c = getConstFromProfile(profile);
  const effectiveTefRatio = (tefRatio !== undefined) ? Number(tefRatio) : c.DEFAULT_TEF_RATIO;
  const maintenancePlusActivity = round(BMR * AF);
  const tef = round(toNum(intakeKcal, 0) * effectiveTefRatio);
  const tdee = round(maintenancePlusActivity + tef);
  return { maintenancePlusActivity, tef, tdee };
}

// End of merged calculations.js