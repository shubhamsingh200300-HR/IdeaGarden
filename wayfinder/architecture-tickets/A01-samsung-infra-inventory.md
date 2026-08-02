---
id: "A01"
title: "Task: Samsung internal infrastructure & AI policy inventory"
labels: [wayfinder:task]
status: closed
assignee: current-session
blocked_by: []
---

## Question

This is a fact-finding task, not a decision — the answers live inside Samsung, not in public documentation, so it's on the human to go find them (HITL). Before the LLM hosting/provider strategy (A02), hosting environment (A03), and identity/access-control (A04) tickets can be responsibly decided, find out:

1. **AI/LLM infrastructure**: Does Samsung already have an internal LLM platform, an approved enterprise agreement with a third-party LLM provider (with data-processing/no-retention terms), or an approved pattern for on-prem/private model hosting? Who owns this decision internally (an AI platform team, security team)?
2. **Hosting/cloud policy for sensitive HR data**: Is Samsung R&D permitted to host HR-adjacent data (exit interviews, survey responses) on public cloud, or is on-prem/private-cloud mandatory for this data class? Are there data-residency requirements (e.g., must stay in a specific country/region)?
3. **Identity/SSO**: What identity provider or SSO system does Samsung R&D tooling typically integrate with, and what's the standard pattern for a new internal tool to authenticate against it?

## Resolution

1. **AI/LLM infrastructure**: Claude Enterprise and Gemini Enterprise are both available/approved.
2. **Hosting/cloud policy**: On-prem hosting is required for this data class — not public cloud, not Samsung private cloud (unless "on-prem" is later clarified to include Samsung-operated private cloud; taken literally as on-prem for now).
3. **Identity/SSO**: Not yet known — graduated into a new ticket, [A08](A08-sso-inventory.md), since it's the only remaining unknown and now blocks just one downstream ticket (A04) rather than three.
