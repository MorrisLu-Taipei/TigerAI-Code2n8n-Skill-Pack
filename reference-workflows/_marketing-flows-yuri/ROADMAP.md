# Roadmap：80 個流程 → 開源可做性對照

把常見的行銷自動化流程攤平成開源模板的清單。靈感來源為公開的商業模板庫，全部獨立重做。

**圖例**
- ✅ 可做：用 n8n + 使用者自備的 API 憑證即可實現
- 🔑 需特殊權限：平台 API 需申請開通（Meta App Review、Google Business Profile…），技術上可做
- ⚠️ 需自備 CDP / 站內整合：依賴顧客數據平台或網站埋點，開源版無對等功能，標註或略過
- 🚩 首發批次（v0.1 先做這 5 個）

---

## A. 內容生成 & 發布
- ✅ 把長文改寫成 FB 貼文並排程發布
- ✅ 把新聞整理成長文，發布到 WordPress + 社群
- ✅ 把 Word 文章上稿到 WordPress
- ✅ 產出貼文可用的 Hashtag（結合 Google Trends） 🚩 **#02**
- ✅ 每日更新活動倒數貼文、加強促購
- 🔑 上傳圖文貼文並排程發布到 FB / IG / Threads（需 Meta API）
- 🔑 文字生成圖片＋貼文，直接發到 IG / FB / Threads（需 Meta API）
- 🔑 產出可直接發布的 FB / IG / Threads 貼文（草稿可純 LLM；發布需 Meta API）
- 🔑 同一篇貼文同步發到多個 FB 粉專（需 Meta API）

## B. 社群/影片成效分析
- ✅ 分析 AI 流量來源並產趨勢圖（改抓 GA4 / GSC）
- 🔑 分析 IG / Threads / FB 貼文互動表現（需 Meta API）
- 🔑 Threads 本週 vs 上週數據報告 🚩 **#05**（先用公開頁/HTTP 版起步）
- 🔑 FB 本月 vs 上月貼文表現比較（需 Meta API）
- 🔑 匯出 FB / IG / Threads 貼文數據到 Google Sheets（需 Meta API）
- 🔑 查詢 YouTube 影片數據（需 YouTube Data API）
- 🔑 查詢 YouTube 留言數據（需 YouTube Data API）

## C. 留言 & 互動管理
- ✅ 檢查社群貼文敏感/違規字並回報 🚩 **#03**
- 🔑 監測 IG / Threads / 多平台留言 → 語意判斷 + 報告（需各平台 API）
- 🔑 整理 FB 留言、Threads 留言 → 回覆建議（需各平台 API）
- ✅ 海巡 Threads 話題 → 產回覆草稿（公開搜尋 + LLM）
- 🔑 回覆 YouTube 留言（需 YouTube Data API）
- 🔑 回覆 Google 商家評論（需 Google Business Profile API）
- 🔑 Google 商家最新評論即時通知（需 Google Business Profile API）

## D. Facebook 廣告管理（皆需 Meta Marketing API）
- 🔑 依廣告表現自動建立新受眾廣告組合
- 🔑 依廣告表現自動重啟廣告組合
- 🔑 暫停表現不佳的廣告素材 / 廣告組合（依 CTR、ROAS、CPC 門檻）
- 🔑 找出表現最好的廣告素材
- 🔑 調整廣告預算
- 🔑 查詢 / 彙整廣告成效並寄報告
- 🔑 多帳戶成效匯出 Google Sheets
- 🔑 自動上傳素材到指定廣告組合

## E. 輿情監測 & 社群爬蟲
- ✅ 監測 PTT / Dcard / Mobile01 / 多論壇 → 輿情報告 🚩 **#04**
- ✅ 監測論壇上的品牌口碑輿情
- ✅ 爬 Amazon 商品留言 → 情緒分析 / 匯出報表（2 支）
- ✅ 用「關鍵字 + 圖片辨識」篩相關貼文（公開搜尋 + 視覺 LLM）
- 🔑 找出 IG 最近相關 / 熱門貼文話題（需 IG API 或公開搜尋）
- 🔑 搜尋 Threads 最新相關貼文（公開搜尋 / HTTP）
- 🔑 整理 Threads 話題 → 社群觀察報告

## F. 新聞彙整 & 內容靈感
- ✅ 每週 AI 新聞摘要（多來源 → 彙整 → 寄信/發布） 🚩 **#01 已完成 v0.1**
- ✅ 整理 Google / Yahoo / 國際 / 多來源新聞重點寄信箱
- ✅ 把 Google 新聞整理成一篇新文章

## G. SEO / 關鍵字
- ✅ 檢查文章 SEO 分數 + 改寫建議
- 🔑 優化官網關鍵字並產 SEO 建議（需 GSC API）
- 🔑 找出 Google 熱搜 vs GSC 高曝光低點擊關鍵字落差（需 GSC API）

## H. CDP / 顧客經營 / EDM
- ✅ 寄新用戶第 2 天關懷 EDM（改用名單來源 + SMTP）
- ✅ 指定 / 智慧名單發 EDM
- ⚠️ 依天氣自動推薦商品（推播站內需 CDP）
- ⚠️ 向不同用戶動態推薦商品（需 CDP）
- ⚠️ 站內單圖 / 多圖彈跳訊息（需網站埋點 / CDP）
- ⚠️ 整理全通路 Lead 趨勢圖（需 CDP 匯整來源）
- ⚠️ RFM 找高價值顧客並產經營建議（需訂單數據源；有 CSV 則 ✅）
- ⚠️ 訂單數據分析報告（需電商數據源；有 CSV 則 ✅）

## I. AI 圖片 / 影片生成
- ✅ 用文字指令生成圖片素材（OpenAI / 其他生圖 API）
- ✅ 改圖上的日期 / 折扣 / 倒數天數（影像編輯 API）
- ✅ 商品圖 × 模特兒合成（影像 API）
- ✅ 批次生成 AI 圖存回 Google Drive
- ✅ 文字生 8 秒影片 / 靜態圖轉動態影片（需影片生成 API，如 Veo）

---

## 批次規劃

- **v0.1（首發 5）**：#01 新聞摘要 ✅ · #02 Hashtag · #03 敏感字 · #04 論壇輿情 · #05 Threads 週報
  → 共同點：主要是 RSS/HTTP 爬取 + LLM + Email，**摩擦最低、可自己 dogfood、好做 demo**。
- **v0.2（Meta OAuth 批）**：多平台發文、社群成效分析、留言管理。
- **v0.3（廣告批）**：D 類全部（需 Meta Marketing API）。
- **不在範圍 / 需自備**：H 類 CDP 依賴項，於 README 標註。
