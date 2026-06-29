# Cookbook 09 — Call an LLM via HTTP Request (portable, one-line provider swap)

> 🌐 **English** | [繁體中文](09-raw-http-llm-portable.md)

## When to use

You need to call an LLM inside a workflow but **don't want to depend on the
`@n8n/n8n-nodes-langchain` nodes**: you want to swap between Ollama (on-prem,
no key) ↔ Claude / OpenAI (cloud) by changing one node, carry the same flow to
any n8n (including environments without the langchain package), or control the
request body and timeout precisely.

Approach: use `n8n-nodes-base.httpRequest` to POST directly to the LLM chat API,
build the body yourself, and parse the response yourself.

> Credit: this pattern is absorbed from the MIT corpus
> `reference-workflows/_marketing-flows-yuri/` (YuriCrystal/n8n-marketing-flows) —
> all of its templates use this approach, with zero langchain dependency.

---

## Sticky Note content

### 🌱 Natural-language version (recommended)

```text
When I run it manually, send a topic to a local AI (Ollama) and have it rewrite
the topic into post drafts for three platforms.
I must be able to swap to cloud Claude / OpenAI by changing only the "call AI"
node's URL and key — nothing else in the flow.

From the AI response, keep only the plain-text content for me to read.
```

<details>
<summary>📐 Advanced: strict DSL form</summary>

```markdown
## Requirement: portable LLM call (raw HTTP)

@trigger: manual
@step: Build Prompt (code) → { prompt }
@step: Call LLM (httpRequest POST)
  - provider=ollama  → http://host.docker.internal:11434/api/chat
  - provider=claude  → https://api.anthropic.com/v1/messages  (header: x-api-key, anthropic-version)
  - provider=openai  → https://api.openai.com/v1/chat/completions  (header: Authorization Bearer)
  - body: { model, messages:[{role:system},{role:user, content: $json.prompt}], stream:false }
  - options: { timeout: 180000 }
@step: Extract (code) → pull plain text from message.content / content[0].text / response
@constraint: swapping provider touches only the Call LLM node
```

</details>

---

## Expected Layer 2

```
[Manual Trigger]
   ↓
[Code: Build Prompt]        ← build { prompt }
   ↓
[HTTP Request: Call LLM]    ← POST chat API, self-built body, timeout 180s
   ↓
[Code: Extract content]     ← tolerant parse of three response shapes
```

| Node | type | Key params |
|---|---|---|
| Manual Trigger | `n8n-nodes-base.manualTrigger` | — |
| Build Prompt | `n8n-nodes-base.code` | return `[{ json: { prompt } }]` |
| Call LLM (Ollama) | `n8n-nodes-base.httpRequest` | POST `http://host.docker.internal:11434/api/chat`; `specifyBody=json`; `jsonBody=={{ JSON.stringify({ model:'qwen2.5:latest', messages:[{role:'system',content:'...'},{role:'user',content:$json.prompt}], stream:false }) }}`; `options.timeout=180000` |
| Call LLM (Claude swap) | `n8n-nodes-base.httpRequest` | POST `https://api.anthropic.com/v1/messages`; headers `x-api-key` + `anthropic-version: 2023-06-01`; body `{ model:'claude-haiku-4-5', max_tokens:1024, messages:[...] }` (use a Header Auth credential, never hard-code the key) |
| Extract | `n8n-nodes-base.code` | see tolerant parser below |

**Tolerant Extract (one snippet handles Ollama / Claude / OpenAI shapes)**

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

## Expected Layer 3

```markdown
### 🤖 AI implementation notes — portable LLM call (raw HTTP)

**Node choice**
- Use `httpRequest` instead of the langchain `openAi`/`anthropic` nodes: no
  dependency, portable, full control of the body.
- `host.docker.internal:11434`: n8n in a container reaching Ollama on the host
  (aligns with "don't bind to localhost; stay Docker-portable").
- `options.timeout=180000`: on-prem models load slowly on first run — give 3 min.
- Extract uses one tolerant snippet for all three response shapes, so swapping
  provider requires no parser change.

**The only action to swap provider**
- Change just the "Call LLM" node: URL + headers + the model field of the body.
  Build Prompt / Extract stay untouched.
- Always carry cloud keys via a Header Auth credential — do NOT inline them in jsonBody.

**Required credentials**
- [ ] Ollama: none (local 11434)
- [ ] Claude: Anthropic API key (Header Auth: `x-api-key`)
- [ ] OpenAI: API key (Header Auth: `Authorization: Bearer`)

**Assumptions**
- For Ollama, the host has `ollama pull`ed the model (e.g. `qwen2.5:latest`).
- The container can reach `host.docker.internal` (default on Docker Desktop;
  Linux needs `--add-host`).

**Testing**
1. Get the Ollama version working manually first; confirm Extract yields plain text.
2. Swap Call LLM to Claude, change body to anthropic format, confirm Extract works unchanged.
3. Disconnect / stop Ollama to verify the 180s timeout behavior.

**Known limits**
- On-prem Ollama sometimes adds filler intros or drops characters → switch to a
  cloud model for clean output.
- Raw HTTP loses the langchain nodes' memory / tool-calling / output parsers; use
  langchain nodes when you need agent capabilities.
- A self-built body means you handle token limits and error codes (429/500)
  yourself — pair with Cookbook 06 retry.

**Maps to the user's requirement**
- @step (Call LLM) → HTTP Request (provider-swappable)
- @step (Extract) → Code tolerant parser
- @constraint (touch one node only) → achieved by decoupling Build/Extract from the provider
```

---

> 🔁 **Often paired with**: Cookbook 06 (retry/timeout reporting for flaky APIs),
> Cookbook 02 (schedule → LLM → email report). When you need a true AI agent
> (memory, tool calls), use the langchain nodes instead — see Cookbook 04.
