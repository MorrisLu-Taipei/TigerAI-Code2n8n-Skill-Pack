# 91 · Webhook 橋接 — 讓 agent / 任何程式呼叫 n8n

把一條 n8n 流程變成「**一個 HTTP 接口**」:任何程式(包含 [Claude Agent Farm](https://github.com/silver2dream/claude-agent-farm) 的 agent)用 `curl` 打它,就能觸發 n8n 生成內容並**把結果拿回去**。這就是「agent ↔ n8n」最實用的橋。

## 流程

```
Webhook (POST) → Build Prompt → Generate with Ollama → Extract → Respond to Agent
```

- **Webhook (POST)**：給你一個網址,收到 POST 就開跑
- **Build Prompt**：從 body 取 `topic`,組成爆款貼文 prompt
- **Generate with Ollama**：本機生成(可換 Claude)
- **Respond to Agent**：把生成結果當 HTTP 回應傳回呼叫方

## 啟用

1. 匯入 `templates/91-webhook-viral-post-api.local-ollama.json`
2. 右上 **Publish**（webhook 一定要啟用才會收請求）
3. 你的網址是：`http://localhost:5678/webhook/viral-post`

## 怎麼呼叫

```bash
curl -X POST http://localhost:5678/webhook/viral-post \
  -H "Content-Type: application/json" \
  -d '{"topic":"接案設計師用 Figma 外掛把改稿時間砍半"}'
```

回應就是生成好的 FB / IG / Threads 貼文(純文字)。

## Claude Agent Farm 怎麼用它

在 agent 的任務裡叫它跑這個 `curl` 就好 —— 例如:

> 「幫我把今天這個主題做成三平台貼文草稿,完成後存到 notes。」
> agent 內部 → `curl ... -d '{"topic":"..."}'` → 拿到回應 → 接著處理。

= **agent 負責判斷/串接,n8n 負責那段固定的生成流程。** 兩個系統各做擅長的事。

## 注意

- **本機 Ollama (qwen2.5)** 偶爾會加廢話開場、漏簡體字 → 要乾淨就把 `Generate with Ollama` 節點換成 Anthropic Claude(見 [docs/01](./01-weekly-ai-news-digest.md) 的換法）。
- Webhook 預設**沒有驗證**。只在本機/內網用沒問題;若要對外開,請在 Webhook 節點加上 Header Auth 之類的驗證,別讓任何人都能打。
- 要回傳 JSON 而非純文字:把 `Respond to Agent` 的 `respondWith` 改成 `json`。
