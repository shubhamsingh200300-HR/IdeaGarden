---
id: "010"
title: Post-launch impact measurement — tracking the suggested success metric
labels: [wayfinder:grilling]
status: closed
assignee: current-session
blocked_by: []
---

## Resolution

**Tracking mechanism: "mark as adopted" + automatic cycle comparison.** The HRBP marks which of the 3-5 ideas (if any) they actually ran — a lightweight note, not full manual reporting. That mark is what makes automatic inference meaningful: the platform then automatically compares the specific targeted signal's score between the survey cycle that triggered the recommendation and the next cycle (annual or pulse), with no further HRBP effort. Pure automatic inference alone was rejected — the platform can't attribute a score change to a specific initiative without first knowing which one (if any) was actually adopted.

**Feedback loop: scoped to the same team only, not the shared benchmark corpus.** Adopted initiatives and their tracked outcomes inform future generations for that same team (e.g., avoid re-suggesting a variant of something that already didn't move the signal; lean toward structural patterns that did work for them). Outcomes do **not** automatically feed into the shared benchmark corpus (ticket 005) — doing so would require its own quality bar (distinguishing a genuine strong outcome from a fluke or confounded result) that isn't designed yet, and conflating unproven internal results with the vetted external corpus risks degrading its credibility over time. Corpus-contribution from real outcomes is a plausible future extension, explicitly not in this version's scope.

## Question

Each generated initiative includes a suggested success metric (ticket 007), but nothing yet specifies how that metric actually gets tracked once a team adopts an initiative — is it manual (the manager self-reports outcomes later), tied to the next annual/pulse survey cycle (compare the specific signal's score before/after), or something else? This also determines whether adopted initiatives and their outcomes feed back into anything (e.g., informing future generations for that team, or contributing real-world outcome data back toward the benchmark corpus over time) or are a one-shot recommendation with no feedback loop.
