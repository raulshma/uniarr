import { useEffect, useState } from "react";
import axios from "axios";
import { logger } from "@/services/logger/LoggerService";
import { stripHtmlTags } from "@/utils/html.utils";

const API_BASE = "https://hacker-news.firebaseio.com/v0";

/**
 * Lazy fetch full HackerNews story content (text) when drawer opens
 * Displays available metadata immediately while content loads in background
 */
export const useHackerNewsStoryContent = (itemId: number) => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) {
      setContent("");
      setLoading(false);
      return;
    }

    const fetchContent = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(`${API_BASE}/item/${itemId}.json`, {
          timeout: 8000,
        });

        const payload = response.data;
        if (payload && typeof payload.text === "string") {
          const cleanedText = stripHtmlTags(payload.text);
          setContent(cleanedText.substring(0, 500)); // Limit to 500 chars for performance
        } else {
          setContent("");
        }
      } catch (error) {
        void logger.warn("useHackerNewsStoryContent: failed to fetch content", {
          itemId,
          error: error instanceof Error ? error.message : String(error),
        });
        setError("Could not load story content");
        setContent("");
      } finally {
        setLoading(false);
      }
    };

    void fetchContent();
  }, [itemId]);

  return { content, loading, error };
};
