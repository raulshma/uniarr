import type { Recommendation } from "@/models/recommendation.schemas";

export interface RecommendationsWidgetData {
  recommendations: Recommendation[];
  cacheAge?: number;
  generatedAt: Date;
}

export interface RecommendationsWidgetConfig {
  limit?: number;
  includeHiddenGems?: boolean;
}
