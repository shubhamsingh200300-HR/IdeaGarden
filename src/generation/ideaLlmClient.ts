import type { RequestConstraints } from "../requests/requestIntakeStore.js";

export type SponsorshipLevel = "team" | "org" | "exec";

export interface CorpusExampleRef {
  company: string;
  initiative: string;
  structure: string;
}

export interface IdeaGenerationInput {
  signal: string;
  context: string;
  constraints: RequestConstraints;
  corpusExamples: CorpusExampleRef[];
}

/**
 * feasibilityScore is a self-assessment from the same generation call that
 * has full natural-language context on both the constraints and its own
 * idea's cost/time ask - computing this independently without NLP
 * understanding of free-text constraints isn't realistic, and the LLM
 * already has everything it needs to judge fit.
 */
export interface GeneratedIdeaDraft {
  title: string;
  description: string;
  signalAddressed: string;
  structuralFormat: string;
  isRecurringOrStructural: boolean;
  ownerRole: string | null;
  sponsorshipLevel: SponsorshipLevel | null;
  estimatedCostInr: number;
  estimatedEffort: string;
  successMetric: string;
  feasibilityScore: number;
}

export interface IdeaLlmClient {
  /** Only ever called with already-anonymized context/constraints (technical-architecture-spec.md Section 2). */
  generateIdea(input: IdeaGenerationInput): Promise<GeneratedIdeaDraft>;
}
