import { Hono, type Context } from "hono";
import { logger } from "hono/logger";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { serve } from "@hono/node-server";
import { Capability, supports, InvoiceError } from "@paid-tw/einvoice";
import { getProvider, SUPPORTED_PROVIDERS, ALLOWED_OPS, type AllowedOp } from "./providers.js";

const app = new Hono();
app.use("*", logger());

// 🔒 SEC-5: deny CORS by default. Set CORS_ORIGINS=https://your-n8n.example.com to allow.
const corsOrigins = (process.env.CORS_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
app.use("*", cors({
  origin: corsOrigins.length === 0 ? "" : corsOrigins,
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["authorization", "content-type"],
}));

// 🔒 SEC-4: 1 MiB body limit. Invoice JSON is small; anything bigger is suspicious.
app.use("/v1/*", bodyLimit({ maxSize: 1024 * 1024, onError: (c) => c.json({ error: { code: "BODY_TOO_LARGE" } }, 413) }));

// 🔒 SEC-1: refuse to start without a token unless EINVOICE_ALLOW_UNAUTH=1 (dev escape hatch only).
const svcToken = process.env.EINVOICE_SVC_TOKEN;
if (!svcToken) {
  if (process.env.EINVOICE_ALLOW_UNAUTH === "1") {
    console.warn("⚠ EINVOICE_SVC_TOKEN not set AND EINVOICE_ALLOW_UNAUTH=1 — UNAUTHENTICATED MODE. Dev only.");
  } else {
    console.error("❌ EINVOICE_SVC_TOKEN is required. Set it, or pass EINVOICE_ALLOW_UNAUTH=1 to override (dev only). Exiting.");
    process.exit(1);
  }
} else {
  app.use("/v1/*", bearerAuth({ token: svcToken }));
}

// ---------- Health + meta -------------------------------------------------

app.get("/healthz", (c) => c.json({ ok: true, providers: SUPPORTED_PROVIDERS }));

app.get("/v1/capabilities/:provider", (c) => {
  const name = c.req.param("provider");
  if (!SUPPORTED_PROVIDERS.includes(name as typeof SUPPORTED_PROVIDERS[number])) {
    return c.json({ error: { code: "UNKNOWN_PROVIDER" } }, 400);
  }
  try {
    const p = getProvider(name);
    return c.json({ provider: p.name, capabilities: [...p.capabilities] as Capability[] });
  } catch (e) {
    return mapError(c, e);
  }
});

// ---------- 5 SDK operations ----------------------------------------------

interface Wrapped<T> {
  provider: string;
  input: T;
}

function unwrap<T>(body: unknown): Wrapped<T> {
  if (!body || typeof body !== "object") throw new Error("body must be an object");
  const b = body as Record<string, unknown>;
  if (typeof b.provider !== "string") throw new Error("body.provider (string) required");
  if (!SUPPORTED_PROVIDERS.includes(b.provider as typeof SUPPORTED_PROVIDERS[number])) {
    throw new Error("unknown provider");
  }
  if (!b.input || typeof b.input !== "object") throw new Error("body.input (object) required");
  return { provider: b.provider, input: b.input as T };
}

function mapError(c: Context, e: unknown) {
  if (e instanceof InvoiceError) {
    const clientFault = e.code === "VALIDATION" || e.code === "UNSUPPORTED" || e.code === "NOT_FOUND" || e.code === "CONFLICT" || e.code === "AUTH";
    const status = clientFault ? 400 : 502;
    return c.json({
      error: {
        code: e.code,
        message: e.message,
        provider: e.provider,
        rawCode: e.rawCode ?? null,
      },
    }, status);
  }
  const msg = (e as Error).message ?? "unknown";
  // 🔒 SEC-3: configuration errors carry only the opaque message.
  return c.json({ error: { code: "INTERNAL", message: msg } }, msg === "configuration error" ? 500 : 400);
}

async function callOp(c: Context, op: AllowedOp) {
  try {
    const { provider, input } = unwrap(await c.req.json());
    // Whitelisted dispatch — op is a compile-time AllowedOp.
    const p = getProvider(provider);
    const fn = p[op] as (i: unknown) => Promise<unknown>;
    const result = await fn.call(p, input);
    return c.json({ provider, result });
  } catch (e) {
    return mapError(c, e);
  }
}

app.post("/v1/issue",          (c) => callOp(c, "issue"));
app.post("/v1/void",           (c) => callOp(c, "void"));
app.post("/v1/allowance",      (c) => callOp(c, "allowance"));
app.post("/v1/void-allowance", (c) => callOp(c, "voidAllowance"));
app.post("/v1/query",          (c) => callOp(c, "query"));

// ---------- Capability-aware failover -------------------------------------

interface FailoverBody {
  capability: Capability;
  candidates: string[];
  op: AllowedOp;
  input: unknown;
}

app.post("/v1/route", async (c) => {
  try {
    const body = (await c.req.json()) as FailoverBody;
    if (!body.capability || !Array.isArray(body.candidates) || !body.op) {
      return c.json({ error: { code: "VALIDATION", message: "capability, candidates[], op are required" } }, 400);
    }
    // 🔒 SEC-2: whitelist op against known SDK methods — no dynamic prototype lookup.
    if (!ALLOWED_OPS.has(body.op)) {
      return c.json({ error: { code: "VALIDATION", message: `op must be one of: ${[...ALLOWED_OPS].join(", ")}` } }, 400);
    }
    const errors: Record<string, string> = {};
    for (const name of body.candidates) {
      if (!SUPPORTED_PROVIDERS.includes(name as typeof SUPPORTED_PROVIDERS[number])) {
        errors[name] = "unknown provider";
        continue;
      }
      try {
        const p = getProvider(name);
        if (!supports(p, body.capability)) {
          errors[name] = `lacks capability ${body.capability}`;
          continue;
        }
        const fn = p[body.op] as (i: unknown) => Promise<unknown>;
        const result = await fn.call(p, body.input);
        return c.json({ provider: p.name, capability: body.capability, result });
      } catch (e) {
        errors[name] = (e as Error).message ?? "unknown error";
      }
    }
    return c.json({ error: { code: "ALL_FAILED", message: "no candidate succeeded" }, attempts: errors }, 502);
  } catch (e) {
    return mapError(c, e);
  }
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`einvoice-svc listening on :${port} (mode=${process.env.EINVOICE_MODE ?? "TEST"})`);
