# Code2n8n V&V Checklist — the **two-layer** gate

> 🌐 **Why this exists**: in v0.27.0 the Pack shipped a case study (`examples/einvoice-n8n/`) where the scanner returned 0 errors and `live-roundtrip.mjs` returned `6/6 ok`, and the release notes said "validated against the user's localhost n8n." A subsequent adversarial review by a second AI immediately found **5 blocking-severity bugs** that meant 5/6 workflows would not actually run, plus an external-service `package.json` with non-existent dependency versions.
>
> Root cause: we equated **Layer 1 (structural / import-time validation)** with **validation**. There is a missing **Layer 2 (compile / runtime / cross-document validation)**.
>
> This document fixes that. Every Code2n8n case study MUST pass both layers before any "validated" / "tested" / "verified" claim appears in commit messages, release notes, or README proof bars.

---

## The two layers

### Layer 1 — Structural / import-time (necessary, **not sufficient**)

| Gate | Tool | Pass means |
| --- | --- | --- |
| Workflow JSON parses | `node -e "JSON.parse(...)"` | File is JSON. Nothing more. |
| Workflow security scanner | `scripts/security-scan.mjs` | No hardcoded secrets / no plaintext credential fields / no webhook-without-auth surprises. **Does NOT validate logic.** |
| n8n REST import | `scripts/live-roundtrip.mjs` | n8n accepts the workflow definition as valid. **Does NOT execute it.** |
| Manifest consistency | `scripts/security-scan.mjs --manifest-mode` (CI gate) | `plugin.json` matches on-disk skills. |

**Layer 1 outputs are NEVER sufficient to claim "validated."** They are a prerequisite — like `tsc --noEmit`: passing means the code parses, not that it works.

### Layer 2 — Compile / runtime / cross-document (**required** to claim validation)

| Gate | What it catches | How to run |
| --- | --- | --- |
| **Dependency reality** | Phantom package versions, ETARGET, broken transitive deps | `cd <case>/svc && npm install` — must succeed without `--force` |
| **Type / compile** | API drift between code and dependencies | `tsc --noEmit` — must exit 0 |
| **CVE scan** | Known-vulnerable deps | `npm audit --omit=dev --audit-level=high` — must report 0 high+ |
| **Service starts** | Runtime crash from misconfig / missing exports | Start the service; `curl /healthz` returns 200 |
| **Authn enforced** | Trust boundary actually holds | `curl /protected/*` without credentials → 401 (not 200) |
| **One real round-trip per pattern** | Workflow runtime contract (HTTP node response shape, resume URL variable name, timezone semantics, binary attachment property) | Import workflow + send a test webhook + observe one Sheet row, one Slack message, one provider response |
| **Cross-document consistency** | README ↔ workflow ↔ svc README ↔ sticky note ↔ scanner output all agree | Reviewer checklist below |

**Only after Layer 2 passes** may a commit / release / README say "validated".

---

## Per-case reviewer checklist

Print this. Tick each line. Do not skip.

### A. Dependency & build (Layer 2 minimum)

- [ ] `cd <case>/svc && npm install` succeeds. **Capture output.**
- [ ] `npm ls --depth 0` shows the exact versions declared in `package.json` (no missing / no extraneous).
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `npx tsc` produces `dist/` with the expected entry file(s).
- [ ] `npm audit --omit=dev --audit-level=high` reports 0 vulnerabilities (or each remaining one is annotated in `SECURITY-REVIEW.md`).
- [ ] `node dist/index.js` or `docker compose up -d --build` brings the service up.
- [ ] `curl /healthz` returns 200 with the expected JSON.

### B. Runtime trust boundary

- [ ] Authentication is mandatory when credentials are present: `curl /protected/*` without header returns 401.
- [ ] Service refuses to start with missing required secrets, OR documents an explicit opt-in escape hatch (env var). Verify by deliberately starting without secrets and observing the exit / warning.
- [ ] At least one **negative test** per security control: oversized body → 413; prototype-pollution payload → 400; unknown enum value → 400.

### C. Workflow runtime contract

- [ ] HTTP nodes that branch on status: confirm `options.response.response.fullResponse = true` is set. Otherwise `$json.statusCode` is undefined and `|| 200` defaults true → silent failures.
- [ ] Wait + resume webhook: confirm `$execution.resumeUrl` (NOT `$resumeUrl` — that is a Pack v0.27.0 hallucination that broke 1 workflow).
- [ ] Every node that promises notification (Slack / Email / SMS / pager) is **graph-connected**, not an orphan. Open n8n's canvas view; trace every dead-letter edge.
- [ ] Webhook responseMode: confirm `responseMode: responseNode` with a `respondToWebhook` node returning a **fixed schema**, not `lastNode` (which leaks whatever the last node happened to output).
- [ ] Schedule trigger: confirm `settings.timezone` is set to the user's locale (e.g. `Asia/Taipei`), AND any Date math inside Code nodes uses `Intl.DateTimeFormat({ timeZone: ... })` — not `new Date().toISOString().slice(0,10)` which is UTC-anchored.
- [ ] Email / file attachment: if there is a CSV / PDF, confirm a `Convert to File` node runs before the Email node and the Email `attachments` field references the resulting binary property name (default `data`).
- [ ] Cross-workflow `executeWorkflow` references: confirm placeholder workflow IDs are replaced with real ones after import, or that the workflow author owns the post-import wiring.

### D. Cross-document consistency

- [ ] **README claim ↔ implementation parity**: for every claim in the case README, point at the file/line that implements it.
  - "dead-letter Slack" → real connection from `Exhausted? = true` → Slack node
  - "human approval gate" → real Wait + Approved? IF
  - "audit row" → real Google Sheets / DB write node, with correct binary mode
- [ ] **sticky note ↔ workflow JSON parity**: no sticky note promises behaviour the JSON does not implement.
- [ ] **scanner warnings ↔ README explanation**: every scanner warning that ships unfixed has a paragraph in the case README explaining why (e.g. SEC-009 entry webhooks).
- [ ] **placeholder coverage**: every `__REPLACE_ME__*` token in any workflow JSON is listed in the case README's setup table. Every token in the table actually exists in the JSON.

### E. End-to-end smoke (one real run per pattern)

Each Code2n8n case must include at least **one** of:

- A Docker Compose stack that brings up the svc + a local n8n + a fake provider stub.
- Or, a fixture-driven test (`node <case>/test-smoke.mjs`) that imports each workflow, sends a synthetic webhook event, and asserts at least one expected side-effect (audit row written, Slack message rendered, response shape matches).

The smoke test runs as part of release validation, NOT just `live-roundtrip.mjs` (which only proves import).

### F. Release-time documentation

When promoting a case study version, **only** the gates listed above may be referenced as "validated". The release notes must say:

- ✅ what was tested (and which gate / tool / command)
- ❌ what was NOT tested (and why — e.g. needs production credentials, requires accountant review)
- 🟡 what is known-partial (and tracked in `SECURITY-REVIEW.md` with target version)

Forbidden phrases unless backed by Layer 2 evidence:

| ❌ Don't say | ✅ Say instead |
| --- | --- |
| "Tested" | "Workflow JSON imports cleanly into n8n; runtime execution requires `__REPLACE_ME__*` replacement" |
| "6/6 ok" | "6/6 import-roundtrip ok; runtime smoke pending" |
| "Validated" | "Validated at the structural layer; runtime contract validated per checklist sections A–D" |
| "Production-ready" | "Reference case demonstrating the methodology; production deployment requires the controls in SECURITY-REVIEW §5" |

---

## Why this is structured as a checklist, not a paragraph

Because the failure mode that produced v0.27.0 was **forgetting to do something specific**, not misunderstanding intent. Checklists exist to make forgetting visible.

If you are an AI assistant running this checklist: tick each box explicitly in your output. Do not aggregate into "✅ all good" without listing the gates individually.

If you are a human reviewer: every unchecked box is a release blocker.

---

## Related artefacts

- [`skills/tigerai/n8n-security-governance/SKILL.md`](../skills/tigerai/n8n-security-governance/SKILL.md) — §10 references this checklist as the validation gate.
- [`scripts/security-scan.mjs`](../scripts/security-scan.mjs) — Layer 1 scanner.
- [`scripts/live-roundtrip.mjs`](../scripts/live-roundtrip.mjs) — Layer 1 import test (NOT runtime).
- [`examples/einvoice-n8n/SECURITY-REVIEW.md`](../examples/einvoice-n8n/SECURITY-REVIEW.md) — the case where these gates were retroactively applied and 13 SEC findings were uncovered.
