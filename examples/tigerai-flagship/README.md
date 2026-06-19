# TigerAI Flagship Examples

> 🌐 **English** | [繁體中文 (INDEX.md)](INDEX.md)
>
> 📦 Repo: https://github.com/MorrisLu-Taipei/TigerAI-A2A-Code2n8n-Skill-Pack
> 📋 [v1-claims-and-evidence](../../docs/v1-claims-and-evidence.md) — what the Pack does / does not claim for each case

---

## v1.0 status

> **Pre-v1.0 reference workflows** — these are real production-grade workflows from the TigerAI library, included as **reference implementations** of the [4 enterprise patterns](../../skills/tigerai/tigerai-enterprise-patterns/SKILL.md). They are **not** part of the v1.0 Path B verification trio (port → security review → real-vendor-sandbox runtime) — for that, see [`examples/einvoice-n8n/`](../einvoice-n8n/) (the v1.0 CLEARED milestone case).
>
> What this directory **is**: 3 flagship workflows + SDD specs + deployment notes, demonstrating Atomic / Universal Worker / Skill-Driven / Security patterns in real production shape.
> What this directory **is not**: A from-scratch Path B case study with full V&V evidence.

---

## The 3 flagship examples

| # | Example | Patterns demonstrated | Nodes | Scenario |
|---|---|---|---|---|
| 1 | [splitPDF-orchestrated](splitPDF-orchestrated/) | Atomic + Universal Worker | 6 | PDF chapter splitting, contract processing |
| 2 | [splitMP3-API-Orchestrated](splitMP3-API-Orchestrated/) | Atomic + Universal Worker (different media, same validation pattern) | 6 | Audio segment splitting, meeting recording processing |
| 3 | [openwebui-bridge-v2](openwebui-bridge-v2/) | Skill-Driven + Security | 5 | OpenWebUI ↔ n8n system integration |

Each example contains:

```text
<example-name>/
├── workflow.json     # Ready to import into n8n
├── spec.md           # SDD spec (per enterprise-patterns Skill §3 template)
└── README.md         # Deployment steps, credential setup, test cases
```

For the full Chinese index with deeper deployment guidance, see [INDEX.md](INDEX.md) / [INDEX.en.md](INDEX.en.md).
