# 09 — Corpus growth workflow

**What to build:** The benchmark corpus grows over time through agent-proposed, human-approved additions, with the vector store re-indexing automatically on each approved change.

**Blocked by:** 02 (Benchmark corpus + on-prem retrieval)

**Status:** implemented

**Implementation note:** new corpus-growth surface, all under `src/corpus/`: `CorpusProposalStore` (encrypted, global/not-per-team, holds every proposal - pending, approved, and rejected - as a durable log so a rejection is visibly discarded rather than deleted or retried), `corpusSlug.ts` (generates a stable, collision-safe id matching the original 71 entries' hand-authored slug shape), `corpusFile.ts` (`appendCorpusEntry` - renders an approved entry back into the exact `### id: ...` markdown block `parseBenchmarkCorpus.ts` expects, so it survives a process restart), and `approveProposal.ts` (the orchestration that ties approval to both the file append and immediate re-indexing). `OnPremVectorStore` gained its first mutation - `addEntry` rebuilds the TF-IDF index over the full entry set in place, so every existing holder of that same instance (generation included) sees the addition on its very next call with no restart. JSON API only (`corpusRoutes.ts`, `POST/GET /api/corpus/proposals`, `POST /api/corpus/proposals/:entryId/{approve,reject}`) - no HTML review page, since the ticket's own test criteria are about retrieval behavior, not a UI, and the last ticket's review specifically flagged unrequested surface area.

**Design notes disclosed up front, not found by review:**
- "A research agent can be run to propose" is satisfied by the submission endpoint existing, not by this app running a research agent itself - a proposal is expected to arrive the same way the original 71 entries did, via a human-invoked `/research` subagent working outside the app, then POSTed here for review.
- The sourcing-standard check is a deliberately thin structural gate (non-empty, URL-shaped sources) - judging whether a source is genuinely primary/attributed is exactly what the ticket's own "explicit human review" checkbox exists to catch; automating that judgment would mean fetching and assessing arbitrary URLs, well beyond this ticket.
- No new authorization role: these routes gate on `requireAuth` alone (not team-scoped, since the corpus is shared infrastructure), matching every other authenticated endpoint's trust boundary in this app today.

**Code review (two-axis) caught:**
- **Standards:** `OnPremVectorStore`'s constructor didn't defensively copy its input array the way the new `addEntry` does - fixed so a caller mutating the array it passed in can't desync `entries` from the index. Also extracted the field-by-field request-body coercion in `corpusRoutes.ts` into a small `parseProposalInput` helper, and collapsed a redundant `CorpusRoutesDeps` interface (it restated a field `ApproveProposalDeps` already declared) into a plain type alias.
- **Spec:** flagged that nothing in the diff documents the connection between "a research agent can be run to propose" and how a proposal actually reaches the endpoint - added the design note above (and a matching code comment on `buildCorpusRoutes`) making that explicit rather than leaving it implicit.
- **Disclosed, not changed:** the sourcing-standard validation only checks for a non-empty, URL-shaped source list, not genuine primary/attributed provenance - confirmed as the intended two-layer design (automated minimum + human judgment at approval), not a gap to close here.

- [ ] A research agent can be run to propose candidate new corpus entries with sources, following the same sourcing standard as the existing 71 entries (primary sources or named, attributed press; no unsourced claims)
- [ ] Nothing is added to the live corpus without explicit human review and approval of a proposed entry
- [ ] Approving a new entry triggers re-indexing (embedding + adding to the on-prem vector store) automatically — not on a periodic schedule
- [ ] Rejected proposals are discarded, not silently retried
- [ ] Tests cover: an approved proposal becomes retrievable via ticket 02's retrieval query; a rejected proposal never appears in retrieval results
