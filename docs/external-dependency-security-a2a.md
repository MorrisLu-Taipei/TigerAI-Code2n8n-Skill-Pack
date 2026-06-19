# External-Dependency Security — A2A directive (AI consumers read this first)

> 🌐 **Languages**: **English** (canonical) · [中文](external-dependency-security-a2a.zh.md)
>
> 🌐 If you operate primarily in a language not listed, use English. Translations are convenience copies; English is source of truth and updated first per release.

> 🤖 **Audience**: this document is written for **AI agents** (Claude Code / Codex / Antigravity / Gemini / any LLM) about to perform a Code2n8n flow that touches external dependencies. Human reviewers should read [`socket-dev-integration.md`](socket-dev-integration.md) + the [`external-dependency-security` SKILL](../skills/tigerai/external-dependency-security/SKILL.md) instead.
>
> The Skill is the SOP narrative; this file is the **machine-actionable directive**: deterministic triggers, required tool invocations, exact output schemas, forbidden phrases, automatic enforcement points.

---

## When this directive activates

You **MUST** apply this directive whenever any of the following is true in the current Code2n8n flow:

- You are about to run `npm install`, `pnpm add`, `yarn add`, or modify any `package.json` `dependencies` / `devDependencies` block.
- You are about to bump a package version (any `package-lock.json` regeneration).
- You are about to write a `FROM` line in a `Dockerfile` or change `image:` in `docker-compose*.yml`.
- You are about to `curl` / `WebFetch` / `wget` a URL on `raw.githubusercontent.com` and use the content to write code, generate a SKILL, or commit to repo (purely-conversational reads are exempt).
- You are about to `cp`, write, or otherwise import an `.workflow.json` originating outside this repo into `examples/<case>/workflows/`.
- A user instruction implicitly assumes external dependency safety has been checked (e.g. "ship this", "deploy", "推上", "上架", "merge", "import this").

If any of the above is true, **the directive is active**. You may not bypass it. There is no "I'll just try and see" mode.

---

## The four gates (auto-enforced by CI as of v0.39.0)

Each gate has: trigger, tool invocation, exact pass criterion, automatic CI check name.

### Gate A — npm dep added/changed → SEC-DEP entry required

**Trigger**: `package.json` `dependencies` or `devDependencies` block changes.

**Tool invocation**:

```bash
# 1. Add or update SEC-DEP entry in <case>/SECURITY-REVIEW.md before committing.
#    Entry id form: SEC-DEP-<sanitized-package-name>-<version>
#    where <sanitized-package-name> = the package name with '@' removed and '/' replaced by '-'
#    Example: @paid-tw/einvoice → paid-tw-einvoice
#    Full id:  SEC-DEP-paid-tw-einvoice-0.3.0

# 2. The entry MUST include:
#    | Trust level     | high / low
#    | L1 npm audit    | PASS / FAIL details
#    | L2 socket.dev   | PASS / FAIL details
#    | L3 code review  | PASS@<commit-sha> / N/A (low-trust)
#    | Approved for    | <scope>
#    | Re-review trigger | major version / author change / repo URL change
```

**Pass criterion**: For every new or changed dep, a matching `SEC-DEP-<sanitized>-<version>` block exists in some `SECURITY-REVIEW.md` in the repo.

**Automatic CI check**: `ext-dep-skill-enforcement` → Gate 1 step. PR fails on missing SEC-DEP entry.

**Forbidden**: silently bumping a version without adding/updating SEC-DEP entry. Using `--force` or `--legacy-peer-deps` to bypass audit failures.

### Gate B — Exact pin (no caret/tilde/range) on case-study deps

**Trigger**: `examples/*/svc/package.json` or `examples/*/api/package.json` has a dep with version starting `^`, `~`, `>`, `<`, `=`.

**Tool invocation**:

```bash
# Before commit, ensure all versions are exact:
node -e "
  const p = JSON.parse(require('fs').readFileSync('<path>/package.json','utf8'));
  for (const sec of ['dependencies','devDependencies']) {
    for (const [n,v] of Object.entries(p[sec]||{})) {
      if (/^[\^~><=]/.test(v)) {
        console.error('OFFENDER:', n, v);
        process.exit(1);
      }
    }
  }
  console.log('OK — all exact pins.');
"
```

**Pass criterion**: zero range specifiers across `dependencies` and `devDependencies` of case-study svc / api `package.json` files.

**Automatic CI check**: `ext-dep-skill-enforcement` → Gate 2 step. PR fails if any range specifier present.

**Forbidden**: using caret `^` to "let it auto-update". Use Renovate (configured in `.github/renovate.json`) for controlled human-reviewed updates.

### Gate C — GitHub raw URLs in committed files must lock commit sha

**Trigger**: any committed file (md, code, json, etc.) contains a URL matching `raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>`.

**Tool invocation**:

```bash
# Convert /main/ or /master/ or /<branch>/ to /<40-char-sha>/.
# Get the current sha for the file you care about:
#   curl -s https://api.github.com/repos/<owner>/<repo>/commits/main | jq -r '.sha'
# Then replace in your URL.
# Note: shorter sha (7-char) is rejected by the gate. Must be full 40-char hex.
```

**Pass criterion**: every `raw.githubusercontent.com/...` URL in committed files has `<ref>` segment that is exactly `[a-f0-9]{40}` (40-char hex).

**Automatic CI check**: `ext-dep-skill-enforcement` → Gate 3 step. Also pre-commit hook `scripts/pre-commit-ext-dep-gates.sh` for fast local feedback.

**Forbidden**: committing `.../main/...` URLs as "good enough". Even in docs / comments — once it ships, the content can change without notice.

**Exception**: read-only AI Coder conversational reads (not committed anywhere) are exempt. The moment the content goes into a commit, this gate applies.

### Gate D — Dockerfile `FROM` must hash-pin or use ARG/DIGEST

**Trigger**: any `Dockerfile` (outside `node_modules/` and outside the on-prem case which is separately tracked) has a `FROM` line.

**Tool invocation**:

```bash
# Get the digest:
docker buildx imagetools inspect node:20.18.1-alpine3.20 | grep Digest

# Update Dockerfile EITHER:
#  (a) directly:  FROM node:20.18.1-alpine3.20@sha256:b50ca7...
#  (b) via ARG:   ARG NODE_IMAGE_DIGEST=sha256:b50ca7...
#                 FROM ${NODE_IMAGE}
```

**Pass criterion**: every `FROM` line contains `@sha256:` OR resolves through an `ARG` whose name contains `IMAGE` or `DIGEST`.

**Automatic CI check**: `ext-dep-skill-enforcement` → Gate 4 step.

**Forbidden**: `FROM node:20-alpine` without pin or ARG. CI will fail.

---

## High-trust packages — additional human gate (CODEOWNERS)

If you (the AI Coder) determine a new package is **high-trust** per [Skill §1.3](../skills/tigerai/external-dependency-security/SKILL.md#13-high-trust-套件清單必須-l3-review) — i.e. the package can touch credentials, makes HTTP requests, signs payloads, talks to databases / cloud / AI services — you MUST:

1. Add the package to a `package.json` (PR will auto-request reviewer per CODEOWNERS)
2. In the SEC-DEP entry, **fill the `L3 code review` field with a commit sha** of the package source you reviewed (not just the version tag — a specific sha)
3. Note the high-trust classification in the PR description using the template at `.github/pull_request_template.md`
4. **Do not merge** until the human CODEOWNERS reviewer signs off (`MorrisLu-Taipei`)

CI cannot automate L3 source code review — that is a human-only gate. Renovate is configured `automerge: false` precisely to prevent AIs from bypassing this.

---

## External workflow JSON ingestion

If you are importing a `.workflow.json` from outside this repo:

**Tool invocation**:

```bash
node scripts/ingest-external-workflow.mjs <path-to-external.workflow.json>
```

**Pass criterion**: exit code 0. The script enforces:
- Gate 1: `security-scan.mjs` reports 0 errors (jscode malicious patterns clean)
- Gate 2: `_pack_ingest` annotation present with `submitter` + `reviewer` + `rationale`, AND `submitter !== reviewer`
- Gate 3: node digest printed for human spot-check (informational, not a fail condition)
- Append event to `scripts/ingest-log.jsonl` (audit trail)

**Forbidden**: bypassing the ingest gate to "just try it". `cp` of external workflow JSON directly into `examples/<case>/workflows/` without running the gate is a violation.

---

## Forbidden phrases (lexical rule)

You **MUST NOT** emit the following words/phrases in any output (commit message, release notes, PR description, README, sticky note, response to user) about external dependencies, unless the relevant gate evidence schema appears **earlier in the same output**:

- `validated` / `verified` / `tested` / `production-ready`
- `驗證` / `驗證通過` / `已驗證` / `可上線` / `正式可用`
- `safe to merge` / `合併沒問題` / `可以推上`
- `audited` / `稽核完成`
- `no vulnerabilities` / `沒有漏洞`
- `0 CVEs` / `clean SCA`
- `cleared for production` / `通過上線審查`

For external dependency claims specifically, evidence schema must include:

```
## External-dependency evidence — gate v1 (this AI ran the gates)

### Gate A — SEC-DEP entries
- All new deps have SEC-DEP entries: PASS / FAIL (<count> missing)

### Gate B — Exact pin
- All case-study package.json deps exact-pinned: PASS / FAIL (<count> offenders)

### Gate C — GitHub raw sha-lock
- All committed raw.githubusercontent.com URLs lock 40-char sha: PASS / FAIL

### Gate D — Dockerfile hash-pin
- All Dockerfile FROM lines hash-pinned or ARG-resolved: PASS / FAIL

### High-trust review
- Each high-trust package has L3 review @<commit-sha>: PASS / N/A (no high-trust deps) / PENDING

### External workflow ingestion (if applicable)
- ingest-external-workflow.mjs exit 0: PASS / N/A / FAIL
```

If any line above is `FAIL` or `PENDING`, do not use any of the forbidden phrases. Use precise status language instead ("Gate A passed but Gate D pending tracked-as v0.39.x").

---

## Critic enforcement (lexical regex)

Per [code2n8n-pipeline SKILL §1.8](../skills/tigerai/code2n8n-pipeline/SKILL.md#18-外部依賴-ingestion-規則加入於-v0360) and SEC-019, a critic agent / reviewer / future AI consuming this Pack MUST run the following lexical scan on any message before emission:

```regex
\b(npm install|pnpm add|yarn add)\b
```

If matched → require nearby (within same message) an explicit acknowledgement that Gates A + B have been run with PASS outcome, OR a tracked-as pending marker.

```regex
raw\.githubusercontent\.com/[^/]+/[^/]+/(?!([a-f0-9]{40})/)
```

If matched in committed content → VETO.

```regex
FROM\s+[^\s@$]+\s*(?:AS\s+\w+)?\s*$
```

If matched in any `Dockerfile` line → VETO unless ARG-resolved.

These are **regex-checkable**. AI Coders may not negotiate them away with "I judged this is fine."

---

## What this directive does NOT do

- Does **not** review the package source code for backdoors — that's the L3 human review, which CI cannot automate.
- Does **not** verify package signatures (npm provenance) unless you run `npm ci --audit-signatures` — Pack v0.38 ships the SKILL guidance but not the CI step (planned for a future release).
- Does **not** rebuild Docker base images periodically — that's a separate hygiene operation.

---

## Per-release status

| Release | Status of this directive |
| --- | --- |
| v0.36.0 | Tier 1: scanner + audit gate + exact-pin policy (no auto-enforce of policy, only audit gate). |
| v0.37.0 | Tier 2: ingestion script + Trivy gate + Renovate config. |
| v0.38.0 | Tier 3: SOP Skill written but not auto-enforced. Effectively documentation-only. |
| **v0.39.0** | **All four gates become CI-enforced. Pre-commit hook available. CODEOWNERS active. This A2A directive ships.** |
