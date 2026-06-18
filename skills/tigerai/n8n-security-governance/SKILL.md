---
name: n8n-security-governance
description: Review an AI-coded application or n8n workflow for production security and change-control readiness. Use for security audits, production readiness, enterprise governance, auth/SQL/secret review, SECURITY-CAVEATS.md, version control, rollback, release tagging, CI/CD, or before declaring a Code2n8n port deployable.
---

# n8n Security Governance

Use this skill as the production gate for AI Coding and Code2n8n work. A working demo is not automatically safe, traceable, or reversible.

## Required outputs

Produce all applicable artifacts:

1. `SECURITY-REVIEW.md`: scope, trust boundaries, checks, evidence, findings, and decision.
2. `SECURITY-CAVEATS.md`: unresolved findings that block or limit deployment.
3. `CHANGELOG.md` entry: user-visible security or workflow behavior changes.
4. Workflow change-history sticky note: internal version, date, and plain-language change.
5. Release traceability: source commit SHA, workflow version/tag, validation result, and rollback target.

Never include real secrets, tokens, passwords, credential values, or sensitive customer data.

## Security review

### 1. Establish scope and trust boundaries

Inventory:

- Public and internal entry points: webhook, REST, form, queue, schedule, CLI.
- Identities: user, admin, service account, n8n credential, worker.
- Sensitive data: secrets, PII, files, prompts, database records, logs.
- Side effects: writes, deletes, notifications, external calls, privileged actions.
- Trust transitions: internet to webhook, workflow to worker, worker to database, AI agent to tool.

### 2. Run mandatory checks

| Area | Minimum checks |
| --- | --- |
| Authentication | Real session/JWT/OAuth validation; no constant-success stubs; login rate limiting |
| Authorization | Route/node-level permission checks; least privilege; tenant/resource ownership |
| Injection | Parameterized SQL values; allowlisted identifiers; command/path/template injection |
| Webhooks | Signature/token verification; replay protection; timestamp tolerance; fast response |
| Secrets | n8n Credentials or approved secret manager; no source/env/log/UI disclosure |
| Input/files | Schema validation; size/MIME limits; filename sanitization; isolated storage |
| Browser/API | CSRF, CORS, secure cookies, security headers, safe error responses |
| AI/agents | Untrusted tool/retrieval content; prompt-injection boundaries; tool allowlists |
| Data | Retention, deletion, encryption, log redaction, backup access |
| Operations | Audit logs, alerts, retry/idempotency, incident owner, credential rotation |
| n8n | Authenticated production webhooks; credential references; restricted Code node/env access |
| Dependencies | Lockfiles, vulnerability scan, pinned images/actions, license review |

Use deterministic scanners when supported: dependency audit, secret scan, SAST, container scan, and n8n instance audit. Record tool versions and commands. Scanner results never replace manual auth and trust-boundary review.

### 3. Record findings

Each finding must contain:

```markdown
## SEC-001: Short title
- Severity: Critical | High | Medium | Low | Informational
- Status: Open | Mitigated | Accepted | False positive
- Evidence: file:line, workflow/node, request/response, or reproducible command
- Impact:
- Reproduction:
- Required fix:
- Validation:
- Owner:
- Target version:
```

Do not call an issue fixed without a regression test or repeatable validation.

### 4. Make a deployment decision

- **PASS**: no unresolved Critical/High findings; validation and rollback evidence exist.
- **CONDITIONAL**: only documented Medium/Low risks remain with owner and due date.
- **BLOCKED**: unresolved Critical/High finding, fake/missing auth, exposed secret, injection, or no rollback path.

If the decision is not PASS, publish `SECURITY-CAVEATS.md` and remove "production-ready" or "enterprise-ready" claims.

## Version control and change governance

Security without traceability is incomplete. Apply these controls to source, workflow JSON, and operational configuration.

### Source control

- Work from a named branch; protect the release branch with review and CI.
- Commit workflow JSON, SDD, field mapping, security review, tests, and migration notes together.
- Keep credentials, `.env`, execution data, and local backups out of Git.
- Add a security-impact note when auth, permissions, credentials, data access, or webhook behavior changes.
- Tag approved releases using the repository convention and record the commit SHA.

### Workflow versioning

- Maintain SemVer in the first sticky note: `v<major.minor.patch> YYYY-MM-DD: summary`.
- Major: breaking contract or behavior change.
- Minor: backward-compatible capability or node path.
- Patch: fix, hardening, documentation, or non-breaking refactor.
- Export the exact reviewed workflow JSON after validation.
- Apply an n8n tag containing the release/version identifier; keep import separate from production activation.

### CI/CD gate

Require:

1. JSON/static lint.
2. Secret scan.
3. Dependency/container scan when applicable.
4. n8n REST import/schema validation.
5. Security regression tests for changed trust boundaries.
6. Artifact hash or commit SHA in release evidence.
7. Explicit approval before production activation.

### Rollback

Document:

- Previous known-good Git tag/commit.
- Previous exported workflow JSON and n8n workflow ID.
- Database/config migration reversibility.
- Credential compatibility and rotation impact.
- Owner and rollback command/procedure.

Do not claim production readiness when the change cannot be traced to a commit or rolled back.

## Observability minimum

Security review without runtime visibility is incomplete: an undetected silent failure is functionally equivalent to a missing control. Every production workflow must expose at least the following.

### Required runtime signals

| Signal | Where it lives | Why it matters |
| --- | --- | --- |
| Workflow execution success / error / canceled count | n8n Executions DB or `executions/list` API | Detect regression after a deploy |
| Error rate per workflow (5-minute window) | derived from the above | Alert when > 2x baseline |
| Latency p50 / p95 / p99 per workflow | n8n execution `startedAt` → `stoppedAt` | Detect upstream slow-downs |
| Webhook 4xx / 5xx response rate | reverse proxy / n8n metrics | Catch auth or signature failures |
| Credential usage frequency per credential ID | execution logs | Detect rotation lag or unauthorized lateral use |
| Queue depth (if running queue mode) | Redis `LLEN` on the n8n queue | Catch worker starvation |
| Disk usage on n8n + worker volumes | host monitoring | Pre-empt OOM and outage |
| Code node / HTTP node exception classes | n8n execution data `error.message` | Top-N for triage |

### Required alert routes

At minimum, three escalation channels with documented owners:

1. **High-volume soft signal** (latency, queue depth) → a chat channel; reviewed daily.
2. **Single-event hard signal** (auth failure spike, credential rotation lag, repeated 5xx) → on-call paging.
3. **Security incident** (signature failure, identifier-injection attempt, secret exfil pattern in logs) → security on-call; auto-create incident ticket.

### Dashboard targets

Pack-agnostic. Pick one and document the link in the workflow's sticky note:

- n8n Insights (Cloud and self-hosted Pro feature)
- Grafana + Prometheus, scraping the n8n metrics endpoint and Postgres execution data
- Datadog / New Relic / Honeycomb if already adopted

A dashboard does not exist until a link is in the sticky note. "Available via Grafana" is not enough.

### Honesty rule

Workflows whose risk profile demands monitoring but ship without it must publish that absence in `SECURITY-CAVEATS.md` exactly as auth/injection findings would. Lack of observability is itself a finding.

---

## Code2n8n integration

1. Run this skill after source inventory and before partition/design.
2. Carry findings into the SDD and partition decision.
3. Re-run affected checks after workflow generation.
4. Include the final security decision and release traceability in validation results.

## §10 — V&V two-layer gate (added v0.28.0 after the einvoice-n8n incident)

> 📜 **Why this exists**: in Pack v0.27.0 the first external-SDK case study (`examples/einvoice-n8n/`) shipped with claims of "validated" backed only by `scripts/security-scan.mjs` (regex pass on workflow JSON) and `scripts/live-roundtrip.mjs` (n8n import/export round-trip). An adversarial review by a second AI immediately found 5 blocking-severity runtime bugs (broken HTTP status check, orphan dead-letter nodes, wrong resume URL variable name, timezone off-by-one for daily/monthly schedulers, missing CSV binary conversion) plus a `package.json` with non-existent dependency versions. Root cause: equating Layer 1 (structural / import-time) with validation. This section enforces both layers from now on.

**Rule**: before any text in a commit, release note, README, or sticky note may say "validated" / "tested" / "verified", the case MUST pass both layers below. Layer 1 alone is necessary but **never sufficient**.

### Layer 1 — Structural / import-time (must pass, does not count as validation)

- `scripts/security-scan.mjs` — 0 errors on workflow JSON.
- `scripts/live-roundtrip.mjs` — every workflow JSON imports / GET / DELETE round-trips cleanly.
- Workflow JSON parses; manifest consistency holds.

### Layer 2 — Compile / runtime / cross-document (required for the "validated" claim)

- **Dependency reality**: `npm install` (or equivalent) succeeds without `--force`; `npm audit --omit=dev` reports 0 high+ CVEs.
- **Compile**: `tsc --noEmit` (or equivalent) exits 0.
- **Service starts**: `/healthz` returns 200; authn enforced on protected paths (`curl /protected/*` without bearer → 401).
- **Negative tests**: oversized body → 413; prototype-pollution payload to dynamic dispatch endpoints → 400; unknown enum → 400.
- **Workflow runtime contract** (each of these is a Pack v0.27.0 failure):
  - HTTP nodes branching on status MUST set `options.response.response.fullResponse = true`. Otherwise `$json.statusCode` is undefined and `|| 200` defaults true → silent failures with corrupted audit log.
  - Wait + resume uses `$execution.resumeUrl` (NOT `$resumeUrl` — that is a hallucination).
  - Every node a sticky note or README promises is actually graph-connected (open the canvas and trace each dead-letter / notification edge).
  - Webhook responseMode = `responseNode` with a fixed-schema `respondToWebhook` node (NOT `lastNode`, which leaks whatever the final node returned).
  - Schedule triggers MUST have `settings.timezone` set; Code-node date math MUST use `Intl.DateTimeFormat({ timeZone })` instead of UTC `toISOString().slice(0,10)`.
  - Email / file attachments preceded by `Convert to File` node when the source is a string.
- **Cross-document parity**: every README claim points at the file/line that implements it; sticky notes do not promise behavior the JSON omits.
- **At least one end-to-end smoke** per pattern (real svc + real workflow + real Sheet row).

### Required output

- **AI agents**: follow [`docs/code2n8n-vv-a2a.md`](../../../docs/code2n8n-vv-a2a.md) — the A2A directive with exact tool invocations, mandatory evidence schema, forbidden phrases, and skip behavior.
- **Human reviewers**: tick every box in [`docs/code2n8n-vv-checklist.md`](../../../docs/code2n8n-vv-checklist.md) **explicitly**. No aggregated "all good".
- Release notes / READMEs must distinguish ✅ what was tested · ❌ what was NOT tested · 🟡 what is known-partial (with target version).
- Forbidden phrases unless backed by Layer 2 evidence: "Tested", "X/X ok", "Validated", "Production-ready". Use the substitutes in the A2A directive / checklist.

### Worked example

[`examples/einvoice-n8n/SECURITY-REVIEW.md`](../../../examples/einvoice-n8n/SECURITY-REVIEW.md) is the retroactive application of this gate to the v0.27.0 case. **13 structured SEC-### findings (SEC-001 … SEC-013)** — SEC-011 / SEC-012 / SEC-013 are the exact failure modes this gate exists to catch (broken status check, orphan dead-letter, timezone trap). The gate would have blocked v0.27.0.

## Completion checklist

- [ ] Trust boundaries and sensitive data are documented.
- [ ] Auth, authorization, injection, webhook, secret, file, AI-agent, and audit controls were reviewed.
- [ ] Findings have evidence, severity, status, owner, and target version.
- [ ] Unresolved risks are disclosed in `SECURITY-CAVEATS.md`.
- [ ] Workflow sticky-note version and repository changelog were updated.
- [ ] Reviewed JSON maps to a Git commit SHA and n8n release tag.
- [ ] CI validation and rollback evidence exist.
- [ ] Deployment decision is PASS, CONDITIONAL, or BLOCKED.
- [ ] **§10 V&V two-layer gate**: Layer 1 + Layer 2 both pass per [`docs/code2n8n-vv-checklist.md`](../../../docs/code2n8n-vv-checklist.md). Every checklist box ticked explicitly, not aggregated.
