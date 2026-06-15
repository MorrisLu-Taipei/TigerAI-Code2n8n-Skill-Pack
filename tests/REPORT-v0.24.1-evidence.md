# v0.24.1 evidence report — installer / manifest / case-study audits

> Date: 2026-06-15
> Pre-release base SHA: `bdcd3b2` (v0.24.0)
> Scope: fix the implementation gaps flagged after v0.24.0 (broken installer, manifest off-by-one, stale evidence, missing CI gate).
> Author: Claude Code (Opus 4.7) under Morris Lu's review.

This is a fresh, dated evidence run; it does **not** replace [`REPORT-3.md`](REPORT-3.md) (historical 2026-05-05 acceptance baseline) — it sits next to it.

---

## 1. Installer parse — both shells

| Installer | Encoding | Parse | Vendor count copy |
| --- | --- | --- | --- |
| `install.ps1` | UTF-8 **with BOM** (`EF BB BF`) — verified | `[Parser]::ParseFile` returns 0 errors under PowerShell Core; PowerShell 5.1 no longer mis-decodes the Chinese strings | "安裝 6 個官方 vendor skills" (was "7 個") |
| `install.sh` | UTF-8, CRLF | `bash -n install.sh` exit 0 | "安裝 6 個官方 vendor skills" (was "7 個") |

Repro:

```bash
$ head -c 3 install.ps1 | od -An -tx1
 ef bb bf
$ bash -n install.sh && echo OK
OK
```

Why it matters: before v0.24.1, Windows users could not run the installer at all — PowerShell 5.1 decoded the BOM-less file as Windows-1252, breaking the closing quote on line 71. The pack claimed "one-shot install" but did not deliver it.

---

## 2. plugin.json ↔ skills/ on-disk consistency

| Source | Count |
| --- | --- |
| `plugin.json` `skills[]` | **14** |
| `skills/_vendor/n8n-*` with SKILL.md | 6 |
| `skills/tigerai/*` with SKILL.md | 8 |
| **Total on disk** | **14** |
| Orphan manifest entries | 0 |
| Unregistered on-disk skills | 0 |

Change: removed the orphan `skills/tigerai/install-tigerai-n8n-pack` manifest entry. The actual `/install-n8n-pack` slash command is an Antigravity workflow under `.agent/workflows/install-pack.md`, not a skill — so the manifest entry was a phantom.

Repro: `.github/workflows/security-gate.yml` job `manifest-consistency` runs both directions on every push/PR.

---

## 3. Case-study workflow audits (fresh run, 2026-06-15)

### 3.1 `examples/google-workspace-admin-workflow/`

```
$ node _audit.mjs
# Audit report — 7 workflow files scanned

✅ core-milestone.workflow.json  (0 error / 0 warn)
✅ core-project-starter.workflow.json  (0 error / 0 warn)
✅ core-setup.workflow.json  (0 error / 0 warn)
✅ entry-milestone.workflow.json  (0 error / 0 warn)
✅ entry-project-starter.workflow.json  (0 error / 0 warn)
✅ entry-milestone.workflow.json  (0 error / 0 warn)
✅ entry-project-starter.workflow.json  (0 error / 0 warn)

Total: 0 errors, 0 warnings
```

### 3.2 `examples/line-ai-customer-service/` (cloud)

```
$ node _audit.mjs
# Audit report — 6 workflow files scanned

✅ admin-ui.workflow.json  (0 error / 0 warn)
✅ api-kb.workflow.json  (0 error / 0 warn)
✅ api-settings.workflow.json  (0 error / 0 warn)
✅ api-users.workflow.json  (0 error / 0 warn)
✅ core-message-router.workflow.json  (0 error / 0 warn)
✅ entry-line.workflow.json  (0 error / 0 warn)

Total: 0 errors, 0 warnings
```

### 3.3 `examples/line-ai-customer-service-onprem/` (on-prem brain)

The on-prem case ships upstream's single 37-node workflow rather than the core+entry split — there's no `_audit.mjs`. Smoke test:

```
nodes: 37  connections (groups): 29  name: "AI 客服系統 - 視覺大腦 (最終相容版 - If v2.3 Logic Fix)"
```

JSON parses cleanly; node count and connection-group count match upstream's `n8n_workflow_export.json`. Deep security review (10 SEC-### findings, BLOCKED decision) is in [`SECURITY-REVIEW.md`](../examples/line-ai-customer-service-onprem/SECURITY-REVIEW.md) — by policy we disclose, we do not patch.

---

## 4. CI gate — `.github/workflows/security-gate.yml`

Before v0.24.1 the `n8n-security-governance` skill described a CI gate as SOP but no pipeline ran. v0.24.1 ships an actual workflow:

| Job | What it enforces |
| --- | --- |
| `manifest-consistency` | Every `plugin.json` entry has a SKILL.md; every on-disk SKILL.md is registered. Bidirectional. |
| `json-audit` | Runs the two existing `_audit.mjs` scripts + parses on-prem workflow JSON. |
| `secret-scan` | High-confidence regex sweep (OpenAI / AWS / GitHub / Slack / PEM private keys) excluding the vetted reference-workflows / research / historical-tests dirs. |
| `installer-parse` | `bash -n install.sh`; verifies `install.ps1` starts with EF BB BF; runs `[Parser]::ParseFile` under PowerShell Core. |

This is the working reference the `n8n-security-governance` skill points to as "what a real CI gate looks like." It is intentionally narrow — it catches the four classes of regression we already saw drift in (broken installer, manifest off-by-one, leaked secrets, broken workflow JSON), and leaves richer scans (dependency CVE, container scan, full n8n REST round-trip) as TODO so the bar can be raised without disabling the gate.

---

## 5. Diff summary (v0.24.0 → v0.24.1)

| File | Change |
| --- | --- |
| `install.ps1` | Re-saved as UTF-8 with BOM (was BOM-less, broke PS 5.1). "7 個" → "6 個". |
| `install.sh` | "7 個" → "6 個". |
| `plugin.json` | Removed orphan `install-tigerai-n8n-pack` entry. Skills count 15 → 14. |
| `README.md` | "15 manifest skills" → "14 skills" in hero + Agentic footprint. |
| `README.zh.md` | "15" → "14" in hero, Agentic footprint, and directory tree. Removed orphan footnote, replaced with note explaining the `/install-n8n-pack` slash command is an `.agent/workflows/` entry, not a skill. |
| `.github/workflows/security-gate.yml` | New file — CI gate above. |
| `tests/REPORT-v0.24.1-evidence.md` | This document. |
| `CHANGELOG.md` | v0.24.1 entry. |
| `VERSION` | `0.24.0` → `0.24.1`. |

---

## 6. What this report does NOT prove

- The on-prem case is still BLOCKED for production (see `SECURITY-REVIEW.md`); no fix was attempted in v0.24.1 — by design.
- No end-to-end "import all 14 skills into a fresh Claude Code / Antigravity install and run a workflow" rerun. The installer parse + manifest consistency narrow that risk a lot, but is not the same as a clean install on a fresh box.
- No dependency / container CVE scan in the gate yet.
- `_n8n_import_test.mjs` scripts exist but assume a live n8n REST endpoint with credentials — not run in CI, not run here.

Honest evidence beats inflated evidence. The known-unknowns above are tracked, not hidden.
