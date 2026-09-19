import { z } from 'zod';

const runSettingsShape = {
  answerStyle: z.enum(['concise', 'balanced', 'detailed']).default('balanced'),
  reasoningDepth: z.enum(['fast', 'light', 'standard', 'thorough', 'exhaustive']).default('standard'),
  domain: z.enum(['auto', 'general', 'coding', 'education', 'research', 'technical']).default('auto'),
  evidenceRetrieval: z.boolean().default(false),
  minRefinementIterations: z.number().int().min(0).max(8).default(0),
  maxRefinementIterations: z.number().int().min(0).max(8).default(2),
  storeAgentTranscripts: z.boolean().default(true),
};

export const runSettingsSchema = z.object(runSettingsShape).refine((s) => s.minRefinementIterations <= s.maxRefinementIterations, {
  message: 'Minimum refinement passes cannot exceed the maximum',
  path: ['minRefinementIterations'],
});

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
  remember: z.boolean().default(true),
});

export const preferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional(),
  answerStyle: z.enum(['concise', 'balanced', 'detailed']).optional(),
  reasoningDepth: z.enum(['fast', 'light', 'standard', 'thorough', 'exhaustive']).optional(),
  domain: z.enum(['auto', 'general', 'coding', 'education', 'research', 'technical']).optional(),
  evidenceRetrieval: z.boolean().optional(),
  minRefinementIterations: z.number().int().min(0).max(8).optional(),
  maxRefinementIterations: z.number().int().min(0).max(8).optional(),
  storeAgentTranscripts: z.boolean().optional(),
  streamPartialAnswers: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
});

export const createConversationSchema = z.object({ title: z.string().trim().min(1).max(160).optional() });
export const updateConversationSchema = z.object({ title: z.string().trim().min(1).max(160) });

export const createAnswerSchema = z.object({
  question: z.string().trim().min(3, 'Ask a question of at least 3 characters').max(8000),
  conversationId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  settings: z.object(runSettingsShape).partial().optional(),
});

export const followUpSchema = z.object({
  question: z.string().trim().min(3).max(8000),
  settings: z.object(runSettingsShape).partial().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().trim().max(160).optional(),
});
