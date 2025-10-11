import axios from "axios";
import type {
  JikanAnime,
  JikanAnimeSearchResponse,
  JikanRecommendationsQuery,
  JikanRecommendationResponse,
  JikanSearchAnimeQuery,
  JikanSeasonNowQuery,
  JikanSeasonNowResponse,
  JikanSeasonUpcomingQuery,
  JikanSeasonUpcomingResponse,
  JikanRandomAnimeResponse,
  JikanTopAnimeQuery,
  JikanTopAnimeResponse,
} from "@/models/jikan.types";

const DEFAULT_BASE = "https://api.jikan.moe/v4";

const client = axios.create({
  baseURL: DEFAULT_BASE,
  timeout: 10_000,
  headers: {
    Accept: "application/json",
  },
});

export const JikanClient = {
  async getTopAnime(page = 1, filter?: JikanTopAnimeQuery["filter"]) {
    const params: JikanTopAnimeQuery = {
      page,
    };
    if (filter) params.filter = filter;
    const response = await client.get<JikanTopAnimeResponse>("/top/anime", {
      params,
    });
    return response.data;
  },

  async getRecommendations(page = 1) {
    const params: JikanRecommendationsQuery = { page };
    const response = await client.get<JikanRecommendationResponse>(
      "/recommendations/anime",
      { params }
    );
    return response.data;
  },

  async getRandomAnime() {
    const response = await client.get<JikanRandomAnimeResponse>(
      "/random/anime"
    );
    return response.data;
  },

  async getSeasonNow(page = 1) {
    const params: JikanSeasonNowQuery = { page };
    const response = await client.get<JikanSeasonNowResponse>(
      "/seasons/now",
      { params }
    );
    return response.data;
  },

  async getSeasonUpcoming(page = 1) {
    const params: JikanSeasonUpcomingQuery = { page };
    const response = await client.get<JikanSeasonUpcomingResponse>(
      "/seasons/upcoming",
      { params }
    );
    return response.data;
  },

  async searchAnime(query: string, page = 1, limit = 20) {
    const params: JikanSearchAnimeQuery = {
      q: query,
      page,
      limit,
    };
    const response = await client.get<JikanAnimeSearchResponse>("/anime", {
      params,
    });
    return response.data;
  },
};
