# SDD / 移植計畫書：LINE AI 客服系統（n8n 版）

> 🌐 [English summary at bottom](#english-summary)
> 日期：2026-05-26｜評估者：tiger.ai.tw@gmail.com + Claude (Opus 4.7)
> 來源：[scorpioliu0953/ai_customer_service](https://github.com/scorpioliu0953/ai_customer_service) @ `main`
> 狀態：**✅ 後端已建（core + entry）；前端 approach C 已建（admin/ 4 條）。** 決策 §10 拍板：儀表板 = approach C、金鑰存 DB、逾時 inline、先只做 LINE。

---

## 0. 摘要與結論

| 問題 | 結論 |
| --- | --- |
| 這是什麼 | LINE AI 客服系統：webhook 收訊息 → 去重 → 關鍵字轉真人 / 呼叫 GPT 或 Gemini → 回覆。附 React 管理儀表板。 |
| 後端能否移植 n8n | **能，而且非常適合** — 這就是 webhook→DB→AI→訊息的編排工作，n8n 本命。 |
| 前端儀表板能否移植 | **不能** — n8n 不是網頁框架。React app 保留並存，或放棄 GUI。 |
| 資料庫 | **不動** — Supabase 4 張表原封不動，n8n 用 Supabase 節點讀寫同一個專案。 |
| 整體評估 | 大腦（webhook，175 行）100% 可移植；臉（dashboard）0% 可移植。約「半套」。 |
| 工作量 | 約等於上次 Google Workspace 那套：3 條 workflow + 文件。 |

**為什麼值得搬**：視覺化 AI 路由、容易加多通路（WhatsApp / Telegram / 網頁 chat）、跟其他 TigerAI flow 整合、脫離 Netlify。
**搬不來的部分**：管理 GUI。保留原 React app（它只讀寫 Supabase，與 n8n 並存無衝突）。

---

## 1. 來源分析

### 1.1 檔案盤點（全 repo 22 檔）

| 檔 | 角色 | 移植 |
| --- | --- | --- |
| `netlify/functions/line-webhook.ts` (175 行) | **後端大腦** | ✅ 移植成 n8n |
| `supabase_schema.sql` | DB schema（settings / user_states / processed_events / storage） | ⏸️ 保留，n8n 直接用 |
| `src/pages/Dashboard.tsx` (14KB) | 設定編輯 GUI | ❌ 不可移植 |
| `src/pages/AgentService.tsx` | 真人接手 GUI | ❌ 不可移植 |
| `src/pages/Login.tsx` | 登入 | ❌ 不可移植 |
| `src/components/Layout.tsx`、`src/lib/supabase.ts`、`src/App.tsx`、`src/main.tsx` | React 骨架 | ❌ 不可移植 |
| `index.html`、`vite.config.ts`、`tailwind.config.js`、`netlify.toml`、`tsconfig*` | 前端建置設定 | ❌ 不適用 |

**結論**：唯一要移植的程式是 `line-webhook.ts`。其他不是前端就是設定檔。

### 1.2 後端流程（line-webhook.ts 完整邏輯）

```
POST /line-webhook
  ↓
讀 settings（單列，含所有 AI/LINE 設定）           [Supabase]
  ↓
驗證 x-line-signature（HMAC-SHA256, channelSecret） [crypto]
  ↓ 簽章錯 → 401
for each event (type=message & text):
  ↓
  ┌─ 去重：insert processed_events(event_id)         [Supabase]
  │   └ insert 失敗（重複）→ skip 這個 event
  ↓
  讀 user_states[userId]                            [Supabase]
  ↓
  關鍵字偵測（handover_keywords 逗號分隔）
  │  - 單字關鍵字：完全相等才中
  │  - 多字關鍵字：includes 即中
  ├─ 命中 → getProfile 拿暱稱                        [LINE API]
  │         upsert user_states(is_human_mode=true)   [Supabase]
  │         reply「已轉接真人」                       [LINE API]
  │         push 通知每個 agent_user_ids             [LINE API]
  │         skip 後續
  ↓ 沒命中
  真人模式判斷：
  │  - is_human_mode 且 未逾時 → skip（不回 AI）
  │  - is_human_mode 且 逾時   → 設回 false，繼續
  ↓
  is_ai_enabled=false → skip
  ↓
  active_ai == 'gpt' ? callGPT : callGemini
  │  callGPT:
  │    - 讀 reference_file_url 內容（fetch text）
  │    - 組 system prompt + 參考文字 + 檔案內容
  │    - gpt-5* → POST /v1/responses（reasoning/verbosity）
  │    - o1/o3* → chat.completions（max_completion_tokens）
  │    - 其他   → chat.completions（temperature + max_tokens）
  │  callGemini:
  │    - 讀 reference_file_url → base64 inline_data
  │    - POST generativelanguage…:generateContent
  ↓
  reply AI 回覆                                      [LINE API]
```

---

## 2. 提議的 n8n 架構

沿用上次「core + entry」拆法，並多一條排程清掃 workflow：

```
                        ┌────────────────────────────────────┐
  LINE webhook ───────▶ │ LINE-CS / Entry / LINE             │
                        │  - Webhook (raw body)              │
                        │  - 讀 settings                      │
                        │  - 驗簽章 (Code: HMAC-SHA256)       │
                        │  - 拆 events → 逐筆呼叫 core         │
                        │  - 200 OK                          │
                        └──────────────┬─────────────────────┘
                                       │ (每個 text event)
                        ┌──────────────▼─────────────────────┐
                        │ LINE-CS / Core / Message Router    │
                        │  - 去重 (Supabase insert)           │
                        │  - 讀 user_states                   │
                        │  - 關鍵字偵測 → 轉真人分支           │
                        │  - 真人模式 / 逾時判斷               │
                        │  - GPT / Gemini 分支                 │
                        │  - reply / push (LINE HTTP)         │
                        └────────────────────────────────────┘

                        ┌────────────────────────────────────┐
  Schedule (每 N 分) ──▶ │ LINE-CS / Cron / Human-mode Sweeper│
                        │  - 掃 user_states is_human_mode=true│
                        │  - 逾時的設回 false                 │
                        └────────────────────────────────────┘
```

> 為什麼把 router 拆成 sub-workflow：之後要加 WhatsApp / Telegram / 網頁 chat，只要再寫一個 entry，把訊息正規化成 `{userId, text, replyToken, channel}` 丟進同一個 core 即可。多通路客服正是這套拆法的價值。

> 逾時回 AI 為何另開排程：原版是「下次該用戶再傳訊息時」才檢查逾時。n8n 也可以照做（inline），但獨立排程掃描更乾淨、也能在用戶沒再傳訊息時就把狀態歸位。兩種都列在計畫，預設 inline + 可選排程。

---

## 3. 節點對照（line-webhook.ts → n8n）

| line-webhook.ts | n8n 節點 | 備註 |
| --- | --- | --- |
| `event.httpMethod !== 'POST'` | Webhook 節點（限定 POST） | — |
| `supabase.from('settings').select('*').single()` | Supabase 節點 `getAll` limit 1 | 讀單列設定 |
| `validateSignature(body, secret, sig)` | **Code 節點**（crypto HMAC-SHA256 → base64 比對 `x-line-signature`） | ⚠️ 需 raw body，見 §6 |
| `JSON.parse(body).events` | Code 節點 / Item Lists 拆陣列 | 一個 webhook 可能帶多個 event |
| `insert processed_events` 去重 | Supabase `create` + `continueOnFail` | insert 失敗＝重複→走 skip 分支 |
| `select user_states` | Supabase `getAll` filter line_user_id | — |
| 關鍵字偵測 | Code 節點（單字 equals / 多字 includes） | 完整重現原邏輯 |
| `lineClient.getProfile(userId)` | HTTP Request `GET /v2/bot/profile/{userId}` | 無原生 LINE 節點 |
| `upsert user_states` | Supabase `upsert`（或 update+insert 二擇一） | ⚠️ 見 §6 upsert 注意 |
| `lineClient.replyMessage` | HTTP Request `POST /v2/bot/message/reply` | — |
| `lineClient.pushMessage` (agents) | HTTP Request `POST /v2/bot/message/push`（loop agent_user_ids） | — |
| 真人模式 + 逾時 | IF 節點 + Code（時間差比對） | — |
| `is_ai_enabled` / `active_ai` 分支 | IF / Switch 節點 | — |
| `callGPT` 一般模型 | **OpenAI 原生節點**（chat completions） | temperature / max_tokens |
| `callGPT` gpt-5（/v1/responses） | HTTP Request `POST /v1/responses` | ⚠️ 原生節點不支援 Responses API 的 reasoning/verbosity |
| `callGPT` o1/o3（max_completion_tokens） | OpenAI 節點或 HTTP | 參數名不同 |
| `reference_file_url` 取內容 | HTTP Request（download） → Extract from File | GPT 走 text、Gemini 走 base64 |
| `callGemini` generateContent | HTTP Request `POST …:generateContent` | 無原生 Gemini 節點 |
| reply AI 回覆 | HTTP Request `POST /v2/bot/message/reply` | — |
| `last_ai_reset_at`（schema 有，webhook 沒用） | （保留欄位，sweeper 可寫） | — |

---

## 4. 資料層

**完全不動 Supabase**。n8n 用 Supabase 節點（`n8n-nodes-base.supabase`）連同一個專案、同樣 4 張表：

| 表 | 欄位 | n8n 怎麼用 |
| --- | --- | --- |
| `settings`（22 欄） | is_ai_enabled, active_ai, gpt_*, gemini_*, system_prompt, reference_text/file_url, line_channel_*, handover_keywords/timeout, agent_user_ids | core 開頭讀一次 |
| `processed_events` | event_id (PK), created_at | 去重 insert |
| `user_states` | line_user_id (PK), nickname, is_human_mode, last_human_interaction, last_ai_reset_at | 讀 + upsert |
| `storage: knowledge_base` bucket | 知識庫檔案（PDF/text） | reference_file_url 指向這 |

> n8n 用 `SUPABASE_SERVICE_ROLE_KEY`（繞過 RLS）跟原 webhook 一樣。

---

## 5. 儀表板問題（重要）

原 React 儀表板做三件事，n8n **都不能**取代：

| 儀表板功能 | n8n 能做嗎 | 替代方案 |
| --- | --- | --- |
| 編輯 settings（模型、prompt、關鍵字、API key） | ❌ | 保留 React app；或 n8n Form（陽春、單向）；或直接改 Supabase |
| 即時對話檢視 | ❌ | 保留 React app；n8n 無即時 UI |
| 真人接手介面 | ❌ | 保留 React app |
| 知識庫上傳 PDF/text | ⚠️ 勉強（n8n Form + Supabase storage） | 保留 React app 較好 |

**建議**：保留原 React 儀表板（它只是 Supabase 的 CRUD 前端，與 n8n 後端並存毫無衝突）。n8n 只接管「LINE 進來後的自動回覆」這條 runtime 路徑。等於：

```
管理員 → React 儀表板 → Supabase ← n8n workflow ← LINE 用戶
        (改設定)                  (跑客服邏輯)
```

---

## 6. 已知雷點（動手前必讀）

| # | 雷點 | 說明 | 對策 |
| --- | --- | --- | --- |
| 1 | **LINE 簽章要 raw body** | n8n Webhook 預設 parse JSON，算 HMAC 要原始 bytes | Webhook 節點開「Raw Body」；Code 節點用 `$binary` 或 raw 字串算 HMAC-SHA256 base64 |
| 2 | **無原生 LINE 節點** | reply / push / getProfile 全手打 | HTTP Request + `Authorization: Bearer {channel_access_token}` |
| 3 | **無原生 Gemini 節點** | generateContent 自己組 | HTTP Request |
| 4 | **GPT-5 Responses API** | 原生 OpenAI 節點不支援 `/v1/responses` 的 reasoning/verbosity | gpt-5* 走 HTTP Request；其餘走原生節點 |
| 5 | **去重 race** | 原版靠 PK 衝突 insert 失敗 | Supabase create + `continueOnFail`，靠 error 判定重複 |
| 6 | **Supabase upsert** | n8n Supabase 節點 upsert 行為要確認 | 測 upsert；不行就 IF(存在?)→update / create |
| 7 | **reply token 時效** | LINE replyToken 約 1 分鐘失效 | core 要快；AI 太慢就改用 push 不用 reply |
| 8 | **一個 webhook 多 event** | LINE 可能一次帶多個 event | entry 拆陣列逐筆丟 core（或 core 內 loop） |
| 9 | **逾時回 AI** | 原版 lazy 檢查 | 預設沿用 inline；可選加排程 sweeper |

---

## 7. 所需 credential / 環境變數

| 項目 | 哪裡拿 | 用在 |
| --- | --- | --- |
| Supabase URL + Service Role Key | Supabase 專案 Settings → API | Supabase 節點（n8n credential: Supabase API） |
| LINE Channel Access Token | LINE Developers Console | 存 settings 表（n8n 從 DB 讀，不另設 credential）或設成 n8n credential |
| LINE Channel Secret | 同上 | 簽章驗證 |
| OpenAI API Key | platform.openai.com | settings.gpt_api_key（DB 讀）或 n8n OpenAI credential |
| Gemini API Key | aistudio.google.com | settings.gemini_api_key（DB 讀） |

> 設計抉擇：原版把所有 key 存在 settings 表，讓儀表板能改。n8n 可沿用（從 DB 讀 key 塞進 HTTP header），保留「改設定不用碰 n8n」的彈性；或改用 n8n credential（較安全但改 key 要進 n8n）。**建議沿用 DB 存 key**，維持與儀表板一致。

---

## 8. 測試 / 驗證計畫（沿用 3 層漏斗）

| Layer | 做什麼 | 工具 |
| --- | --- | --- |
| 1 靜態 lint | JSON 結構、Code 節點 JS 語法、表達式、連線、孤節點 | `_audit.mjs`（沿用上個專案的，加 supabase/openai node type） |
| 2 n8n REST import | POST 到本機 n8n `/workflows` 驗 schema 後清掉 | `_n8n_import_test.mjs` |
| 3 實際執行 | 真接 LINE sandbox + Supabase 測試專案 + 真 AI key 跑一輪 | 需使用者授權 |

Layer 3 測試案例建議：
1. 一般問句 → GPT 正常回覆
2. 一般問句 → 切 Gemini 正常回覆
3. 打「真人」→ 轉真人 + agent 收到 push + 用戶收到「已轉接」
4. 真人模式內再傳 → 不回 AI（靜默）
5. 逾時後再傳 → 自動回 AI
6. 同一 event 重送（模擬 LINE retry）→ 去重，不重複回覆
7. 壞簽章 → 401

---

## 9. 建置計畫（核可後執行）

| 階段 | 產出 | 估點 |
| --- | --- | --- |
| A | 目錄骨架 + README + CREDITS + 此 SDD | 小 |
| B | `core/core-message-router.workflow.json`（主邏輯，~28 節點） | 大 |
| C | `entry-line/entry-line.workflow.json`（webhook + 簽章 + 拆 event） | 中 |
| D | `cron/human-mode-sweeper.workflow.json`（排程歸位逾時） | 小 |
| E | `docs/`：install、supabase-setup、line-setup、credentials、field-mapping | 中 |
| F | `_audit.mjs` + `_n8n_import_test.mjs` 驗證 + 本機 n8n 匯入（帶 `[Claude YYYY-MM-DD]` 前綴 + tag） | 中 |

預估與上次 Google Workspace 移植相當。

---

## 10. 待你拍板的決策

1. **儀表板**：保留原 React app（建議）／改最小 n8n Form／放棄 GUI？
2. **API key 放哪**：沿用 DB settings（建議，與儀表板一致）／改 n8n credential？
3. **逾時回 AI**：inline lazy（建議，貼近原版）／另開排程 sweeper／兩者都做？
4. **多通路**：只先做 LINE（建議先聚焦）／一開始就鋪 WhatsApp/Telegram entry？
5. **輸出位置**：`examples/line-ai-customer-service/`（本 SDD 已放這）。

---

## English summary

**Source**: [scorpioliu0953/ai_customer_service](https://github.com/scorpioliu0953/ai_customer_service) — a LINE AI customer-service system: React admin dashboard + Netlify serverless webhook + Supabase + OpenAI/Gemini.

**Portability verdict**: The **backend webhook** (`line-webhook.ts`, 175 lines) is an *excellent* fit for n8n — it's exactly the webhook→DB→AI→messaging orchestration n8n is built for, and arguably better than serverless here because adding more channels (WhatsApp/Telegram/web) becomes trivial with a core+entry split. The **React dashboard** is *not* portable — n8n is not a web framework; keep the React app as-is (it's just a Supabase CRUD front-end and coexists fine). The **Supabase DB** stays untouched; n8n talks to the same 4 tables via the Supabase node.

**Proposed architecture**: `Core / Message Router` (sub-workflow with all the logic) + `Entry / LINE` (webhook, raw-body signature verification, event fan-out) + optional `Cron / Human-mode Sweeper` (scheduled timeout revert).

**Key gotchas**: LINE signature needs raw request body (Webhook "Raw Body" + Code HMAC-SHA256); no native LINE node (HTTP Request for reply/push/getProfile); no native Gemini node; GPT-5 Responses API needs HTTP Request; dedup relies on PK-conflict insert; reply-token ~1min TTL.

**This document is a plan only — no workflows built yet. Awaiting go-ahead** on the 5 open decisions in §10.
