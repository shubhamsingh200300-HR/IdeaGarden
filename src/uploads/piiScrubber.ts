import nlp from "compromise";

export interface ScrubResult {
  redactedText: string;
  needsQuarantine: boolean;
  flaggedTerms: string[];
}

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Covers NANP 3-3-4 (with optional parens/no separators) and +CC 5-5 (e.g. Indian mobile numbers).
// Not exhaustive of every international format - a real deployment should confirm formats actually
// seen in Samsung's exports rather than guess further, to avoid false-positive redaction of other data.
const PHONE_PATTERN = /\+\d{1,3}[-.\s]\d{4,5}[-.\s]\d{4,5}\b|\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
// Assumes a letter-prefix format (e.g. "EMP-48213"). This is a guess, not a confirmed Samsung
// format - purely numeric or lowercase employee IDs would need a different, confirmed pattern.
const EMPLOYEE_ID_PATTERN = /\b[A-Z]{2,6}-\d{3,8}\b/g;

/** Regex-only redaction (email/phone/employee-ID) - safe to apply to any column, structured or free-text. */
export function redactPatterns(text: string): string {
  return text
    .replace(EMAIL_PATTERN, "[EMAIL]")
    .replace(PHONE_PATTERN, "[PHONE]")
    .replace(EMPLOYEE_ID_PATTERN, "[EMPLOYEE_ID]");
}

/**
 * On-prem PII scrubbing: regex handles pattern-matchable PII (deterministic,
 * always redacted). Person-name detection uses `compromise` — a local,
 * lexicon/rule-based NLP library (no network call, no model download) as a
 * lighter-weight on-prem stand-in for a full neural NER model. Its name
 * detection is not perfect (e.g. some non-Western first names go
 * undetected entirely — a residual false-negative risk inherent to any
 * automated detector, not something this quarantine step can catch since
 * it only flags candidates the detector actually found).
 *
 * Confidence rule: a multi-word match (e.g. "John Smith") is treated as
 * high-confidence and redacted directly. A single-word match (e.g. a first
 * name only) is treated as low-confidence and is NOT auto-redacted -
 * instead the row is flagged for quarantine so the HRBP (who already has
 * raw-data access) decides, rather than the pipeline guessing.
 *
 * `compromise`'s `.people()` only tags person names, not other entity
 * types (organizations, locations) that could also help re-identify
 * someone in combination with other fields - a scope limit worth knowing
 * about, not something this function currently covers.
 */
export function scrubText(text: string): ScrubResult {
  let redactedText = redactPatterns(text);

  const people = nlp(redactedText).people().out("array") as string[];
  const flaggedTerms: string[] = [];

  for (const candidate of people) {
    if (candidate.trim().includes(" ")) {
      redactedText = redactedText.split(candidate).join("[NAME]");
    } else {
      flaggedTerms.push(candidate);
    }
  }

  return {
    redactedText,
    needsQuarantine: flaggedTerms.length > 0,
    flaggedTerms,
  };
}
