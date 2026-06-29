# `_marketing-flows-yuri` — 行銷自動化模板（第三方參考，MIT）

> ⚠️ **出處備註（使用前必讀）**：此資料夾**不是本 Pack 原創**，是外部 MIT 專案的副本，納入作為
> `tigerai-example-finder` 的**行銷情境參考語料**。任何時候引用、改寫、或對外展示其中內容，
> 都要標明來源（見下方授權）。

## 來源

- **專案**：n8n 行銷自動化模板包 · Open Marketing Flows
- **作者**：Yuri (@yuri.learns)
- **Repo**：https://github.com/YuriCrystal/n8n-marketing-flows
- **授權**：MIT License, Copyright (c) 2026 Yuri (@yuri.learns) — 全文見 [`LICENSE.upstream`](./LICENSE.upstream)
- **匯入時間**：2026-06-29
- **方法論二次致謝**：`templates/90-viral-social-post.*` 的爆款框架源自 駱君昊 (Hao) 的
  MIT skill（https://github.com/Hao0321/claude-skill-social-post），詳見 [`CREDITS.md`](./CREDITS.md)。

## 內容

- `templates/` — 81 支 n8n workflow JSON
- `docs/` — 2 份模板說明
- `UPSTREAM-README.md` / `ROADMAP.md` / `CREDITS.md` — 原 repo 文件（原文保留）

### 三種版本（命名規則）

| 後綴 | 數量 | 說明 |
|------|------|------|
| `*.local-ollama.json` | 19 | 免 key 本機版：Ollama (`host.docker.internal:11434`) + RSS/公開爬蟲 + Discord/n8n 輸出，匯入即用 |
| `*.skeleton.json` | 59 | 架構範本：節點搭好、credential 留空，填自己的 key 才能跑 |
| `*.json`（通用版） | 3+ | 預設接 Anthropic Claude (`claude-haiku-4-5`) + Email |

## 品質定位（重要）

- `local-ollama` 那批：作者已驗證「匯入即用」。
- `skeleton` 那 59 支：作者**僅驗證「可匯入 + 節點圖正確」，未實機跑出 API 結果**（作者無對應平台金鑰）。
  → 只能當**架構參考**，不可當「可上線品」直接交付客戶。

## 跟本 Pack 的關係 / 值得學的點

對照 [skills/tigerai/](../../skills/tigerai/) 的企業治理取向，這套是「輕量、行銷情境」取向，互補不重疊。值得吸收：

1. **Raw HTTP 直呼 LLM（不依賴 langchain node）** → 可攜、一鍵換 provider，符合「不綁本機、Docker 帶得走」。
2. **三層打包**（免 key 本機版 / skeleton / 通用版）降低上手摩擦。
3. **ROADMAP 開源可做性分級**（✅ / 🔑 需平台授權 / ⚠️ 需 CDP），適合選型說明。
4. **反主流爆款貼文 prompt 方法論**（純內容方法論）。

> 治理註記：這些是參考語料，**不套用本 Pack 的 Atomic Orchestration / SDD / 安全治理約束**。
> 若要把任一支變成可上線品，請走 `sticky-note-to-workflow` + `n8n-security-governance` 重做。
