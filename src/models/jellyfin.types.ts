import type {
  components,
  paths,
} from "@/connectors/client-schemas/jellyfin-openapi";

// Re-export / alias generated OpenAPI types so callers can continue importing
// from `@/models/jellyfin.types` while we source the definitions directly from
// the Jellyfin OpenAPI schema.

export type JellyfinServerInfo = components["schemas"]["PublicSystemInfo"];

export type JellyfinUserProfile = components["schemas"]["UserDto"];

export type JellyfinCollectionType = components["schemas"]["CollectionType"];

export type JellyfinPerson = components["schemas"]["BaseItemPerson"];

export type JellyfinMediaStream = components["schemas"]["MediaStream"];

export type JellyfinMediaSource = components["schemas"]["MediaSourceInfo"];

type _JellyfinLibraryViewResponse = NonNullable<
  paths["/UserViews"]["get"]["responses"][200]["content"]["application/json"]
>;

export type JellyfinLibraryView = NonNullable<
  _JellyfinLibraryViewResponse["Items"]
>[number];

export type JellyfinUserData = components["schemas"]["UserItemDataDto"];

export type JellyfinItem = components["schemas"]["BaseItemDto"];

export type JellyfinItemsResponse =
  components["schemas"]["BaseItemDtoQueryResult"];

export type JellyfinResumeItem = JellyfinItem;

export type JellyfinLatestItem = JellyfinItem;

export type JellyfinImageOptions =
  paths["/Items/{itemId}/Images/{imageType}"]["get"]["parameters"]["query"];

export type JellyfinSessionPlayState = components["schemas"]["PlayerStateInfo"];

export type JellyfinSession = components["schemas"]["SessionInfoDto"];

export type JellyfinSearchHintResult =
  components["schemas"]["SearchHintResult"];

export type JellyfinSearchHint = components["schemas"]["SearchHint"];

export type JellyfinSearchOptions =
  paths["/Search/Hints"]["get"]["parameters"]["query"];
