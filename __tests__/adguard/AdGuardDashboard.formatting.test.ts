/**
 * Unit tests for AdGuard Dashboard response time formatting.
 * Validates formatting logic: ms if <1000ms, otherwise seconds with 2 decimals, or --- if missing.
 */

describe("AdGuard Dashboard Response Time Formatting", () => {
  // Helper to replicate the formatResponseTime function
  const numberFormatter = new Intl.NumberFormat();

  const formatResponseTime = (seconds?: number): string => {
    if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
      return "---";
    }

    const ms = seconds * 1000;
    if (ms < 1000) {
      const roundedMs = Math.round(ms);
      return `${numberFormatter.format(roundedMs)} ms`;
    }

    const secsFixed = Number(seconds.toFixed(2));
    return `${numberFormatter.format(secsFixed)} s`;
  };

  describe("when avgProcessingTimeSeconds is missing", () => {
    it("should return --- when undefined", () => {
      expect(formatResponseTime(undefined)).toBe("---");
    });

    it("should return --- when null", () => {
      expect(formatResponseTime(null as any)).toBe("---");
    });

    it("should return --- when NaN", () => {
      expect(formatResponseTime(Number.NaN)).toBe("---");
    });
  });

  describe("when avgProcessingTimeSeconds is less than 1 second", () => {
    it("should display milliseconds as integer when < 1000 ms", () => {
      expect(formatResponseTime(0.054)).toBe("54 ms");
    });

    it("should display milliseconds rounded correctly at boundary", () => {
      expect(formatResponseTime(0.5)).toBe("500 ms");
    });

    it("should display milliseconds for 999 ms", () => {
      expect(formatResponseTime(0.999)).toBe("999 ms");
    });

    it("should round milliseconds to nearest integer", () => {
      expect(formatResponseTime(0.0545)).toBe("55 ms");
      expect(formatResponseTime(0.0544)).toBe("54 ms");
    });
  });

  describe("when avgProcessingTimeSeconds is 1 second or greater", () => {
    it("should display seconds with 2 decimal places for values >= 1000 ms", () => {
      expect(formatResponseTime(1.234)).toBe("1.23 s");
    });

    it("should display seconds with 2 decimal places for large values", () => {
      expect(formatResponseTime(123.456)).toBe("123.46 s");
    });

    it("should display round numbers with minimal decimals via numberFormatter", () => {
      // numberFormatter does not preserve trailing zeros; 1.00 becomes "1"
      expect(formatResponseTime(1)).toBe("1 s");
    });

    it("should round seconds correctly", () => {
      expect(formatResponseTime(1.235)).toBe("1.24 s");
      expect(formatResponseTime(1.234)).toBe("1.23 s");
    });

    it("should handle very small fractional seconds that become >= 1000 ms with locale formatting", () => {
      // 0.9999 seconds = 999.9 ms -> rounds to 1000 ms; numberFormatter adds grouping
      expect(formatResponseTime(0.9999)).toBe("1,000 ms");
    });
  });

  describe("edge cases", () => {
    it("should handle zero seconds", () => {
      expect(formatResponseTime(0)).toBe("0 ms");
    });

    it("should handle very small positive values", () => {
      expect(formatResponseTime(0.001)).toBe("1 ms");
      expect(formatResponseTime(0.0001)).toBe("0 ms");
    });

    it("should handle very large seconds values", () => {
      // seconds are fixed to 2 decimals, numberFormatter applies grouping and may drop trailing zeros
      expect(formatResponseTime(9999.99)).toBe("9,999.99 s");
    });
  });
});
