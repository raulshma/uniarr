/**
 * High Contrast Utilities Tests
 */

import {
  adjustColorForHighContrast,
  getHighContrastChartColors,
  getContrastRatio,
  meetsWCAGAA,
  meetsWCAGAAA,
  getAccessibleColorPair,
} from "@/utils/accessibility/highContrast.utils";

describe("High Contrast Utilities", () => {
  describe("adjustColorForHighContrast", () => {
    it("should return original color when high contrast is disabled", () => {
      const color = "#3b82f6";
      const result = adjustColorForHighContrast(color, false, false);
      expect(result).toBe(color);
    });

    it("should adjust blue color for high contrast in light mode", () => {
      const color = "#3b82f6";
      const result = adjustColorForHighContrast(color, false, true);
      expect(result).toBe("#0000FF");
    });

    it("should adjust blue color for high contrast in dark mode", () => {
      const color = "#3b82f6";
      const result = adjustColorForHighContrast(color, true, true);
      expect(result).toBe("#00FFFF");
    });

    it("should adjust green color for high contrast", () => {
      const color = "#10b981";
      const result = adjustColorForHighContrast(color, false, true);
      expect(result).toBe("#00FF00");
    });

    it("should adjust red color for high contrast", () => {
      const color = "#ef4444";
      const result = adjustColorForHighContrast(color, false, true);
      expect(result).toBe("#FF0000");
    });

    it("should return original color for unmapped colors", () => {
      const color = "#123456";
      const result = adjustColorForHighContrast(color, false, true);
      expect(result).toBe(color);
    });
  });

  describe("getHighContrastChartColors", () => {
    it("should return dark mode high contrast colors", () => {
      const colors = getHighContrastChartColors(true);
      expect(colors).toHaveLength(6);
      expect(colors).toContain("#00FFFF");
      expect(colors).toContain("#00FF00");
      expect(colors).toContain("#FFFF00");
    });

    it("should return light mode high contrast colors", () => {
      const colors = getHighContrastChartColors(false);
      expect(colors).toHaveLength(6);
      expect(colors).toContain("#0000FF");
      expect(colors).toContain("#FF0000");
      expect(colors).toContain("#00AA00");
    });

    it("should return different colors for light and dark modes", () => {
      const lightColors = getHighContrastChartColors(false);
      const darkColors = getHighContrastChartColors(true);
      expect(lightColors).not.toEqual(darkColors);
    });
  });

  describe("getContrastRatio", () => {
    it("should calculate contrast ratio for black and white", () => {
      const ratio = getContrastRatio("#000000", "#FFFFFF");
      expect(ratio).toBeCloseTo(21, 0);
    });

    it("should calculate contrast ratio for same colors", () => {
      const ratio = getContrastRatio("#FF0000", "#FF0000");
      expect(ratio).toBeCloseTo(1, 0);
    });

    it("should calculate contrast ratio for blue and white", () => {
      const ratio = getContrastRatio("#0000FF", "#FFFFFF");
      expect(ratio).toBeGreaterThan(8);
    });

    it("should be symmetric", () => {
      const ratio1 = getContrastRatio("#FF0000", "#00FF00");
      const ratio2 = getContrastRatio("#00FF00", "#FF0000");
      expect(ratio1).toBeCloseTo(ratio2, 2);
    });
  });

  describe("meetsWCAGAA", () => {
    it("should return true for black text on white background", () => {
      expect(meetsWCAGAA("#000000", "#FFFFFF")).toBe(true);
    });

    it("should return true for white text on black background", () => {
      expect(meetsWCAGAA("#FFFFFF", "#000000")).toBe(true);
    });

    it("should return false for low contrast pairs", () => {
      expect(meetsWCAGAA("#CCCCCC", "#FFFFFF")).toBe(false);
    });

    it("should return true for sufficient contrast", () => {
      expect(meetsWCAGAA("#0000FF", "#FFFFFF")).toBe(true);
    });
  });

  describe("meetsWCAGAAA", () => {
    it("should return true for black text on white background", () => {
      expect(meetsWCAGAAA("#000000", "#FFFFFF")).toBe(true);
    });

    it("should return false for pairs that only meet AA", () => {
      // This pair meets AA but not AAA
      expect(meetsWCAGAAA("#767676", "#FFFFFF")).toBe(false);
    });

    it("should have stricter requirements than AA", () => {
      const color1 = "#767676";
      const color2 = "#FFFFFF";

      // Should meet AA but not AAA
      expect(meetsWCAGAA(color1, color2)).toBe(true);
      expect(meetsWCAGAAA(color1, color2)).toBe(false);
    });
  });

  describe("getAccessibleColorPair", () => {
    it("should return high contrast colors when high contrast is enabled in dark mode", () => {
      const pair = getAccessibleColorPair(true, true);
      expect(pair.foreground).toBe("#FFFFFF");
      expect(pair.background).toBe("#000000");
    });

    it("should return high contrast colors when high contrast is enabled in light mode", () => {
      const pair = getAccessibleColorPair(false, true);
      expect(pair.foreground).toBe("#000000");
      expect(pair.background).toBe("#FFFFFF");
    });

    it("should return normal contrast colors when high contrast is disabled", () => {
      const darkPair = getAccessibleColorPair(true, false);
      expect(darkPair.foreground).toBe("#E5E7EB");
      expect(darkPair.background).toBe("#1F2937");

      const lightPair = getAccessibleColorPair(false, false);
      expect(lightPair.foreground).toBe("#1F2937");
      expect(lightPair.background).toBe("#FFFFFF");
    });

    it("should return color pairs that meet WCAG AA", () => {
      const darkPair = getAccessibleColorPair(true, false);
      expect(meetsWCAGAA(darkPair.foreground, darkPair.background)).toBe(true);

      const lightPair = getAccessibleColorPair(false, false);
      expect(meetsWCAGAA(lightPair.foreground, lightPair.background)).toBe(
        true,
      );
    });
  });
});
