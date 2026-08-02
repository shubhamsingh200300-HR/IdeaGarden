import type { GeneratedIdeaDraft } from "./ideaLlmClient.js";

const GENERIC_PERK_KEYWORDS = [
  "outing",
  "cake",
  "birthday",
  "swag",
  "snack",
  "happy hour",
  "team lunch",
  "picnic",
  "party",
];

/**
 * Content-spec quality rubric's gate (ticket 004): four hard disqualifiers,
 * checked before ranking ever applies. An idea failing any one of these
 * is discarded outright, never shown at any rank.
 *
 * Disclosed limitation: criteria (2) and (3) trust fields the LLM reports
 * about its own output (isRecurringOrStructural, ownerRole,
 * sponsorshipLevel) with no independent cross-check against the idea's
 * actual title/description - a response that misreports these (e.g.
 * claiming isRecurringOrStructural regardless of the idea) would pass.
 * Only criterion (4) is verified against the idea's own text. Closing
 * this gap would need semantic verification (comparing the claim against
 * the generated text), which is out of scope here.
 */
export function passesGate(idea: GeneratedIdeaDraft): boolean {
  if (!idea.signalAddressed.trim()) return false; // (1) addresses a specific, named signal
  if (!idea.isRecurringOrStructural) return false; // (2) structural/recurring, not one-off
  if (!idea.ownerRole?.trim() || !idea.sponsorshipLevel) return false; // (3) defined owner and resourcing shape

  const text = `${idea.title} ${idea.description}`.toLowerCase();
  if (GENERIC_PERK_KEYWORDS.some((keyword) => text.includes(keyword))) return false; // (4) not a generic perk

  return true;
}
