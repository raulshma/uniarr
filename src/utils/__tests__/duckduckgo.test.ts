/**
 * Tests for custom DuckDuckGo search implementation
 */

import {
  search,
  SafeSearchType,
  SearchTimeType,
  type SearchOptions,
} from "../duckduckgo";

describe("DuckDuckGo Search", () => {
  describe("Enums", () => {
    it("should export SafeSearchType enum with correct values", () => {
      expect(SafeSearchType.STRICT).toBe(0);
      expect(SafeSearchType.MODERATE).toBe(-1);
      expect(SafeSearchType.OFF).toBe(-2);
    });

    it("should export SearchTimeType enum with correct values", () => {
      expect(SearchTimeType.ALL).toBe("a");
      expect(SearchTimeType.DAY).toBe("d");
      expect(SearchTimeType.WEEK).toBe("w");
      expect(SearchTimeType.MONTH).toBe("m");
      expect(SearchTimeType.YEAR).toBe("y");
    });
  });

  describe("search function", () => {
    it("should be a function", () => {
      expect(typeof search).toBe("function");
    });

    it("should throw error for empty query", async () => {
      await expect(search("")).rejects.toThrow("Query cannot be empty!");
    });

    // Note: Actual search tests would require mocking fetch
    // and are better suited for integration tests
  });

  describe("SearchOptions", () => {
    it("should accept valid options", () => {
      const options: SearchOptions = {
        safeSearch: SafeSearchType.MODERATE,
        time: SearchTimeType.WEEK,
        locale: "en-us",
        region: "wt-wt",
        offset: 0,
        marketRegion: "US",
      };

      expect(options).toBeDefined();
      expect(options.safeSearch).toBe(SafeSearchType.MODERATE);
      expect(options.time).toBe(SearchTimeType.WEEK);
    });
  });
});
