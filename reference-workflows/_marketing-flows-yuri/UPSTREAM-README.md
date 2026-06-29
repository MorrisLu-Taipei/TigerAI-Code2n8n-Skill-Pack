# n8n 行銷自動化模板包 · Open Marketing Flows

> 一鍵匯入的 n8n 開源行銷自動化模板：社群發文、輿情監測、新聞彙整、廣告管理、AI 生圖生影。
> Free & open-source n8n workflow templates for marketing automation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## 這是什麼

一組 **可直接匯入 [n8n](https://n8n.io) 的工作流模板**，把常見的行銷自動化情境做成「下載 JSON → 匯入 → 接上自己的金鑰 → 開跑」。

每支模板都附中文說明、節點流程、需要哪些憑證。不用從零接 API、不用會寫程式。

> 本專案所有工作流皆為**獨立實作、文案原創**，靈感來自常見的行銷自動化情境概念，未使用任何第三方的程式碼、品牌或素材；與任何商業平台無隸屬或合作關係。

## 為什麼做這個

商業行銷自動化平台把這些流程鎖在付費牆後面。但這些「點子」是通用的——發文、爬輿情、整理新聞、自動關掉爛廣告——任何人都該能免費自架。這個 repo 把它們攤在陽光下。

## 怎麼用

1. 自架或註冊一個 n8n（[Docker 一行啟動](https://docs.n8n.io/hosting/installation/docker/) 或 n8n Cloud）。
2. 下載 `templates/` 裡你要的 `.json`。
3. n8n 介面右上 **⋯ → Import from File**，選那支 JSON。
4. 點開有「鑰匙」圖示的節點，接上**你自己的** API 憑證（OpenAI / Anthropic、SMTP、Google、Meta…）。
5. 改掉範例參數（收件信箱、關鍵字、排程時間），存檔、Activate。

> ⚠️ **金鑰是你自己的。** 模板裡不含任何金鑰，請接自己的。使用各平台 API 時請遵守其服務條款與速率限制。

## 模板清單

| # | 模板 | 串接 | 狀態 |
|---|------|------|------|
| 01 | [每週 AI 新聞摘要](./docs/01-weekly-ai-news-digest.md) | RSS · LLM · 推播 | ✅ 已驗證 |
| 02 | 產出貼文 Hashtag（分平台 IG/Threads/FB） | LLM | ✅ 已驗證 |
| 03 | 檢查社群貼文敏感字 | LLM | ✅ 已驗證 |
| 04 | PTT 輿情監測 | HTTP 爬蟲 · LLM · 推播 | ✅ 已驗證 |
| 05 | 主題→多平台貼文草稿 | LLM | ✅ 已驗證 |
| 90 | 爆款社群貼文（反主流公式，[致謝 Hao](./CREDITS.md)） | LLM | ✅ 已驗證 |
| 91 | [Webhook 橋接 — agent/程式可呼叫](./docs/91-webhook-bridge.md) | Webhook · LLM | ✅ 已驗證 |

> **兩種版本**：`*.json` 為通用版（預設 Claude + Email）；`*.local-ollama.json` 為**免 key 本機版**（呼叫本機 [Ollama](https://ollama.com)、隨用工具直接看輸出、監測類推 Discord webhook）。想用哪種就匯入哪個檔。換 LLM / 換推播管道的作法見 [docs/01](./docs/01-weekly-ai-news-digest.md)。

完整 80 個流程的開源可做性對照見 [ROADMAP.md](./ROADMAP.md)。

### 架構範本（skeleton，未接 key）

需要平台 API 授權的流程（發布社群、看數據、管廣告…）做成「**待設定範本**」：架構搭好、credential 留空，填入你自己的 key 就能用。每支都附說明便利貼，且**生成/分析（Ollama）的部分免費就能跑**，只有碰平台的節點要金鑰。

| 原型 | 需要的授權 |
|------|-----------|
| AI 生成貼文 → 發布社群 (Meta) | Meta Graph API（FB/IG/Threads 同架構） |
| 社群成效分析 → 報告 | Meta Graph API（read_insights） |
| FB 廣告依表現自動暫停 | Meta Marketing API（ads_management） |
| 留言監測 → AI 回覆建議 | 各平台留言 API |
| 資料匯出 Google Sheets | Google Sheets / OAuth |
| YouTube 影片數據 → AI 分析 | YouTube Data API Key |
| AI 產文 → 發布 WordPress | WordPress REST API（應用程式密碼） |

> ⚠️ 這些標 `*.skeleton.json` 的範本經「匯入 + 節點圖正確」驗證，但**未經實機跑出 API 結果**（作者無對應平台金鑰）。填入你的憑證後請自行測試。

### 完整檔案庫

`templates/` 共 **81 支**，涵蓋常見行銷自動化情境中**可開源實作的部分**（約 10 種依賴顧客數據平台／CDP，無法用開源複製，見 [ROADMAP](./ROADMAP.md)）。命名規則：

- **`*.local-ollama.json`（19 支）** — 免費本機可跑：Ollama + RSS/公開爬蟲 + Discord/n8n 輸出，**匯入即用**
- **`*.skeleton.json`（59 支）** — 待接 key 的架構範本，涵蓋第二層全部子類（發布社群、成效分析、廣告、留言、Sheets、YouTube、WordPress、生圖等），每支附說明便利貼
- **`*.json`** — 通用版（預設 Claude + Email）

> 提示：免費本機那批是「下載 → 匯入 → 直接跑」；架構範本是「下載 → 匯入 → 填你的 key → 跑」。

## 預設用 Claude

需要 LLM 的模板預設呼叫 **Anthropic Claude**（`claude-haiku-4-5` 兼顧成本與品質，可自行改成 `claude-opus-4-8`）。也可以換成 OpenAI 或任何相容端點——詳見各模板說明。

## 授權

[MIT](./LICENSE)。隨意用、改、商用，附上著作權聲明即可。部分模板的方法論致謝見 [CREDITS.md](./CREDITS.md)。

## 貢獻

歡迎 PR 新模板或修正。請附：① 模板 JSON ② 一份 `docs/` 說明 ③ 確認可在乾淨的 n8n 匯入。
