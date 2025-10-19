import type {
  components,
  paths,
} from "@/connectors/client-schemas/jellyseerr-openapi";

// Re-export / alias the generated OpenAPI types so other modules can keep
// importing from `@/models/jellyseerr.types` while the underlying shapes come
// directly from the generated spec. This avoids duplicating or diverging
// type definitions and satisfies the requirement to use generated types.

export type JellyseerrUserSummary = components["schemas"]["User"];
export type JellyseerrSeasonRequestStatus = components["schemas"]["Season"];
export type JellyseerrMovieDetails =
  paths["/movie/{movieId}"]["get"]["responses"]["200"]["content"]["application/json"];
export type JellyseerrTvDetails =
  paths["/tv/{tvId}"]["get"]["responses"]["200"]["content"]["application/json"];
export type JellyseerrMediaSummary =
  | (JellyseerrMovieDetails & { readonly mediaType: "movie" })
  | (JellyseerrTvDetails & { readonly mediaType: "tv" });
export type JellyseerrRequest = components["schemas"]["MediaRequest"] & {
  readonly mediaDetails?: JellyseerrMediaSummary;
};

export type JellyseerrPagedResult<TItem> = {
  readonly items: TItem[];
  readonly total: number;
  readonly pageInfo?: components["schemas"]["PageInfo"];
};

export type JellyseerrRequestList = JellyseerrPagedResult<JellyseerrRequest>;

export type JellyseerrRequestQueryOptions =
  paths["/request"]["get"]["parameters"]["query"];

export type CreateJellyseerrRequest =
  paths["/request"]["post"]["requestBody"]["content"]["application/json"];
export type JellyseerrApprovalOptions =
  paths["/request/{requestId}"]["put"]["requestBody"]["content"]["application/json"];
export type JellyseerrDeclineOptions = JellyseerrApprovalOptions;

export type JellyseerrRequestStatus = number;

export type JellyseerrSearchResult =
  | components["schemas"]["MovieResult"]
  | components["schemas"]["TvResult"];

export type JellyseerrCreditPerson = components["schemas"]["Cast"];
export type JellyseerrCreditsResult = {
  readonly cast?: components["schemas"]["Cast"][];
};
