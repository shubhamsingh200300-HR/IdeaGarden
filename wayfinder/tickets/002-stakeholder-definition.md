---
id: "002"
title: Stakeholder definition — who inputs what
labels: [wayfinder:grilling]
status: closed
assignee: current-session
blocked_by: []
---

## Resolution

Two stakeholder roles feed the platform per team, both giving a mix of structured and free-text input:

- **Manager**: free-text context (situational narrative — recent events, team dynamics, what they think is going on) + constraints (budget, time, headcount/logistics limits the generator must respect). No structured ratings — that would duplicate the HRBP's survey data.
- **HRBP**: uploads the team's annual culture survey results as an Excel file (the platform must support this upload and let the data be sliced/filtered by various parameters — e.g. by sub-team, tenure, role), **plus** free-text context (organizational nuance a survey can't capture — attrition events, reorgs, sensitive dynamics). The AI is responsible for analyzing the uploaded survey data, not the HRBP manually interpreting it first.

Explicitly deferred, not decided here: whether the Manager and/or HRBP have veto/approval authority over generated ideas before a team sees them — that's ticket 008 (human-in-the-loop)'s question, not an input-definition question.

Team-sample input (surveying the team directly, beyond the annual survey) was considered and dropped — the annual survey plus HRBP context already carries the "ground truth" role that direct sampling would have served.

## Question

Who counts as an "important stakeholder" for a given team when the platform gathers input (team manager, HRBP, skip-level, peer engineers, the requesting team itself)? For each stakeholder type included, what do they concretely provide — free-text pain points, structured ratings, constraints (budget, time, headcount), veto/approval authority over generated ideas? This decision fixes the shape of the input side of the spec, distinct from the culture-data side (ticket 003).
