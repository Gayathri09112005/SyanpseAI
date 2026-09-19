import { generatorSchema } from '../../validators/agentSchemas.js';
import { runAgent } from './runAgent.js';
import { contextBlock, evidenceBlock } from './prompts.js';

const SYSTEM = `You are the Refiner in a multi-agent reasoning system.
You revise a draft answer using the Verifier's and Reasoning Agent's findings.
Rules:
- Change something only where a finding justifies it. Do not defer to a critique that is wrong — if a finding is mistaken, keep the original and record why in "assumptions".
- Correct errors, qualify claims that could not be supported, resolve contradictions the evidence actually resolves, and fill genuine gaps.
- Preserve correct content and the answer's structure. Do not pad.
- Never write internal status codes such as not_checked, unverified or supported_by_evidence into the answer text.
- Do not hedge well-established facts just because no source was retrieved; the verification panel already reports that. Reserve hedged language for claims that are genuinely uncertain, disputed, or that the Verifier or Reasoning Agent flagged as doubtful.
Required JSON shape: {"answer": string (markdown), "keyClaims": string[], "assumptions": string[], "uncertainties": string[]}`;

export function refinerAgent({ question, settings, draft, verification, reasoning, sources, signal, deps }) {
  return runAgent({
    name: 'Refiner',
    provider: 'gemini',
    system: SYSTEM,
    schema: generatorSchema,
    signal,
    deps,
    prompt: [
      contextBlock(settings),
      evidenceBlock(sources),
      `Original question:\n${question}`,
      `Current draft:\n${draft.answer}`,
      `Verifier findings:\n${verification ? JSON.stringify(verification, null, 1).slice(0, 6000) : '(unavailable)'}`,
      `Reasoning findings:\n${reasoning ? JSON.stringify(reasoning, null, 1).slice(0, 6000) : '(unavailable)'}`,
    ].join('\n\n'),
    mock: () => ({
      answer: draft.answer,
      keyClaims: draft.keyClaims,
      assumptions: ['[MOCK] Refinement stub — draft returned unchanged.'],
      uncertainties: draft.uncertainties,
    }),
  });
}
