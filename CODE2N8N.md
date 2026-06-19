# Code2n8n — Manifesto

> 🌐 **English** (canonical) · [繁體中文](#繁體中文)
>
> 📦 **Repo**: https://github.com/MorrisLu-Taipei/TigerAI-A2A-Code2n8n-Skill-Pack
> 🚀 **v1.0 milestone**: [Path B end-to-end · Taiwan e-invoice case CLEARED with real-vendor-sandbox runtime evidence](examples/einvoice-n8n/)
> 📋 **v1.0 claims & evidence index**: [`docs/v1-claims-and-evidence.md`](docs/v1-claims-and-evidence.md)
> 🤖 **AI consumers** — read this first: [V&V A2A directive (11 languages)](docs/code2n8n-vv-a2a.md) · [external-dependency security A2A directive (English + Chinese)](docs/external-dependency-security-a2a.md)
>
> *by n8n Taipei Ambassador Morris Lu*

---

## English

### Why the rename

| Release | Name | Why |
| --- | --- | --- |
| pre-v0.21.0 | (sticky-note-to-workflow only) | Single skill, focused on natural-language → workflow |
| v0.21.0 → v0.41.0 | **TigerAI Code2n8n Skill Pack** | Added the "port existing code → governable workflow" path; manifesto written |
| **v1.0.0+** | **TigerAI A2A Code2n8n Skill Pack** | Added A2A directives in machine-readable specs (V&V two-layer gate in 11 languages; external-dependency security in English + Chinese). The Pack now ships rules other AI agents can consume directly, not just human-readable SOPs |

### Is n8n still a "No-Code" tool?

After Claude Code / Codex / Antigravity, real No-Code is gone. AI can write the system, the API integration, the agent, the script — from a picture, a story, a paragraph of intent.

**So why do enterprises want n8n *more*, not less?**

> *Per A2A directive (V&V A2A directive 11-language spec) — the enterprise-need checklist below is backed by the [4-case spectrum](#the-4-case-spectrum-code2n8n-journeys-ship-in-this-pack), [SECURITY-REVIEW.md](examples/einvoice-n8n/SECURITY-REVIEW.md) entries SEC-001 ~ SEC-022, and [v1-claims-and-evidence.md](docs/v1-claims-and-evidence.md) rows C1–C9. Each item is observable in at least one shipped case study.*

Because what enterprises need was never "code that runs today." They need code that can be:

- logged into with corporate identity
- audited for each execution
- parameter-tweaked without re-deploying
- version-controlled and rolled back
- handed off when a teammate leaves
- governed across systems by IT + ops + managers reading the same canvas
- security-reviewed for auth, injection, secrets, supply-chain attacks
- traced via a single execution history — tomorrow, next quarter, next succession

AI writes code that runs. **Code2n8n + n8n make that code something an enterprise can deploy.**

### Demo-ready is NOT deployment-grade

> *Per A2A directive — the following paragraph cites the restricted-phrase list verbatim from the directive itself (`per §1.6` rule definition); this is the spec citation, not a Pack claim. Evidence: [v1-claims-and-evidence.md](docs/v1-claims-and-evidence.md).*

Per the Pack's [V&V A2A directive](docs/code2n8n-vv-a2a.md) and [§1.6 lexical schema-before-claim rule](skills/tigerai/code2n8n-pipeline/SKILL.md), the words "validated / verified / tested / production-ready" require an evidence schema to appear in the same artefact. This is enforced by CI (`pack-self-scan-a2a` job).

The on-prem LINE customer-service case bundled in v0.22.2 looked complete — login screen, admin dashboard, Postgres, Redis, Qdrant, Ollama, a 37-node n8n workflow. Code2n8n's audit still found:

- `/api/auth/me` always returned `authenticated: true` — no real session or JWT
- All `/api/*` data routes lacked auth middleware
- Plaintext password comparison
- SQL identifier injection from request body field names
- Exposed API key / LINE secret / user state / n8n credential list
- No CSRF, no rate limit, no operation audit trail

Those defects do not stop a demo. They do stop an enterprise deployment.

Code2n8n therefore enforces a **Step 1.5 Security Audit** before any deployment claim. If findings remain unfixed, the case must:

1. Downgrade all deployment-grade language
2. Publish `SECURITY-CAVEATS.md` with file, line number, repro, and fix direction
3. Mark **DO NOT DEPLOY AS-IS**

Full disclosure of that case: [`examples/line-ai-customer-service-onprem/SECURITY-CAVEATS.md`](examples/line-ai-customer-service-onprem/SECURITY-CAVEATS.md).

> **AI-written software that runs is not automatically software an enterprise can deploy. Code2n8n is both a migration method and a review gate.**

> 🛠️ **SSO / IAM / audit log / HA** — covered by **n8n Enterprise** out of the box. The Pack does not reimplement them. The Pack's job is to make Code2n8n-produced workflows land cleanly on top of Enterprise (IAM-friendly, queue-safe, rollback-traceable). Full responsibility boundary: [`docs/enterprise-setup.md`](docs/enterprise-setup.md).

### The 4-case spectrum (Code2n8n journeys ship in this Pack)

Each case demonstrates a different point on the conversion → review → runtime trajectory.

| # | Case | Code2n8n journey | Status |
| --- | --- | --- | --- |
| 1 | [Google Workspace admin workflow](examples/google-workspace-admin-workflow/) | 1,373-line Apps Script → core + entry n8n workflows (line-by-line `PROVENANCE.md`) | Structural PASS · runtime needs caller Google Workspace credentials |
| 2 | [LINE customer service (cloud)](examples/line-ai-customer-service/) | Netlify Functions + Supabase → n8n runtime + approach-C admin UI | Structural PASS · runtime needs caller LINE + Supabase credentials |
| 3 | [LINE customer service (on-prem)](examples/line-ai-customer-service-onprem/) | Docker + Postgres + Redis + Qdrant + Ollama + n8n (37-node brain) | 5-phase V&V; security audit disclosed major defects — **DO NOT DEPLOY AS-IS** (preserved as teaching artefact) |
| **4** | [**Taiwan e-invoice (einvoice-n8n)**](examples/einvoice-n8n/) ⭐ | `@paid-tw/einvoice` TypeScript SDK (5 providers, MIG 4.0) → 80-line Hono `svc` + 14 n8n workflows | **v1.0 CLEARED** — Amego 10/10 SDK capability PASS against real Amego public sandbox (11 invoice traces); 22 SEC entries (20 ✅ / 1 mitigated / 1 documented); 4-Tier external-dependency security CI auto-enforced; 3 HITL versions (v1 DIY / v2 Slack sendAndWait / v3 Form for Taiwan) |

The 4th case is the v1.0 milestone: **first Path B case to ship CLEARED with real-vendor-sandbox runtime ground truth**. Closing report: [`examples/einvoice-n8n/tests/v0.41-final-validation-report.md`](examples/einvoice-n8n/tests/v0.41-final-validation-report.md).

### Code2n8n method in this Pack

**Marquee skill** — [`skills/tigerai/code-to-workflow/`](skills/tigerai/code-to-workflow/SKILL.md): the 7-step methodology (inventory → partition → core+entry → frontend decision tree → workflow design → 3-layer validation funnel → doc templates) + real pitfalls list + the 4 case studies as worked examples.

**Companion skills**:

- [`skills/tigerai/sticky-note-to-workflow/`](skills/tigerai/sticky-note-to-workflow/SKILL.md) — Path A: natural-language intent → workflow
- [`skills/tigerai/n8n-code-to-native/`](skills/tigerai/n8n-code-to-native/SKILL.md) — refactor Code nodes into native n8n nodes (reduces attack surface; pairs with malicious-jsCode scanner)
- [`skills/tigerai/n8n-security-governance/`](skills/tigerai/n8n-security-governance/SKILL.md) — Step 1.5 Security Audit SOP
- [`skills/tigerai/external-dependency-security/`](skills/tigerai/external-dependency-security/SKILL.md) — 4-Tier security for any external dependency (npm packages, GitHub raw content, external workflow JSON, Docker base images)
- [`skills/tigerai/code2n8n-pipeline/`](skills/tigerai/code2n8n-pipeline/SKILL.md) — the 13-stage auto-pilot pipeline that runs the whole flow with main + critic agents; §1.6 lexical schema-before-claim rule lives here
- [`skills/tigerai/tigerai-enterprise-patterns/`](skills/tigerai/tigerai-enterprise-patterns/SKILL.md) — 4 enterprise governance patterns

### V&V gate (per A2A directive, machine-readable)

Two layers, enforced via CI:

**Layer 1 (structural)** — `JSON.parse` + [`security-scan.mjs`](scripts/security-scan.mjs) (9 malicious-jsCode patterns + secret detector + cleartext URL warning) + [`live-roundtrip.mjs`](scripts/live-roundtrip.mjs) (REST import/delete cycle against a real n8n instance).

**Layer 2 (runtime)** — `npm install` / `npm audit --audit-level=high` (CI fail-gate since v0.36.0) / `tsc --noEmit` / `/healthz` / unauthenticated `/v1/*` → 401 / body-limit 413 / op-enum 400 / per-workflow runtime contract / cross-document parity / **end-to-end smoke against real vendor sandbox**.

[§1.6 lexical schema-before-claim rule](skills/tigerai/code2n8n-pipeline/SKILL.md) — restricted words ("validated / verified / tested / production-ready") require the evidence schema to appear earlier in the same artefact. CI scans the Pack's own user-facing docs ([`scripts/self-scan-forbidden-phrases.mjs`](scripts/self-scan-forbidden-phrases.mjs)) — we eat our own dog food.

### 4-Tier external-dependency security (v0.36 → v0.39)

Built in response to the question "do we security-check external GitHub content + handle malicious code?" Each Tier is CI-enforced:

| Tier | Release | What it adds |
| --- | --- | --- |
| Tier 1 | v0.36.0 | scanner with 9 malicious-jsCode patterns (reverse-shell / env-dump / dynamic-eval / require-child-process / fs-write-sensitive / net-exfil / process-spawn / base64-decode / require-fs) + `npm audit` → fail-gate + svc deps caret → exact-pin |
| Tier 2 | v0.37.0 | container hardening (`USER 65534`, `npm ci`, base-image hash-pin) + SBOM (CycloneDX) CI artefact + Trivy gate (exit-code 1) + Renovate review-required + external-workflow ingestion gate (3 sub-gates) |
| Tier 3 | v0.38.0 | new Skill `external-dependency-security` (9 sections covering npm review / sigstore provenance / GitHub commit-sha lock / external-workflow ingestion / Docker base-image SOP / Stage 7 SCA gate / cross-Skill coordination / operator quickstart) |
| Tier 4 | v0.39.0 | Skill rules → real CI gates (`ext-dep-skill-enforcement` job, 4 sub-gates) + pre-commit hook + `CODEOWNERS` + PR template (10-checkbox dep review) + A2A directive (English + Chinese, machine-readable spec for AI consumers) |

Defense-in-depth, not a 100% guarantee — novel supply-chain attacks always evade any single tool. The Pack ships the gates and the honest disclosure that they are gates, not guarantees.

### New division of labour (AI Coding ↔ Code2n8n ↔ n8n)

| Dimension | Claude Code / Codex / Antigravity | Code2n8n + n8n |
| --- | --- | --- |
| Natural language → code | Strong | Assists |
| Complex algorithms | Strong | Calls existing services |
| Visual workflow | Weak | Strong |
| Tweaking runtime params | Edit code | Adjust a node |
| Execution log / retry / alert | DIY | Built-in |
| Cross-system wiring | Possible | Visual orchestration |
| Handover | Engineering docs | The workflow *is* the handover |
| Governance | Extra build | Identity / permission / history / policy connectors |
| Auth / injection / secret review | Frequently omitted in demo-ready POCs | Mandatory Step 1.5 audit; disclose unresolved findings |
| External-dependency security | Manual / ad-hoc | 4-Tier CI auto-enforce |
| Cross-AI handoff | Hard (each AI sees opaque code) | A2A directives in machine-readable spec — Claude / Codex / Gemini all consume the same gate |

### The customer flow

```text
business need
  → picture / story / natural language
  → Claude Code generates the program
  → Code2n8n analyzes the system + runs Step 1.5 Security Audit
  → emits an n8n Workflow
  → plugged into enterprise identity, permission, data, governance
```

Code2n8n does not translate every Python line into n8n nodes. It re-partitions the system: **what stays as code (best at logic), what becomes a workflow node (best at being seen and managed).**

### Closing

> **AI Coding solves "how is the function built." Code2n8n solves "how is the capability modularized + reviewed + governance-traced." n8n solves "how the modules cooperate across the whole enterprise."**

That is the new division of labour, and it is why my customers want n8n *more* in the AI-coding era, not less.

---

## 繁體中文

### 為什麼改名

| 版本 | 名稱 | 為何改 |
| --- | --- | --- |
| pre-v0.21.0 | （只有 sticky-note-to-workflow）| 單一 skill，聚焦自然語言 → workflow |
| v0.21.0 → v0.41.0 | **TigerAI Code2n8n Skill Pack** | 加入「移植既有程式 → 可治理 workflow」路徑；manifesto 寫成 |
| **v1.0.0+** | **TigerAI A2A Code2n8n Skill Pack** | 加上 A2A directives（machine-readable spec）— V&V 兩層 gate 在 11 國語言、external-dependency security 在中英雙語。Pack 現在 ship 給其他 AI agent 直接消費的規則，不只人類讀的 SOP |

### n8n 還是 No-Code 工具嗎？

在 Claude Code / Codex / Antigravity 出現之後，真的 No-Code 已經消失。AI 只要看一張圖、聽一個故事，就能寫出系統、API 串接、Agent、自動化腳本。

**那為什麼企業反而**更**要 n8n？**

因為企業要的從來不只是「今天能跑的程式」。他們要的是程式可以：

- 用企業身份登入
- 每次執行被稽核
- 改參數不用重 deploy
- 版本控制 + 回 rollback
- 同事離職時被接手
- IT、營運、主管能看同一張圖談話
- 對 auth、injection、secrets、supply chain 攻擊有安全 review
- 一套執行紀錄追蹤 — 今天、下季、下次接手都看得到

AI 把程式寫出來。**Code2n8n + n8n 把那段程式變成企業能 deploy 的東西。**

### Demo 跑得起來 ≠ 可以 deployment

> *Per A2A directive — 下段引用 §1.6 rule 定義的受限字眼清單（spec 引用，非 Pack claim）。Evidence: [v1-claims-and-evidence.md](docs/v1-claims-and-evidence.md)。*

依本 Pack 的 [V&V A2A directive](docs/code2n8n-vv-a2a.md) 與 [§1.6 lexical schema-before-claim rule](skills/tigerai/code2n8n-pipeline/SKILL.md)，「validated / verified / tested / production-ready / 驗證 / 驗證通過」這類字眼需要 evidence schema 出現在同 artefact 內。CI `pack-self-scan-a2a` job 自動掃。

v0.22.2 收錄的 LINE AI 客服地端案例看起來完整 — 登入頁、管理後台、Postgres、Redis、Qdrant、Ollama、37 節點 n8n workflow。Code2n8n 安全審查發現：

- `/api/auth/me` 永遠回 `authenticated: true` — 沒有真 session 或 JWT
- 所有 `/api/*` 資料路由沒掛 auth middleware
- 密碼以明文比對
- request body 欄位名稱拼進 SQL → identifier injection
- API key / LINE secret / 用戶狀態 / n8n credential 名單可被未授權讀
- 沒 CSRF、rate limit、操作 audit log

這些不阻止 demo，但阻止企業 deployment。

Code2n8n 因此強制在 source inventory + 架構分區之間加一個 **Step 1.5 Security Audit**。若缺陷沒修就必須：

1. 降級所有 deployment-grade 字眼
2. 發布 `SECURITY-CAVEATS.md` 列檔案、行號、reproducer、修補方向
3. 明標 **DO NOT DEPLOY AS-IS**

完整揭露：[`examples/line-ai-customer-service-onprem/SECURITY-CAVEATS.md`](examples/line-ai-customer-service-onprem/SECURITY-CAVEATS.md)。

> **AI 寫的能跑，不代表企業能 deploy。Code2n8n 既是移植方法、也是 review gate。**

> 🛠️ **SSO / IAM / 稽核 log / HA** — **n8n Enterprise** 開箱即有，Pack 不重做。Pack 工作是讓 Code2n8n 產出的 workflow 乾淨落在 Enterprise 上（IAM-friendly、queue-safe、rollback-traceable）。完整責任邊界：[`docs/enterprise-setup.md`](docs/enterprise-setup.md)。

### 四個案例光譜（Code2n8n 不同路徑的證據）

| # | Case | Code2n8n 路徑 | 狀態 |
| --- | --- | --- | --- |
| 1 | [Google Workspace admin workflow](examples/google-workspace-admin-workflow/) | 1,373 行 Apps Script → core + entry n8n workflows（逐行 `PROVENANCE.md`） | 結構層 PASS · runtime 需 caller Google Workspace credentials |
| 2 | [LINE customer service (cloud)](examples/line-ai-customer-service/) | Netlify Functions + Supabase → n8n runtime + approach-C 自托管後台 | 結構層 PASS · runtime 需 caller LINE + Supabase credentials |
| 3 | [LINE customer service (on-prem)](examples/line-ai-customer-service-onprem/) | Docker + Postgres + Redis + Qdrant + Ollama + n8n（37 節點大腦） | 5 階段 V&V；安全 audit 揭露重大缺陷 — **DO NOT DEPLOY AS-IS**（保留作教學 artefact） |
| **4** | [**Taiwan e-invoice (einvoice-n8n)**](examples/einvoice-n8n/) ⭐ | `@paid-tw/einvoice` TypeScript SDK（5 家供應商，MIG 4.0）→ 80 行 Hono `svc` + 14 個 n8n workflow | **v1.0 CLEARED** — Amego 10/10 SDK capability 對真實 Amego sandbox PASS（11 張真實發票 trace）；22 SEC entries（20 ✅ / 1 mitigated / 1 documented）；4-Tier external-dependency security CI 自動 enforce；3 個 HITL 版本（v1 DIY / v2 Slack sendAndWait / v3 Form 台灣首選） |

第 4 個 case 是 v1.0 milestone：**第一個 Path B case ship CLEARED with 真實 vendor sandbox runtime ground truth**。結案報告：[`examples/einvoice-n8n/tests/v0.41-final-validation-report.md`](examples/einvoice-n8n/tests/v0.41-final-validation-report.md)。

### Code2n8n 在本 Pack 怎麼落地

**Marquee skill** — [`skills/tigerai/code-to-workflow/`](skills/tigerai/code-to-workflow/SKILL.md)：7 步驟方法論（盤點 → 分區 → core+entry → 前端決策樹 → workflow 設計 → 3 層驗證漏斗 → 文件範本）+ 真實踩雷清單 + 4 個 case study 當實證。

**配套 skill**：

- [`sticky-note-to-workflow/`](skills/tigerai/sticky-note-to-workflow/SKILL.md) — Path A：自然語言意圖 → workflow
- [`n8n-code-to-native/`](skills/tigerai/n8n-code-to-native/SKILL.md) — Code 節點微觀去 JS 化（縮 attack surface，配合惡意 jsCode scanner）
- [`n8n-security-governance/`](skills/tigerai/n8n-security-governance/SKILL.md) — Step 1.5 Security Audit SOP
- [`external-dependency-security/`](skills/tigerai/external-dependency-security/SKILL.md) — 對任何外部依賴的 4-Tier security
- [`code2n8n-pipeline/`](skills/tigerai/code2n8n-pipeline/SKILL.md) — 13 階段 auto-pilot pipeline（main + critic agents）；§1.6 lexical schema-before-claim rule 在此
- [`tigerai-enterprise-patterns/`](skills/tigerai/tigerai-enterprise-patterns/SKILL.md) — 4 個企業治理 pattern

### AI Coding ↔ Code2n8n ↔ n8n 新分工

| 維度 | Claude Code / Codex / Antigravity | Code2n8n + n8n |
| --- | --- | --- |
| 自然語言 → 程式 | 強 | 輔助 |
| 複雜演算法 | 強 | 呼叫既有服務 |
| 視覺化流程 | 弱 | 強 |
| 改執行參數 | 改程式 | 動 node |
| 執行紀錄 / 重試 / 告警 | DIY | 內建 |
| 跨系統串接 | 可開發 | 視覺化編排 |
| 交接 | 工程文件 | workflow 本身就是交接介面 |
| 治理 | 額外建設 | 身份 / 權限 / 紀錄 / 政策 connectors |
| Auth / injection / secret review | 容易留下 demo-ready POC 缺口 | 強制 Step 1.5 audit；未修補就揭露 |
| 外部依賴安全 | 手動 / ad-hoc | 4-Tier CI 自動 enforce |
| 跨 AI 換手 | 困難（每個 AI 看 opaque 程式） | A2A directives machine-readable spec — Claude / Codex / Gemini 都消費同一 gate |

### 客戶 flow

```text
業務需求
  → 圖片 / 故事 / 自然語言
  → Claude Code 寫出程式
  → Code2n8n 分析系統 + 跑 Step 1.5 Security Audit
  → 轉成 n8n Workflow
  → 接入企業身份、權限、資料、治理
```

Code2n8n 不是把每行 Python 翻成 n8n 節點。它幫企業重新分派：**哪些留程式（最會跑邏輯）、哪些上升成 workflow node（最會被看與管）**。

### 結論

> **AI Coding 解決「功能怎麼做」。Code2n8n 解決「功能如何模組化 + review + 治理追蹤」。n8n 解決「模組如何與整個企業協作」。**

這就是新的分工，也是為什麼**我的客戶在 AI Coding 時代反而**更要 n8n。
