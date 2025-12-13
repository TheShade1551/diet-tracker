import { describe, test, expect } from "vitest";

import {
  computeNEAT,
  computeEAT_walk,
  computeAdvancedActivityFactor,
} from "../src/utils/calculations";

describe("Advanced TDEE calculations", () => {
  test("NEAT blends steps and survey into a positive number", () => {
    const neat = computeNEAT({
      steps: 2000,
      weight_kg: 80,
      survey: { subjective: 50 },
      bmr: 1800,
    });

    expect(typeof neat).toBe("number");
    expect(Number.isNaN(neat)).toBe(false);
    expect(neat).toBeGreaterThan(0);
  });

  test("computeEAT_walk returns gross and net calories", () => {
    const res = computeEAT_walk(
      {
        distance_km: 2,
        duration_min: 30,
        intensity: 50,
      },
      {
        weight_kg: 80,
        bmr: 1800,
      }
    );

    expect(res).toHaveProperty("gross");
    expect(res).toHaveProperty("net");

    expect(res.gross).toBeGreaterThan(0);
    expect(res.net).toBeGreaterThanOrEqual(0);
  });

  test("computeAdvancedActivityFactor composes BMR + NEAT + EAT", () => {
    const result = computeAdvancedActivityFactor({
      bmr: 1800,
      weight_kg: 80,
      activities: [
        {
          type: "walk",
          distance_km: 2,
          duration_min: 30,
          intensity: 50,
        },
      ],
      steps: 3000,
      survey: { subjective: 60 },
    });

    expect(result.afAdvanced).toBeGreaterThan(1.0);
    expect(result.neat).toBeGreaterThanOrEqual(0);
    expect(result.eat).toBeGreaterThanOrEqual(0);
  });

  test("legacy workout fields do not affect advanced calculations", () => {
    const result = computeAdvancedActivityFactor({
      bmr: 1800,
      weight_kg: 80,
      activities: [],
      steps: 4000,
      survey: { subjective: 50 },
      workoutCalories: 800,
      intensityFactor: 2,
    });

    expect(result.eat).toBe(0);
  });
});