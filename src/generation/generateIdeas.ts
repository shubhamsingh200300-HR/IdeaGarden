import type { SignalAnalysisSummary } from "../analysis/signalAnalysis.js";
import type { OnPremVectorStore } from "../corpus/vectorStore.js";
import type { GenerationRequest, RequestConstraints } from "../requests/requestIntakeStore.js";
import { scrubText } from "../uploads/piiScrubber.js";
import { passesGate } from "./gate.js";
import type { GeneratedIdeaDraft, IdeaLlmClient, SponsorshipLevel } from "./ideaLlmClient.js";
import { scoreIdea } from "./rank.js";

/**
 * The manager's context/constraints come through ticket 10's public,
 * unauthenticated form with no scrubbing applied at submission time (the
 * raw text is kept there for the HRBP, who is authorized to see it).
 * Before anything reaches this ticket's external LLM call, it must be
 * anonymized - the same "only anonymized data reaches the LLM" rule
 * ticket 03 enforces for survey data. Unlike ticket 03's row-level
 * quarantine (which holds a whole row back for human review), there's no
 * review workflow for manager context here, so low-confidence name
 * candidates are redacted too rather than left as a flag - erring toward
 * over-redaction at this specific boundary, since nothing downstream can
 * review an under-redaction.
 */
function scrubForExternalLlm(text: string): string {
  const { redactedText, flaggedTerms } = scrubText(text);
  return flaggedTerms.reduce((result, term) => result.split(term).join("[NAME]"), redactedText);
}

function scrubConstraints(constraints: RequestConstraints): RequestConstraints {
  return {
    budget: scrubForExternalLlm(constraints.budget),
    time: scrubForExternalLlm(constraints.time),
    headcountLogistics: scrubForExternalLlm(constraints.headcountLogistics),
  };
}

export interface GenerateIdeasDeps {
  vectorStore: OnPremVectorStore;
  ideaLlmClient: IdeaLlmClient;
}

/** The user-facing shape - precedent grounding, raw rubric scores, and the structural-recurrence flag stay internal (ticket 06's own last checkbox). */
export interface PublicIdeaCard {
  title: string;
  description: string;
  signalAddressed: string;
  structuralFormat: string;
  ownerRole: string;
  sponsorshipLevel: SponsorshipLevel;
  estimatedCostInr: number;
  estimatedEffort: string;
  successMetric: string;
}

export interface GenerationResult {
  ideas: PublicIdeaCard[];
  /** How many negative/mixed-sentiment signals were diagnosed - lets a caller tell "fewer than 3 ideas because few problems were found" apart from something going wrong, rather than silently returning a short list. */
  candidateSignalCount: number;
}

const CORPUS_EXAMPLES_PER_SIGNAL = 3;
const MAX_IDEAS = 5;

function toPublicCard(idea: GeneratedIdeaDraft): PublicIdeaCard {
  return {
    title: idea.title,
    description: idea.description,
    signalAddressed: idea.signalAddressed,
    structuralFormat: idea.structuralFormat,
    ownerRole: idea.ownerRole!, // gate guarantees non-null
    sponsorshipLevel: idea.sponsorshipLevel!, // gate guarantees non-null
    estimatedCostInr: idea.estimatedCostInr,
    estimatedEffort: idea.estimatedEffort,
    successMetric: idea.successMetric,
  };
}

/**
 * Hybrid RAG + gate-then-rank (content-spec tickets 006/004): one
 * diagnosed signal (a negative/mixed free-text theme - positive themes
 * are strengths, not problems to address) yields one grounded candidate
 * idea. Every candidate is gated before ranking; only gate-passing
 * candidates are ranked and the top 3-5 returned.
 *
 * `additionalContext` supports ticket 07's regenerate-with-adjustment
 * flow: the HRBP can nudge a fresh generation attempt without the
 * manager needing to resubmit through ticket 10's invite flow again.
 * It's blended in for this call only, never persisted to the stored
 * request - the manager's original submission (ticket 10) remains the
 * record of truth.
 */
export async function generateIdeas(
  request: GenerationRequest,
  analysis: SignalAnalysisSummary,
  deps: GenerateIdeasDeps,
  additionalContext?: string,
): Promise<GenerationResult> {
  const candidateSignals = analysis.freeTextThemes.filter(
    (theme) => theme.sentiment === "negative" || theme.sentiment === "mixed",
  );

  const combinedContext = additionalContext ? `${request.context} ${additionalContext}` : request.context;
  const scrubbedContext = scrubForExternalLlm(combinedContext);
  const scrubbedConstraints = scrubConstraints(request.constraints);

  const scored: { idea: GeneratedIdeaDraft; score: number }[] = [];

  for (const theme of candidateSignals) {
    const queryText = `${theme.label} ${scrubbedContext}`;
    const corpusMatches = deps.vectorStore.retrieveBySignal(theme.label, queryText, CORPUS_EXAMPLES_PER_SIGNAL);

    const corpusExampleRefs = corpusMatches.map((entry) => ({
      company: entry.company,
      initiative: entry.initiative,
      structure: entry.structure,
    }));

    const draft = await deps.ideaLlmClient.generateIdea({
      signal: theme.label,
      context: scrubbedContext,
      constraints: scrubbedConstraints,
      corpusExamples: corpusExampleRefs,
    });

    if (!passesGate(draft)) continue;

    const score = scoreIdea(draft, {
      targetSignal: theme.label,
      corpusExamplesUsed: corpusExampleRefs,
      corpusExamplesRequested: CORPUS_EXAMPLES_PER_SIGNAL,
    });
    scored.push({ idea: draft, score });
  }

  scored.sort((a, b) => b.score - a.score);

  return {
    ideas: scored.slice(0, MAX_IDEAS).map(({ idea }) => toPublicCard(idea)),
    candidateSignalCount: candidateSignals.length,
  };
}
