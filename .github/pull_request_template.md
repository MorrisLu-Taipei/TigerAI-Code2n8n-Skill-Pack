<!-- v0.39.0 SEC-019 — PR template enforcing external-dependency-security Skill review checklist -->

## What changed

<!-- one-line summary -->

## External dependency review (if this PR touches deps / Dockerfile / external workflows)

> **If your PR touches `package.json`, `Dockerfile`, `docker-compose*.yml`, or imports an external `.workflow.json`, complete this section.** Otherwise delete it.

### Dependencies added / changed

| Package | Version | Trust level | L1 npm audit | L2 socket.dev | L3 source review | SEC-DEP entry |
| --- | --- | --- | --- | --- | --- | --- |
| <!-- example: @paid-tw/einvoice --> | <!-- 0.3.0 --> | <!-- high / low --> | <!-- PASS / N/A --> | <!-- PASS / N/A --> | <!-- PASS@commit-sha / N/A --> | <!-- link to SEC-DEP entry --> |

### Skill `external-dependency-security` checklist

- [ ] §1.6 — All new / changed deps use **exact pin** (no `^`/`~`/range)
- [ ] §1.2 — `npm audit --audit-level=high` exits 0 (CI verifies, but local run for sanity)
- [ ] §1.2 — socket.dev review run (GitHub App comment OR `npx @socketsecurity/cli ci` output linked)
- [ ] §1.3 — **High-trust packages** identified and listed above
- [ ] §1.4 — L3 source code review done for each high-trust package (commit sha cited in SEC-DEP entry)
- [ ] §1.5 — `SEC-DEP-<package>-<version>` entry added to SECURITY-REVIEW.md
- [ ] §3 — Any `raw.githubusercontent.com` URLs in committed files lock commit sha (40-char hex), not `/main/`
- [ ] §5.2 — Dockerfile `FROM` lines hash-pinned via `@sha256:` or ARG/DIGEST pattern
- [ ] §5.4 — `docker-compose*.yml` has runtime hardening (`read_only`, `cap_drop:[ALL]`, `secrets:` file-mount)

### External workflow JSON ingestion (if applicable)

If this PR imports a `.workflow.json` from outside this repo:

- [ ] Ran `node scripts/ingest-external-workflow.mjs <file>` and got exit 0
- [ ] `_pack_ingest` annotation present (submitter, reviewer, rationale)
- [ ] Submitter ≠ reviewer (two distinct humans)
- [ ] Audit log entry appended to `scripts/ingest-log.jsonl`

---

## V&V evidence

<!-- Per code2n8n-pipeline SKILL §1.6 lexical schema-before-claim rule, if this PR claims any
     restricted word (validated / 驗證 / production-ready / X/X ok / etc), the evidence schema
     MUST appear above the claim. Copy from docs/code2n8n-vv-a2a.md. -->

```
## V&V evidence — gate v1
### Layer 1 (structural)
- JSON parse: PASS / FAIL (N files)
- security-scan.mjs: <count> error / <count> warning
- live-roundtrip.mjs: <X>/<Y> ok  (tag: <tag>)

### Layer 2 (runtime)
- npm install: PASS / FAIL
- npm audit (high+): PASS / FAIL
- tsc --noEmit: PASS / FAIL
- /healthz 200: PASS / FAIL
- Unauthenticated /v1/* → 401: PASS / FAIL
- End-to-end runtime smoke: PASS / PENDING tracked-as <version>
```

---

## Required CI checks (auto-run on this PR)

- [x] `ext-dep-skill-enforcement` — Skill §1.8 (SEC-DEP entries) + §1.6 (exact pin) + §3 (sha-lock) + §5.2 (Dockerfile pin)
- [x] `dependency-cve` — `npm audit --audit-level=high` fail gate (SEC-017)
- [x] `workflow-security-scan` — Code-node malicious jsCode detection (SEC-017 Tier 1)
- [x] `container-scan` — Trivy HIGH/CRITICAL fail gate (SEC-018)
- [x] `sbom-generate` — CycloneDX SBOM produced + uploaded as artifact (SEC-018)

If any CI check is red, do **NOT** override unless you have explicit approval recorded in the PR comments.
