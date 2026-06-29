# Cookbook 09 — 用 HTTP Request 直呼 LLM（可攜、一鍵換 provider）

> 🌐 [English](09-raw-http-llm-portable.en.md) | **繁體中文**

## 使用情境

需要在 workflow 裡叫 LLM，但**不想綁 `@n8n/n8n-nodes-langchain` 節點**：
想在 Ollama（地端、免 key）↔ Claude / OpenAI（雲端）之間一鍵切換、想把同一支流程帶到任何 n8n
（含沒裝 langchain 套件的環境）、或想精準控制送出的 body 與逾時。

做法：用 `n8n-nodes-base.httpRequest` 直接 POST 到 LLM 的 chat API，自己組 body、自己解回應。

> 來源致謝：此 pattern 吸收自 MIT 語料 `reference-workflows/_marketing-flows-yuri/`
> （YuriCrystal/n8n-marketing-flows）—— 它全部模板都用這招，零 langchain 依賴。

---

## Sticky Note 內容

### 🌱 自然語言版（推薦）

**【中文】**

```text
我手動執行時，把一段主題交給本機 AI（Ollama）改寫成三平台社群貼文草稿。
要能很容易換成雲端 Claude / OpenAI——只改那顆「呼叫 AI」的網址和金鑰就好，
流程其他部分都不要動。

AI 回來的結果，只留純文字內容給我看。
```

**【English】**

```text
When I run it manually, send a topic to a local AI (Ollama) and have it rewrite
the topic into post drafts for three platforms.
I must be able to swap to cloud Claude / OpenAI by changing only the "call AI"
node's URL and key — nothing else in the flow.

From the AI response, keep only the plain-text content for me to read.
```

<details>
<summary>📐 進階：DSL 嚴謹寫法</summary>

```markdown
## 需求：可攜式 LLM 呼叫（HTTP 直呼）

@trigger: manual
@step: Build Prompt (code) → { prompt }
@step: Call LLM (httpRequest POST)
  - provider=ollama  → http://host.docker.internal:11434/api/chat
  - provider=claude  → https://api.anthropic.com/v1/messages  (header: x-api-key, anthropic-version)
  - provider=openai  → https://api.openai.com/v1/chat/completions  (header: Authorization Bearer)
  - body: { model, messages:[{role:system},{role:user, content: $json.prompt}], stream:false }
  - options: { timeout: 180000 }
@step: Extract (code) → 從 message.content / content[0].text / response 任一取出純文字
@constraint: 換 provider 只動 Call LLM 節點，前後不變
```

</details>

---

## 預期 Layer 2

```
[Manual Trigger]
   ↓
[Code: Build Prompt]        ← 組 { prompt }
   ↓
[HTTP Request: Call LLM]    ← POST chat API，body 自組，timeout 180s
   ↓
[Code: Extract content]     ← 容錯解析三種回應形狀
```

| 節點 | type | 關鍵參數 |
|---|---|---|
| Manual Trigger | `n8n-nodes-base.manualTrigger` | — |
| Build Prompt | `n8n-nodes-base.code` | 回傳 `[{ json: { prompt } }]` |
| Call LLM (Ollama) | `n8n-nodes-base.httpRequest` | POST `http://host.docker.internal:11434/api/chat`；`specifyBody=json`；`jsonBody=={{ JSON.stringify({ model:'qwen2.5:latest', messages:[{role:'system',content:'...'},{role:'user',content:$json.prompt}], stream:false }) }}`；`options.timeout=180000` |
| Call LLM (Claude 換法) | `n8n-nodes-base.httpRequest` | POST `https://api.anthropic.com/v1/messages`；headers `x-api-key` + `anthropic-version: 2023-06-01`；body `{ model:'claude-haiku-4-5', max_tokens:1024, messages:[...] }`（建議用 Header Auth credential，不要硬寫 key） |
| Extract | `n8n-nodes-base.code` | 見下方容錯解析 |

**Extract 容錯解析（同一段碼吃 Ollama / Claude / OpenAI 三種回應）**

```javascript
const d = $input.first().json;
let out = '';
try {
  out =
    (d.message && d.message.content) ||                    // Ollama /api/chat
    (d.content && d.content[0] && d.content[0].text) ||    // Anthropic messages
    (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || // OpenAI
    d.response || '';                                      // Ollama /api/generate
} catch (e) {}
if (!out) out = JSON.stringify(d);
return [{ json: { result: out } }];
```

---

## 預期 Layer 3

```markdown
### 🤖 AI 實作說明 — 可攜式 LLM 呼叫（HTTP 直呼）

**節點選型**
- 用 `httpRequest` 而非 langchain `openAi`/`anthropic` 節點：去依賴、可攜、body 完全可控。
- `host.docker.internal:11434`：容器內 n8n 打到 host 上的 Ollama（符合「不綁本機、Docker 帶得走」）。
- `options.timeout=180000`：地端模型首跑載入慢，給足 3 分鐘避免逾時。
- Extract 用「多形狀容錯」一段碼吃三家回應，換 provider 不必改解析。

**換 provider 的唯一動作**
- 只改「Call LLM」這一顆：URL + headers + body 的 model 欄。Build Prompt / Extract 不動。
- 雲端金鑰一律用 Header Auth credential 帶，**不要**寫進 jsonBody。

**所需 Credentials**
- [ ] Ollama：無（本機 11434）
- [ ] Claude：Anthropic API key（Header Auth：`x-api-key`）
- [ ] OpenAI：API key（Header Auth：`Authorization: Bearer`）

**前提假設**
- 用 Ollama 時，host 已 `ollama pull` 對應 model（如 `qwen2.5:latest`）。
- 容器能連到 `host.docker.internal`（Docker Desktop 預設可；Linux 需 `--add-host`）。

**測試建議**
1. Ollama 版先手動跑通，確認 Extract 取到純文字。
2. 把 Call LLM 換成 Claude，body 改 anthropic 格式，驗證 Extract 不用改也能取值。
3. 斷網/關 Ollama，驗證 180s 逾時行為。

**已知限制**
- 地端 Ollama 偶爾加廢話開場、漏字 → 要乾淨輸出就換雲端 model。
- HTTP 直呼不享有 langchain 節點的記憶體 / tool calling / output parser；需要 agent 能力時仍應用 langchain 節點。
- 自組 body 要自己處理 token 上限與錯誤碼（429/500），可搭 Cookbook 06 retry。

**對應使用者需求**
- @step (Call LLM) → HTTP Request（可換 provider）
- @step (Extract) → Code 容錯解析
- @constraint (只動一顆) → 已用 Build/Extract 與 provider 解耦達成
```

---

> 🔁 **常搭配**：Cookbook 06（API 不穩時 retry/逾時回報）、Cookbook 02（定時觸發 → LLM → 寄報表）。
> 需要真正的 AI agent（記憶、工具呼叫）時，改用 langchain 節點，見 Cookbook 04。
