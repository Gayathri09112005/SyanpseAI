export const STYLE_GUIDANCE = {
  concise: 'Answer in the fewest words that are still complete. Prefer 1-3 short paragraphs or a tight list.',
  balanced: 'Give a well-structured answer with enough detail to be useful, without padding.',
  detailed: 'Give a thorough answer: cover mechanism, caveats, and worked examples where they help.',
};

export const DOMAIN_GUIDANCE = {
  auto: 'Infer the domain from the question and adapt your depth and vocabulary accordingly.',
  general: 'Treat this as a general-knowledge question for an intelligent non-specialist.',
  coding: 'Treat this as a programming question. Give runnable code, state language/version assumptions, and check for bugs.',
  education: 'Treat this as a teaching question. Build up from fundamentals and name the concept being used.',
  research: 'Treat this as a research question. Separate established findings from open questions and contested claims.',
  technical: 'Treat this as a technical/engineering question. Be precise about units, tradeoffs, and failure modes.',
};

export const DEPTH_GUIDANCE = {
  fast: 'Check only the central claim and the single most likely failure point. Keep findings brief.',
  light: 'Cover the main reasoning path and flag only clear problems.',
  standard: 'Cover the main reasoning path and the most likely failure points.',
  thorough: 'Examine every claim and step; include notable edge cases and alternative interpretations.',
  exhaustive: 'Be exhaustive: enumerate edge cases, boundary conditions, alternative interpretations and second-order effects.',
};

export function contextBlock(settings) {
  return [
    `Answer style: ${settings.answerStyle}. ${STYLE_GUIDANCE[settings.answerStyle]}`,
    `Domain: ${settings.domain === 'auto' ? 'not specified' : settings.domain}. ${DOMAIN_GUIDANCE[settings.domain]}`,
    `Analysis depth: ${settings.reasoningDepth}. ${DEPTH_GUIDANCE[settings.reasoningDepth]}`,
  ].join('\n');
}

export function historyBlock(history = []) {
  if (!history.length) return '';
  const lines = history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${String(m.content).slice(0, 1200)}`)
    .join('\n');
  return `\nEarlier conversation (for context; the current question is what you must answer):\n${lines}\n`;
}

export function evidenceBlock(sources = []) {
  if (!sources.length) {
    return 'No external evidence was retrieved. You must therefore mark every factual claim as "unverified" or "not_checked". Never invent sources, URLs or quotations.';
  }
  const lines = sources
    .map((s, i) => `[${i}] ${s.title || 'Untitled'} — ${s.url}\n    ${String(s.snippet || '').slice(0, 600)}`)
    .join('\n');
  return `Retrieved evidence (cite by index in evidenceIds; these are the ONLY sources you may cite — never invent others):\n${lines}`;
}
