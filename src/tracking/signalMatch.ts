import type { FreeTextTheme } from "../analysis/signalAnalysis.js";
import { cosineSimilarity, tokenize, type TermVector } from "../corpus/textVector.js";

function vectorOf(text: string): TermVector {
  const vector: TermVector = new Map();
  for (const token of tokenize(text)) vector.set(token, (vector.get(token) ?? 0) + 1);
  return vector;
}

const MIN_MATCH_SIMILARITY = 0.2;

/**
 * An idea's signalAddressed is the LLM's own paraphrase of the theme it was
 * generated from (generateIdeas.ts imposes no exact-match constraint - the
 * gate only checks the field is non-empty), so re-finding "the same signal"
 * in a later analysis needs the same fuzzy fit rank.ts already uses for
 * ranking, not a string match. Below the threshold, treat the signal as no
 * longer present rather than forcing a match onto an unrelated theme.
 */
export function findMatchingTheme(themes: FreeTextTheme[], signalAddressed: string): FreeTextTheme | null {
  const target = vectorOf(signalAddressed);

  let best: { theme: FreeTextTheme; score: number } | null = null;
  for (const theme of themes) {
    const score = cosineSimilarity(target, vectorOf(theme.label));
    if (score >= MIN_MATCH_SIMILARITY && (!best || score > best.score)) {
      best = { theme, score };
    }
  }

  return best?.theme ?? null;
}
