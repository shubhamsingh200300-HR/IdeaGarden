# 09 — Corpus growth workflow

**What to build:** The benchmark corpus grows over time through agent-proposed, human-approved additions, with the vector store re-indexing automatically on each approved change.

**Blocked by:** 02 (Benchmark corpus + on-prem retrieval)

**Status:** ready-for-agent

- [ ] A research agent can be run to propose candidate new corpus entries with sources, following the same sourcing standard as the existing 71 entries (primary sources or named, attributed press; no unsourced claims)
- [ ] Nothing is added to the live corpus without explicit human review and approval of a proposed entry
- [ ] Approving a new entry triggers re-indexing (embedding + adding to the on-prem vector store) automatically — not on a periodic schedule
- [ ] Rejected proposals are discarded, not silently retried
- [ ] Tests cover: an approved proposal becomes retrievable via ticket 02's retrieval query; a rejected proposal never appears in retrieval results
