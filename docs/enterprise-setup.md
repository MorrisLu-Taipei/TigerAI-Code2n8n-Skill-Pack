# Enterprise Setup — SSO / IAM / HA / DR

> 🌐 中英對照（中文先，英文摘要在底）
> 📖 與 [`CODE2N8N.md`](../CODE2N8N.md) 配對：宣言講「為什麼企業需要 Code2n8n」，本檔講「Code2n8n workflow 怎麼跟 n8n self-hosted 企業治理組件對接」。

---

## 責任邊界：Pack vs n8n vs 你的 IT

很多讀者看 hero 圖第三塊「n8n Enterprise Orchestration」會以為「裝了 Skill Pack 就有 SSO」。**不會**。下表把責任分清楚。

| 圖示元素 | 誰負責提供 | Pack 是否附 setup 指引 |
| --- | --- | --- |
| Workflow 結構 / 治理 SOP / 安全審查方法論 | ✅ **Pack**（這個 repo） | ✅ 是 — 看 `skills/tigerai/n8n-security-governance/` |
| Workflow CI/CD gate / 版本控制紀律 | ✅ **Pack** | ✅ 同上 |
| Audit log / Observability 標準 | ✅ **Pack** 訂規範 | ✅ 同上 |
| Retry / Approval / Handover 模式 | ✅ **Pack** 訂模式 | ✅ 看 `skills/tigerai/tigerai-enterprise-patterns/` Pillar 4.2 |
| ERP / CRM / DB / SaaS 連接器 | ✅ **n8n 內建節點** | ❌ Pack 不重做節點 |
| SSO（SAML / OIDC / LDAP） | ✅ **n8n self-hosted enterprise** | ⚠️ 本檔僅指路 |
| IAM / RBAC（使用者 / 角色 / 工作流權限） | ✅ **n8n self-hosted enterprise** | ⚠️ 本檔僅指路 |
| HA / Resilience（多 instance + queue mode + Redis + Postgres） | ✅ **n8n 部署層** | ⚠️ 本檔僅指路 |
| Backup / DR（資料庫備份、binlog、跨區災備） | ✅ **你的 IT** | ⚠️ 本檔列檢查清單 |

下面三章是「本檔僅指路」的部分。**Pack 不重做 n8n 已經做完的事**；它的工作是讓你產出的 workflow **跑在這套企業基礎建設上時不會破洞**。

---

## 1. SSO / IAM

### n8n self-hosted enterprise 提供什麼

n8n self-hosted **enterprise edition** 內建：

- **SAML 2.0**（對接 Okta / Azure AD / Auth0 / Google Workspace SAML / OneLogin）
- **OIDC / OAuth2**（對接 Keycloak / Auth0 / Azure AD / Google）
- **LDAP**（對接內部 AD / OpenLDAP）
- **RBAC**：Workflow / Credential / Variable / Project 四種資源的 owner / editor / viewer
- **Project**：團隊命名空間，credential 與 workflow 限定範圍

設定路徑見官方文件：<https://docs.n8n.io/user-management/>

### Pack 的 workflow 該怎麼配合

Code2n8n 產出的 workflow 必須符合下列「IAM-friendly」原則，否則企業上線時權限會打結：

| 原則 | 做法 |
| --- | --- |
| **不寫死 user identity** | 不要在 Layer 1 sticky 寫 `"approver: alice@corp"`。應改 `"approver: 由 settings.approver_email 提供"` |
| **每個 webhook 標 owner project** | 從 Workflow Settings 把 workflow 設給特定 project，credential 也綁該 project |
| **credential 走 reference 而非 inline** | 所有 API key / DB password 必過 n8n Credentials store；不寫死進 Code node |
| **記錄「執行者身分」** | 排程 / webhook 觸發的 workflow 在 audit log 寫 `execution_mode + trigger_user_id`（webhook 帶 cookie 時可解 JWT，內部 trigger 則記 service-account） |
| **拒絕 manualTrigger 上正式環境** | 正式環境 workflow 只用 webhook / schedule / Execute Workflow Trigger；manualTrigger 留給開發 |

### Code2n8n 整合

Step 1.5 security audit 已內含「Authentication」與「Authorization」兩個檢查欄。把上述原則跑一遍才能 PASS：

- Authentication：webhook 是否驗 JWT / 簽章？workflow 是否標 owner？
- Authorization：每個外部呼叫的 credential 是否最小授權？

---

## 2. HA / Resilience（高可用）

### n8n 內建什麼

n8n 自己提供「queue mode」可開到多 worker 容器，搭配外部 Redis + Postgres：

- **Main instance**：UI / API / webhook receive
- **Worker instance(s)**：實際跑 workflow execution（可以 N 個）
- **Queue（Redis）**：execution 排程
- **資料庫（Postgres）**：workflow / credential / execution data 儲存

設定路徑：<https://docs.n8n.io/hosting/scaling/queue-mode/>

### Pack 的 workflow 該怎麼配合

| 原則 | 做法 |
| --- | --- |
| **Code node 不依賴本機檔案** | 不要 `fs.writeFileSync('/tmp/x')` 然後下個節點讀同一個檔 — multi-worker 模式下下個節點可能在別的容器 |
| **長任務用 Wait 節點而非 sleep** | `Wait` 節點會把 execution 還回 queue 給其他 worker；`while(sleep)` 會卡住 worker |
| **檔案處理走 Universal Worker pattern** | 重邏輯放 FastAPI worker（見 `tigerai-enterprise-patterns` Pillar 2），n8n 只編排 |
| **External call 必設 timeout** | HTTP 30s / Worker 300s / DB query 10s；無 timeout 會把 worker 卡到死 |
| **idempotency key** | 任何「寫入外部系統」的節點必帶 idempotency key（請求 ID / 訂單號），避免 retry 時重複 |

### 部署層檢查清單

跟你的 IT 確認：

- [ ] Postgres 主從 + binlog；每日邏輯備份 + 至少 4 小時 PITR
- [ ] Redis 持久化（AOF）+ replica + sentinel/cluster
- [ ] n8n main + worker 容器跨 AZ 部署
- [ ] webhook ingress 前面有 ALB / nginx + sticky session（webhook 等回應的流程要黏同一 main）
- [ ] credential encryption key（`N8N_ENCRYPTION_KEY`）有備份 + 跨環境輪替 SOP
- [ ] worker 不開外網 — 透過內網叫 main 的 API

---

## 3. Backup / DR / 災備

### 必備備份目標

n8n 的「state」分散在四個地方，全要備：

| 目標 | 怎麼備 | 頻率 |
| --- | --- | --- |
| Postgres（workflows / credentials / executions） | `pg_dump` + WAL archiving | 至少每日 + 連續 WAL |
| `N8N_ENCRYPTION_KEY` | 密管系統 / HSM；**不能跟 DB 同處** | 一次性 + 輪替紀錄 |
| Workflow JSON exports（離線版本控制） | git 化 — workflow 設計過程的 source of truth | 每次合併 |
| n8n 設定 / 環境變數 / volume mounts | IaC（Terraform / Helm）git 化 | 隨變更 |

### 災備演練（DR drill）

每季至少一次：

1. 在 staging 環境用昨日的 Postgres dump + Encryption Key 還原一份 n8n
2. 隨機抽 3 個 workflow 驗證 import + 試跑 + 對 audit log
3. 拿一個 production credential 走輪替演練（旋轉後仍能跑）
4. 把演練紀錄存到 `runbook/dr-drills/YYYY-Q?.md`

### Pack 的責任

Code2n8n 產出的 workflow 在 `SECURITY-REVIEW.md` 內必含「Rollback / Recovery」段（這是 `n8n-security-governance` 必產出 #5）。但**還原整個 n8n instance 不是 Pack 的事** — Pack 假設你的 IT 已經把這四件事做了。

---

## 4. 跟 Code2n8n 工作流接 SSO/HA/DR 的順序

1. 先把 n8n self-hosted enterprise 起好（main + worker + queue + DB）— 你的 IT
2. SSO / RBAC / Project 切好 — 你的 IT
3. **再裝 Skill Pack**（`bash install.sh` 或 `/install-n8n-pack`）
4. 跑 Code2n8n 移植（marquee skill）
5. Step 1.5 security review 把上面三章的對應原則套進去：IAM-friendly workflow、queue-safe 設計、有 rollback 證據
6. CI/CD gate 通過後才上 production
7. 季度做 DR drill

如果 1-2 還沒做就直接 4，**你的 workflow 可以動但會在「上正式環境」那關卡關**。

---

## 5. 為什麼 hero 圖把這些放進 Block 3

因為從讀者角度看，「n8n Orchestration」這塊**整套企業環境**才是部署目標 — Pack 是橋，n8n 是企業治理層。圖示這樣畫忠實反映了使用者看到的世界。

但這份文件存在的理由是：**讀者不該誤以為裝了 Pack 就拿到 SSO**。本檔明確切割 Pack 的責任邊界 + 指路 n8n 官方文件 + 補上「Code2n8n 工作流怎麼跟這層相處」的工程準則。

---

## English summary

The hero diagram's third panel ("n8n Enterprise Orchestration") includes SSO, IAM, HA, CI/CD, Log Audit, etc. **The Pack does not implement SSO / HA / IAM — n8n self-hosted enterprise does.** What the Pack delivers is the discipline so that the workflows you produce *land cleanly* on top of those n8n features.

| Claim in the hero | Owner | Pack contribution |
| --- | --- | --- |
| Workflow structure, security audit method, version control discipline, CI/CD gate, observability standard, retry/approval/handover patterns | **Pack** | Full SOPs in `n8n-security-governance` + `tigerai-enterprise-patterns` |
| ERP/CRM/DB/SaaS connectors | n8n built-in nodes | not duplicated |
| SSO (SAML/OIDC/LDAP), IAM/RBAC, projects | n8n self-hosted enterprise edition | this doc links to official setup; the Pack adds IAM-friendly workflow design rules |
| HA / queue mode, multi-worker scaling | n8n deployment layer | this doc lists workflow rules so they survive multi-worker (no local-file passing, idempotency keys, Wait instead of sleep, proper timeouts) |
| Backup / DR / encryption key custody | Your IT | this doc gives a checklist; the Pack's `SECURITY-REVIEW.md` template requires a Rollback section |

**Order of adoption**: self-hosted enterprise n8n + SSO/RBAC/Projects first → then install the Pack → then run the Code2n8n migration → then Step 1.5 security review enforces IAM-friendly, queue-safe, traceable design → CI gate → production. Skipping the first two steps means your workflows run but fail enterprise sign-off.
