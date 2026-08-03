function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Corpus entry ids are hand-authored slugs in the original 71 entries
 * (e.g. "netflix-freedom-responsibility-keeper-test") - an agent-proposed
 * entry needs the same shape so it reads naturally alongside them in the
 * markdown file, with a numeric suffix on collision rather than silently
 * overwriting or rejecting a legitimately similarly-named proposal.
 */
export function generateUniqueEntryId(company: string, initiative: string, existingIds: Iterable<string>): string {
  const base = slugify(`${company}-${initiative}`);
  const used = new Set(existingIds);

  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}
