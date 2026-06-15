# Responsibility matrix & honest completion status

> Companion to [`enterprise-setup.md`](enterprise-setup.md). That doc draws the boundary; this one rates **how far each box in the hero diagram is actually shipped**.

The hero diagram makes claims across four layers. This page tells you, per claim, who owns it and how complete it is **as of v0.24.1**. Honest evidence beats inflated evidence — if a row says "partial," that's the truth, not a hedge.

---

## Who owns what

| Layer | Owns |
| --- | --- |
| **Pack (this repo)** | Porting methodology, Partition rules, Security Review SOP, Workflow Design rules, Validation SOP, versioning & release rules. |
| **n8n (community + self-hosted)** | Workflow runtime, nodes, integration & execution. |
| **n8n Enterprise** | SSO/IAM, Audit Log, HA, Metrics, Source Control / Environments — the enterprise platform capabilities. |
| **Enterprise IT / DevOps** | Infrastructure, backup, DR, monitoring, the actual CI runner. |

The Pack does **not** reimplement what n8n Enterprise already ships, and does **not** try to be your IT department. It writes the rules, the tests, and the artefacts that land cleanly on top of all three.

---

## Per-claim status (v0.24.1)

| Hero claim | Current state | Status |
| --- | --- | --- |
| Inventory, Partition, Workflow Design | Codified in `code-to-workflow` skill; three case studies demonstrate it end to end | ✅ Methodology done |
| Security Audit | Dedicated `n8n-security-governance` skill; `code-to-workflow` Step 1.5 enforces it; `SECURITY-REVIEW.md` (positive) + `SECURITY-CAVEATS.md` (negative) examples ship | ✅ Review methodology done |
| Production Validation | `_audit.mjs` lint + `_n8n_import_test.mjs` REST scripts exist; full validation still needs a live n8n + credentials | 🟡 Partial — works, but not unattended |
| Security scanning | Agent-driven SOP + checklists; **not** a deterministic scanner | 🟡 Not toolised |
| Version Control | Commit pinning, version stamping, release/rollback rules documented | 🟡 Has SOP, no full automation |
| CI/CD | Pack defines the gate; v0.24.1 ships `.github/workflows/security-gate.yml` (manifest consistency + JSON audit + secret scan + installer parse); broader pipelines (GitLab CI, full dep CVE, container scan) not yet | 🟡 First gate live, more to come |
| Retry, Approval, Handover | Enterprise Pattern designs exist | 🟡 No drop-in importable template |
| Logs, Alerts, Observability | Design requirements stated | ⛔ Execution belongs to n8n + monitoring stack + IT |
| SSO, IAM, HA, Audit Log | — | ⛔ n8n Enterprise — Pack should not implement |
| ERP / CRM / DB / SaaS / LLM integration | Design guidance on how to use them | ⛔ Actual integration = n8n nodes |

Legend: ✅ done · 🟡 partial / in progress · ⛔ explicitly out of Pack scope (owned elsewhere)

---

## What this means for readers

- If you came here because the hero promises "Security Audit" and "CI/CD gate" — yes, both exist; read [`skills/tigerai/n8n-security-governance/SKILL.md`](../skills/tigerai/n8n-security-governance/SKILL.md) and [`.github/workflows/security-gate.yml`](../.github/workflows/security-gate.yml).
- If you came expecting an out-of-the-box deterministic secret scanner or container CVE scanner — that's roadmap, not v0.24.1.
- If you came expecting SSO / Audit Log / HA — that's **n8n Enterprise**, not this Pack. The Pack's job is to make sure what it produces lands cleanly on top.

The hero diagram is a positioning artefact; this page is the receipts. They should always be readable together.
