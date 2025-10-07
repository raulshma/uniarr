import { z } from 'zod';

import { type ServiceType } from '@/models/service.types';

const serviceTypeValues = [
  'sonarr',
  'radarr',
  'jellyseerr',
  'qbittorrent',
  'prowlarr',
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
      if (!data.username || data.username.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['username'],
          message: 'Username is required for Jellyseerr',
        });
      }

      if (!data.password || data.password.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['password'],
          message: 'Password is required for Jellyseerr',
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
