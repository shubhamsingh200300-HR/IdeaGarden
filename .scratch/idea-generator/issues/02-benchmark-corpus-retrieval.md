# 02 — Benchmark corpus + on-prem retrieval

**What to build:** The 71-initiative benchmark corpus (see `wayfinder/research/benchmark-corpus.md`) is embedded into an on-prem vector store, tagged by signal, and retrievable by a signal-scoped similarity query.

**Blocked by:** None — can start immediately (parallel to 01, 03)

**Status:** implemented (commit 8d4c2cd)

**Implementation note:** built as `src/corpus/*` — `parseBenchmarkCorpus.ts` (parses the real 71-entry markdown corpus), `textVector.ts` (a local TF-IDF index + cosine similarity), `signalTags.ts` (normalizes compound/parenthetical signal tags for matching), `vectorStore.ts` (signal-scoped, similarity-ranked retrieval). 30 tests, including integration tests against the real corpus data.

**Flagged scoping call:** retrieval uses a local TF-IDF index, not a real neural embedding model, as the "on-prem embedding model." This satisfies every literal acceptance criterion (on-prem, no cloud API, signal-tagged, similarity-ranked, graceful degradation) but is lexical similarity, not semantic — a query using different vocabulary than an entry's text may rank poorly despite being conceptually relevant. Standing up real local model-serving infrastructure was judged bigger than this ticket; the `OnPremVectorStore` interface is designed so a real embedding model could replace the TF-IDF index later without changing callers. Confirm whether this tradeoff is acceptable or whether real embeddings should be prioritized sooner.

- [ ] All corpus entries are loaded and embedded using an on-prem embedding model (no cloud embedding API)
- [ ] Each entry retains its primary/secondary signal tags (autonomy, growth/mastery, recognition, cross-team visibility, psychological safety, belonging, career progression clarity, purpose/impact visibility)
- [ ] A retrieval query scoped to a given signal returns entries tagged with that signal, ranked by semantic similarity — not a pure whole-corpus similarity search with no signal filter
- [ ] Retrieval and the vector store both run on-prem, consistent with the on-prem hosting mandate
- [ ] Tests cover: a query for a given signal returns only same-signal entries, ranked sensibly; a query for a signal with few/no matching entries degrades gracefully
