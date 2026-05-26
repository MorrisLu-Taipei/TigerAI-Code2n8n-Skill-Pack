# Credits / 致謝

## Original work / 原始作品

**Project**: ai_customer_service
**Author / GitHub**: [scorpioliu0953](https://github.com/scorpioliu0953)
**Repository**: <https://github.com/scorpioliu0953/ai_customer_service>
**Stack**: React + TypeScript + Vite (frontend), Netlify Functions (backend), Supabase (DB), OpenAI GPT + Google Gemini, LINE Messaging API.

## This port / 本移植

**Location**: `examples/line-ai-customer-service/`
**Platform**: n8n
**Scope**: Backend runtime path only — a 1:1 behavioural port of `netlify/functions/line-webhook.ts` (175 lines) into two n8n workflows (core message router + LINE entry). The React admin dashboard is **not** ported (n8n is not a web framework); instead it is re-specified as `FRONTEND-SDD.md` (approach C — n8n-hosted UI), to be built later. The Supabase schema is reused unchanged.

Preserved verbatim from upstream:

- LINE signature verification (HMAC-SHA256 over raw body)
- Event deduplication via `processed_events` primary-key conflict
- Handover keyword matching (single-char exact / multi-char substring)
- Human-mode flag + timeout-revert logic
- GPT routing across model families (chat completions / o-series / gpt-5 Responses API)
- Gemini `generateContent` with inline knowledge-base file
- Agent push-notification fan-out
- API keys stored in the `settings` table (so the dashboard can edit them)

## License / 授權

This port inherits the upstream license. Refer to the upstream repository for terms. Keep this `CREDITS.md` in distributions and cite the upstream project.

## Provenance / 出處

Every behaviour in the n8n port is sourced from `netlify/functions/line-webhook.ts` and `supabase_schema.sql` of the upstream repo. See `docs/field-mapping.md` for the function-by-function mapping from the TypeScript handler to n8n nodes.
