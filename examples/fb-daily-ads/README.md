# FB Daily Ads — Code2n8n 案例（4 workflow 治理鏈）

> 🌐 **English summary at bottom**

把 FB 每日廣告投放管理拆成 4 個 workflow 的 Code2n8n 範例。實證 Pack 的 4 個方法論決策：**Partition、Workflow Design、Validation、Security**。

## 為什麼拆 4 個 workflow，不是 1 個

| Workflow | 角色 | 觸發 | 對應 Pack 模板 |
| --- | --- | --- | --- |
| [`fb-daily-pull`](fb-daily-pull.workflow.json) | 排程拉指標 | Schedule 09:00 | — |
| [`fb-daily-decide`](fb-daily-decide.workflow.json) | 套規則 → 建議清單 | Sub-WF call | — |
| [`fb-daily-approve`](fb-daily-approve.workflow.json) | Slack 核可關卡 | Sub-WF call | [`human-approval-gate`](../templates/human-approval-gate.workflow.json) |
| [`fb-daily-apply`](fb-daily-apply.workflow.json) | 推 FB API + 寫稽核 | Sub-WF call | [`retry-with-backoff`](../templates/retry-with-backoff.workflow.json) + [`handover-trace`](../templates/handover-trace.workflow.json) |

拆 4 個的理由：**一個 workflow 一個責任**。每個獨立可測、可 rollback。Apply 是唯一會打 FB 寫端點的 workflow，意外 blast radius 被框死。

## Partition 決策

```
留在 FB 平台：       實際投遞、競價、Conversion 歸因
n8n 編排：           排程 + API 編排 + 規則套用 + 核可關卡 + 通知 + 稽核
留在 Google Sheet：  預算規則、Yesterday Performance、Audit 三個 tab
留在程式（未來）：    若加 ML 評分 / 創意生成 → 外掛 FastAPI worker
```

**n8n 不負責**：FB 自己會做的 bid optimization、創意生成。Pack 強調的是「拉指標 → 套規則 → 要核可 → 推變更 → 寫紀錄」這條治理鏈。

## 上線前你要改的 placeholder（共 5 個）

打開每個 workflow 的 sticky note，搜尋 `__REPLACE_ME__` 就會看到：

| Token | 出現在 | 應該填什麼 |
| --- | --- | --- |
| `__REPLACE_ME__AD_ACCOUNT_ID__` | pull | `act_<numeric>` |
| `__REPLACE_ME__FB_GRAPH_VERSION__` | pull, apply | `v20.0`（看你的 FB API 版本） |
| `__REPLACE_ME__GOOGLE_SHEET_ID__` | pull, decide, apply | Google Sheet 的 `documentId` |
| `__REPLACE_ME__SLACK_CHANNEL__` | approve, apply | Slack channel id 或 `#name` |
| `__REPLACE_ME__FB_*_WF_ID__` | pull, decide, approve | 對應 sub-workflow 的 id（import 完才會知道，三個都要回填） |

Credentials 用 n8n Credential UI 設定，**不要**寫進 workflow JSON：
- `httpHeaderAuth` → `Authorization: Bearer <fb_system_user_token>` → 給 pull / apply 的 HTTP 節點
- Google Sheets OAuth → 給三個 Sheet 節點
- Slack OAuth → 給 approve / apply 的 Slack 節點

## Google Sheet 結構

| Tab | 欄位 |
| --- | --- |
| `Yesterday Performance` | `correlationId, date, campaignId, campaignName, spend, conversions, revenue, cpa, roas, ctr, cpm` |
| `Rules` | `campaignId, target_cpa, target_roas, pause_threshold, scale_threshold, scale_increment` |
| `Audit` | `correlationId, campaignId, campaignName, action, status, before, after, appliedAt` |

`Rules` 留給非工程師改。規則改了不用動 n8n。

## Validation SOP（上線前必做）

1. **靜態 lint**：四份 JSON 通過 [`scripts/security-scan.mjs`](../../scripts/security-scan.mjs)。
2. **REST round-trip**：`node scripts/live-roundtrip.mjs --glob "examples/fb-daily-ads/*.workflow.json"` import → GET → DELETE 全綠。
3. **Sandbox dry-run**：FB API 開發者帳戶或測試 ad account 跑一輪；**不要直接上正式帳戶**。
4. **Approval 流程**：故意造一筆會被建議 `pause` 的資料，跑完整 Slack 核可流。
5. **Rollback drill**：故意核可一筆錯的變更，用 `Audit` tab 的 before 欄反向還原。

## Security 要點（套 `n8n-security-governance` Skill）

| 風險 | 處理 |
| --- | --- |
| FB token 外洩 | 用 n8n Credential 儲存；System User Token > User Token；不寫進 workflow JSON |
| Slack callback 沒驗簽 | 上線版前面要加 inbound Webhook + HMAC SHA-256 (`X-Slack-Signature`) 驗證；目前模板的 Wait node 接 raw callback 只適合 dev |
| 預算修改沒留底 | `Audit` tab 自動寫 before/after |
| API 連環失敗淹沒 | `retry-with-backoff` 3 次後送 dead-letter status `failed-dlq` |

---

## English

A 4-workflow Code2n8n case study for FB daily ad management. One responsibility per workflow:
- `fb-daily-pull` — Schedule, fetch yesterday's Insights, write to Sheet.
- `fb-daily-decide` — Apply rules from Sheet, emit recommendations.
- `fb-daily-approve` — Slack approve/reject gate. Built on `examples/templates/human-approval-gate.workflow.json`.
- `fb-daily-apply` — The only workflow that writes to FB API. Wraps each call with `retry-with-backoff` and the `handover-trace` correlation-id pattern. Writes before/after rows to the Audit tab.

Replace the five `__REPLACE_ME__*` tokens, wire your three n8n credentials (FB / Google Sheets / Slack), then run the validation SOP: scanner → live round-trip → sandbox dry-run → approval flow → rollback drill. Audit tab keeps the receipts.
