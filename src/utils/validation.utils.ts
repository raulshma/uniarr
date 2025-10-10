import { z } from 'zod';

import { type ServiceType } from '@/models/service.types';

const serviceTypeValues = [
  'sonarr',
  'radarr',
  'jellyseerr',
  'jellyfin',
  'qbittorrent',
  'transmission',
  'deluge',
  'sabnzbd',
  'nzbget',
  'rtorrent',
  'prowlarr',
  'bazarr',
] as const satisfies readonly ServiceType[];

const httpSchemeRegex = /^https?:\/\//i;

export const serviceConfigSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    type: z.enum(serviceTypeValues),
    url: z
      .string()
      .trim()
      .min(1, 'URL is required')
      .url('Invalid URL')
      .refine((value) => httpSchemeRegex.test(value), 'URL must start with http:// or https://'),
    apiKey: z.string().trim().optional(),
    username: z.string().trim().optional(),
    password: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'jellyfin') {
      if (!data.apiKey || data.apiKey.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['apiKey'],
          message: 'API key is required for Jellyfin',
        });
      }
      return;
    }

    if (data.type === 'qbittorrent') {
      if (!data.username || data.username.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['username'],
          message: 'Username is required for qBittorrent',
        });
      }

      if (!data.password || data.password.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['password'],
          message: 'Password is required for qBittorrent',
        });
      }

      return;
    }

    if (data.type === 'jellyseerr') {
      if (!data.apiKey || data.apiKey.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['apiKey'],
          message: 'API key is required for Jellyseerr',
        });
      }

      return;
    }

    // For Sonarr and Radarr, only API key is required
    if (data.type === 'sonarr' || data.type === 'radarr') {
      if (!data.apiKey || data.apiKey.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['apiKey'],
          message: 'API key is required for Sonarr and Radarr',
        });
      }
      return;
    }

    // For other services (like prowlarr), API key is required
    if (data.type === 'prowlarr') {
      if (!data.apiKey || data.apiKey.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['apiKey'],
          message: 'API key is required for Prowlarr',
        });
      }
      return;
    }
  });

export type ServiceConfigInput = z.infer<typeof serviceConfigSchema>;

/**
 * Sanitizes text by removing HTML tags and truncating to specified length
 */
export const sanitizeAndTruncateText = (text: string | undefined | null, maxLength: number = 50): string => {
  if (!text) return '';
  
  // Remove HTML tags
  const sanitized = text.replace(/<[^>]*>/g, '');
  
  // Truncate if too long
  if (sanitized.length > maxLength) {
    return sanitized.substring(0, maxLength).trim() + '...';
  }
  
  return sanitized.trim();
};

/**
 * Sanitizes service version text specifically for display
 */
export const sanitizeServiceVersion = (version: string | undefined | null): string => {
  if (!version) return '';
  
  // Remove HTML tags and common HTML entities
  let sanitized = version
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
  
  // If it looks like HTML content, return a generic message
  if (sanitized.includes('<!DOCTYPE') || sanitized.includes('<html') || sanitized.includes('<body')) {
    return 'Version detected';
  }
  
  // Truncate to reasonable length for version display
  if (sanitized.length > 30) {
    return sanitized.substring(0, 30).trim() + '...';
  }
  
  return sanitized;
};