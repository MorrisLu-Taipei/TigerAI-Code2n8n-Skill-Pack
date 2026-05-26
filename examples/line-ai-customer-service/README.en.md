# LINE AI Customer Service (n8n port)

> 🌐 **English** | [繁體中文](README.md)

An n8n port of the **backend webhook** from [scorpioliu0953/ai_customer_service](https://github.com/scorpioliu0953/ai_customer_service) (Netlify + React + Supabase + GPT/Gemini).

The original is a LINE AI customer-service system: receive message → dedup → human-handoff keyword → call GPT or Gemini → reply, plus a React admin dashboard. This directory ports the **backend runtime path** to n8n workflows. The **frontend** — since n8n is not a web framework — is captured as a plan instead ([FRONTEND-SDD.md](FRONTEND-SDD.md), approach C: serve the UI from n8n itself), not yet built.

---

## Built: backend runtime

| workflow | role | trigger |
| --- | --- | --- |
| [core/core-message-router.workflow.json](core/core-message-router.workflow.json) | **brain** — dedup / handoff / human-mode timeout / GPT or Gemini / reply | called by entry |
| [entry-line/entry-line.workflow.json](entry-line/entry-line.workflow.json) | **entry** — webhook + signature verification + event fan-out | LINE webhook POST |

Same core+entry split as the previous example: adding WhatsApp / Telegram / web chat later means writing one more entry that normalizes messages to `{userId, text, eventId, replyToken}` and calls the same core.

## Planned: frontend (SDD only)

[FRONTEND-SDD.md](FRONTEND-SDD.md) — approach C: a Webhook + Respond to Webhook returns a single-file mini dashboard (HTML+JS), backed by four `/admin/api/*` webhooks doing CRUD over the same Supabase tables. The whole system, UI included, runs inside n8n.

---

## Quick start

1. **Supabase**: run the upstream `supabase_schema.sql` to create the 4 tables (see [docs/supabase-setup.md](docs/supabase-setup.md)). Fill the single `settings` row with your LINE / OpenAI / Gemini keys and prompt.
2. **n8n credential**: only a **Supabase API** credential (URL + Service Role Key) is needed. LINE / OpenAI / Gemini keys are read from the `settings` row — no extra n8n credentials.
3. **Import** both workflows.
4. **Wire**: entry's `Call core (per event)` → set `workflowId` to the core's ID; assign the Supabase credential to every Supabase node.
5. **n8n env**: self-hosted needs `NODE_FUNCTION_ALLOW_BUILTIN=crypto` (or `*`) so the signature-check `require('crypto')` works.
6. **Activate** the entry workflow → copy the webhook Production URL → paste into LINE Developers Console Webhook URL.
7. Full steps in [docs/install.md](docs/install.md).

---

## Differences from the original

| Item | Original (Netlify) | n8n port |
| --- | --- | --- |
| Backend runtime | `netlify/functions/line-webhook.ts` | core + entry workflows |
| Signature check | `@line/bot-sdk` `validateSignature` | Code node `require('crypto')` HMAC-SHA256 (needs raw body) |
| LINE reply / push / profile | `@line/bot-sdk` Client | HTTP Request to LINE Messaging API |
| GPT | `openai` SDK + `/v1/responses` for gpt-5 | HTTP Request (body built per model family) |
| Gemini | `@google/generative-ai` | HTTP Request `generateContent` |
| Dedup | Supabase insert PK conflict | Supabase create + error-output branch |
| Keys | stored in settings table (DB) | **kept** — read from DB so the dashboard can edit |
| Admin UI | React SPA (Netlify) | approach C: n8n-hosted (planned, see FRONTEND-SDD) |
| Database | Supabase | **untouched**, same Supabase |

Behaviour (dedup, keywords, timeout, GPT/Gemini routing) matches the original.

---

## Credits

Upstream: [scorpioliu0953/ai_customer_service](https://github.com/scorpioliu0953/ai_customer_service). See [CREDITS.md](CREDITS.md).
