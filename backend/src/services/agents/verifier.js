import { verifierSchema } from '../../validators/agentSchemas.js';
import { runAgent } from './runAgent.js';
import { contextBlock, evidenceBlock } from './prompts.js';

const SYSTEM = `You are the Verifier in a multi-agent reasoning system.
You examine a draft answer for factual accuracy. You do NOT rewrite the answer.
Rules you must never break:
- Never invent sources, URLs, quotations or evidence.
- A claim is "supported_by_evidence" or "contradicted_by_evidence" ONLY when retrieved evidence shown to you says so; cite it in evidenceIds.
- Use "unverified" when the claim is checkable but no evidence was available, and "not_checked" when it is out of scope (opinion, preference, trivially definitional).
- Agreement between models is not evidence.
Required JSON shape: {"overallAssessment": "sound"|"minor_issues"|"significant_issues"|"unreliable", "claims": [{"claim": string, "status": string, "explanation": string, "evidenceIds": number[], "confidence": number 0-1}], "issues": [{"severity":"low"|"medium"|"high","description":string,"suggestedFix":string}], "missingInformation": string[], "summary": string}`;

export function verifierAgent({ question, settings, draft, sources, signal, deps }) {
  return runAgent({
    name: 'Verifier',
    provider: 'groq',
    system: SYSTEM,
    schema: verifierSchema,
    signal,
    deps,
    prompt: [
      contextBlock(settings),
      evidenceBlock(sources),
      `Original question:\n${question}`,
      `Draft answer to verify:\n${draft.answer}`,
      `Claims the generator says it relies on:\n${draft.keyClaims.map((c) => `- ${c}`).join('\n') || '- (none stated)'}`,
    ].join('\n\n'),
    mock: () => ({
      overallAssessment: 'minor_issues',
      claims: [
        {
          claim: '[MOCK] Verification did not run against a real model.',
          status: 'not_checked',
          explanation: 'No Groq API key configured; this is a development stub.',
          evidenceIds: [],
        },
      ],
      issues: [],
      missingInformation: ['[MOCK] Real verification requires GROQ_API_KEY.'],
      summary: '[MOCK MODE] Verifier stub — no factual checking was performed.',
    }),
  });
}
