# 02 — Benchmark corpus + on-prem retrieval

**What to build:** The 71-initiative benchmark corpus (see `wayfinder/research/benchmark-corpus.md`) is embedded into an on-prem vector store, tagged by signal, and retrievable by a signal-scoped similarity query.

**Blocked by:** None — can start immediately (parallel to 01, 03)

**Status:** ready-for-agent

- [ ] All corpus entries are loaded and embedded using an on-prem embedding model (no cloud embedding API)
- [ ] Each entry retains its primary/secondary signal tags (autonomy, growth/mastery, recognition, cross-team visibility, psychological safety, belonging, career progression clarity, purpose/impact visibility)
- [ ] A retrieval query scoped to a given signal returns entries tagged with that signal, ranked by semantic similarity — not a pure whole-corpus similarity search with no signal filter
- [ ] Retrieval and the vector store both run on-prem, consistent with the on-prem hosting mandate
- [ ] Tests cover: a query for a given signal returns only same-signal entries, ranked sensibly; a query for a signal with few/no matching entries degrades gracefully
