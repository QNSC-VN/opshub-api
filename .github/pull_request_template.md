## Linked ticket
<!-- Required: paste the ticket URL or ID -->
Closes #<!-- TICKET-XXX -->

## What changed and why
<!-- 2-5 sentences. What does this PR do? Why is this the right approach? -->

## Type of change
- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `refactor` — no behaviour change
- [ ] `perf` — performance improvement
- [ ] `security` — security fix or hardening
- [ ] `chore` / `ci` / `deps` — tooling, config, deps

## How to test
<!-- Steps for the reviewer to verify this works -->
1.
2.

## Security checklist
<!-- For auth, data access, or API changes — skip if not applicable -->
- [ ] No secrets logged or exposed in error messages
- [ ] Input validated at the boundary (Zod / nestjs-zod)
- [ ] New endpoints have `@UseGuards(JwtAuthGuard)` + role check
- [ ] Sensitive fields (tokens, passwords) are never returned in responses
- [ ] Migration is zero-downtime (expand-contract pattern)
- [ ] New DB columns / tables have appropriate indexes

## Reviewer notes
<!-- Anything the reviewer should pay special attention to -->
