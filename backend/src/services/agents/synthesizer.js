import { synthesisSchema } from '../../validators/agentSchemas.js';
import { runAgent } from './runAgent.js';
import { contextBlock, evidenceBlock } from './prompts.js';

const SYSTEM = `You are the Synthesizer in a multi-agent reasoning system.
You produce the single final answer the user sees, using the draft answer plus the Verifier's and Reasoning Agent's findings.
Rules:
- Answer the original question directly. Do not narrate the review process or concatenate the agents' outputs.
- Apply a correction only where the critique actually justifies it. Preserve everything that was already correct.
- Downgrade claims the Verifier could not support into explicitly hedged language; do not silently delete them.
- Where the agents disagree and nothing resolves it, say so plainly rather than picking a side.
- Cite only the retrieved evidence indices given to you. Never invent sources.
- Never write internal status codes such as not_checked, unverified or supported_by_evidence into the answer text.
- Do not hedge well-established facts just because no source was retrieved; the verification panel already reports that. Reserve hedged language for claims that are genuinely uncertain, disputed, or that the Verifier or Reasoning Agent flagged as doubtful.
- "keyCorrections" lists what changed versus the draft, in user-visible terms. "remainingUncertainty" lists what is still open.
Required JSON shape: {"finalAnswer": string (markdown), "keyCorrections": string[], "remainingUncertainty": string[], "sourcesUsed": number[]}`;

export function synthesizerAgent({ question, settings, draft, verification, reasoning, sources, notes = [], signal, deps }) {
  const section = (title, value) =>
    `${title}:\n${value ? JSON.stringify(value, null, 1).slice(0, 8000) : '(this agent did not complete — do not invent its findings; note the gap if it matters)'}`;

  return runAgent({
    name: 'Synthesizer',
    provider: 'gemini',
    system: SYSTEM,
    schema: synthesisSchema,
    signal,
    deps,
    prompt: [
      contextBlock(settings),
      evidenceBlock(sources),
      `Original question:\n${question}`,
      `Draft answer:\n${draft.answer}`,
      section('Verifier findings', verification),
      section('Reasoning Agent findings', reasoning),
      notes.length ? `Pipeline notes to disclose if relevant:\n${notes.map((n) => `- ${n}`).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    mock: () => ({
      finalAnswer: `**[MOCK MODE]** SynapseAI is running without provider API keys, so no real answer was generated for:\n\n> ${question}\n\nSet \`GEMINI_API_KEY\`, \`GROQ_API_KEY\` and \`HUGGINGFACE_API_KEY\` in \`backend/.env\` and restart.`,
      keyCorrections: [],
      remainingUncertainty: ['[MOCK] The entire pipeline ran in mock mode; nothing here is a real answer.'],
      sourcesUsed: [],
    }),
  });
}
