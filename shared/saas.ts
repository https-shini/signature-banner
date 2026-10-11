import { z } from 'zod';
import { idSchema } from './model';
export const workspaceInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).default(''),
  })
  .strict();
export type Workspace = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  settings: Record<string, unknown>;
  createdAt: string;
};
export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  settings: Record<string, unknown>;
  createdAt: string;
};
export const contextIds = z.object({
  workspaceId: idSchema.optional(),
  projectId: idSchema.optional(),
});
export type AuthConfiguration =
  | { mode: 'personal' }
  | { mode: 'saas'; url: string; anonKey: string };
