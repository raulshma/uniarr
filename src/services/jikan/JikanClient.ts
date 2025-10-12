import axios from "axios";
import type {
  JikanAnime,
  JikanAnimeFull,
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

// Rate limiting configuration
const RATE_LIMIT_PER_SECOND = 10;
const RATE_LIMIT_PER_MINUTE = 180;

// Token bucket for rate limiting
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private capacity: number;
  private refillRate: number; // tokens per millisecond

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.lastRefill = Date.now();
    this.refillRate = refillRate;
  }

  private refill() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor(timePassed * this.refillRate);

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async acquire(tokens = 1): Promise<void> {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        this.refill();

        if (this.tokens >= tokens) {
          this.tokens -= tokens;
          resolve();
        } else {
          // Wait and try again
          setTimeout(tryAcquire, 100);
        }
      };

      tryAcquire();
    });
  }
}

// Create token buckets for different time windows
const secondBucket = new TokenBucket(RATE_LIMIT_PER_SECOND, RATE_LIMIT_PER_SECOND / 1000);
const minuteBucket = new TokenBucket(RATE_LIMIT_PER_MINUTE, RATE_LIMIT_PER_MINUTE / (60 * 1000));

// Request queue for managing API calls
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;

  async enqueue<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeRequest = async () => {
        try {
          // Acquire tokens from both buckets
          await Promise.all([
            secondBucket.acquire(1),
            minuteBucket.acquire(1)
          ]);

          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.processNext();
        }
      };

      this.queue.push(executeRequest);

      if (!this.processing) {
        this.processNext();
      }
    });
  }

  private async processNext() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const nextRequest = this.queue.shift();
    if (nextRequest) {
      await nextRequest();
    }
  }
}

const requestQueue = new RequestQueue();

const client = axios.create({
  baseURL: DEFAULT_BASE,
  timeout: 10_000,
  headers: {
    Accept: "application/json",
  },
});

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Start with 1 second

async function makeRequest<T>(requestFn: () => Promise<T>, retries = 0): Promise<T> {
  try {
    return await requestQueue.enqueue(requestFn);
  } catch (error) {
    if (retries < MAX_RETRIES && axios.isAxiosError(error)) {
      // Retry on rate limit or server errors
      if (error.response?.status === 429 || (error.response?.status && error.response.status >= 500)) {
        const delay = RETRY_DELAY * Math.pow(2, retries); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        return makeRequest(requestFn, retries + 1);
      }
    }
    throw error;
  }
}

export const JikanClient = {
  async getTopAnime(page = 1, filter?: JikanTopAnimeQuery["filter"]) {
    const params: JikanTopAnimeQuery = {
      page,
    };
    if (filter) params.filter = filter;
    return makeRequest(() =>
      client.get<JikanTopAnimeResponse>("/top/anime", { params }).then(r => r.data)
    );
  },

  async getRecommendations(page = 1) {
    const params: JikanRecommendationsQuery = { page };
    return makeRequest(() =>
      client.get<JikanRecommendationResponse>("/recommendations/anime", { params }).then(r => r.data)
    );
  },

  async getRandomAnime() {
    return makeRequest(() =>
      client.get<JikanRandomAnimeResponse>("/random/anime").then(r => r.data)
    );
  },

  async getSeasonNow(page = 1) {
    const params: JikanSeasonNowQuery = { page };
    return makeRequest(() =>
      client.get<JikanSeasonNowResponse>("/seasons/now", { params }).then(r => r.data)
    );
  },

  async getSeasonUpcoming(page = 1) {
    const params: JikanSeasonUpcomingQuery = { page };
    return makeRequest(() =>
      client.get<JikanSeasonUpcomingResponse>("/seasons/upcoming", { params }).then(r => r.data)
    );
  },

  async getAnimeFullById(malId: number) {
    return makeRequest(() =>
      client.get<{ data: JikanAnimeFull }>(`/anime/${malId}`).then(r => r.data.data)
    );
  },

  async getAnimeRecommendations(malId: number) {
    return makeRequest(() =>
      client.get<{ data: { entry?: { mal_id?: number; type?: string; name?: string; url?: string } }[] }>(
        `/anime/${malId}/recommendations`
      ).then(r => r.data.data)
    );
  },

  async getAnimeReviews(malId: number) {
    return makeRequest(() =>
      client.get<{ data: { mal_id?: number; content?: string; user?: { username?: string } }[] }>(
        `/anime/${malId}/reviews`
      ).then(r => r.data.data)
    );
  },

  async getAnimePictures(malId: number) {
    return makeRequest(() =>
      client.get<{ data: { jpg?: { image_url?: string; large_image_url?: string } }[] }>(
        `/anime/${malId}/pictures`
      ).then(r => r.data.data)
    );
  },

  async getAnimeEpisodes(malId: number) {
    return makeRequest(() =>
      client.get<{ data: { mal_id?: number; title?: string; episode_id?: number; duration?: string }[] }>(
        `/anime/${malId}/episodes`
      ).then(r => r.data.data)
    );
  },

  async getAnimeStatistics(malId: number) {
    return makeRequest(() =>
      client.get<{ data: { watching?: number; completed?: number; on_hold?: number; dropped?: number; plan_to_watch?: number; total?: number } }>(
        `/anime/${malId}/statistics`
      ).then(r => r.data.data)
    );
  },

  async getAnimeStreaming(malId: number) {
    return makeRequest(() =>
      client.get<{ data: { name?: string; url?: string }[] }>(
        `/anime/${malId}/streaming`
      ).then(r => r.data.data)
    );
  },

  async searchAnime(query: string, page = 1, limit = 20) {
    const params: JikanSearchAnimeQuery = {
      q: query,
      page,
      limit,
    };
    return makeRequest(() =>
      client.get<JikanAnimeSearchResponse>("/anime", { params }).then(r => r.data)
    );
  },
};
