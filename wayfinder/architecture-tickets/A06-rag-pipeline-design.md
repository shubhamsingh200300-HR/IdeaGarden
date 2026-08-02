---
id: "A06"
title: RAG pipeline / vector store design
labels: [wayfinder:grilling]
status: closed
assignee: current-session
blocked_by: []
---

## Resolution

1. **Vector store & embeddings: on-prem.** A self-hosted vector database and a locally-run open-source embedding model, consistent with A03's on-prem mandate covering "any model-serving components." Keeps the retrieval query itself (which includes a team's diagnosed signals, derived from real team data) from ever needing to leave the on-prem boundary, even though the corpus content alone wouldn't have strictly required it.
2. **Retrieval: filter by signal tag, then rank by similarity.** Narrow to corpus entries tagged with the same primary/secondary signal as the team's diagnosed issue first, then rank those by semantic similarity. Matches how the corpus is already organized and avoids retrieving superficially similar text that addresses a different underlying signal — consistent with the quality gate's requirement that every idea target a specific, named signal.
3. **Corpus growth: semi-automated, agent-assisted, human-approved.** A research agent periodically proposes candidate new initiatives with sources (mirroring how the original 71-entry corpus was built); nothing is added without human review and approval. Re-indexing is event-triggered — runs on each approved corpus update, not a periodic schedule — since the corpus is small enough that re-embedding on every change is cheap and keeps the vector store always consistent with no lag window.

## Question

Given the LLM/embedding provider chosen in A02, how is the 71-initiative benchmark corpus (wayfinder/research/benchmark-corpus.md) embedded, indexed, and retrieved at generation time? What vector store/technology is used, how is retrieval scoped (e.g., by primary signal tag), and how does the corpus get updated/re-indexed as new initiatives are added over time?
