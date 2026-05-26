# 安裝與設定 / Install

## 前置需求

- 運作中的 n8n（self-hosted 或 cloud），版本 ≥ 1.50。
- Supabase 專案（沿用原 repo 的 schema）。
- LINE Messaging API channel（Channel Access Token + Channel Secret）。
- OpenAI 與/或 Google Gemini API key。
- **自托管 n8n 必須設環境變數**：`NODE_FUNCTION_ALLOW_BUILTIN=crypto`（或 `*`）。簽章驗證的 Code 節點用 `require('crypto')`，沒設會報錯。

## 步驟 1 — Supabase

見 [supabase-setup.md](supabase-setup.md)。重點：
1. 跑原 repo 的 `supabase_schema.sql` 建 4 張表 + knowledge_base bucket。
2. 在 `settings` 那一列填入所有金鑰與設定（LINE token/secret、OpenAI/Gemini key、prompt、關鍵字、agent ids）。

## 步驟 2 — n8n credential（只要一個）

**Credentials → New → Supabase API**：
- Host：你的 Supabase 專案 URL（`https://xxxx.supabase.co`）
- Service Role Secret：Supabase → Settings → API → `service_role` key

> LINE / OpenAI / Gemini 都**不需要** n8n credential — 金鑰從 `settings` 表讀，塞進 HTTP header。這跟原版一致，也讓未來儀表板能改金鑰。

## 步驟 3 — 匯入 workflow

匯入：
- `core/core-message-router.workflow.json`
- `entry-line/entry-line.workflow.json`

每個 Supabase 節點 → 指派步驟 2 的 credential。

## 步驟 4 — 接線

1. 開 `LINE-CS / Entry / LINE` → `Call core (per event)` 節點 → `workflowId` 填 `LINE-CS / Core / Message Router` 的 workflow ID。
2. 確認 entry 的 `LINE Webhook` 節點 **Raw Body 已開**（簽章驗證需要）。

## 步驟 5 — 啟用 + 接 LINE

1. 啟用 `LINE-CS / Entry / LINE`。
2. 複製 `LINE Webhook` 的 Production URL（形如 `https://你的n8n/webhook/line-webhook`）。
3. LINE Developers Console → 你的 channel → Messaging API → Webhook URL 貼上 → Verify → 開啟 Use webhook。

## 步驟 6 — 測試

| 測試 | 預期 |
| --- | --- |
| 傳一般問句 | 收到 GPT/Gemini 回覆 |
| 傳「真人」 | 收到「已轉接真人」+ agent 收到 push |
| 真人模式內再傳 | 不回 AI（靜默） |
| 等超過 `handover_timeout_minutes` 再傳 | 自動回 AI |
| 同一訊息 LINE 重送 | 去重，不重複回 |
| 壞簽章（直接 POST 亂打） | 回 401 |

## 疑難排解

| 症狀 | 解法 |
| --- | --- |
| 所有訊息都 401 / 簽章失敗 | (1) Webhook Raw Body 沒開；(2) `NODE_FUNCTION_ALLOW_BUILTIN` 沒含 crypto；(3) settings 的 channel_secret 不對 |
| `require is not defined` / crypto 錯誤 | 設 `NODE_FUNCTION_ALLOW_BUILTIN=crypto` 重啟 n8n |
| AI 不回但沒報錯 | 檢查 `is_ai_enabled=true`、`active_ai` 拼字、對應 api_key 有填 |
| 回覆失敗（reply token expired） | core 跑太久；確認 entry 是先 Respond 200 再 call core（本範例已如此） |
| 去重把正常訊息也擋掉 | 確認 processed_events 只存 event_id 且 LINE 每訊息 webhookEventId 唯一 |
| Supabase upsert 行為怪 | 本範例用 IF(exists)→update/create，非原生 upsert；確認 user_states PK 是 line_user_id |

---

## English summary

Prereqs: n8n ≥ 1.50, a Supabase project (upstream schema), a LINE Messaging channel, OpenAI/Gemini keys, and the env var `NODE_FUNCTION_ALLOW_BUILTIN=crypto` on self-hosted n8n (the signature-check Code node uses `require('crypto')`).

1. Run the upstream `supabase_schema.sql`; fill the single `settings` row with all keys/config.
2. Create one **Supabase API** credential in n8n (URL + service_role key). No LINE/OpenAI/Gemini credentials needed — keys come from the DB.
3. Import both workflows; assign the Supabase credential to every Supabase node.
4. In the entry workflow, point `Call core (per event)` at the core workflow's ID; ensure the Webhook node has **Raw Body ON**.
5. Activate the entry workflow, copy the webhook URL into LINE Developers Console.
6. Test golden path + handover + timeout + dedup + bad signature (table above).
