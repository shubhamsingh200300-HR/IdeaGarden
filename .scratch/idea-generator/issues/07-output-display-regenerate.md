# 07 — Output display + regenerate

**What to build:** The HRBP sees the generated top 3-5 ideas as complete, actionable cards, and can request a fresh batch if none fit.

**Blocked by:** 06 (Idea generation: hybrid RAG + gate-then-rank)

**Status:** ready-for-agent

- [ ] Each idea displays exactly seven fields: title, description, signal addressed, structural format (cadence/day-to-day shape), suggested ownership & sponsorship level, estimated effort/cost (denominated in INR), and suggested success metric
- [ ] No confidence scores, raw rubric scores, or corpus attribution are shown to the HRBP
- [ ] Output is visible only to the requesting HRBP — never to the manager or any other role
- [ ] HRBP can trigger regeneration of a fresh batch, optionally after adjusting the original request's context/constraints (ticket 04)
- [ ] Tests cover: all seven fields render for each of the 3-5 ideas; cost displays in INR; regeneration produces a new batch without requiring a brand-new request from scratch
