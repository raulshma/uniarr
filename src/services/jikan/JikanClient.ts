import axios from "axios";
import type { JikanAnime, JikanListResponse } from "@/models/jikan.types";

const DEFAULT_BASE = "https://api.jikan.moe/v4";

const client = axios.create({
  baseURL: DEFAULT_BASE,
  timeout: 10_000,
  headers: {
    Accept: "application/json",
  },
});

export const JikanClient = {
  async getTopAnime(page = 1, filter?: string) {
    const params: Record<string, unknown> = { page };
    if (filter) params.filter = filter;
    const response = await client.get<JikanListResponse<JikanAnime>>(
      "/top/anime",
      { params }
    );
    return response.data;
  },

  async getRecommendations(page = 1) {
    const response = await client.get<JikanListResponse<any>>(
      "/recommendations/anime",
      { params: { page } }
    );
    return response.data;
  },

  async getRandomAnime() {
    const response = await client.get<JikanListResponse<JikanAnime>>(
      "/random/anime"
    );
    return response.data;
  },

  async getSeasonNow() {
    const response = await client.get<JikanListResponse<JikanAnime>>(
      "/seasons/now"
    );
    return response.data;
  },

  async getSeasonUpcoming() {
    const response = await client.get<JikanListResponse<JikanAnime>>(
      "/seasons/upcoming"
    );
    return response.data;
  },

  async searchAnime(query: string, page = 1, limit = 20) {
    const response = await client.get<JikanListResponse<JikanAnime>>("/anime", {
      params: { q: query, page, limit },
    });
    return response.data;
  },
};
