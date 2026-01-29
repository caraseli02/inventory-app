import { describe, it, expect } from "vitest";
import { requiresHumanReview } from "../server/policies/confidencePolicy";
import { isAllowedBusinessRule } from "../server/policies/businessRulesPolicy";
import { requiresHumanReviewForReorder } from "../server/policies/reorderPolicy";
import { isWithinBusinessHours } from "../server/policies/timeOfDayPolicy";

/**
 * Policy Tests
 *
 * These tests verify that our policy gates work correctly.
 * Policies are pure functions - no database needed!
 *
 * What you'll learn:
 * - Policies are easy to test because they're pure functions
 * - Boundary conditions are important (exactly at threshold)
 * - Each policy has a single responsibility
 */

describe("Confidence Policy", () => {
  it("should require human review when confidence is below 0.7", () => {
    expect(requiresHumanReview(0.5)).toBe(true);
    expect(requiresHumanReview(0.69)).toBe(true);
    expect(requiresHumanReview(0.0)).toBe(true);
  });

  it("should NOT require human review when confidence is 0.7 or above", () => {
    expect(requiresHumanReview(0.7)).toBe(false);
    expect(requiresHumanReview(0.8)).toBe(false);
    expect(requiresHumanReview(0.92)).toBe(false);
    expect(requiresHumanReview(1.0)).toBe(false);
  });

  it("should handle edge case at exactly 0.7", () => {
    // This is a boundary test - important for understanding policy behavior
    expect(requiresHumanReview(0.7)).toBe(false);
    expect(requiresHumanReview(0.6999999)).toBe(true);
  });
});

describe("Business Rules Policy", () => {
  describe("REORDER actions", () => {
    it("should always allow REORDER actions", () => {
      const result = isAllowedBusinessRule({
        actionType: "REORDER",
        suggestedValueCents: 0,
      });
      expect(result.ok).toBe(true);
    });
  });

  describe("Price change actions", () => {
    it("should allow valid price deltas", () => {
      const result = isAllowedBusinessRule({
        actionType: "PRICE_DECREASE",
        suggestedValueCents: 100,
      });
      expect(result.ok).toBe(true);
    });

    it("should reject zero delta", () => {
      const result = isAllowedBusinessRule({
        actionType: "PRICE_DECREASE",
        suggestedValueCents: 0,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("INVALID_PRICE_DELTA");
      }
    });

    it("should treat negative delta as absolute value", () => {
      // The policy uses Math.abs(), so -50 is treated as 50
      const result = isAllowedBusinessRule({
        actionType: "PRICE_INCREASE",
        suggestedValueCents: -50,
      });
      expect(result.ok).toBe(true); // Valid because abs(-50) = 50
    });

    it("should reject extremely large price deltas (> 500 cents)", () => {
      const result = isAllowedBusinessRule({
        actionType: "PRICE_DECREASE",
        suggestedValueCents: 600,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("PRICE_DELTA_TOO_LARGE");
      }
    });

    it("should allow delta at exactly 500 cents (boundary)", () => {
      const result = isAllowedBusinessRule({
        actionType: "PRICE_DECREASE",
        suggestedValueCents: 500,
      });
      expect(result.ok).toBe(true);
    });

    it("should handle PRICE_INCREASE same as PRICE_DECREASE", () => {
      const validIncrease = isAllowedBusinessRule({
        actionType: "PRICE_INCREASE",
        suggestedValueCents: 100,
      });
      expect(validIncrease.ok).toBe(true);

      const invalidIncrease = isAllowedBusinessRule({
        actionType: "PRICE_INCREASE",
        suggestedValueCents: 600,
      });
      expect(invalidIncrease.ok).toBe(false);
    });
  });
});

describe("Reorder Policy", () => {
  it("should require human review for REORDER actions", () => {
    expect(requiresHumanReviewForReorder("REORDER")).toBe(true);
  });

  it("should NOT require human review for price actions", () => {
    expect(requiresHumanReviewForReorder("PRICE_INCREASE")).toBe(false);
    expect(requiresHumanReviewForReorder("PRICE_DECREASE")).toBe(false);
  });

  it("should NOT require human review for unknown action types", () => {
    expect(requiresHumanReviewForReorder("UNKNOWN")).toBe(false);
  });
});

describe("Time-of-Day Policy", () => {
  it("should return true during business hours (9am-6pm UTC)", () => {
    // 9am UTC - start of business hours
    expect(isWithinBusinessHours("2025-01-15T09:00:00Z")).toBe(true);
    // 12pm UTC - middle of day
    expect(isWithinBusinessHours("2025-01-15T12:00:00Z")).toBe(true);
    // 5pm UTC - still within business hours
    expect(isWithinBusinessHours("2025-01-15T17:00:00Z")).toBe(true);
    // 5:59pm UTC - last minute of business hours
    expect(isWithinBusinessHours("2025-01-15T17:59:59Z")).toBe(true);
  });

  it("should return false outside business hours", () => {
    // 6pm UTC - just closed
    expect(isWithinBusinessHours("2025-01-15T18:00:00Z")).toBe(false);
    // 8am UTC - before opening
    expect(isWithinBusinessHours("2025-01-15T08:59:59Z")).toBe(false);
    // 3am UTC - middle of night
    expect(isWithinBusinessHours("2025-01-15T03:00:00Z")).toBe(false);
    // 11pm UTC - late night
    expect(isWithinBusinessHours("2025-01-15T23:00:00Z")).toBe(false);
  });

  it("should handle boundary at exactly 9am UTC (start)", () => {
    expect(isWithinBusinessHours("2025-01-15T09:00:00Z")).toBe(true);
    expect(isWithinBusinessHours("2025-01-15T08:59:59Z")).toBe(false);
  });

  it("should handle boundary at exactly 6pm UTC (end)", () => {
    // hour < 18, so 17:xx is in, 18:xx is out
    expect(isWithinBusinessHours("2025-01-15T17:59:59Z")).toBe(true);
    expect(isWithinBusinessHours("2025-01-15T18:00:00Z")).toBe(false);
  });

  it("should use UTC regardless of date", () => {
    // Different dates, same UTC hour = same result
    expect(isWithinBusinessHours("2024-12-25T12:00:00Z")).toBe(true); // Christmas
    expect(isWithinBusinessHours("2025-07-04T12:00:00Z")).toBe(true); // Summer
    expect(isWithinBusinessHours("2025-01-01T03:00:00Z")).toBe(false); // New Year
  });
});
