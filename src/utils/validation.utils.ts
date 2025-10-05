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
    apiKey: z.string().trim().min(1, 'API key cannot be empty').optional(),
    username: z.string().trim().min(1, 'Username cannot be empty').optional(),
    password: z.string().trim().min(1, 'Password cannot be empty').optional(),
  })
  .refine(
    (data) => Boolean(data.apiKey) || (Boolean(data.username) && Boolean(data.password)),
    {
      message: 'Either API key or username/password is required',
      path: ['apiKey'],
    },
  );

export type ServiceConfigInput = z.infer<typeof serviceConfigSchema>;
