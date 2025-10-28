import axios from "axios";
import { handleApiError } from "@/utils/error.utils";
import { logger } from "@/services/logger/LoggerService";

export interface YouTubeTestResult {
  success: boolean;
  message: string;
  details?: {
    statusCode?: number;
    endpoint?: string;
    channelId?: string;
    error?: string;
  };
}

const SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";

/**
 * Tests YouTube API connectivity by attempting a search query on a single channel.
 * Used for validating API key and channel ID configuration before saving.
 * @param apiKey YouTube Data API v3 key
 * @param channelId Channel ID to test (UC...)
 * @returns {YouTubeTestResult} Success/failure result with message and optional error details
 */
export const testYouTubeApiKey = async (
  apiKey: string,
  channelId: string,
): Promise<YouTubeTestResult> => {
  if (!apiKey || !channelId) {
    return {
      success: false,
      message: "API key and channel ID are required.",
    };
  }

  const trimmedApiKey = apiKey.trim();
  const trimmedChannelId = channelId.trim();

  if (trimmedApiKey.length === 0 || trimmedChannelId.length === 0) {
    return {
      success: false,
      message: "API key and channel ID cannot be empty.",
    };
  }

  try {
    const params = {
      key: trimmedApiKey,
      channelId: trimmedChannelId,
      part: "snippet",
      order: "date",
      maxResults: 1,
      type: "video",
    } as const;

    const response = await axios.get(SEARCH_ENDPOINT, {
      timeout: 8000,
      params,
    });

    if (Array.isArray(response.data?.items)) {
      return {
        success: true,
        message: `✓ Connection successful! Found ${response.data.items.length} video(s).`,
        details: {
          channelId: trimmedChannelId,
        },
      };
    } else {
      return {
        success: true,
        message:
          "✓ Connection successful! No videos found (channel may be empty).",
        details: {
          channelId: trimmedChannelId,
        },
      };
    }
  } catch (error) {
    const apiError = handleApiError(error, {
      operation: "testYouTubeApiKey",
      endpoint: SEARCH_ENDPOINT,
    });

    void logger.warn("YouTube API test failed", {
      channelId: trimmedChannelId,
      statusCode: apiError.statusCode,
      message: apiError.message,
    });

    // Return detailed error info for dialog display
    return {
      success: false,
      message: `Connection failed: ${apiError.message}`,
      details: {
        statusCode: apiError.statusCode,
        endpoint: SEARCH_ENDPOINT,
        channelId: trimmedChannelId,
        error: apiError.message,
      },
    };
  }
};

/**
 * Generates user-friendly troubleshooting hints based on error status code
 * @param statusCode HTTP status code from YouTube API
 * @returns Troubleshooting message
 */
export const getYouTubeTroubleshootingHint = (statusCode?: number): string => {
  switch (statusCode) {
    case 401:
      return "Invalid or expired API key. Verify in Google Cloud Console.";
    case 403:
      return "Access denied. Check API key restrictions:\n• IP whitelist may be blocking requests\n• HTTP referrer restrictions may apply\n• API method restrictions may be set\nVisit: https://console.cloud.google.com/apis/credentials";
    case 404:
      return "Channel ID not found or is private. Verify the channel ID is correct and public.";
    case 429:
      return "API quota exceeded. Wait a moment and try again.";
    case 500:
      return "YouTube API server error. Try again later.";
    default:
      return "Verify your API key has YouTube Data API v3 enabled and appropriate permissions.";
  }
};
