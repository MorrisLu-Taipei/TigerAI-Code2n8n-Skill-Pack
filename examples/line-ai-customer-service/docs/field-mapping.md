# 函式對照表 / Function mapping

> 把 `netlify/functions/line-webhook.ts` 與 `supabase_schema.sql` 逐項對到 n8n 節點。
> 來源 commit：[scorpioliu0953/ai_customer_service@main](https://github.com/scorpioliu0953/ai_customer_service)。

## line-webhook.ts → n8n 節點

| line-webhook.ts | 行 | n8n 節點 |
| --- | --- | --- |
| `httpMethod !== 'POST'` 擋掉 | L13 | Webhook 節點限定 POST |
| `supabase.from('settings').select('*').single()` | L15 | entry `Read settings`（Supabase getAll limit 1） |
| `validateSignature(body, secret, sig)` | L23-26 | entry `Verify signature + parse`（Code, HMAC-SHA256 raw body） |
| `JSON.parse(body).events` + filter message/text | L28-36 | entry `Verify signature + parse` 內 + `Fan out events` |
| `insert processed_events` 去重 | L40-47 | core `Dedup (insert processed_events)` + error output → `Duplicate → skip` |
| `select user_states` | L50 | core `Read user_states` |
| `handover_keywords` 解析 + 比對 | L53-62 | core `Detect keyword + state`（Code，單字 equals / 多字 includes） |
| `getProfile` 拿暱稱 | L67 | core `Get LINE profile`（HTTP GET /v2/bot/profile） |
| `upsert user_states (is_human_mode=true)` | L69-74 | core `user_states exists?` → `Update`/`Create user_states (human)` |
| `replyMessage('已轉接...')` | L76 | core `Reply 已轉接真人`（HTTP reply） |
| `agent_user_ids` 拆 + `pushMessage` 迴圈 | L78-83 | core `Fan out agents` + `Push to agents`（HTTP push） |
| 真人模式 + 逾時判斷 | L88-93 | core `Human-mode + timeout`（Code）+ `Proceed to AI?` / `Needs revert?` |
| `update is_human_mode=false`（逾時） | L92 | core `Revert is_human_mode=false` |
| `is_ai_enabled` gate | L96 | core `Human-mode + timeout` 內設 action='silent' |
| `callGPT` | L114-149 | core `Build GPT request` + `Call OpenAI` + `Extract GPT text` |
| ‣ gpt-5 → `/v1/responses` | L122-137 | `Build GPT request` 內依 `model.includes('gpt-5')` 切 url/body |
| ‣ o1/o3 → `max_completion_tokens` | L142-143 | 同上分支 |
| ‣ 其他 → `temperature`+`max_tokens` | L144-147 | 同上分支 |
| ‣ `reference_file_url` fetch text | L117-119 | core `Load reference (text)`（HTTP, neverError） |
| `callGemini` | L152-174 | core `Build Gemini request` + `Call Gemini` + `Extract Gemini text` |
| ‣ `reference_file_url` → base64 inline_data | L154-162 | core `Load reference (binary)`（HTTP, responseFormat file） |
| `replyMessage(aiResult)` | L107 | core `Reply AI text`（HTTP reply） |

## supabase_schema.sql → n8n 用法

| 表 | 行 | n8n |
| --- | --- | --- |
| `settings`（22 欄） | L2-28 | entry 開頭讀一次，整列傳進 core 的 `settings` |
| `processed_events`（event_id PK） | L31-34 | core 去重 insert；PK 衝突＝重複 |
| `user_states`（line_user_id PK, nickname, is_human_mode, last_human_interaction, last_ai_reset_at） | L37-43 | core 讀 + update/create |
| `storage: knowledge_base` bucket | L57-59 | reference_file_url 指向此；前端 SDD 的 kb-upload 寫入此 |

## 設定欄位（settings 表）對照

| 欄位 | 預設 | n8n 哪裡用 |
| --- | --- | --- |
| `is_ai_enabled` | true | core 是否回 AI 的 gate |
| `active_ai` | gpt | core `GPT or Gemini?` switch |
| `gpt_api_key` | — | `Call OpenAI` Authorization header |
| `gpt_model_name` | gpt-4.1-mini | `Build GPT request` 決定端點 |
| `gpt_temperature` | 0.7 | chat completions body |
| `gpt_max_tokens` | 2000 | chat completions body |
| `gpt_reasoning_effort` | none | gpt-5 Responses body |
| `gpt_verbosity` | medium | gpt-5 Responses body |
| `gemini_api_key` | — | Gemini url query key |
| `gemini_model_name` | gemini-pro | Gemini url path |
| `gemini_max_tokens` | 2000 | Gemini generationConfig |
| `system_prompt` | 你是一個專業的客服助手。 | GPT/Gemini system 內容 |
| `reference_text` | '' | GPT/Gemini 參考文字 |
| `reference_file_url` | '' | core `Load reference` 抓取 |
| `line_channel_access_token` | — | 所有 LINE HTTP header |
| `line_channel_secret` | — | entry 簽章驗證 |
| `handover_keywords` | 真人,客服,人工 | core 關鍵字偵測 |
| `handover_timeout_minutes` | 30 | core 逾時判斷 |
| `agent_user_ids` | '' | core push 通知對象 |
