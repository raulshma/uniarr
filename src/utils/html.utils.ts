/**
 * HTML and text utilities for cleaning and formatting content
 */

/**
 * Strip HTML tags and decode HTML entities from text
 * Handles common HTML entities and removes all tags
 */
export const stripHtmlTags = (html: string): string => {
  if (!html) return "";

  // Decode common HTML entities
  const decoded = html
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2F;/g, "/")
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&#\d+;/g, (match) => {
      // Handle numeric entities
      const code = parseInt(match.slice(2, -1), 10);
      return String.fromCharCode(code);
    });

  // Remove HTML tags
  const stripped = decoded.replace(/<[^>]*>/g, "");

  // Clean up excessive whitespace
  const cleaned = stripped
    .replace(/\n\s*\n/g, "\n\n") // Collapse multiple newlines to max 2
    .replace(/\r\n/g, "\n") // Normalize line endings
    .trim();

  return cleaned;
};
