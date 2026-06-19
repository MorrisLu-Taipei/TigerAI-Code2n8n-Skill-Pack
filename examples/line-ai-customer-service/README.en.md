# LINE AI Customer Service (n8n port)

> 🌐 **English** | [繁體中文](README.md)

> ## v1.0 status — Structural PASS · Runtime needs caller credentials
>
> | Aspect | Status |
> | --- | --- |
> | **Code2n8n path** | Path B: Netlify Functions + Supabase + GPT/Gemini → n8n runtime + approach-C admin UI |
> | **Position in [4-case spectrum](../../CODE2N8N.md#the-4-case-spectrum-code2n8n-journeys-ship-in-this-pack)** | #2 of 4 |
> | **Layer 1 V&V** (structural) | ✅ Static lint 0 err / 0 warn · n8n REST import 6/6 |
> | **Layer 2 V&V** (runtime) | ⚠ Requires caller LINE + Supabase credentials — not validated end-to-end in Pack CI |
> | **Upstream license** | MIT — [`scorpioliu0953/ai_customer_service`](https://github.com/scorpioliu0953/ai_customer_service) |
> | **Pack-authored layer** | core + entry workflows + approach-C admin UI + cloud-version SDD spec |
> | **Difference from v1.0 CLEARED case (einvoice)** | This case lacks **real-vendor-sandbox runtime evidence** (LINE Messaging API + Supabase require caller's own accounts); the 3rd leg of Path B (real-vendor-sandbox runtime PASS) is completed by the caller |
> | **Difference from #3 LINE on-prem case** | This is the **cloud version** with structural-PASS security review; #3 is the **on-prem version** with security review disclosing major defects → DO NOT DEPLOY AS-IS |
> | **Claims & evidence** | [v1-claims-and-evidence.md](../../docs/v1-claims-and-evidence.md) |

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
