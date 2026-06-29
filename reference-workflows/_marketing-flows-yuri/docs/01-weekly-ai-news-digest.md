# 01 · 每週 AI 新聞摘要 (Weekly AI News Digest)

每週自動抓多個新聞來源、用 LLM 整理成一份摘要，寄到你信箱。
這是商業平台「每週新聞摘要」流程的開源重做版——也是自架版的 AI 週報機器人。

## 流程

```
Schedule Trigger (每週一 09:00)
      ├─→ RSS Google News ─┐
      └─→ RSS Yahoo News ──┤
                           Merge (append)
                           → Prepare News Text  (去重、取前 15 則、組成提示詞)
                           → Summarize with Claude  (HTTP → Anthropic Messages API)
                           → Extract Summary
                           → Send Email
```

## 需要的憑證

匯入後，點開有鑰匙圖示的節點接上**你自己的**憑證：

| 節點 | 憑證類型 | 怎麼接 |
|------|----------|--------|
| Summarize with Claude | **Header Auth** | Name 填 `x-api-key`，Value 填你的 Anthropic API Key。模板已預設好 `anthropic-version` 標頭。 |
| Send Email | **SMTP** | 填你的寄信主機（Gmail 用應用程式密碼、或 SendGrid / Mailgun SMTP）。 |

> RSS 節點不需要憑證。

## 設定步驟

1. n8n → **Import from File** → 選 `templates/01-weekly-ai-news-digest.json`。
2. **Summarize with Claude**：建立一組 Header Auth 憑證（`x-api-key` = 你的金鑰）並選用。
3. **Send Email**：建立 SMTP 憑證，把 `fromEmail` / `toEmail` 改成你的信箱。
4. （可選）**RSS Google News**：把網址裡的 `q=AI` 改成你要追的主題，例如 `q=AI%20Agent`、`q=設計`、`q=減重`。
5. （可選）**Schedule Trigger**：cron `0 9 * * 1` = 每週一 09:00，可改。例如每天 08:00 → `0 8 * * *`。
6. 右上 **Execute Workflow** 手動測一次 → 確認收到信 → 再按 **Active** 開啟排程。

## 可調整

- **換模型**：在 Summarize 節點的 Body 把 `claude-haiku-4-5-20251001` 改成 `claude-opus-4-8`（品質更高、較貴）。
- **改用 OpenAI**：URL 換成 `https://api.openai.com/v1/chat/completions`、Header Auth 改 `Authorization` = `Bearer <key>`、Body 改成 OpenAI 格式（`{model, messages}`），並把 Extract Summary 的 `data.content[0].text` 改成 `data.choices[0].message.content`。
- **多收件人**：Send Email 的 `toEmail` 用逗號分隔。
- **改發到 Discord / Telegram / Slack**：把 Send Email 換成對應節點，內容一樣吃 `{{ $json.summary }}`。
- **加更多來源**：複製一個 RSS 節點、接到 Merge（記得把 Merge 的 `numberInputs` 加大）。

## 已驗證

- ✅ JSON 結構、節點連線完整（無斷線參照）。
- ✅ 兩個 RSS 來源實測可連、皆回傳 100+ 則含標題的項目（2026-06）。
- ⏳ **尚待你在自己的 n8n 實際匯入測試一次**——node 參數的細部 schema 會隨 n8n 版本微調，第一次匯入若有節點跳紅字，把訊息貼給我即可微調。

## 注意

- 你自己的 API 金鑰、你自己的成本。Haiku 跑一次摘要成本極低（約幾分美元）。
- 抓取新聞請遵守來源網站的使用條款；本流程僅讀取公開 RSS。
