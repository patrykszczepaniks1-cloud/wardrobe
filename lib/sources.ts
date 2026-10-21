import { suggestCategory } from "./categories";
import { parsePrice, parseProductHtml } from "./scrape";
import type { ScrapeResult } from "./types";

type Json = Record<string, unknown>;

/** How much useful product data a result has. */
export function score(r: ScrapeResult | null | undefined) {
  if (!r) return 0;
  return (r.title ? 1 : 0) + (r.price != null ? 2 : 0) + (r.image ? 1 : 0);
}

// Titles of block, error and consent pages that bot filters serve instead of the product.
const JUNK_TITLE =
  /access denied|captcha|are you a (human|robot)|just a moment|attention required|pardon our interruption|request blocked|forbidden|not found|404|page unavailable|something went wrong|sidan (kunde inte hittas|finns inte)|hoppsan|ups,|oops/i;

/** Drop results that are a bot-filter or error page rather than a product. */
export function usable(r: ScrapeResult | null | undefined): ScrapeResult | null {
  if (!r) return null;
  if (r.price == null && (!r.title || JUNK_TITLE.test(r.title))) return null;
  return r;
}

/** Combine results: the best one wins, the others fill in whatever it is missing. */
export function mergeResults(results: (ScrapeResult | null | undefined)[]): ScrapeResult | null {
  const ok = results.filter((r): r is ScrapeResult => !!r).sort((a, b) => score(b) - score(a));
  if (!ok.length) return null;
  const out = { ...ok[0] };
  for (const r of ok.slice(1)) {
    out.title ??= r.title;
    out.brand ??= r.brand;
    out.store ??= r.store;
    out.image ??= r.image;
    if (out.price == null && r.price != null) {
      out.price = r.price;
      out.currency = r.currency;
      out.originalPrice = r.originalPrice;
    }
    out.images = Array.from(new Set([...out.images, ...r.images])).slice(0, 8);
  }
  out.suggestedCategory ??= suggestCategory(out.title, new URL(out.url).pathname);
  return out;
}

const SLUG_NOISE = new Set(["html", "htm", "prd", "p", "product", "products", "dp", "item", "www", "en", "sv", "se"]);

/**
 * Last resort: most fashion shops put the product name in the link
 * (zalando.se/adidas-originals-samba-og-unisex-sneakers-…-ad115p04q-c11.html).
 */
export function resultFromSlug(input: string): ScrapeResult {
  const url = new URL(input);
  const segments = url.pathname.split("/").filter(Boolean);
  // The longest hyphenated segment is almost always the product name.
  const slug = segments
    .map((s) => decodeURIComponent(s).replace(/\.(html?|aspx?|php)$/i, ""))
    .filter((s) => s.includes("-"))
    .sort((a, b) => b.length - a.length)[0];
  const words = (slug ?? "")
    .split(/[-_]+/)
    .filter((w) => w && !SLUG_NOISE.has(w.toLowerCase()))
    // Drop SKU-like tokens: digits mixed with letters, or long numbers.
    .filter((w) => !/\d/.test(w) || /^\d{1,3}$/.test(w));
  const title = words.length >= 2 ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : null;
  return {
    url: url.toString(),
    title,
    brand: null,
    price: null,
    originalPrice: null,
    currency: null,
    image: null,
    images: [],
    store: storeName(url.hostname),
    suggestedCategory: suggestCategory(title, url.pathname),
  };
}

const KNOWN_STORES: Record<string, string> = { asos: "ASOS", hm: "H&M", "hm.com": "H&M", zalando: "Zalando", cos: "COS", nike: "Nike", zara: "Zara" };

function storeName(hostname: string) {
  const parts = hostname.replace(/^www\d?\./, "").split(".");
  const name = parts.length > 2 && /^(co|com)$/.test(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[parts.length - 2] ?? parts[0];
  return KNOWN_STORES[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

/* ---------- ASOS: the app's product API is far less locked down than the website ---------- */

const ASOS_STORES: Record<string, string> = {
  se: "SE", us: "US", de: "DE", fr: "FR", es: "ES", it: "IT", nl: "NL", dk: "DK", pl: "PL", au: "AU", ch: "CH", no: "NO", fi: "FI", ie: "IE", at: "AT", be: "BE",
};

export function asosApiUrls(input: string): string[] {
  const url = new URL(input);
  if (!/(^|\.)asos\.com$/.test(url.hostname)) return [];
  const id = url.pathname.match(/\/prd\/(\d+)/)?.[1] ?? url.searchParams.get("productId");
  if (!id) return [];
  const store = ASOS_STORES[url.pathname.split("/")[1]?.toLowerCase()] ?? "COM";
  const qs = `store=${store}&sizeSchema=EU`;
  return [
    `https://www.asos.com/api/product/catalogue/v4/products/${id}?${qs}`,
    `https://api.asos.com/product/catalogue/v3/products/${id}?${qs}`,
  ];
}

export function parseAsosProduct(data: Json, url: string): ScrapeResult | null {
  if (!data || typeof data.name !== "string") return null;
  const price = (data.price ?? {}) as Json;
  const amount = (k: string) => parsePrice(((price[k] ?? {}) as Json).value);
  const current = amount("current");
  const previous = amount("previous") ?? amount("rrp");
  const media = (data.media ?? {}) as Json;
  const images = ((media.images ?? []) as Json[])
    .map((i) => (typeof i.url === "string" ? i.url : null))
    .filter((u): u is string => !!u)
    .map((u) => `${u.startsWith("http") ? "" : "https://"}${u}?$n_640w$&wid=634&fit=constrain`);
  const brand = typeof (data.brand as Json)?.name === "string" ? ((data.brand as Json).name as string) : null;
  return {
    url,
    title: data.name,
    brand,
    price: current,
    originalPrice: previous != null && current != null && previous > current ? previous : null,
    currency: typeof price.currency === "string" ? price.currency.toUpperCase() : null,
    image: images[0] ?? null,
    images: images.slice(0, 8),
    store: "ASOS",
    suggestedCategory: suggestCategory(data.name, typeof (data.productType as Json)?.name === "string" ? ((data.productType as Json).name as string) : null),
  };
}

/* ---------- Rendering services: fetch the page from a real browser elsewhere ---------- */

export function jinaRequest(url: string) {
  const headers: Record<string, string> = { "X-Return-Format": "html", "X-Timeout": "12" };
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;
  return { url: `https://r.jina.ai/${url}`, headers };
}

export function microlinkRequest(url: string) {
  const params = new URLSearchParams({
    url,
    "data.ld.selectorAll": 'script[type="application/ld+json"]',
    "data.ld.attr": "html",
    "data.price.selector": 'meta[property="product:price:amount"], meta[property="og:price:amount"], [itemprop="price"]',
    "data.price.attr": "content",
    "data.currency.selector": 'meta[property="product:price:currency"], meta[property="og:price:currency"], [itemprop="priceCurrency"]',
    "data.currency.attr": "content",
  });
  const key = process.env.MICROLINK_API_KEY;
  return {
    url: `https://${key ? "pro" : "api"}.microlink.io/?${params}`,
    headers: (key ? { "x-api-key": key } : {}) as Record<string, string>,
  };
}

/** Turn Microlink's metadata back into HTML so the normal parser can read it. */
export function parseMicrolink(body: Json, url: string): ScrapeResult | null {
  if (body?.status !== "success" || !body.data) return null;
  const d = body.data as Json;
  const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const meta = (prop: string, v: unknown) => (v ? `<meta property="${prop}" content="${esc(v)}">` : "");
  const ld = (Array.isArray(d.ld) ? d.ld : d.ld ? [d.ld] : [])
    .filter((s): s is string => typeof s === "string")
    .map((s) => `<script type="application/ld+json">${s.replace(/<\/script/gi, "")}</script>`)
    .join("");
  const html = `<html><head>${meta("og:title", d.title)}${meta("og:site_name", d.publisher)}${meta("og:image", (d.image as Json)?.url)}${meta(
    "product:price:amount",
    d.price,
  )}${meta("product:price:currency", d.currency)}${ld}</head></html>`;
  return parseProductHtml(html, typeof d.url === "string" ? d.url : url);
}
