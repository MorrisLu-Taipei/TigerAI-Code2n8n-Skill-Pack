# Frontend SDD：n8n 自托管管理儀表板（approach C）

> 🌐 [English summary at bottom](#english-summary)
> 日期：2026-05-26｜狀態：**✅ 已實作**（4 條 admin workflow 在 `admin/`，由 `admin/_build_admin.mjs` 產生）。本文件保留為設計依據。
> 對應決策：使用者選定 approach C（n8n 自己吐 UI）。

---

## 0. 為什麼是這個做法

原 repo 的管理介面是一個 React SPA（Dashboard / AgentService / Login）。n8n 不是網頁框架、不能 build React 專案。但 n8n 的 **Webhook 節點 + Respond to Webhook 回 `text/html`** 可以吐出一個 **單檔 HTML+JS 迷你儀表板**；該頁面再用 `fetch` 打其他 n8n webhook 當 API 讀寫 Supabase。

成果：**整套（含管理 UI）都跑在 n8n，零外部主機**。陽春但自我完備，最適合 skill-pack 範例展示「n8n 能托管 UI」。

---

## 1. 範圍

| 原 React 功能 | 本 SDD 對應 | 優先 |
| --- | --- | --- |
| 登入 | 單一密碼 / token gate（webhook query 或 cookie） | P1 |
| 編輯 settings（模型、prompt、關鍵字、API key、超時） | 表單頁，讀/寫 settings 列 | P1 |
| 即時對話檢視 | 列出最近 user_states + 最後互動時間 | P2（非即時，刷新式） |
| 真人接手 / 放回 AI | 切某 user 的 is_human_mode | P1 |
| 知識庫上傳 PDF/text | 上傳到 Supabase storage `knowledge_base` + 回填 reference_file_url | P2 |

> 「即時對話」原版也只是輪詢 Supabase，不是真 websocket。本 SDD 用「刷新按鈕 / 每 N 秒 poll」即可達到等價體驗。

---

## 2. 架構

```
                        ┌─ Webhook GET  /admin          → 回 dashboard.html (單檔 SPA)
                        ├─ Webhook GET  /admin/api/settings   → Supabase 讀 settings
   瀏覽器 ──fetch──────▶ ├─ Webhook POST /admin/api/settings   → Supabase 更新 settings
   (n8n 托管的           ├─ Webhook GET  /admin/api/users      → Supabase 讀 user_states (近 N 筆)
    HTML 頁面)           ├─ Webhook POST /admin/api/takeover   → 切 is_human_mode
                        └─ Webhook POST /admin/api/kb-upload   → Supabase storage 上傳 + 回填 url

   (另一條既有 runtime workflow)
   LINE ───────────────▶ Webhook POST /line-webhook    → core message router
```

每個 `/admin/...` 都是一個 n8n workflow（或同一個 workflow 內多個 Webhook 節點，視 n8n 版本對多 webhook 的支援；建議拆成獨立小 workflow 較清楚）。

### 建議 workflow 拆法

| workflow | 內容 | 節點數估 |
| --- | --- | --- |
| `admin/admin-ui.workflow.json` | `GET /admin` → Respond HTML（整個 dashboard.html 內嵌在一個 Code/Set 節點的字串） | 3 |
| `admin/api-settings.workflow.json` | `GET`/`POST /admin/api/settings` → Supabase 讀/寫 | 5 |
| `admin/api-users.workflow.json` | `GET /admin/api/users` + `POST /admin/api/takeover` | 5 |
| `admin/api-kb.workflow.json` | `POST /admin/api/kb-upload` → Supabase storage | 5 |

---

## 3. 單檔 dashboard.html 設計

放在 `admin-ui` workflow 的一個節點字串裡，由 Respond to Webhook 以 `Content-Type: text/html` 回傳。

```
dashboard.html (single file)
├── <style>  — 最小 CSS（深色、響應式，可抄原 Tailwind 風格的精簡版）
├── 區塊 1：登入 gate（輸入 token → 存 sessionStorage → 之後每個 fetch 帶 header）
├── 區塊 2：Settings 表單
│     - is_ai_enabled (toggle)
│     - active_ai (gpt / gemini)
│     - gpt_*：api_key, model_name, temperature, max_tokens, reasoning_effort, verbosity
│     - gemini_*：api_key, model_name, max_tokens, thinking_level
│     - system_prompt (textarea)
│     - reference_text (textarea)
│     - handover_keywords, handover_timeout_minutes, agent_user_ids
│     - line_channel_access_token, line_channel_secret
│     [儲存] → POST /admin/api/settings
├── 區塊 3：用戶清單
│     - 表格：line_user_id / nickname / is_human_mode / last_human_interaction
│     - 每列 [接手] / [放回 AI] → POST /admin/api/takeover
│     - [刷新] 按鈕 / 每 10 秒 poll GET /admin/api/users
└── 區塊 4：知識庫上傳
      - <input type=file> → POST /admin/api/kb-upload (multipart)
      - 顯示目前 reference_file_url
```

純 vanilla JS（無框架、無 build），約 300–400 行。

---

## 4. 認證

原版用 Supabase Auth + RLS。n8n 自托管 UI 沒有現成 auth，方案：

| 方案 | 說明 | 建議 |
| --- | --- | --- |
| 共享 token | 環境變數存一個 admin token；每個 `/admin/api/*` webhook 檢查 header `X-Admin-Token` | ✅ 簡單夠用 |
| n8n Basic Auth | 在 webhook 前掛 n8n 的 Header Auth credential | 次選 |
| 不設防 | 只在內網跑 | ❌ 不建議，settings 含 API key |

> 因為 settings 含 LINE / OpenAI / Gemini 金鑰，**一定要設 token**。token 比對失敗回 401。

---

## 5. 與後端共用

- 同一個 Supabase credential（已在後端 workflow 用）。
- 同樣 4 張表，不需新 schema。
- knowledge_base bucket 已存在（後端 reference_file_url 指向它）。

---

## 6. 已知限制（誠實說明）

| 限制 | 影響 | 緩解 |
| --- | --- | --- |
| 非即時 | 對話檢視靠 poll，非 websocket | 10 秒 poll，體驗接近 |
| 無 build / 無框架 | UI 比原 React 陽春 | 夠管理用；要漂亮就走 approach A/B |
| 金鑰存 DB + 走 n8n webhook | token 外洩風險 | 強制 admin token + HTTPS + 內網限制 |
| n8n webhook 回大 HTML | 單節點字串很長 | 可接受；或用 binary/靜態檔節點 |
| 多 webhook 路徑 | 每條 path 一個 workflow，較多檔 | 拆 4 個小 workflow，清楚 |
| 檔案上傳 | n8n webhook 收 multipart 後轉 Supabase storage | 用 Webhook binary + HTTP/ Supabase storage API |

---

## 7. 建置計畫（核可後）

| 階段 | 產出 |
| --- | --- |
| F1 | `admin/admin-ui.workflow.json` + `dashboard.html`（先唯讀顯示 settings/users） |
| F2 | `admin/api-settings.workflow.json`（讀寫 settings）+ 前端表單接上 |
| F3 | `admin/api-users.workflow.json`（用戶清單 + 接手/放回） |
| F4 | `admin/api-kb.workflow.json`（知識庫上傳） |
| F5 | admin token 認證 + 文件 |

預估比後端略小（UI 邏輯集中在一個 HTML 字串 + 4 條薄 API workflow）。

---

## 8. 替代路線（若日後不滿意 approach C）

- **approach A**：保留原 React app（Supabase 直連），n8n 只做 runtime。零前端工。
- **approach B**：原 React app 改打 n8n webhook 當 API。最完整但工作量最大。

approach C 的 4 條 `/admin/api/*` workflow 對 approach B 是可重用的（B 只是把前端從 n8n 托管換成 Netlify 托管）。所以先做 C 不會白做。

---

## English summary

This is the **frontend plan only** (not yet built). The user chose **approach C**: serve the admin dashboard *from n8n itself* using a Webhook node that returns a single-file HTML+JS SPA via Respond to Webhook, with a handful of `/admin/api/*` webhooks acting as the CRUD API over the same Supabase tables. Result: the entire system (including the management UI) runs inside n8n with no external host — spartan but self-contained, ideal for demonstrating n8n's reach in a skill-pack example.

Scope: login gate (shared admin token — mandatory because settings hold API keys), settings editor, user list with human-takeover toggle, and knowledge-base file upload. Conversation view is poll-based (the original was too — it polled Supabase, not websockets).

Build is split into 4 thin workflows (`admin-ui`, `api-settings`, `api-users`, `api-kb`). These same API workflows are reusable if the user later switches to approach B (React front-end hosted externally calling n8n as the API), so building C first is not throwaway work.
