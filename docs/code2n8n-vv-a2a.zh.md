# Code2n8n V&V — A2A 指令（AI consumer 先讀這份）

> 🌐 **語言**：[English](code2n8n-vv-a2a.md) · **中文** · [日本語](code2n8n-vv-a2a.ja.md) · [한국어](code2n8n-vv-a2a.ko.md) · [Français](code2n8n-vv-a2a.fr.md) · [Deutsch](code2n8n-vv-a2a.de.md) · [Español](code2n8n-vv-a2a.es.md) · [Tiếng Việt](code2n8n-vv-a2a.vi.md) · [ภาษาไทย](code2n8n-vv-a2a.th.md) · [Bahasa Melayu](code2n8n-vv-a2a.ms.md) · [Bahasa Indonesia](code2n8n-vv-a2a.id.md)
>
> 英文版為 source of truth；翻譯版本以發版為單位同步。

> 🤖 **受眾**：寫給執行 Code2n8n 流程的 **AI agent**（Claude Code / Codex / Antigravity / 任一 LLM）。人類 reviewer 請改讀 [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md)。
>
> 把以下規則當作必要遵守的指令，不是參考建議。

---

## 指令何時生效

只要當前 Code2n8n 流程中出現以下任一情境，**必須**套用本指令：

- 你準備在任一輸出（commit 訊息、release notes、README、sticky note、CHANGELOG、回應使用者）寫出「驗證」/「驗證通過」/「已驗證」/「已測試」/「production-ready」/「可上線」/「X/X ok」/「全綠」/「validated」/「tested」這類字眼。
- 你準備建議某個案例可以出版、合併、部署、啟用、或 import 進正式 n8n。
- 使用者指令隱含驗證已完成（例如「跑這個 workflow」、「上架」、「上線」）。

任一情境成立 → 指令生效，不得繞過。

---

## Gate（兩層）

每個案例有**兩層**驗證。**兩層皆通過**才可使用驗證類字眼。

### Layer 1 — 結構 / import-time

三條指令。三條都要跑，全部 capture 輸出。

```
# 1. JSON parse
node -e "JSON.parse(require('fs').readFileSync('<workflow>.workflow.json','utf8'))"

# 2. 確定性安全掃描
node scripts/security-scan.mjs --glob "<case-dir>/workflows/*.workflow.json" --format markdown

# 3. n8n REST round-trip（需 N8N_API_URL + N8N_API_KEY）
node scripts/live-roundtrip.mjs --glob "<case-dir>/workflows/*.workflow.json"
```

**Layer 1 通過條件**（三項皆需）：
- 每個 workflow JSON 都能 parse。
- `security-scan.mjs` 報 `0 error`。warning 只允許「同時在 case README 與 SECURITY-REVIEW.md 中有段落解釋為什麼留下不修」的情況。
- `live-roundtrip.mjs` 報 `X/X ok`（X = 掃描檔案數）。

**Layer 1 為必要、非充分。** 僅通過 Layer 1，**不得**使用驗證類字眼。

### Layer 2 — Compile / runtime / 跨文件一致性

下列任一情境成立 → Layer 2 強制：
- 案例含 wrapper service / SDK / 外部相依（任何 `package.json` / `requirements.txt` / `go.mod` / `Cargo.toml`）
- workflow 含「runtime 行為從 JSON 看不出」的節點（status branching 的 HTTP node、Wait + resume、有 timezone 的 Schedule、含 binary 附件的 Email 等）
- case README 宣稱可觀測行為（通知、稽核寫入、排程執行、跨系統交接）

#### Layer 2.A — 相依性現實

```
cd <case-dir>/svc && npm install
cd <case-dir>/svc && npm audit --omit=dev --audit-level=high
cd <case-dir>/svc && npx tsc --noEmit
```

**通過條件**：
- `npm install` exit 0（無 `ETARGET`、不可加 `--force`）
- `npm audit` 報 high 以上 `0 vulnerabilities`
- `tsc --noEmit` exit 0

任一紅 → 必須先修。**不得**在任一紅的情況下宣稱驗證。

#### Layer 2.B — Runtime 信任邊界

```
cd <case-dir>/svc && npx tsc && node dist/index.js &
sleep 2
curl -s http://127.0.0.1:<port>/healthz
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<port>/v1/<protected>
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <token>" http://127.0.0.1:<port>/v1/<protected>
```

**通過條件**：
- `/healthz` 200 + 預期 JSON body
- 未驗證打到受保護端點 → 401（不是 200、不是 500）
- 驗證後打到同端點 → 200 或文件宣稱的領域狀態碼（400 / 502 屬上游錯誤）

加上 **3 個負面測試**：
- 超大 body → 預期 413
- prototype 污染 payload（如 `op: "__proto__"`）→ 預期 400
- 未知 enum（如 `provider: "fake-provider"`）→ 預期 400 且 body 不洩漏內部細節

#### Layer 2.C — Workflow runtime 契約

每份 workflow JSON 都要檢查**實際節點配置**（不是看 sticky note）：

| 模式 | 必要配置 |
| --- | --- |
| HTTP node 後接 status-based IF | `options.response.response.fullResponse = true` 且 `neverError = true` |
| Wait node + resume webhook | sticky note / Code node 用 `$execution.resumeUrl`（**不是** `$resumeUrl`） |
| Schedule trigger | `settings.timezone` 設為非 UTC tz（如 `Asia/Taipei`）且 Code node 日期運算用 `new Intl.DateTimeFormat('en-CA', { timeZone })`（**不是** `new Date().toISOString().slice(0,10)`） |
| Webhook entry | `responseMode = "responseNode"` + `respondToWebhook` 節點 + 固定 schema body（**不是** `responseMode = "lastNode"`） |
| Email + 附件 | 前面有 `n8n-nodes-base.convertToFile` 節點且 Email 節點 `attachments` 指向產生的 binary property 名（預設 `data`） |
| Dead-letter / 通知節點 | `connections{}` 內至少一條入邊。打開 JSON 確認，不要相信 sticky note。 |

任何違反 → release blocker。

#### Layer 2.D — 跨文件一致性

case README 的每一條宣稱 → 找到實作的 file:line。實作不存在 = 文件 bug，修文件或補實作後才能宣稱驗證。範例：

- 「dead-letter Slack」→ 找 Slack 節點，確認從 `Exhausted? = true` 有入邊。
- 「人工核可關卡」→ 確認 Wait + resume + Approved? IF + 兩條分支都有 audit 寫入。
- 「audit row」→ 確認 Sheet / DB 寫入節點存在、欄位完整、在連線圖中。
- 「finance summary email」→ 確認 Email 節點存在、有連線、收件信箱 placeholder 在 placeholder 表中列出。

---

## 跑完 gate 必須輸出的 schema

跑完 Layer 1 + Layer 2 後，輸出（給使用者、給 commit 訊息、給 release notes、給另一個 AI）**必須**含以下格式段落：

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

任一行 FAIL 或 PENDING → 該行對應的驗證類字眼在後續輸出中**禁用**。

---

## 禁用詞表

對應 evidence 行為 PASS 之前，**不得**輸出下列字眼：

| 禁用詞 | 需要的 evidence |
| --- | --- |
| 「驗證通過」/「已驗證」/「validated」 | Layer 1 + Layer 2 全 PASS，或每個 PENDING 在同段落明確標註 |
| 「已測試」/「tested」 | 至少 Layer 2.B PASS |
| 「X/X ok」/「全綠」 | 必須限定哪一層（如「Layer 1 X/X ok」）— 不得用無限定形式 |
| 「可上線」/「正式可用」/「production-ready」 | Layer 1 + Layer 2 + end-to-end smoke + SECURITY-REVIEW decision 為 PASS 或 CONDITIONAL |
| 「應該可以」/「看起來沒問題」 | 在任何驗證情境**禁用** — 用具體 evidence 替代 |

**必須**使用下列替代詞：

| 替代詞 | 適用情境 |
| --- | --- |
| 「結構層驗證 PASS；runtime 驗證 PENDING」 | Layer 1 完成、Layer 2 未做 |
| 「Layer 1 + Layer 2 PASS per [`docs/code2n8n-vv-a2a.md`](docs/code2n8n-vv-a2a.md)」 | 兩層皆完成 |
| 「import 通過；activation 需替換 X」 | Workflow JSON 合法、runtime 未測 |
| 「reference case；正式部署需 SECURITY-REVIEW §<n> 的補償控制」 | 案例可參考、未到 production-ready |

---

## 環境無法完整跑 gate 時的行為

若環境真的無法跑 Layer 2（沒設 `N8N_API_URL` / `N8N_API_KEY`、無 npm registry 連線、無 service 可起），**必須**：

1. 輸出 evidence schema、不可用的行標 `SKIPPED (reason: <reason>)`。
2. 明確告知使用者 / 呼叫 AI：「Layer 2 未跑，原因：<reason>。在 Layer 2 跑完之前，無法宣稱驗證通過。」
3. 拒絕輸出任何禁用詞。

部分跑、悄悄當完整跑就是本指令要防的失敗模式。skip 要大聲說。

---

## 對抗式 review hook

任何**全新外部 SDK / 系統**的第一個 Code2n8n 案例，**必須**在自家 gate 跑完後再請至少一個獨立 AI（使用者選的模型）做對抗式 review。獨立 review 的輸出進 case `SECURITY-REVIEW.md`，與自家 finding 並列。**獨立 review 是 gate 的一部分，不是選用 commentary**。

理由：本 gate 抓確定性結構 / runtime 失敗；新的 AI、無先入觀，會抓出實作 AI（你）統計上盲區的設計 / 文件層失敗。Pack v0.27.0 → v0.28.0 之所以出事，就是這個 hook 沒有強制。

---

## 為什麼指令這樣寫

- **觸發確定**（不是「用判斷」），AI 無法 reason 自己繞過。
- **工具呼叫精確**（不是「驗證相依性」），不同 AI 跑出同一份 evidence。
- **輸出 schema 強制**（不是「總結一下」），下游 AI / 人類可機械驗證 gate 是否跑過。
- **禁用詞表列死**，AI 無法用口語把驗證宣稱滲透出去。
- **skip 行為明文**，部分跑無法偽裝成完整跑。

這就是 consumer 為 AI agent 的 Pack 該長的 A2A interface。讀本指令的 AI 若無法 / 不願遵守，**必須**在繼續 Code2n8n 流程前告知使用者。

---

## 相關 artefact

- [`code2n8n-vv-checklist.md`](code2n8n-vv-checklist.md) — 人類版本（給人類 reviewer 用）
- [`../skills/tigerai/n8n-security-governance/SKILL.md`](../skills/tigerai/n8n-security-governance/SKILL.md) §10 — security skill 強制執行本指令
- [`../examples/einvoice-n8n/SECURITY-REVIEW.md`](../examples/einvoice-n8n/SECURITY-REVIEW.md) — 驅動本指令出生的案例
- [`../examples/einvoice-n8n/REFLECTION.md`](../examples/einvoice-n8n/REFLECTION.md) — 指令缺席時發生過什麼
