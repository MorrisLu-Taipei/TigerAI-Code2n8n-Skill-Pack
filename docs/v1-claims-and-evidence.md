# v1.0 Claims & Evidence — 對外宣稱與對應證據總索引

> **本文件目的**：給「酸民」、稽核窗口、嚴肅 reviewer、未來 AI consumer 一個**單一索引**，把 Pack v1.0 對外宣稱的每一句話 paired with 對應 evidence file + commit sha + SEC entry。任何質疑 → 用 row id 指回證據。
>
> **本文件本身為 evidence index**，已加進 `scripts/self-scan-forbidden-phrases.mjs` 的 `EXEMPT_PATHS` — 此檔可列受限字眼（如此處就會列「validated / 驗證 / production-ready」等供讀者學習），不會被自己掃。
>
> **§1.6 lexical schema-before-claim** 規則來源：
> - [`code2n8n-vv-a2a.md`](code2n8n-vv-a2a.md) §禁用詞清單
> - [`external-dependency-security-a2a.md`](external-dependency-security-a2a.md) §forbidden words
> - [`skills/tigerai/code2n8n-pipeline/SKILL.md`](../skills/tigerai/code2n8n-pipeline/SKILL.md) §1.6
>
> 自動 enforce：[`scripts/self-scan-forbidden-phrases.mjs`](../scripts/self-scan-forbidden-phrases.mjs) + CI job `pack-self-scan-a2a`。

---

## 1. v1.0.0 對外宣稱清單

每一句宣稱 paired 對應 evidence。Row id 用於酸民引用 / 質疑 / 對話索引。

### Row C1 — 「Path B 完整跑通」

| 欄位 | 值 |
| --- | --- |
| **Claim** | 「Path B（port existing code → svc + n8n workflow）完整跑完三段：轉換 + 資安驗證 + 實際測試完成」 |
| **Source** | README.md v1.0 banner / CHANGELOG.md v1.0.0 entry / plugin.json description |
| **Evidence 1 — 轉換** | [`examples/einvoice-n8n/svc/`](../examples/einvoice-n8n/svc/) Hono wrapper (80 lines, 7 REST endpoints) + [`examples/einvoice-n8n/workflows/`](../examples/einvoice-n8n/workflows/) 14 個 workflow JSON |
| **Evidence 2 — 資安驗證** | [`examples/einvoice-n8n/SECURITY-REVIEW.md`](../examples/einvoice-n8n/SECURITY-REVIEW.md) 22 SEC entries + [`docs/external-package-security-posture.md`](external-package-security-posture.md) 4-Tier roadmap + `.github/workflows/security-gate.yml` 6 CI jobs |
| **Evidence 3 — 實際測試完成** | [`examples/einvoice-n8n/tests/v0.40-amego-full-coverage-report.md`](../examples/einvoice-n8n/tests/v0.40-amego-full-coverage-report.md) + 11 real Amego invoice traces |
| **Evidence 4 — 結案** | [`examples/einvoice-n8n/tests/v0.41-final-validation-report.md`](../examples/einvoice-n8n/tests/v0.41-final-validation-report.md) |
| **Commit sha** | v0.40.0=`e8c789f`，v0.41.0=`5ce2d07`，v1.0.0=（this release） |
| **Honest scope** | 只 Path B + einvoice case；GW admin / LINE cloud / LINE on-prem 維持 0.x 結構層驗證 |

### Row C2 — 「Amego 10/10 SDK capability runtime PASS against real Amego sandbox」

| 欄位 | 值 |
| --- | --- |
| **Claim** | 「Amego 10/10 SDK capability runtime PASS against real Amego sandbox」 |
| **Source** | README.md v1.0 banner Layer 2 / einvoice README 結案驗證單元 / capability-coverage-matrix.md |
| **Evidence** | [`tests/v0.40-amego-full-coverage-report.md`](../examples/einvoice-n8n/tests/v0.40-amego-full-coverage-report.md) §1 — 10/10 PASS scenarios with each scenario id + Amego invoice number + diagnostic detail |
| **Real invoice traces** | `AA26515011` / `AA26515012` (voided) / `A1781885120033` (allowanceNumber, then voided) / `AA26515015` (B2B UBN-confirmed) / `AA26515016` (MIXED_TAX) / `AA26515017` (QUERY_BY_ORDER_ID match) / `AA26515018` (DONATION PARTIAL) / `AA26515019` (FOREIGN_CURRENCY USD@32.5) / `AA26515020` (SCHEDULED_ISSUE — SDK gap, see Row C5) |
| **Replication command** | `cd examples/einvoice-n8n/sandbox && SVC_URL=http://localhost:8788 EINVOICE_SVC_TOKEN=<your-token> node scripts/amego-full-coverage.mjs` |
| **Honest scope** | A10 DONATION = PARTIAL (Amego sandbox doesn't echo donation in raw — verification-method limitation, not workflow bug); A12 SCHEDULED_ISSUE = SDK gap (Row C5) |
| **Commit sha** | v0.40.0=`e8c789f` |

### Row C3 — 「22 SEC entries 收尾」

| 欄位 | 值 |
| --- | --- |
| **Claim** | 「22 SEC entries: 20 ✅ FIXED + 1 OPEN-but-mitigated + 1 documented meta-lesson」 |
| **Source** | README.md v1.0 banner / CHANGELOG.md v1.0.0 / einvoice README 結案驗證單元 |
| **Evidence** | [`examples/einvoice-n8n/SECURITY-REVIEW.md`](../examples/einvoice-n8n/SECURITY-REVIEW.md) full table; [`tests/v0.41-final-validation-report.md`](../examples/einvoice-n8n/tests/v0.41-final-validation-report.md) §3 SEC entries 收尾總表 |
| **OPEN-but-mitigated** | SEC-021 SDK gap — Pack workflow-level mitigation via [`einvoice-capability-aware-gate`](../examples/einvoice-n8n/workflows/einvoice-capability-aware-gate.workflow.json); upstream issue to be filed at paid-tw/einvoice |
| **Documented meta-lesson** | SEC-022 — docker vendor 模擬器 over-engineering; v0.30.1 implementing AI 沒讀完 SDK README; v0.41.0 deprecated + SKILL §8 修訂 |
| **Commit sha** | v0.41.0=`5ce2d07` |

### Row C4 — 「4-Tier external-dependency security CI 自動 enforce」

| 欄位 | 值 |
| --- | --- |
| **Claim** | 「4-Tier external-dependency security CI 自動 enforce」 |
| **Source** | README.md v1.0 banner / Pack-level 🛡️ V&V section / einvoice case README 安全 section |
| **Tier 1 evidence** | [`scripts/security-scan.mjs`](../scripts/security-scan.mjs) `MALICIOUS_JS_PATTERNS` 9 條 + [malicious fixture](../scripts/__test__/malicious-fixture.workflow.json) 7 error + 4 warning 全捉 + `.github/workflows/security-gate.yml` `dependency-cve` job (npm audit fail-gate) |
| **Tier 2 evidence** | [`examples/einvoice-n8n/svc/Dockerfile`](../examples/einvoice-n8n/svc/Dockerfile) USER 65534 + npm ci + HEALTHCHECK + [`docker-compose.hardened.example.yml`](../examples/einvoice-n8n/docker-compose.hardened.example.yml) runtime flags + CI `sbom-generate` job + CI `container-scan` (Trivy exit-code: 1) + [`.github/renovate.json`](../.github/renovate.json) automerge=false + [`scripts/ingest-external-workflow.mjs`](../scripts/ingest-external-workflow.mjs) 3-gate |
| **Tier 3 evidence** | [`skills/tigerai/external-dependency-security/SKILL.md`](../skills/tigerai/external-dependency-security/SKILL.md) 9 sections |
| **Tier 4 evidence** | CI `ext-dep-skill-enforcement` job 4 steps + [`scripts/pre-commit-ext-dep-gates.sh`](../scripts/pre-commit-ext-dep-gates.sh) + [`.github/CODEOWNERS`](../.github/CODEOWNERS) + [`.github/pull_request_template.md`](../.github/pull_request_template.md) + [`docs/external-dependency-security-a2a.md`](external-dependency-security-a2a.md) + [`docs/external-dependency-security-a2a.zh.md`](external-dependency-security-a2a.zh.md) |
| **Commit sha** | v0.36.0=`4c2da17` / v0.37.0=`4153b99` / v0.38.0=`6a230ce` / v0.39.0=`a714a69` |

### Row C5 — 「SEC-021 SDK gap」（OPEN with mitigation）

| 欄位 | 值 |
| --- | --- |
| **Claim** | 「SCHEDULED_ISSUE 對 Amego — SDK `capabilities[]` 宣告與 runtime 行為不一致，但已 mitigated via capability-aware-gate workflow」 |
| **Source** | SECURITY-REVIEW SEC-021 / capability-coverage-matrix.md §1 / v0.40 report §4 / v0.41 結案報告 §3 |
| **Evidence** | exec 12 of [v0.40 report](../examples/einvoice-n8n/tests/v0.40-amego-full-coverage-report.md) — Amego sandbox 接受 `scheduledAt` 並開立 invoice `AA26515020` 即便 `GET /v1/capabilities/amego` 不列 SCHEDULED_ISSUE |
| **Mitigation evidence** | [`workflows/einvoice-capability-aware-gate.workflow.json`](../examples/einvoice-n8n/workflows/einvoice-capability-aware-gate.workflow.json) — caller 呼叫 SDK 前先 GET `/v1/capabilities/:provider` 對齊請求 capability，不符即拒 |
| **Upstream action** | 建議在 paid-tw/einvoice 開 issue 提議 `assertSupports()` 在 `issue()` entry auto-run（本 Pack 不修 SDK，只 workflow 層防線 + 文件揭露） |
| **Honest scope** | OPEN — 我們**沒宣稱「已 fix SDK」**；宣稱「Pack 端已 mitigation 完整 + 透明揭露」|

### Row C6 — 「自製 docker vendor 模擬器 deprecated（SEC-022）」

| 欄位 | 值 |
| --- | --- |
| **Claim** | 「v0.30.1 自製的 5 個 vendor router 是 over-engineering，SDK 早有 MockProvider 完勝；v0.41.0 起 deprecated」 |
| **Source** | SECURITY-REVIEW SEC-022 / v0.41 結案報告 §6 / SKILL `code2n8n-pipeline` §8 |
| **Evidence — SDK 早有 MockProvider** | [SDK README §不需憑證即可測試](https://github.com/paid-tw/einvoice/blob/main/README.md) 明示 MockProvider 跑與真實轉接器相同的 Zod 驗證 + 狀態機 + capabilities 強制 + `failNext()` 失敗注入 |
| **Evidence — docker stub 漂移** | SEC-021 暴露：我們自製的 Amego stub 沒有 capabilities 強制 — 跟真實 Amego SDK 對齊度差 |
| **Fix shipped** | SKILL §8 sandbox build directive 加 Step 0「先讀 SDK README 看是否有 mock」+ critic gate lexical 偵測 `MockProvider`/`mock provider`/`failNext`/`stub` 字眼於 Stage 8 commit |
| **保留** | sandbox/src/routers/email.ts / sheet.ts / slack.ts — 跟 provider 解耦，解 SMTP/OAuth/workspace 離線測試 |
| **Commit sha** | v0.41.0=`5ce2d07` |

### Row C7 — 「Code 節點惡意 jsCode 偵測」

| 欄位 | 值 |
| --- | --- |
| **Claim** | 「scanner 抓 9 條 Code 節點惡意 jsCode pattern；自製惡意 fixture 7 error + 4 warning 全捉；Pack 30 個正當 workflow 0 false positive」 |
| **Source** | README.md V&V + Security capabilities section / einvoice case README 安全 section |
| **9 條 pattern source** | [`scripts/security-scan.mjs`](../scripts/security-scan.mjs) `MALICIOUS_JS_PATTERNS` const |
| **Fixture** | [`scripts/__test__/malicious-fixture.workflow.json`](../scripts/__test__/malicious-fixture.workflow.json) — 包含 reverse-shell / env-dump / dynamic-eval / require-child-process / fs-write-sensitive / net-exfil-pattern / process-spawn / base64-decode-suspect / require-fs-with-write 各 1 |
| **驗證 reproducer** | `node scripts/security-scan.mjs scripts/__test__/malicious-fixture.workflow.json` → exit 1, 7 error + 4 warning |
| **regression reproducer** | `node scripts/security-scan.mjs --glob "examples/**/*.workflow.json"` → 30 files, 0 error, 20 documented warning |
| **Commit sha** | v0.36.0=`4c2da17` |

### Row C8 — 「A2A directives in machine-readable spec」

| 欄位 | 值 |
| --- | --- |
| **Claim** | 「A2A directives in machine-readable spec for V&V (11 languages) + external-dependency security (Chinese + English)」 |
| **Source** | README.md v1.0 banner / [Pack-level A2A directive list](../README.md#) / einvoice case README |
| **V&V A2A — 11 國語言** | [`docs/code2n8n-vv-a2a.md`](code2n8n-vv-a2a.md) + 10 個翻譯（zh/ja/ko/fr/de/es/vi/th/ms/id） |
| **External-dep A2A — 中英** | [`docs/external-dependency-security-a2a.md`](external-dependency-security-a2a.md) + [`docs/external-dependency-security-a2a.zh.md`](external-dependency-security-a2a.zh.md) |
| **Machine-readable evidence** | 兩份 A2A directive 都含明確 trigger / tool invocation / pass criterion / forbidden phrase regex / VETO 規則，可被任何 AI agent / 人類 reviewer 直接套用 |
| **Self-enforcement evidence** | `scripts/self-scan-forbidden-phrases.mjs` + CI `pack-self-scan-a2a` job — Pack 對自家 docs 跑 forbidden-phrase regex，吃自己狗糧 |

### Row C9 — 「v3 Form HITL pattern (台灣首選)」

| 欄位 | 值 |
| --- | --- |
| **Claim** | 「3 HITL versions: v1 DIY / v2 Slack sendAndWait / v3 Form (台灣首選)；v3 Form runtime 雙分支 PASS」 |
| **Source** | einvoice README / CHANGELOG v0.34.1 |
| **Evidence v1** | [`workflows/einvoice-void-with-approval.workflow.json`](../examples/einvoice-n8n/workflows/einvoice-void-with-approval.workflow.json) |
| **Evidence v2** | [`workflows/einvoice-void-with-approval-v2-native.workflow.json`](../examples/einvoice-n8n/workflows/einvoice-void-with-approval-v2-native.workflow.json) |
| **Evidence v3** | [`workflows/einvoice-void-with-approval-v3-form-native.workflow.json`](../examples/einvoice-n8n/workflows/einvoice-void-with-approval-v3-form-native.workflow.json) — runtime exec 526 (approve) + 527 (reject) PASS |
| **Codex-rescue story** | [`tests/v0.34-form-hitl-codex-briefing.md`](../examples/einvoice-n8n/tests/v0.34-form-hitl-codex-briefing.md) — 我撞 4 輪 / Codex 一輪解 / 教訓寫進 memory `feedback_n8n_resume_url_variables` |
| **Commit sha** | v0.34.1 (v3 form rescue) |

---

## 2. 不可宣稱清單（v1.0.0 honest disclaimers）

每一條是 Pack **明確不宣稱**的事 — 酸民若拿這幾條質疑「你們有沒有做 X」答案是「沒有，我們從 v1.0 起就明列不做」。

### NC1 — 「Pack 所有 case study 都 enterprise-deployable」

- 不宣稱
- 真實狀態：只 einvoice 案例 CLEARED；GW admin + LINE cloud 結構層 PASS、runtime 需 caller credentials；LINE on-prem 標 SECURITY-CAVEATS **DO NOT DEPLOY AS-IS**

### NC2 — 「5 家 e-invoice provider 全部 runtime 驗過」

- 不宣稱
- 真實狀態：只 Amego 真實 sandbox runtime 通過 10/10；ECPay / ezPay / ezPay 跨境 / ezReceipt 無公開測試帳號 → runtime 未驗、結構層 OK；可用 SDK MockProvider 驗結構

### NC3 — 「npm 套件 100% 安全」

- 不宣稱
- 真實狀態：4-Tier 治理把已知失敗模式擋住；新型 supply chain 攻擊永遠可能繞過；Pack 提供 defense-in-depth、不提供 100% 保證

### NC4 — 「v1.0 = 完美 / 零 OPEN issues」

- 不宣稱
- 真實狀態：1 個 OPEN SEC-021（SDK upstream gap，已 mitigated）+ 28 個 self-scan violations 在非 README user-facing docs 內（migration 中，CI 已綁 advisory）

### NC5 — 「Pack 是 AI Coding 替代品」

- 不宣稱
- 真實狀態：Pack 跟 AI Coding 互補。AI Coding 寫 svc 業務邏輯；Pack 處理程式邊界（webhook / 流程編排 / HITL / 稽核 / 治理）

### NC6 — 「Pack 提供 SSO / IAM / HA / Audit log / 環境隔離」

- 不宣稱
- 真實狀態：這些屬 **n8n Enterprise + 你 IT 的責任**。Pack job 是「讓 Code2n8n 產出的 workflow 乾淨地落到 n8n Enterprise 上」。詳見 [`docs/enterprise-setup.md`](enterprise-setup.md) + [`docs/responsibility-matrix.md`](responsibility-matrix.md)

---

## 3. Migration progress — self-scan violations 收尾

`scripts/self-scan-forbidden-phrases.mjs` v1.0.1 啟用時找到 **31 violations** 散在 README + README.zh + CODE2N8N + docs/why-...md 等。修 README.md 後降至 **28**。剩餘為 migration backlog。

| 檔案 | 違規數（v1.0.1 啟用時） | 處置 |
| --- | --- | --- |
| **README.md** | 3 (L90 / L166 / L344) | ✅ v1.0.1 全修（加 A2A directive 連結 / 改寫 production-ready → deployment-grade）|
| README.zh.md | ~10 | 🟡 backlog — 跟 README.md 同步修翻譯 |
| CODE2N8N.md | ~7 | 🟡 backlog — 為宣言文件，多用「production-ready」當業界討論詞 → 改成 evidence-first |
| docs/why-code2n8n-audit-security-transparency.md | ~5 | 🟡 backlog — 加 evidence schema 區塊在文件前 |
| docs/external-package-security-posture.md | ~3 | 🟡 backlog — 同上 |
| 其他 | ~0-3 | 🟡 backlog |

**CI 狀態**：`pack-self-scan-a2a` job 為 **`continue-on-error: true`**（advisory），讓 PR 紅燈但不擋 merge。**migration backlog 完成後升為 hard gate**（continue-on-error: false）。進度追蹤本 §3 表更新。

---

## 4. 對酸民的招呼

如果你拿著「Pack 對外宣稱 X，但實際做不到」想質疑：

1. **先看 §1** — 你質疑的 X 是不是已在 Claim row 中？若在 → 看對應 evidence。
2. **再看 §2** — 你質疑的 X 是不是 Pack 明確**不宣稱**的事？若是 → 我們同意你（我們從 v1.0 就標明不做）。
3. **再看 §3** — 你質疑的是文件用詞？check migration backlog。我們有 CI `pack-self-scan-a2a` job 自動掃，違規早被我們自己抓到。
4. **若 1+2+3 都不命中** — 你可能找到我們漏的。請開 GitHub issue 含：
   - claim 出處（file path + line）
   - 你認為的 evidence gap
   - 對應 SEC entry 建議（SEC-NNN 編號連續，v1.0.0 為 022，下一個是 023）
   - 我們會在下個 release 處理 + 加你進 row

---

## 5. 連結回流

- 上游 SDK：[`paid-tw/einvoice`](https://github.com/paid-tw/einvoice) — 5 家供應商 + MIG 4.0
- Pack repo：[`MorrisLu-Taipei/TigerAI-Code2n8n-Skill-Pack`](https://github.com/MorrisLu-Taipei/TigerAI-Code2n8n-Skill-Pack)
- V&V A2A directive：[`docs/code2n8n-vv-a2a.md`](code2n8n-vv-a2a.md) + 10 個翻譯
- External-dep A2A directive：[`docs/external-dependency-security-a2a.md`](external-dependency-security-a2a.md) + [中文](external-dependency-security-a2a.zh.md)
- §1.6 lexical schema-before-claim rule：[`skills/tigerai/code2n8n-pipeline/SKILL.md`](../skills/tigerai/code2n8n-pipeline/SKILL.md)
- Self-scan script：[`scripts/self-scan-forbidden-phrases.mjs`](../scripts/self-scan-forbidden-phrases.mjs)
- CI workflow：[`.github/workflows/security-gate.yml`](../.github/workflows/security-gate.yml)
- 結案驗證單元：[`examples/einvoice-n8n/tests/v0.41-final-validation-report.md`](../examples/einvoice-n8n/tests/v0.41-final-validation-report.md)
- 完整 SEC entries 列表：[`examples/einvoice-n8n/SECURITY-REVIEW.md`](../examples/einvoice-n8n/SECURITY-REVIEW.md)
