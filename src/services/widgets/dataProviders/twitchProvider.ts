import axios from "axios";

import { logger } from "@/services/logger/LoggerService";
import { handleApiError } from "@/utils/error.utils";

export interface TwitchChannelStatus {
  login: string;
  displayName: string;
  isLive: boolean;
  title?: string;
  viewerCount?: number;
  startedAt?: string;
  thumbnailUrl?: string;
  profileImageUrl?: string;
  gameName?: string;
}

export interface FetchTwitchOptions {
  clientId: string;
  accessToken: string;
  channelLogins: string[];
}

const STREAMS_ENDPOINT = "https://api.twitch.tv/helix/streams";
const USERS_ENDPOINT = "https://api.twitch.tv/helix/users";

const buildHeaders = (clientId: string, accessToken: string) => ({
  "Client-Id": clientId,
  Authorization: `Bearer ${accessToken}`,
});

interface TwitchStreamPayload {
  user_login: string;
  user_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
  game_name?: string;
}

interface TwitchUserPayload {
  login: string;
  display_name: string;
  profile_image_url?: string;
}

const fetchStreams = async (
  clientId: string,
  accessToken: string,
  channelLogins: string[],
): Promise<Map<string, TwitchStreamPayload>> => {
  if (channelLogins.length === 0) {
    return new Map();
  }

  try {
    const params = new URLSearchParams();
    channelLogins.forEach((login) => params.append("user_login", login));

    const response = await axios.get(STREAMS_ENDPOINT, {
      timeout: 6000,
      headers: buildHeaders(clientId, accessToken),
      params,
    });

    const data = Array.isArray(response.data?.data)
      ? (response.data.data as TwitchStreamPayload[])
      : [];

    const map = new Map<string, TwitchStreamPayload>();
    data.forEach((stream) => {
      map.set(stream.user_login.toLowerCase(), stream);
    });

    return map;
  } catch (error) {
    const apiError = handleApiError(error, {
      operation: "fetchTwitchStreams",
      endpoint: STREAMS_ENDPOINT,
    });
    void logger.warn("twitchProvider: failed to fetch streams", {
      message: apiError.message,
    });
    return new Map();
  }
};

const fetchUsers = async (
  clientId: string,
  accessToken: string,
  channelLogins: string[],
): Promise<Map<string, TwitchUserPayload>> => {
  if (channelLogins.length === 0) {
    return new Map();
  }

  try {
    const params = new URLSearchParams();
    channelLogins.forEach((login) => params.append("login", login));

    const response = await axios.get(USERS_ENDPOINT, {
      timeout: 6000,
      headers: buildHeaders(clientId, accessToken),
      params,
    });

    const data = Array.isArray(response.data?.data)
      ? (response.data.data as TwitchUserPayload[])
      : [];

    const map = new Map<string, TwitchUserPayload>();
    data.forEach((user) => {
      map.set(user.login.toLowerCase(), user);
    });

    return map;
  } catch (error) {
    const apiError = handleApiError(error, {
      operation: "fetchTwitchUsers",
      endpoint: USERS_ENDPOINT,
    });
    void logger.warn("twitchProvider: failed to fetch users", {
      message: apiError.message,
    });
    return new Map();
  }
};

export const fetchTwitchChannelStatus = async ({
  clientId,
  accessToken,
  channelLogins,
}: FetchTwitchOptions): Promise<TwitchChannelStatus[]> => {
  if (!clientId || !accessToken || channelLogins.length === 0) {
    return [];
  }

  const normalizedLogins = channelLogins.map((login) => login.toLowerCase());

  const [streams, users] = await Promise.all([
    fetchStreams(clientId, accessToken, normalizedLogins),
    fetchUsers(clientId, accessToken, normalizedLogins),
  ]);

  return normalizedLogins.map((login) => {
    const stream = streams.get(login);
    const user = users.get(login);

    return {
      login,
      displayName: stream?.user_name ?? user?.display_name ?? login,
      isLive: Boolean(stream),
      title: stream?.title,
      viewerCount: stream?.viewer_count,
      startedAt: stream?.started_at
        ? new Date(stream.started_at).toISOString()
        : undefined,
      thumbnailUrl: stream?.thumbnail_url,
      profileImageUrl: user?.profile_image_url,
      gameName: stream?.game_name,
    } satisfies TwitchChannelStatus;
  });
};
