import type {
  components,
  operations,
} from "@/connectors/client-schemas/jikan-openapi";

// Re-export generated OpenAPI types so callers can keep importing from
// `@/models/jikan.types` while we source definitions directly from the spec.

export type JikanImageJpg = NonNullable<
  components["schemas"]["anime_images"]
>["jpg"];

export type JikanImages = components["schemas"]["anime_images"];

export type JikanAnime = components["schemas"]["anime"];

export type JikanAnimeEntry = components["schemas"]["anime_meta"];

export type JikanAnimeImages = components["schemas"]["anime_images"];

export type JikanAnimeAiringInfo = components["schemas"]["daterange"];

export type JikanTopAnimeResponse = NonNullable<
  operations["getTopAnime"]["responses"][200]["content"]["application/json"]
>;

export type JikanTopAnimeQuery = NonNullable<
  operations["getTopAnime"]["parameters"]["query"]
>;

export type JikanRandomAnimeResponse = NonNullable<
  operations["getRandomAnime"]["responses"][200]["content"]["application/json"]
>;

export type JikanRandomAnimeData = JikanRandomAnimeResponse["data"];

export type JikanSeasonNowResponse = NonNullable<
  operations["getSeasonNow"]["responses"][200]["content"]["application/json"]
>;

export type JikanSeasonNowQuery = NonNullable<
  operations["getSeasonNow"]["parameters"]["query"]
>;

export type JikanSeasonUpcomingResponse = NonNullable<
  operations["getSeasonUpcoming"]["responses"][200]["content"]["application/json"]
>;

export type JikanSeasonUpcomingQuery = NonNullable<
  operations["getSeasonUpcoming"]["parameters"]["query"]
>;

export type JikanAnimeSearchResponse = NonNullable<
  operations["getAnimeSearch"]["responses"][200]["content"]["application/json"]
>;

export type JikanSearchAnimeQuery = NonNullable<
  operations["getAnimeSearch"]["parameters"]["query"]
>;

export type JikanRecommendationResponse = NonNullable<
  operations["getRecentAnimeRecommendations"]["responses"][200]["content"]["application/json"]
>;

export type JikanRecommendationsQuery = NonNullable<
  operations["getRecentAnimeRecommendations"]["parameters"]["query"]
>;

export type JikanRecommendation = NonNullable<
  JikanRecommendationResponse["data"]
>[number];

export type JikanAnimePagination = components["schemas"]["pagination_plus"];

export type JikanAnimeFullResponse = NonNullable<
  operations["getAnimeFullById"]["responses"][200]["content"]["application/json"]
>;

export type JikanAnimeFull = JikanAnimeFullResponse["data"];

// Trailer type: some endpoints include `trailer.images`, others only include the
// base trailer fields. Export a union/intersection type so callers can opt-in to
// the richer shape when available.
export type JikanTrailer = components["schemas"]["trailer_base"] &
  components["schemas"]["trailer_images"];
