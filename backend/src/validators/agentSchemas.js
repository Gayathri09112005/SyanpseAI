import { z } from 'zod';

const shortText = z.string().trim().min(1).max(2000);
const list = (item, max = 12) => z.array(item).max(max).default([]);

export const generatorSchema = z.object({
  answer: z.string().trim().min(1).max(40000),
  keyClaims: list(shortText),
  assumptions: list(shortText),
  uncertainties: list(shortText),
});

export const VERIFICATION_STATUSES = [
  'supported_by_evidence',
  'contradicted_by_evidence',
  'partially_supported',
  'unverified',
  'not_checked',
];

export const verifierSchema = z.object({
  // Required, not defaulted: an empty object must not validate as a clean bill of health.
  overallAssessment: z.enum(['sound', 'minor_issues', 'significant_issues', 'unreliable']),
  claims: list(
    z.object({
      claim: shortText,
      status: z.enum(VERIFICATION_STATUSES).catch('unverified'),
      explanation: z.string().trim().max(2000).default(''),
      evidenceIds: z.array(z.number().int().min(0)).max(10).default([]),
      confidence: z.number().min(0).max(1).optional(),
    }),
    20,
  ),
  issues: list(
    z.object({
      severity: z.enum(['low', 'medium', 'high']).catch('medium'),
      description: shortText,
      suggestedFix: z.string().trim().max(2000).optional(),
    }),
  ),
  missingInformation: list(shortText),
  summary: z.string().trim().min(1).max(4000),
});

export const reasonerSchema = z.object({
  summary: z.string().trim().min(1).max(4000),
  logicalIssues: list(
    z.object({
      severity: z.enum(['low', 'medium', 'high']).catch('medium'),
      description: shortText,
    }),
  ),
  missingSteps: list(shortText),
  assumptions: list(shortText),
  edgeCases: list(shortText),
  suggestedImprovements: list(shortText),
});

export const synthesisSchema = z.object({
  finalAnswer: z.string().trim().min(1).max(60000),
  keyCorrections: list(shortText),
  remainingUncertainty: list(shortText),
  sourcesUsed: z.array(z.number().int().min(0)).max(20).default([]),
});
