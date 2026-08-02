/**
 * Two of the ticket's own canonical signal names contain a slash
 * ("growth/mastery", "purpose/impact visibility") — those must never be
 * split. Everything else with a slash (e.g. "recognition/rest",
 * "psychological safety/inclusion") is the corpus tagging two distinct
 * signals at once and should be.
 */
const CANONICAL_SIGNALS_WITH_SLASH = new Set(["growth/mastery", "purpose/impact visibility"]);

/**
 * The corpus records signal tags in a few shapes beyond a plain name:
 * compound ("recognition/rest" — tags two signals at once, except the
 * canonical exceptions above) and qualified ("psychological safety
 * (fairness)" — a base signal with a parenthetical aside, which may
 * itself contain a comma). This expands either shape into the matchable
 * base tag(s), lowercased, so a query for "recognition" or "rest" both
 * find the former, and a query for "psychological safety" finds the latter.
 */
export function expandSignalTags(raw: string): string[] {
  const withoutQualifier = raw.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();

  if (CANONICAL_SIGNALS_WITH_SLASH.has(withoutQualifier)) {
    return [withoutQualifier];
  }

  return withoutQualifier
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}
