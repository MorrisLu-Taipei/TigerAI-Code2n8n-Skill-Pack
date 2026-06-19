# 外部依賴安全 — A2A directive（AI 消費者請先讀此檔）

> 🌐 **語言**：[English](external-dependency-security-a2a.md)（canonical）· **中文**
>
> 🌐 若你（AI 消費者）主要操作語言不在上述列表，請使用英文版作為 source of truth；其他語言為 release 內 sync 的便利副本。

> 🤖 **對象**：本文件針對**AI agent**（Claude Code / Codex / Antigravity / Gemini / 任何 LLM）即將執行涉及外部依賴的 Code2n8n 流程。人類審查者請改讀 [`socket-dev-integration.md`](socket-dev-integration.md) + [`external-dependency-security` SKILL](../skills/tigerai/external-dependency-security/SKILL.md)。
>
> Skill 是 SOP 敘述；本檔是 **machine-actionable directive**：明確觸發、明確工具呼叫、明確 output schema、禁用詞、自動 enforcement 點。

---

## 何時觸發此 directive

只要以下任一為真，你**必須**套用本 directive：

- 即將跑 `npm install` / `pnpm add` / `yarn add`，或修改任何 `package.json` 的 `dependencies` / `devDependencies` 區段
- 即將升任何套件版本（任何 `package-lock.json` 重產）
- 即將寫 `Dockerfile` 的 `FROM` 行，或改 `docker-compose*.yml` 的 `image:`
- 即將 `curl` / `WebFetch` / `wget` 一個 `raw.githubusercontent.com` URL **並把內容寫進 code / SKILL / commit**（純對話讀取免）
- 即將 `cp` / 寫入 / 匯入一個來自本 repo 之外的 `.workflow.json` 進 `examples/<case>/workflows/`
- 使用者指令隱含「外部依賴已驗過」（例：「推上」「上架」「ship」「deploy」「merge」「import this」）

任一觸發 → directive **active**，不可繞。沒有「我試試看」模式。

---

## 四道 gate（v0.39.0 起 CI 自動 enforce）

每道 gate 含：觸發 / 工具呼叫 / 通過條件 / CI 自動 check 名稱。

### Gate A — 新增 / 修改 npm dep → 必須有 SEC-DEP entry

**觸發**：`package.json` `dependencies` / `devDependencies` 區段變動。

**工具呼叫**：

```bash
# commit 前，在 <case>/SECURITY-REVIEW.md 加上或更新 SEC-DEP entry。
# entry id 格式：SEC-DEP-<sanitized-package-name>-<version>
# 其中 <sanitized-package-name> = 套件名去 '@' + '/' 換 '-'
# 範例：@paid-tw/einvoice → paid-tw-einvoice
# 完整 id：SEC-DEP-paid-tw-einvoice-0.3.0

# entry 必須含：
# | Trust level     | high / low
# | L1 npm audit    | PASS / FAIL 細節
# | L2 socket.dev   | PASS / FAIL 細節
# | L3 code review  | PASS@<commit-sha> / N/A (low-trust)
# | Approved for    | <範圍>
# | Re-review trigger | major version / author change / repo URL change
```

**通過條件**：每個新增 / 變動的 dep 在 repo 某處 `SECURITY-REVIEW.md` 內有對應的 `SEC-DEP-<sanitized>-<version>` 區塊。

**自動 CI check**：`ext-dep-skill-enforcement` → Gate 1 step。PR 缺 SEC-DEP entry 即 fail。

**禁止**：默默升版本不加 SEC-DEP；用 `--force` / `--legacy-peer-deps` 繞 audit。

### Gate B — case-study deps 必 exact pin（無 caret / tilde / range）

**觸發**：`examples/*/svc/package.json` 或 `examples/*/api/package.json` 有 dep 版本以 `^` / `~` / `>` / `<` / `=` 開頭。

**工具呼叫**：

```bash
node -e "
  const p = JSON.parse(require('fs').readFileSync('<path>/package.json','utf8'));
  for (const sec of ['dependencies','devDependencies']) {
    for (const [n,v] of Object.entries(p[sec]||{})) {
      if (/^[\^~><=]/.test(v)) {
        console.error('OFFENDER:', n, v);
        process.exit(1);
      }
    }
  }
  console.log('OK — all exact pins.');
"
```

**通過條件**：case-study svc / api `package.json` 內 `dependencies` + `devDependencies` 零 range specifier。

**自動 CI check**：`ext-dep-skill-enforcement` → Gate 2 step。

**禁止**：用 caret `^` 期望「自動升版」。要升版用 Renovate（`.github/renovate.json` 已設）走人類 review。

### Gate C — committed file 內 GitHub raw URL 必鎖 commit sha

**觸發**：commit 進 repo 的任何檔案（md / 程式 / json / 任何）含符合 `raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>` 的 URL。

**工具呼叫**：

```bash
# 把 /main/ 或 /master/ 或 /<branch>/ 換成 /<40-char-sha>/。
# 取得當前 sha：
#   curl -s https://api.github.com/repos/<owner>/<repo>/commits/main | jq -r '.sha'
# 然後 URL 內替換。
# 注意：短 sha（7-char）會被 gate 拒；必須 40-char hex 完整 sha。
```

**通過條件**：每個 `raw.githubusercontent.com/...` URL 的 `<ref>` 段必 `[a-f0-9]{40}`（40-char hex）。

**自動 CI check**：`ext-dep-skill-enforcement` → Gate 3 step。`scripts/pre-commit-ext-dep-gates.sh` 提供本機 pre-commit 快速回饋。

**禁止**：committed 內塞 `.../main/...` URL 當「差不多就好」。即便文件 / 註解內也不行 — 內容會無痕變。

**例外**：純 AI Coder 對話式讀取（不寫進任何 commit）免。一旦內容進 commit，此 gate 立即生效。

### Gate D — Dockerfile `FROM` 必 hash-pin 或 ARG / DIGEST

**觸發**：任何 `Dockerfile`（排除 `node_modules/`、排除 on-prem case 獨立追蹤）含 `FROM` 行。

**工具呼叫**：

```bash
# 取得 digest：
docker buildx imagetools inspect node:20.18.1-alpine3.20 | grep Digest

# 更新 Dockerfile，二擇一：
#  (a) 直接：FROM node:20.18.1-alpine3.20@sha256:b50ca7...
#  (b) ARG：  ARG NODE_IMAGE_DIGEST=sha256:b50ca7...
#            FROM ${NODE_IMAGE}
```

**通過條件**：每個 `FROM` 行含 `@sha256:` **或**透過 `ARG`（變數名含 `IMAGE` / `DIGEST`）解析。

**自動 CI check**：`ext-dep-skill-enforcement` → Gate 4 step。

**禁止**：`FROM node:20-alpine` 無 pin 無 ARG。CI 會 fail。

---

## High-trust 套件 — 額外人類 gate（CODEOWNERS）

若你（AI Coder）判定新套件為 **high-trust**（依 [Skill §1.3](../skills/tigerai/external-dependency-security/SKILL.md#13-high-trust-套件清單必須-l3-review)） — 即該套件會接觸 credentials、發 HTTP、簽 payload、連 DB / cloud / AI 服務 — 你**必須**：

1. 把套件加進 `package.json`（CODEOWNERS 自動 request reviewer）
2. SEC-DEP entry 內 `L3 code review` 欄位**填你 review 過的 commit sha**（不是 version tag — 具體 sha）
3. PR description 用 `.github/pull_request_template.md` 標明 high-trust 分類
4. **不可 merge** 直到人類 CODEOWNERS reviewer（`MorrisLu-Taipei`）簽核

CI 無法自動跑 L3 原始碼 review — 只能是人類 gate。Renovate 設 `automerge: false` 正是為了阻止 AI 繞此 gate。

---

## 外部 workflow JSON ingestion

匯入 repo 外的 `.workflow.json`：

**工具呼叫**：

```bash
node scripts/ingest-external-workflow.mjs <path-to-external.workflow.json>
```

**通過條件**：exit code 0。腳本強制：
- Gate 1: `security-scan.mjs` 0 error（jscode malicious pattern clean）
- Gate 2: `_pack_ingest` annotation 含 `submitter` + `reviewer` + `rationale`，且 `submitter !== reviewer`
- Gate 3: 列 node digest 供人類 spot-check（資訊性，非 fail 條件）
- 通過後 append 至 `scripts/ingest-log.jsonl`（audit trail）

**禁止**：繞 ingest gate「試一下」。直接 `cp` 外部 workflow 進 `examples/<case>/workflows/` 不跑 gate 即違規。

---

## 禁用詞（lexical rule）

針對外部依賴主張，你**不可**在任何 output（commit message / release notes / PR description / README / sticky note / 回 user 訊息）emit 以下字眼，**除非**該 output 更早位置已 emit 對應的 gate evidence schema：

- `validated` / `verified` / `tested` / `production-ready`
- `驗證` / `驗證通過` / `已驗證` / `可上線` / `正式可用`
- `safe to merge` / `合併沒問題` / `可以推上`
- `audited` / `稽核完成`
- `no vulnerabilities` / `沒有漏洞`
- `0 CVEs` / `clean SCA`
- `cleared for production` / `通過上線審查`

外部依賴主張的 evidence schema 必含：

```
## External-dependency evidence — gate v1（this AI ran the gates）

### Gate A — SEC-DEP entries
- All new deps have SEC-DEP entries: PASS / FAIL (<count> missing)

### Gate B — Exact pin
- All case-study package.json deps exact-pinned: PASS / FAIL (<count> offenders)

### Gate C — GitHub raw sha-lock
- All committed raw.githubusercontent.com URLs lock 40-char sha: PASS / FAIL

### Gate D — Dockerfile hash-pin
- All Dockerfile FROM lines hash-pinned or ARG-resolved: PASS / FAIL

### High-trust review
- Each high-trust package has L3 review @<commit-sha>: PASS / N/A (no high-trust deps) / PENDING

### External workflow ingestion (if applicable)
- ingest-external-workflow.mjs exit 0: PASS / N/A / FAIL
```

任一行 FAIL / PENDING → 不可用禁用詞。改用精確狀態語言（「Gate A pass、Gate D pending tracked-as v0.39.x」）。

---

## Critic enforcement（lexical regex）

依 [code2n8n-pipeline SKILL §1.8](../skills/tigerai/code2n8n-pipeline/SKILL.md#18-外部依賴-ingestion-規則加入於-v0360) 與 SEC-019，未來 AI 消費此 Pack 時的 critic agent / reviewer 必須對每則訊息 emit 前跑下列 regex 掃描：

```regex
\b(npm install|pnpm add|yarn add)\b
```

命中 → 同訊息內必含 Gate A + B 已跑且 PASS 的明示，或 tracked-as pending marker。

```regex
raw\.githubusercontent\.com/[^/]+/[^/]+/(?!([a-f0-9]{40})/)
```

命中於 committed 內容 → **VETO**。

```regex
FROM\s+[^\s@$]+\s*(?:AS\s+\w+)?\s*$
```

命中於任何 `Dockerfile` → **VETO** 除非 ARG-resolved。

這些是 **regex-checkable**。AI Coder 不可用「我覺得這個 OK」協商繞過。

---

## 本 directive **不**做的事

- **不**幫你 review 套件原始碼是否有後門 — 那是 L3 人類 review，CI 無法自動化
- **不**驗 package signature（npm provenance），除非你跑 `npm ci --audit-signatures` — Pack v0.38 已 ship SKILL 指引但 CI step 未強制（規劃中）
- **不**定期 rebuild Docker base image — 那是獨立的維運工作

---

## 各 release 狀態

| Release | 本 directive 狀態 |
| --- | --- |
| v0.36.0 | Tier 1：scanner + audit gate + exact-pin policy（policy 無自動 enforce，只有 audit gate） |
| v0.37.0 | Tier 2：ingestion script + Trivy gate + Renovate config |
| v0.38.0 | Tier 3：SOP Skill 寫好但無自動 enforce。實質僅文件 |
| **v0.39.0** | **四道 gate CI 全自動 enforce。pre-commit hook 可用。CODEOWNERS active。本 A2A directive ship。** |
