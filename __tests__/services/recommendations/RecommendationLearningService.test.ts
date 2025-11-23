import { RecommendationLearningService } from "@/services/ai/recommendations/RecommendationLearningService";
import { StorageBackendManager } from "@/services/storage/MMKVStorage";

describe("RecommendationLearningService - Not Interested management", () => {
  const userId = "test_user";

  beforeEach(async () => {
    const manager = StorageBackendManager.getInstance();
    if (!manager.isInitialized()) {
      await manager.initialize();
    }
    await manager.getAdapter().clear();
  });

  it("records a rejected feedback and exposes it through getRejectedRecommendations", async () => {
    const service = RecommendationLearningService.getInstance();

    const rec = {
      id: "rec_test_1",
      title: "Test Movie",
      type: "movie",
      matchScore: 42,
      metadata: {
        posterUrl: "",
        overview: "Test overview",
        genres: ["Test"],
        rating: 8.5,
        popularity: 30,
      },
    } as any;

    const userContext: any = {
      watchHistory: [],
      preferences: {
        favoriteGenres: [],
        dislikedGenres: [],
        contentRatingLimit: "",
      },
      libraryStats: { totalItems: 0 },
    };

    await service.recordFeedback(
      userId,
      rec.id,
      rec,
      "rejected",
      userContext,
      "Not interested",
    );

    const rejected = await service.getRejectedRecommendations(userId);
    expect(rejected.length).toBe(1);
    expect(rejected[0].recommendation.title).toBe("Test Movie");
  });

  it("removes a rejected feedback entry via removeRejectedRecommendation", async () => {
    const service = RecommendationLearningService.getInstance();
    const recId = "rec_test_2";

    const rec = {
      id: recId,
      title: "Another Test",
      type: "movie",
      matchScore: 30,
      metadata: {
        posterUrl: "",
        overview: "Test overview",
        genres: ["Test"],
        rating: 7.5,
        popularity: 20,
      },
    } as any;

    const userContext: any = {
      watchHistory: [],
      preferences: {
        favoriteGenres: [],
        dislikedGenres: [],
        contentRatingLimit: "",
      },
      libraryStats: { totalItems: 0 },
    };

    await service.recordFeedback(
      userId,
      recId,
      rec,
      "rejected",
      userContext,
      "Not interested",
    );
    let rejected = await service.getRejectedRecommendations(userId);
    expect(rejected.length).toBe(1);

    await service.removeRejectedRecommendation(userId, recId);
    rejected = await service.getRejectedRecommendations(userId);
    expect(rejected.length).toBe(0);
  });
});
