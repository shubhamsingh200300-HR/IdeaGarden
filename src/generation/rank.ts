import { cosineSimilarity, tokenize, type TermVector } from "../corpus/textVector.js";
import type { CorpusExampleRef, GeneratedIdeaDraft, SponsorshipLevel } from "./ideaLlmClient.js";

export interface FailedPriorIdea {
  title: string;
  description: string;
  signalAddressed: string;
}

export interface RankingContext {
  targetSignal: string;
  corpusExamplesUsed: CorpusExampleRef[];
  corpusExamplesRequested: number;
  /** Ticket 08: this team's own past adoptions whose targeted signal didn't move. Omit (or pass []) when there's no adoption history yet. */
  failedPriorIdeas?: FailedPriorIdea[];
}

// Content-spec quality rubric (ticket 004): weighted, highest first - fit,
// feasibility, structural ambition, precedent grounding. Precedent
// grounding and the raw score itself are internal only, never exposed.
const WEIGHT_FIT = 4;
const WEIGHT_FEASIBILITY = 3;
const WEIGHT_STRUCTURAL_AMBITION = 2;
const WEIGHT_PRECEDENT_GROUNDING = 1;
// Ticket 08's feedback loop: a soft demotion, not a fifth hard gate
// disqualifier - the content-spec rubric's four gate criteria stay the
// only pass/fail line (gate.ts). Weighted between feasibility and
// structural ambition so a strong near-duplicate can still surface if
// nothing better exists, just not win the top rank over a genuinely
// different approach. This matches ticket 08's own acceptance criterion
// verbatim - "doesn't re-rank a highly similar failed idea to the top" -
// which is a ranking claim, not an exclusion claim.
const WEIGHT_PAST_FAILURE_PENALTY = 3;

const STRUCTURAL_AMBITION_BY_SPONSORSHIP: Record<SponsorshipLevel, number> = {
  team: 0.33,
  org: 0.66,
  exec: 1,
};

function termFrequencyVector(text: string): TermVector {
  const vector: TermVector = new Map();
  for (const token of tokenize(text)) {
    vector.set(token, (vector.get(token) ?? 0) + 1);
  }
  return vector;
}

/** Graduated textual similarity between the targeted signal and what the idea claims to address - a close paraphrase scores between an exact match and a totally unrelated drift, not a single fixed "partial credit" constant. */
function fitScore(idea: GeneratedIdeaDraft, targetSignal: string): number {
  return cosineSimilarity(termFrequencyVector(idea.signalAddressed), termFrequencyVector(targetSignal));
}

/**
 * A self-reported field from a call with full natural-language context on
 * both sides (constraints and the idea's own cost/time ask) - computing
 * this independently without NLP understanding of free-text constraints
 * isn't realistic. Clamped defensively: an out-of-range value from a
 * misbehaving response must not dominate or invert ranking.
 */
function feasibilityScore(idea: GeneratedIdeaDraft): number {
  return Math.max(0, Math.min(1, idea.feasibilityScore));
}

/**
 * Actual textual overlap between the idea and the strongest-matching
 * retrieved precedent - not merely "did retrieval return enough entries."
 * An idea that ignores its grounding examples and hallucinates something
 * unrelated scores low here even if retrieval succeeded.
 */
function precedentGroundingScore(idea: GeneratedIdeaDraft, examples: CorpusExampleRef[]): number {
  if (examples.length === 0) return 0;
  const ideaVector = termFrequencyVector(`${idea.title} ${idea.description}`);
  const similarities = examples.map((example) =>
    cosineSimilarity(ideaVector, termFrequencyVector(`${example.initiative} ${example.structure}`)),
  );
  return Math.max(...similarities);
}

/**
 * Textual overlap (title + description + signalAddressed) between this
 * candidate and the closest of this team's own past ideas that didn't move
 * its targeted signal - a graduated similarity, same shape as
 * precedentGroundingScore, not a binary "is this the same idea" check.
 */
function pastFailureSimilarity(idea: GeneratedIdeaDraft, failedPriorIdeas: FailedPriorIdea[]): number {
  if (failedPriorIdeas.length === 0) return 0;
  const ideaVector = termFrequencyVector(`${idea.title} ${idea.description} ${idea.signalAddressed}`);
  const similarities = failedPriorIdeas.map((failed) =>
    cosineSimilarity(ideaVector, termFrequencyVector(`${failed.title} ${failed.description} ${failed.signalAddressed}`)),
  );
  return Math.max(...similarities);
}

export function scoreIdea(idea: GeneratedIdeaDraft, ctx: RankingContext): number {
  const structuralAmbition = idea.sponsorshipLevel
    ? STRUCTURAL_AMBITION_BY_SPONSORSHIP[idea.sponsorshipLevel]
    : 0;

  return (
    fitScore(idea, ctx.targetSignal) * WEIGHT_FIT +
    feasibilityScore(idea) * WEIGHT_FEASIBILITY +
    structuralAmbition * WEIGHT_STRUCTURAL_AMBITION +
    precedentGroundingScore(idea, ctx.corpusExamplesUsed) * WEIGHT_PRECEDENT_GROUNDING -
    pastFailureSimilarity(idea, ctx.failedPriorIdeas ?? []) * WEIGHT_PAST_FAILURE_PENALTY
  );
}
