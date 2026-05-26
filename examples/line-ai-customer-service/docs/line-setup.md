# LINE 設定 / LINE Messaging API setup

## 步驟

1. [LINE Developers Console](https://developers.line.biz/console/) → 建一個 **Provider** → 建一個 **Messaging API channel**。
2. 在 channel 的 **Basic settings** 抄下 **Channel secret** → 填到 Supabase `settings.line_channel_secret`。
3. 在 **Messaging API** 分頁 → **Channel access token (long-lived)** → Issue → 抄下 → 填到 `settings.line_channel_access_token`。
4. **Messaging API** 分頁 → **Webhook URL** → 貼上 n8n entry 的 Production URL：
   ```
   https://<你的 n8n 網域>/webhook/line-webhook
   ```
   → **Verify**（n8n entry 要先啟用）→ 開 **Use webhook**。
5. 關掉 **Auto-reply messages** 與 **Greeting messages**（不然會跟你的 AI 回覆打架）。
6. （選）把專員自己的 LINE userId 填進 `settings.agent_user_ids`（逗號分隔）。要拿自己的 userId 可暫時在 core 印出 `event.userId`，或用 LINE 的 webhook 測試。

## Webhook 行為注意

- LINE 對非 2xx 回應會**重試**。本範例 entry 驗簽後**先回 200**再非同步處理，core 又有 `processed_events` 去重，所以重試安全、不會重複回覆。
- **reply token 約 1 分鐘失效**。entry 先回 200、core 盡快 reply，正常 AI 延遲（數秒）不會超時。若你的模型很慢，考慮改用 push（需要 userId，已有）取代 reply。

## 簽章驗證需求

- entry 的 `LINE Webhook` 節點 **Raw Body 必須開**（LINE 簽章是對原始 bytes 算 HMAC-SHA256）。
- 自托管 n8n 要設 `NODE_FUNCTION_ALLOW_BUILTIN=crypto`（或 `*`）。

## 測試小抄

用 LINE 官方帳號加好友後直接傳訊息測。對照 [install.md](install.md) 的測試表（一般問句 / 真人 / 逾時 / 去重 / 壞簽章）。

---

## English

Create a Messaging API channel in the LINE Developers Console. Copy the **Channel secret** → `settings.line_channel_secret`; issue a long-lived **Channel access token** → `settings.line_channel_access_token`. Set the **Webhook URL** to `https://<n8n>/webhook/line-webhook` (entry must be active), Verify, enable Use webhook, and **disable auto-reply + greeting** messages. Optionally put agents' LINE userIds in `settings.agent_user_ids`.

Notes: LINE retries on non-2xx — the entry responds 200 first then processes async, and the core dedups via `processed_events`, so retries are safe. Reply tokens expire in ~1 min, so the entry responds 200 fast and the core replies ASAP. The Webhook node needs **Raw Body ON** and self-hosted n8n needs `NODE_FUNCTION_ALLOW_BUILTIN=crypto` for signature verification.
