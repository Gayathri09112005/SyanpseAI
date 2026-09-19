import { reasonerSchema } from '../../validators/agentSchemas.js';
import { runAgent } from './runAgent.js';
import { contextBlock } from './prompts.js';

const SYSTEM = `You are the Reasoning Agent in a multi-agent reasoning system.
You critique the logic of a draft answer: consistency, gaps, hidden assumptions, unsupported conclusions,
alternative interpretations, edge cases, and calculation or implementation errors.
Report conclusions and short justifications only — never expose step-by-step internal deliberation.
Be specific and actionable; "could be clearer" is not a finding. If the reasoning is sound, say so and return few issues.
Required JSON shape: {"summary": string, "logicalIssues": [{"severity":"low"|"medium"|"high","description":string}], "missingSteps": string[], "assumptions": string[], "edgeCases": string[], "suggestedImprovements": string[]}`;

export function reasonerAgent({ question, settings, draft, signal, deps }) {
  return runAgent({
    name: 'Reasoning Agent',
    provider: 'huggingface',
    system: SYSTEM,
    schema: reasonerSchema,
    signal,
    deps,
    prompt: [
      contextBlock(settings),
      `Original question:\n${question}`,
      `Draft answer to critique:\n${draft.answer}`,
      `Stated assumptions:\n${draft.assumptions.map((a) => `- ${a}`).join('\n') || '- (none stated)'}`,
    ].join('\n\n'),
    mock: () => ({
      summary: '[MOCK MODE] Reasoning stub — no logical analysis was performed.',
      logicalIssues: [],
      missingSteps: [],
      assumptions: ['[MOCK] Real critique requires HUGGINGFACE_API_KEY.'],
      edgeCases: [],
      suggestedImprovements: [],
    }),
  });
}
