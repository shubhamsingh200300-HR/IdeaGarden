# 08 — Post-launch tracking

**What to build:** An HRBP marks an idea as adopted; the platform automatically tracks the targeted signal's movement at the next survey cycle and uses the outcome to inform future generations for that same team.

**Blocked by:** 03 (Survey ingestion pipeline), 07 (Output display + regenerate)

**Status:** implemented

**Implementation note:** new `src/tracking/` module: `AdoptedIdeaStore` (append-only, per-team, encrypted like every other store), `signalMatch.ts` (fuzzy-matches an idea's `signalAddressed` back to a theme label via the same cosine-similarity approach `rank.ts` already uses for fit, since the LLM's phrasing isn't guaranteed to match verbatim), `adoptIdea.ts` (captures a baseline snapshot at adoption time - the only chance to do so, since `DerivedDataStore` only ever keeps the latest cycle), and `recordCycleOutcomes.ts` (runs automatically inside `uploadRoutes.ts` right after a fresh annual-survey ingest, comparing every pending adoption's targeted signal - no separate HRBP action). `rank.ts` gained a per-team past-failure penalty (soft demotion, not a fifth gate disqualifier) so a near-duplicate of something that didn't move the signal doesn't win top rank on a later generation. HTML surface: a "Mark as adopted" form on each idea card and an "Adopted ideas" before/after section on the ideas page (`ideaPagesRoutes.ts`); JSON mirror: `POST /:teamId/ideas/adopt` (`generationRoutes.ts`).

**Code review (two-axis) caught:**
- **Standards:** flagged `RunGenerationDeps.adoptedIdeaStore` as required rather than optional like `AppDeps`'s other dependency bags (`ingestDeps?`, `analysisDeps?`, `generationDeps?`) - kept as required and documented why: unlike those, there's no coherent "generation without the ability to adopt" deployment once this ticket ships, since the adopt routes mount unconditionally alongside generation itself.
- **Spec:** the two named acceptance-test scenarios were each covered only in isolation (adopt via real HTTP in one test, outcome recorded via direct store call in another) - never chained end-to-end. Added `src/tracking/postLaunchTracking.test.ts`, a real-HTTP integration test driving the full flow (upload cycle 1 → generate → adopt → upload cycle 2 → view page) and asserting the before/after comparison is actually visible in the rendered HTML.
- **Spec (scope creep):** removed a `GET /:teamId/ideas/adoptions` JSON listing endpoint that wasn't asked for by the ticket - AC3 ("surfaced to the HRBP") is already satisfied by the HTML page's Adopted ideas section.
- **Disclosed, not changed:** the past-failure ranking penalty demotes a near-duplicate idea rather than excluding it outright. This matches the ticket's own acceptance-test wording verbatim - "doesn't re-rank a highly similar failed idea to the top" - which is a ranking claim, not an exclusion claim, even though the descriptive bullet above it ("avoid re-suggesting") reads more strongly in isolation.

- [ ] HRBP can mark one of the ideas shown to them (ticket 07) as "adopted" for their team — a lightweight action, not a full report form
- [ ] When a team's next-cycle survey is uploaded (ticket 03), the platform automatically compares the adopted idea's targeted signal score between the triggering cycle and the new cycle, with no further HRBP effort required
- [ ] The comparison result is surfaced to the HRBP for that team
- [ ] Adopted initiatives and their tracked outcomes inform future generation requests for that same team (e.g., avoid re-suggesting a variant of something that didn't move the signal) — this feedback loop is scoped per-team only, not written back into the shared benchmark corpus
- [ ] Tests cover: marking an idea adopted, then uploading a next-cycle survey, produces a visible before/after comparison for the targeted signal; a second generation request for the same team reflects the prior outcome (e.g., doesn't re-rank a highly similar failed idea to the top)
