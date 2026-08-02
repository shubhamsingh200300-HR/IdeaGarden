# 08 — Post-launch tracking

**What to build:** An HRBP marks an idea as adopted; the platform automatically tracks the targeted signal's movement at the next survey cycle and uses the outcome to inform future generations for that same team.

**Blocked by:** 03 (Survey ingestion pipeline), 07 (Output display + regenerate)

**Status:** ready-for-agent

- [ ] HRBP can mark one of the ideas shown to them (ticket 07) as "adopted" for their team — a lightweight action, not a full report form
- [ ] When a team's next-cycle survey is uploaded (ticket 03), the platform automatically compares the adopted idea's targeted signal score between the triggering cycle and the new cycle, with no further HRBP effort required
- [ ] The comparison result is surfaced to the HRBP for that team
- [ ] Adopted initiatives and their tracked outcomes inform future generation requests for that same team (e.g., avoid re-suggesting a variant of something that didn't move the signal) — this feedback loop is scoped per-team only, not written back into the shared benchmark corpus
- [ ] Tests cover: marking an idea adopted, then uploading a next-cycle survey, produces a visible before/after comparison for the targeted signal; a second generation request for the same team reflects the prior outcome (e.g., doesn't re-rank a highly similar failed idea to the top)
