import { useEffect, useState } from "react";
import axios from "axios";
import { logger } from "@/services/logger/LoggerService";
import { stripHtmlTags } from "@/utils/html.utils";

/**
 * Lazy fetch full Reddit post content (selftext) when drawer opens
 * Displays available metadata immediately while content loads in background
 */
export const useRedditPostContent = (permalink: string) => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!permalink) {
      setContent("");
      setLoading(false);
      return;
    }

    const fetchContent = async () => {
      setLoading(true);
      setError(null);

      try {
        // Reddit API endpoint for post details
        const url = `${permalink}.json`;
        const response = await axios.get(url, {
          timeout: 8000,
          headers: {
            "User-Agent": "UniArr-App",
          },
        });

        // Response is an array with post data in first element
        const postData = response.data?.[0]?.data?.children?.[0]?.data;

        if (postData) {
          const selftext = postData.selftext || "";
          // Strip any HTML entities that might be present
          const cleanedText = stripHtmlTags(selftext);
          setContent(cleanedText.substring(0, 500)); // Limit to 500 chars for performance
        } else {
          setContent("");
        }
      } catch (error) {
        void logger.warn("useRedditPostContent: failed to fetch content", {
          permalink,
          error: error instanceof Error ? error.message : String(error),
        });
        setError("Could not load post content");
        setContent("");
      } finally {
        setLoading(false);
      }
    };

    void fetchContent();
  }, [permalink]);

  return { content, loading, error };
};
