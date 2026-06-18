import { createAmegoProvider } from "@paid-tw/einvoice-amego";
import { createEcpayProvider } from "@paid-tw/einvoice-ecpay";
import { createEzpayProvider } from "@paid-tw/einvoice-ezpay";
import { createEzpayCrossBorderProvider } from "@paid-tw/einvoice-ezpay-crossborder";
import { createEzreceiptProvider } from "@paid-tw/einvoice-ezreceipt";
import type { InvoiceProvider } from "@paid-tw/einvoice";

const env = process.env;

class ConfigurationError extends Error {
  constructor(detail: string) {
    super("configuration error"); // 🔒 SEC-3: hide env var names from clients
    this.name = "ConfigurationError";
    (this as { detail?: string }).detail = detail;
  }
}

function need(name: string): string {
  const v = env[name];
  if (!v) {
    // Detail is for the server-side log only; the thrown message is opaque.
    console.error(`[providers] missing env var: ${name}`);
    throw new ConfigurationError(`env var ${name} not set`);
  }
  return v;
}

// ProviderMode in the SDK is "TEST" | "PRODUCTION".
const mode = (env.EINVOICE_MODE === "PRODUCTION" ? "PRODUCTION" : "TEST") as
  | "PRODUCTION"
  | "TEST";

const cache = new Map<string, InvoiceProvider>();

export function getProvider(name: string): InvoiceProvider {
  const key = name.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;

  let p: InvoiceProvider;
  switch (key) {
    case "amego":
      p = createAmegoProvider({
        sellerUbn: need("AMEGO_SELLER_UBN"),
        appKey: need("AMEGO_APP_KEY"),
        mode,
      });
      break;
    case "ecpay":
      p = createEcpayProvider({
        merchantId: need("ECPAY_MERCHANT_ID"),
        hashKey: need("ECPAY_HASH_KEY"),
        hashIV: need("ECPAY_HASH_IV"),
        mode,
      });
      break;
    case "ezpay":
      p = createEzpayProvider({
        merchantId: need("EZPAY_MERCHANT_ID"),
        hashKey: need("EZPAY_HASH_KEY"),
        hashIV: need("EZPAY_HASH_IV"),
        mode,
      });
      break;
    case "ezpay-crossborder":
      // EzpayCrossBorderConfig is a type-alias for EzpayConfig.
      p = createEzpayCrossBorderProvider({
        merchantId: need("EZPAY_CB_MERCHANT_ID"),
        hashKey: need("EZPAY_CB_HASH_KEY"),
        hashIV: need("EZPAY_CB_HASH_IV"),
        mode,
      });
      break;
    case "ezreceipt":
      p = createEzreceiptProvider({
        appCode: need("EZRECEIPT_APP_CODE"),
        appKey: need("EZRECEIPT_APP_KEY"),
        accName: need("EZRECEIPT_ACC_NAME"),
        password: need("EZRECEIPT_PASSWORD"),
        mode,
      });
      break;
    default:
      throw new ConfigurationError(`unknown provider: ${name}`);
  }
  cache.set(key, p);
  return p;
}

export const SUPPORTED_PROVIDERS = [
  "amego",
  "ecpay",
  "ezpay",
  "ezpay-crossborder",
  "ezreceipt",
] as const;

export const ALLOWED_OPS = new Set([
  "issue",
  "void",
  "allowance",
  "voidAllowance",
  "query",
] as const);

export type AllowedOp = "issue" | "void" | "allowance" | "voidAllowance" | "query";
