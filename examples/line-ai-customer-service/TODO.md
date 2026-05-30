# TODO — LINE AI 客服 n8n 範例

> 持久待辦清單。`[x]` 已做、`[ ]` 待做。日期為絕對日期。

## 已完成（v0.19.0, 2026-05-26）

- [x] 後端 runtime：`core/core-message-router` + `entry-line`（raw-body HMAC 簽章驗證）
- [x] 前端 approach C 薄管理層：`admin/admin-ui` + `api-settings` + `api-users` + `api-kb`
- [x] 文件：SDD / FRONTEND-SDD / docs（install / supabase / line / admin / field-mapping）
- [x] 靜態 lint 0/0 + 本機 n8n REST import 6/6

## ⬜ 後台（後台 / admin backend）— 尚未做完

approach C 目前只是「能改設定 + 看用戶 + 接手切換 + 傳檔」的薄 shim，**不等於原版那種完整管理後台**。缺：

- [ ] **真正的認證**：目前只有共享 `LINECS_ADMIN_TOKEN`（header 比對）。原版用 Supabase Auth + RLS 多帳號登入。→ 需求：多管理員帳號？權限分級？或維持單 token 即可？
- [ ] **對話歷史檢視**：原版 Dashboard 可看每位用戶的訊息往來。目前 n8n 版沒有存對話內容（schema 也沒這張表）。→ 要的話需新增 `messages` 表 + core 寫入 + 後台查詢頁。
- [ ] **真人即時接手介面**：原版 `AgentService.tsx` 讓專員在後台直接回覆。目前 approach C 只能切 `is_human_mode`，專員實際回覆仍走 LINE 官方帳號 App。→ 要在後台內回覆需：後台送 push API + 對話表。
- [ ] **設定頁完整度**：目前是陽春表單，缺欄位驗證、模型下拉清單、儲存成功/失敗細節提示。
- [ ] **knowledge base 管理**：目前只能上傳單檔回填 `reference_file_url`。缺：多檔列表、刪除、預覽。
- [ ] **決策**：後台要繼續走 approach C（n8n 自托管、陽春）還是改 approach B（保留原 React 儀表板、改打 n8n webhook 當 API）？approach B 的 4 條 `/admin/api/*` 已可重用，差在前端宿主。

## ⬜ 其他待做（非後台）

- [ ] **Layer 3 實跑驗證**：backend + 後台都只過 lint + import schema 檢查，**沒有真接 LINE channel + Supabase + AI key 端到端跑過**。需使用者授權的測試憑證。
  - 測試案例見 `docs/install.md`（一般問句 / 真人 / 逾時 / 去重 / 壞簽章）。
- [ ] **Error-handler workflow**：對應上游沒有但 n8n 該補 — 用 n8n Error Trigger + 通知，集中接 core/entry 的失敗。
- [ ] **多通路 entry**：目前只有 LINE。core 已設計成可被多 entry 共用；要加 WhatsApp / Telegram / 網頁 chat 各寫一個 entry，正規化成 `{userId, text, eventId, replyToken}` 丟 core。
- [ ] **Supabase upsert 行為確認**：core 用 IF(exists)→update/create 取代原生 upsert，實跑時確認無 race。

## 參考來源

上游：[scorpioliu0953/ai_customer_service](https://github.com/scorpioliu0953/ai_customer_service)。後台功能對照原版 `src/pages/Dashboard.tsx`、`AgentService.tsx`、`Login.tsx`。
