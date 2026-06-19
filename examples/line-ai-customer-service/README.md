# LINE AI 客服系統（n8n 版）

> 🌐 [English](README.en.md) | **繁體中文**

> ## v1.0 狀態 — Structural PASS · Runtime 需 caller credentials
>
> | 面向 | 狀態 |
> | --- | --- |
> | **Code2n8n 路徑** | Path B：Netlify Functions + Supabase + GPT/Gemini → n8n runtime + approach-C admin UI |
> | **在 [4-case spectrum](../../CODE2N8N.md#the-4-case-spectrum-code2n8n-journeys-ship-in-this-pack) 位置** | #2 of 4 |
> | **Layer 1 V&V**（structural）| ✅ Static lint 0 err / 0 warn · n8n REST import 6/6 |
> | **Layer 2 V&V**（runtime）| ⚠ Requires caller LINE + Supabase credentials — not validated end-to-end in Pack CI |
> | **上游 license** | MIT — [`scorpioliu0953/ai_customer_service`](https://github.com/scorpioliu0953/ai_customer_service) |
> | **Pack-authored layer** | core + entry workflows + approach-C admin UI + 雲端版 SDD spec |
> | **跟 v1.0 CLEARED 案例（einvoice）的差別** | 此案例**沒有真實 vendor sandbox runtime evidence**（LINE Messaging API + Supabase 需 caller 自有帳號），完整 Path B 三段中第三段由 caller 自行完成 |
> | **跟 #3 LINE on-prem 案例的差別** | 此為**雲端版**，安全 review 結果是 structural PASS；#3 是**地端版**，安全 review 揭露重大缺陷 → DO NOT DEPLOY AS-IS |
> | **Claims & evidence** | [v1-claims-and-evidence.md](../../docs/v1-claims-and-evidence.md) |

從 [scorpioliu0953/ai_customer_service](https://github.com/scorpioliu0953/ai_customer_service)（Netlify + React + Supabase + GPT/Gemini）的 **後端 webhook** 移植到 n8n。

> 💡 **想看同一系統的進階企業版？** 走 [`../line-ai-customer-service-onprem/`](../line-ai-customer-service-onprem/) — 同一上游、地端 Docker 演化、Ollama + Qdrant RAG、真實 5 階段 V&V。兩個範例並排可看「同一程式可走不同 Code2n8n 路徑」。完整方法論見 marquee skill [`code-to-workflow`](../../skills/tigerai/code-to-workflow/SKILL.md)。

原版是一套 LINE AI 客服：收訊息 → 去重 → 關鍵字轉真人 → 呼叫 GPT 或 Gemini → 回覆，附 React 管理儀表板。本目錄把**後端那條 runtime 路徑**完整移植成 n8n workflow；**前端**因為 n8n 不是網頁框架，改寫成計畫書（[FRONTEND-SDD.md](FRONTEND-SDD.md)，approach C：用 n8n 自己吐 UI），尚未實作。

---

## 已建：後端 runtime

| workflow | 角色 | 觸發 |
| --- | --- | --- |
| [core/core-message-router.workflow.json](core/core-message-router.workflow.json) | **大腦** — 去重 / 關鍵字轉真人 / 真人模式逾時 / GPT or Gemini / 回覆 | 被 entry 呼叫 |
| [entry-line/entry-line.workflow.json](entry-line/entry-line.workflow.json) | **入口** — webhook + 簽章驗證 + 拆 event | LINE webhook POST |

沿用上個專案的 core + entry 拆法：之後要加 WhatsApp / Telegram / 網頁 chat，只要再寫一個 entry 把訊息正規化成 `{userId, text, eventId, replyToken}` 丟進同一個 core。

## 已建：前端管理台（approach C）

計畫見 [FRONTEND-SDD.md](FRONTEND-SDD.md)；**已實作**為 4 條 admin workflow，整套含 UI 都跑在 n8n（用 Webhook + Respond to Webhook 回 `text/html` 吐單檔儀表板）：

| workflow | 路徑 | 功能 |
| --- | --- | --- |
| [admin/admin-ui.workflow.json](admin/admin-ui.workflow.json) | `GET /linecs-admin` | 吐出單檔儀表板 HTML |
| [admin/api-settings.workflow.json](admin/api-settings.workflow.json) | `GET /linecs-admin-settings`、`POST /linecs-admin-settings-save` | 讀 / 寫 settings |
| [admin/api-users.workflow.json](admin/api-users.workflow.json) | `GET /linecs-admin-users`、`POST /linecs-admin-takeover` | 用戶清單 / 接手切換 |
| [admin/api-kb.workflow.json](admin/api-kb.workflow.json) | `POST /linecs-admin-kb` | 知識庫上傳到 Supabase storage |

設定見 [docs/admin-setup.md](docs/admin-setup.md)。每個資料 API 用 n8n env `LINECS_ADMIN_TOKEN` 比對 `X-Admin-Token` header 做認證。

> HTML 由 [admin/_build_admin.mjs](admin/_build_admin.mjs) 產生（避免手工 JSON 跳脫）。要改 UI 就改該檔再 `node _build_admin.mjs` 重新產生。

---

## 目錄結構

```text
line-ai-customer-service/
├── README.md / README.en.md
├── CREDITS.md                       原始作者標示
├── SDD.md                           整體移植計畫書（後端 + 評估）
├── FRONTEND-SDD.md                  前端計畫書（approach C，待實作）
├── core/
│   └── core-message-router.workflow.json
├── entry-line/
│   └── entry-line.workflow.json
├── admin/                           前端管理台（approach C）
│   ├── _build_admin.mjs             產生器（內嵌單檔儀表板 HTML）
│   ├── admin-ui.workflow.json
│   ├── api-settings.workflow.json
│   ├── api-users.workflow.json
│   └── api-kb.workflow.json
└── docs/
    ├── install.md
    ├── supabase-setup.md
    ├── line-setup.md
    ├── admin-setup.md
    └── field-mapping.md
```

---

## 快速上手

1. **Supabase**：跑原 repo 的 `supabase_schema.sql` 建 4 張表（見 [docs/supabase-setup.md](docs/supabase-setup.md)）。在 `settings` 那一列填入 LINE / OpenAI / Gemini 金鑰與 prompt。
2. **n8n credential**：只需要一個 **Supabase API** credential（URL + Service Role Key）。LINE / OpenAI / Gemini 的金鑰都從 `settings` 表讀，不用另設 n8n credential。
3. **Import**：`core/core-message-router.workflow.json`、`entry-line/entry-line.workflow.json`。
4. **接線**：entry 的 `Call core (per event)` 節點 → `workflowId` 填 core 的 workflow ID。所有 Supabase 節點 → 指派 credential。
5. **n8n env**：自托管要設 `NODE_FUNCTION_ALLOW_BUILTIN=crypto`（或 `*`），簽章驗證的 `require('crypto')` 才能用。
6. **啟用** entry workflow → 複製 webhook Production URL → 貼到 LINE Developers Console 的 Webhook URL。
7. 詳見 [docs/install.md](docs/install.md)。

---

## 與原版的差異

| 項目 | 原版 (Netlify) | n8n 版 |
| --- | --- | --- |
| 後端 runtime | `netlify/functions/line-webhook.ts` | core + entry 兩條 workflow |
| 簽章驗證 | `@line/bot-sdk` `validateSignature` | Code 節點 `require('crypto')` HMAC-SHA256（需 raw body） |
| LINE reply / push / profile | `@line/bot-sdk` Client | HTTP Request 直打 LINE Messaging API |
| GPT | `openai` SDK + `/v1/responses` for gpt-5 | HTTP Request（依模型家族組 body） |
| Gemini | `@google/generative-ai` | HTTP Request `generateContent` |
| 去重 | Supabase insert PK 衝突 | Supabase create + error output 分支 |
| 金鑰 | 存 settings 表（DB） | **沿用** — 從 DB 讀，儀表板可改 |
| 管理 UI | React SPA (Netlify) | approach C：n8n 自托管（待建，見 FRONTEND-SDD） |
| 資料庫 | Supabase | **不動**，同一個 Supabase |

行為（去重、關鍵字、逾時、GPT/Gemini 分支）與原版一致。

---

## 致謝

原始專案：[scorpioliu0953/ai_customer_service](https://github.com/scorpioliu0953/ai_customer_service)。詳見 [CREDITS.md](CREDITS.md)。
