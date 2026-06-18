# Code2n8n V&V — A2A directive (AI consumers read this first)

> 🌐 **Languages**: **English** · [中文](code2n8n-vv-a2a.zh.md) · [日本語](code2n8n-vv-a2a.ja.md) · [한국어](code2n8n-vv-a2a.ko.md) · [Français](code2n8n-vv-a2a.fr.md) · [Deutsch](code2n8n-vv-a2a.de.md) · [Español](code2n8n-vv-a2a.es.md) · [Tiếng Việt](code2n8n-vv-a2a.vi.md) · [ภาษาไทย](code2n8n-vv-a2a.th.md) · [Bahasa Melayu](code2n8n-vv-a2a.ms.md) · [Bahasa Indonesia](code2n8n-vv-a2a.id.md)
>
> 🌐 If you (the consuming AI agent) operate primarily in a language not listed above, use English as the canonical version — it is the source of truth; translations are convenience copies kept in sync per release.

> 🤖 **Audience**: this document is written for **AI agents** (Claude Code / Codex / Antigravity / any LLM) executing Code2n8n flows. Human reviewers should read [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) instead — it's the same gate translated for humans.
>
> The companion document `code2n8n-vv-checklist.md` is the human-oriented version (boxes to tick, paragraphs explaining why). This file is the **machine-actionable directive**: deterministic triggers, required tool invocations, exact output schemas, forbidden phrases. Treat the rules below as load-bearing — not advisory.

---

## When this directive activates

You **MUST** apply this directive whenever any of the following is true in the current Code2n8n flow:

- You are about to write the words "validated" / "verified" / "tested" / "production-ready" / "X/X ok" / "驗證" / "驗證通過" / "已驗證" in any output (commit message, release notes, README, sticky note, CHANGELOG, response to user).
- You are about to recommend that a case study be shipped, merged, deployed, activated, or imported into a production n8n.
- A user instruction implicitly assumes validation has occurred (e.g. "run the workflow", "deploy this", "上架到正式環境").

If any of the above is true, **the directive is active**. You may not bypass it.

---

## The gate (two layers)

A case study has **two** validation layers. Both must pass before validation language is permitted. Each layer specifies the exact tool, the exact output you must observe, and what you must do with that output.

### Layer 1 — Structural / import-time

Three commands. Run all three. Capture each output verbatim.

```
# 1. JSON parse check
node -e "JSON.parse(require('fs').readFileSync('<workflow>.workflow.json','utf8'))"

# 2. Deterministic security scanner
node scripts/security-scan.mjs --glob "<case-dir>/workflows/*.workflow.json" --format markdown

# 3. n8n REST round-trip (requires N8N_API_URL + N8N_API_KEY)
node scripts/live-roundtrip.mjs --glob "<case-dir>/workflows/*.workflow.json"
```

**Layer 1 pass criteria** (all three required):
- Each workflow JSON parses without exception.
- `security-scan.mjs` reports `0 error`. Warnings are permitted only if each warning has a corresponding paragraph in the case `README.md` AND in `SECURITY-REVIEW.md` explaining why it ships unfixed.
- `live-roundtrip.mjs` reports `X/X ok` where X = number of workflows scanned.

**Layer 1 is necessary, not sufficient.** You **MAY NOT** use validation language after passing Layer 1 alone.

### Layer 2 — Compile / runtime / cross-document

Layer 2 is mandatory whenever the case study includes any of:
- A wrapper service / SDK / external dependency (anything with a `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`)
- A workflow node whose runtime behavior is not visible from the JSON alone (HTTP nodes with status branching, Wait + resume, Schedule with timezone semantics, Email with binary attachments)
- A claim in the case `README.md` that promises observable behavior (notifications, audit log writes, scheduled execution, cross-system handover)

For any case meeting any of these conditions, all of the following are **required**:

#### Layer 2.A — Dependency reality

```
cd <case-dir>/svc && npm install
cd <case-dir>/svc && npm audit --omit=dev --audit-level=high
cd <case-dir>/svc && npx tsc --noEmit
```

**Pass criteria**:
- `npm install` exits 0 (no `ETARGET`, no `--force` required).
- `npm audit` reports `0 vulnerabilities` at high severity or above.
- `tsc --noEmit` exits 0.

If any fails, you **MUST** fix it before proceeding. You **MUST NOT** claim validation if any of these are red.

#### Layer 2.B — Runtime trust boundary

```
cd <case-dir>/svc && npx tsc && node dist/index.js &
sleep 2
curl -s http://127.0.0.1:<port>/healthz
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/v1/<protected>
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <token>" http://127.0.0.1:<port>/v1/<protected>
```

**Pass criteria**:
- `/healthz` returns 200 with the expected JSON body.
- Unauthenticated request to a protected endpoint returns 401 (not 200, not 500).
- Authenticated request to the same endpoint returns 200 or the documented domain-specific status (400 / 502 for upstream errors).

Plus at least **three negative tests** per security control declared in the case:
- Oversized request body → expected 413
- Prototype-pollution payload (e.g. `op: "__proto__"`) → expected 400
- Unknown enum value (e.g. `provider: "fake-provider"`) → expected 400 with no internal detail in the body

#### Layer 2.C — Workflow runtime contract

For each workflow JSON, inspect the **actual node configuration** (not just the sticky note) and verify:

| Pattern | Required configuration |
| --- | --- |
| HTTP node followed by status-based IF | `options.response.response.fullResponse = true` AND `neverError = true` |
| Wait node with resume webhook | Sticky note / Code node uses `$execution.resumeUrl` (NOT `$resumeUrl`) |
| Schedule trigger | `settings.timezone` set to a non-UTC tz (e.g. `Asia/Taipei`) AND any Code-node date math uses `new Intl.DateTimeFormat('en-CA', { timeZone })` (NOT `new Date().toISOString().slice(0,10)`) |
| Webhook entry | `responseMode = "responseNode"` AND a `respondToWebhook` node with a fixed-schema body (NOT `responseMode = "lastNode"`) |
| Email node with attachment | A `n8n-nodes-base.convertToFile` node runs immediately before it, AND the Email node's `attachments` references the resulting binary property name (default `data`) |
| Dead-letter / notification node | The node has at least one incoming connection in `connections{}`. Open the JSON; do not trust the sticky note. |

Any pattern present in the JSON that violates the rule above is a **release blocker** until fixed.

#### Layer 2.D — Cross-document parity

For each claim in the case `README.md`, locate the file:line that implements it. If the implementation does not exist, the claim is a documentation bug — fix the doc or fix the implementation before claiming validation. Examples:

- "dead-letter Slack" → search for the Slack node, confirm it has an incoming edge from the `Exhausted? = true` IF branch.
- "human approval gate" → confirm Wait + resume + Approved? IF + audit writes for both branches.
- "audit row" → confirm the Sheet / DB write node exists, with a complete column mapping, and is in the connection graph.
- "finance summary email" → confirm an Email node exists, connected, with the email-recipient placeholder named in the placeholder table.

---

## Output schema you MUST produce after running the gate

After running Layer 1 + Layer 2, your output (whether to user, commit message, release notes, or another AI) MUST include a section in the following exact format:

```
## V&V evidence — gate v1 (this AI ran the gate)

### Layer 1 (structural)
- JSON parse: PASS / FAIL (N files)
- security-scan.mjs: <count> error / <count> warning  (warnings explained: yes / no)
- live-roundtrip.mjs: <X>/<Y> ok  (tag: <tag>)

### Layer 2 (runtime)
- npm install: PASS / FAIL  (`<one-line summary>`)
- npm audit (high+): PASS / FAIL  (<count> vulnerabilities)
- tsc --noEmit: PASS / FAIL  (<count> errors)
- /healthz 200: PASS / FAIL
- Unauthenticated /v1/* → 401: PASS / FAIL
- Negative test 1 (body limit): PASS / FAIL
- Negative test 2 (prototype dispatch): PASS / FAIL
- Negative test 3 (unknown enum): PASS / FAIL
- Workflow runtime contract (per-pattern): PASS / FAIL  (link to row)
- Cross-document parity: PASS / FAIL  (claims checked: N)
- End-to-end runtime smoke: PASS / PENDING / FAIL  (tracked-as: <version>)
```

If any line is FAIL or PENDING, the corresponding piece of validation language is **forbidden** in the rest of your output.

---

## Forbidden output patterns

You **MUST NOT** emit any of the following unless the corresponding evidence line is `PASS`:

| Forbidden phrase | Required evidence |
| --- | --- |
| "validated" / "驗證通過" / "已驗證" | All Layer 1 + Layer 2 lines PASS, OR each PENDING explicitly labeled in the same paragraph |
| "tested" / "已測試" | At least Layer 2.B PASS |
| "X/X ok" / "全綠" | Specify which gate (e.g. "Layer 1 X/X ok") — never the unqualified form |
| "production-ready" / "可上線" / "正式可用" | Layer 1 + Layer 2 + end-to-end smoke + SECURITY-REVIEW decision is PASS or CONDITIONAL |
| "should work" / "looks good" | Forbidden in any validation context (vague — replace with specific evidence) |

You **MUST** use the substitutes:

| Substitute | When |
| --- | --- |
| "structural validation PASS; runtime validation PENDING" | Layer 1 done, Layer 2 not done |
| "Layer 1 + Layer 2 PASS per [`docs/code2n8n-vv-a2a.md`](docs/code2n8n-vv-a2a.md)" | Both layers done |
| "imports cleanly; activation requires X" | Workflow JSON valid, runtime untested |
| "reference case; production deployment requires SECURITY-REVIEW §<n> controls" | Case is shipped but not production-ready |

---

## Behavior when gate cannot be fully run

If you are in an environment that genuinely cannot run Layer 2 (e.g. no `N8N_API_URL` / `N8N_API_KEY` set, no network access to npm registry, no service to start), you **MUST**:

1. Output the evidence schema above with the unavailable lines marked `SKIPPED (reason: <reason>)`.
2. Explicitly tell the user / caller AI: "Layer 2 was not run because <reason>. The validation claim cannot be made until Layer 2 is run."
3. Refuse to emit any forbidden phrase.

Doing the gate partially and silently is the failure mode this directive exists to prevent. Be loud about skips.

---

## Adversarial review hook

For every case study you ship as the **first** Code2n8n case for a new external SDK or system, you **MUST** invite at least one independent AI (the user's choice of model) to perform an adversarial review **after** your own gate. The independent review's output goes into the case `SECURITY-REVIEW.md` alongside your own findings. The independent review is part of the gate, not optional commentary.

Reason: the gate above catches deterministic structural and runtime failures, but a fresh AI with no priors catches design-level and documentation-level failures that you (the implementing AI) are statistically blind to. Pack v0.27.0 → v0.28.0 transition exists because this hook was not enforced.

---

## Why the directive is written this way

- **Triggers are deterministic** (not "use judgment") so an AI cannot reason itself out of running the gate.
- **Tool invocations are exact** (not "verify dependencies") so different AIs converge on the same evidence.
- **Output schema is mandatory** (not "summarize") so downstream AIs / humans can mechanically check whether the gate ran.
- **Forbidden phrases are listed** so an AI cannot accidentally claim validation through colloquial wording.
- **Skip behavior is explicit** so partial runs do not impersonate full runs.

This is what an A2A interface looks like for a Pack whose consumers are AI agents, not humans. If you are an AI reading this and you cannot or will not follow the directive, you **MUST** disclose that to the user before proceeding with the Code2n8n flow.

---

## Related artefacts

- [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) — human-oriented version of the same gate (use this when explaining the gate to a human reviewer).
- [`../skills/tigerai/n8n-security-governance/SKILL.md`](../skills/tigerai/n8n-security-governance/SKILL.md) §10 — security skill enforces this directive.
- [`../examples/einvoice-n8n/SECURITY-REVIEW.md`](../examples/einvoice-n8n/SECURITY-REVIEW.md) — the case study that drove this directive.
- [`../examples/einvoice-n8n/REFLECTION.md`](../examples/einvoice-n8n/REFLECTION.md) — what happened when the directive was missing.
