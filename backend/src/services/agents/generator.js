import { generatorSchema } from '../../validators/agentSchemas.js';
import { runAgent } from './runAgent.js';
import { contextBlock, historyBlock } from './prompts.js';

const SYSTEM = `You are the Answer Generator in a multi-agent reasoning system.
Answer the user's question independently and honestly. You have not seen any other agent's work.
Be accurate before being impressive: if you are unsure, say so in "uncertainties" rather than guessing confidently.
Required JSON shape: {"answer": string (markdown allowed), "keyClaims": string[], "assumptions": string[], "uncertainties": string[]}
"keyClaims" are the specific, checkable factual statements your answer depends on.`;

export function generatorAgent({ question, settings, history, signal, deps }) {
  return runAgent({
    name: 'Answer Generator',
    provider: 'gemini',
    system: SYSTEM,
    schema: generatorSchema,
    signal,
    deps,
    prompt: `${contextBlock(settings)}\n${historyBlock(history)}\nQuestion:\n${question}`,
    mock: () => ({
      answer: `**[MOCK MODE]** No Gemini API key is configured, so this is a development stub, not a real answer.\n\nThe question was: "${question}"`,
      keyClaims: ['[MOCK] This response was not produced by a language model.'],
      assumptions: ['[MOCK] Running with AI_MODE=mock or a missing GEMINI_API_KEY.'],
      uncertainties: ['[MOCK] Nothing here should be treated as factual.'],
    }),
  });
}
