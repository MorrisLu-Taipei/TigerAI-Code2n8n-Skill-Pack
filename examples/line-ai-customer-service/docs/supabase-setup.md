# Supabase 設定 / Supabase setup

n8n 版**不改 Supabase schema**，沿用原 repo 的 `supabase_schema.sql`。

## 步驟

1. Supabase → SQL Editor → 貼上原 repo 的 [`supabase_schema.sql`](https://github.com/scorpioliu0953/ai_customer_service/blob/main/supabase_schema.sql) → Run。會建立：
   - `settings`（22 欄，自動插入一列預設）
   - `processed_events`（event_id PK）
   - `user_states`（line_user_id PK）
   - `knowledge_base` storage bucket（公開讀）
2. Supabase → Settings → API → 抄下：
   - **Project URL**
   - **service_role** secret key（給 n8n 用，繞過 RLS，跟原 webhook 一樣）

## 填 settings 那一列

schema 會自動插入一列預設值。用 Supabase Table Editor 開 `settings`，把這些填好：

| 欄位 | 填什麼 |
| --- | --- |
| `line_channel_access_token` | LINE channel access token |
| `line_channel_secret` | LINE channel secret |
| `active_ai` | `gpt` 或 `gemini` |
| `gpt_api_key` | OpenAI key（用 GPT 時） |
| `gpt_model_name` | 例 `gpt-4.1-mini` / `gpt-5` / `o3-mini` |
| `gemini_api_key` | Gemini key（用 Gemini 時） |
| `gemini_model_name` | 例 `gemini-2.0-flash` |
| `system_prompt` | 客服人設與規則 |
| `reference_text` | 知識庫純文字（選填） |
| `reference_file_url` | knowledge_base bucket 裡的檔案公開 URL（選填） |
| `handover_keywords` | 例 `真人,客服,人工` |
| `handover_timeout_minutes` | 例 `30` |
| `agent_user_ids` | 專員的 LINE userId，逗號分隔 |
| `is_ai_enabled` | `true` |

## RLS 注意

schema 對 `settings` / `user_states` 開了 RLS，只允許 authenticated。n8n 用 **service_role** key 連線，繞過 RLS（與原 webhook 行為相同），所以 n8n 讀寫不受影響。**service_role key 千萬不要外洩、不要進前端。**

## 知識庫上傳

- 後端 runtime 只「讀」 `reference_file_url`。
- 「上傳」介面屬於前端（見 [FRONTEND-SDD.md](../FRONTEND-SDD.md) 的 kb-upload）；在那實作前，先手動把檔案丟進 knowledge_base bucket，複製公開 URL 貼到 `settings.reference_file_url`。

---

## English

The n8n port does **not** change the Supabase schema — run the upstream `supabase_schema.sql` as-is (creates `settings`, `processed_events`, `user_states`, and the `knowledge_base` storage bucket). Grab the Project URL and the **service_role** key for the single n8n Supabase credential (it bypasses RLS, same as the original webhook). Fill the auto-inserted `settings` row with your LINE / OpenAI / Gemini keys and config (table above). The backend only reads `reference_file_url`; uploading is a frontend concern (see FRONTEND-SDD) — until then, upload to the bucket manually and paste the public URL into `settings.reference_file_url`.
