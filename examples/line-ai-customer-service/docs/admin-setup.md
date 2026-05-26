# 管理台設定 / Admin UI setup (approach C)

整套管理介面跑在 n8n，無外部主機。實作於 `admin/` 的 4 條 workflow。參考來源：[scorpioliu0953/ai_customer_service](https://github.com/scorpioliu0953/ai_customer_service) 的 React 儀表板，改寫為 approach C。

## 步驟

1. **設 n8n 環境變數**：
   - `LINECS_ADMIN_TOKEN` — 管理台登入 token（每個資料 API 用它比對 `X-Admin-Token` header）。
   - `SUPABASE_URL` — 你的 Supabase 專案 URL（**knowledge base 上傳用**）。
   - `SUPABASE_SERVICE_ROLE_KEY` — service role key（**knowledge base 上傳用**）。
2. **匯入** `admin/` 下 4 個 workflow。
3. 把每個 Supabase 節點指派到你的 **Supabase API** credential（跟後端同一個）。
4. **啟用** 4 個 workflow。
5. 開 `admin-ui` 的 `GET /linecs-admin` webhook Production URL：
   ```
   https://<你的 n8n>/webhook/linecs-admin
   ```
   瀏覽器打開就是管理台。輸入 `LINECS_ADMIN_TOKEN` 登入。

## 端點一覽

| Method | Path | workflow | 認證 |
| --- | --- | --- | --- |
| GET | `/linecs-admin` | admin-ui | 無（只是空殼頁面） |
| GET | `/linecs-admin-settings` | api-settings | X-Admin-Token |
| POST | `/linecs-admin-settings-save` | api-settings | X-Admin-Token |
| GET | `/linecs-admin-users` | api-users | X-Admin-Token |
| POST | `/linecs-admin-takeover` | api-users | X-Admin-Token |
| POST | `/linecs-admin-kb` | api-kb | X-Admin-Token |

> 儀表板 HTML 用相對路徑推算這些 sibling 端點（`location.pathname.replace(/linecs-admin$/, 'linecs-admin-...')`），所以 test / production webhook 前綴會自動帶上。

## 認證模型

- 頁面本身（`/linecs-admin`）不設防 — 它只是空殼，沒有資料。
- 所有**資料** API 檢查 header `X-Admin-Token` 是否等於 n8n env `LINECS_ADMIN_TOKEN`，不符回 401。
- 因為 settings 含 LINE / OpenAI / Gemini 金鑰，**務必設一個夠強的 token，並只在 HTTPS / 內網使用**。

## 改 UI

儀表板是單檔 HTML+JS，內嵌在 `admin-ui.workflow.json` 的 `Build dashboard.html` Code 節點。**不要手改 JSON**（跳脫很痛）；改 [`admin/_build_admin.mjs`](../admin/_build_admin.mjs) 裡的 `DASHBOARD` 模板，再跑：

```bash
cd admin && node _build_admin.mjs
```

會重新產生 4 個 workflow JSON。

## 限制（見 FRONTEND-SDD §6）

- 對話檢視非即時，靠刷新 / poll。
- UI 比原 React 陽春（無框架、無 build）。
- kb 上傳用 env 金鑰走 Supabase Storage REST，不是 Supabase 節點。

---

## English

The entire admin UI runs in n8n (approach C) via 4 workflows in `admin/`. Set n8n env vars `LINECS_ADMIN_TOKEN` (login token, checked against the `X-Admin-Token` header by every data API), plus `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (for knowledge-base upload). Import the 4 workflows, assign the Supabase credential to the Supabase nodes, activate, and open `https://<n8n>/webhook/linecs-admin`. The page is an unguarded shell; all data APIs require the token. Edit the dashboard by changing the `DASHBOARD` template in `admin/_build_admin.mjs` and re-running `node _build_admin.mjs` — never hand-edit the workflow JSON.
