import * as cheerio from "cheerio";
import type { ScrapeResult } from "./types";
import { suggestCategory } from "./categories";

type Json = unknown;

const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR",
  "£": "GBP",
  $: "USD",
  "zł": "PLN",
  zl: "PLN",
  kr: "SEK",
  "¥": "JPY",
  "₹": "INR",
  CHF: "CHF",
};

/**
 * Parse a price string that may use either "1,234.56" or "1.234,56" style
 * separators (or plain numbers / cents-free values). Returns null if no number.
 */
export function parsePrice(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  const m = input.replace(/\s| /g, "").match(/\d[\d.,']*/);
  if (!m) return null;
  let s = m[0].replace(/'/g, "").replace(/[.,]$/, "");
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot !== -1 && lastComma !== -1) {
    // Both present: the later separator is the decimal one.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? "." : ",";
    const count = s.split(sep).length - 1;
    const decimals = s.length - s.lastIndexOf(sep) - 1;
    // Several separators, or exactly three trailing digits ("1.299", "1,299"), mean thousands.
    s = count > 1 || decimals === 3 ? s.split(sep).join("") : s.replace(sep, ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function detectCurrency(text: string | null | undefined): string | null {
  if (!text) return null;
  const iso = text.match(/\b(EUR|USD|GBP|PLN|SEK|NOK|DKK|CHF|CZK|HUF|CAD|AUD|JPY|NZD|RON)\b/i);
  if (iso) return iso[1].toUpperCase();
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(sym)) return code;
  }
  return null;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function hasType(node: Record<string, Json>, type: string): boolean {
  return asArray(node["@type"] as string | string[]).some(
    (t) => typeof t === "string" && t.toLowerCase().endsWith(type.toLowerCase()),
  );
}

/** Walk any JSON-LD structure and collect objects whose @type matches. */
function collectByType(root: Json, type: string, out: Record<string, Json>[] = []): Record<string, Json>[] {
  if (Array.isArray(root)) {
    root.forEach((r) => collectByType(r, type, out));
  } else if (root && typeof root === "object") {
    const node = root as Record<string, Json>;
    if (hasType(node, type)) out.push(node);
    for (const key of ["@graph", "mainEntity", "itemListElement", "hasVariant", "item"]) {
      if (key in node) collectByType(node[key], type, out);
    }
  }
  return out;
}

function imageFromLd(img: Json): string | null {
  for (const i of asArray(img as Json[])) {
    if (typeof i === "string") return i;
    if (i && typeof i === "object") {
      const o = i as Record<string, Json>;
      if (typeof o.url === "string") return o.url;
      if (typeof o.contentUrl === "string") return o.contentUrl;
    }
  }
  return null;
}

interface Offer {
  price: number | null;
  originalPrice: number | null;
  currency: string | null;
}

function offerFromLd(offers: Json): Offer {
  for (const o of asArray(offers as Json[])) {
    if (!o || typeof o !== "object") continue;
    const offer = o as Record<string, Json>;
    const specs = asArray(offer.priceSpecification as Json[]).filter((x) => x && typeof x === "object") as Record<string, Json>[];
    // Sale pages often list the old price as a StrikethroughPrice / ListPrice specification.
    const isOld = (sp: Record<string, Json>) => /strikethrough|listprice|msrp/i.test(String(sp.priceType ?? ""));
    const spec = specs.find((sp) => !isOld(sp)) ?? specs[0];
    const old = specs.find(isOld);
    const price = parsePrice(offer.price) ?? parsePrice(offer.lowPrice) ?? parsePrice(spec?.price);
    const rawCurrency = offer.priceCurrency ?? spec?.priceCurrency;
    const currency = typeof rawCurrency === "string" ? rawCurrency : null;
    const was = parsePrice(old?.price);
    if (price != null) {
      return { price, originalPrice: was != null && was > price ? was : null, currency: currency ? currency.toUpperCase() : null };
    }
    if (offer.offers) {
      const nested = offerFromLd(offer.offers);
      if (nested.price != null) return nested;
    }
  }
  return { price: null, originalPrice: null, currency: null };
}

function absolutize(src: string | null | undefined, base: string): string | null {
  if (!src) return null;
  try {
    return new URL(src.trim(), base).toString();
  } catch {
    return null;
  }
}

function cleanTitle(title: string | null, store: string | null): string | null {
  if (!title) return null;
  let t = title.replace(/\s+/g, " ").trim();
  if (store) {
    // Strip trailing " | Store" / " – Store" suffixes.
    const re = new RegExp(`\\s*[|–—-]\\s*${store.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
    t = t.replace(re, "");
  }
  return t || null;
}

function storeFromHost(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, "");
  const parts = host.split(".");
  // Drop the TLD, plus a generic second level like "co" in example.co.uk.
  parts.pop();
  if (parts.length > 1 && /^(co|com|org|net|ac)$/.test(parts[parts.length - 1])) parts.pop();
  const name = parts[parts.length - 1] || host;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function isShopify(html: string): boolean {
  return /cdn\.shopify\.com|Shopify\.shop\s*=|shopify-digital-wallet/i.test(html);
}

/** Pure HTML → product metadata extraction. */
export function parseProductHtml(html: string, url: string): ScrapeResult {
  const $ = cheerio.load(html);
  const meta = (...names: string[]): string | null => {
    for (const n of names) {
      const v =
        $(`meta[property="${n}"]`).attr("content") ??
        $(`meta[name="${n}"]`).attr("content") ??
        $(`meta[itemprop="${n}"]`).attr("content");
      if (v && v.trim()) return v.trim();
    }
    return null;
  };

  // JSON-LD
  let ldTitle: string | null = null;
  let ldImage: string | null = null;
  let ldPrice: number | null = null;
  let ldOriginal: number | null = null;
  let ldCurrency: string | null = null;
  let ldBrand: string | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (ldTitle && ldPrice != null) return;
    const raw = $(el).contents().text();
    let data: Json;
    try {
      data = JSON.parse(raw);
    } catch {
      try {
        data = JSON.parse(raw.replace(/[\u0000-\u001f]+/g, " "));
      } catch {
        return;
      }
    }
    const products = [...collectByType(data, "Product"), ...collectByType(data, "ProductGroup")];
    for (const p of products) {
      if (!ldTitle && typeof p.name === "string") ldTitle = p.name;
      if (!ldImage) ldImage = imageFromLd(p.image);
      if (!ldBrand && p.brand) {
        const b = asArray(p.brand as Json[])[0];
        ldBrand = typeof b === "string" ? b : ((b as Record<string, Json>)?.name as string) ?? null;
      }
      if (ldPrice == null) {
        const offer = offerFromLd(p.offers);
        if (offer.price != null) {
          ldPrice = offer.price;
          ldOriginal = offer.originalPrice;
          ldCurrency = offer.currency;
        }
      }
    }
  });

  // Microdata fallback
  const itempropPrice =
    $('[itemprop="price"]').first().attr("content") ?? $('[itemprop="price"]').first().text() ?? null;
  const itempropCurrency = $('[itemprop="priceCurrency"]').first().attr("content") ?? null;

  const siteName = meta("og:site_name", "application-name");
  const store = siteName || storeFromHost(url);

  const rawTitle =
    ldTitle ||
    meta("og:title", "twitter:title") ||
    $('[itemprop="name"]').first().text().trim() ||
    $("h1").first().text().trim() ||
    $("title").first().text().trim() ||
    null;

  // OpenGraph product tags: a sale_price next to price means price is the "was" price.
  const ogPrice = parsePrice(meta("product:price:amount", "og:price:amount"));
  const ogSale = parsePrice(meta("product:sale_price:amount", "og:sale_price:amount"));
  const ogOnSale = ogSale != null && ogPrice != null && ogSale < ogPrice;
  let price = ldPrice ?? (ogOnSale ? ogSale : ogPrice ?? ogSale) ?? parsePrice(itempropPrice || null);
  const originalPrice = ldPrice != null ? ldOriginal : ogOnSale ? ogPrice : null;
  let currency =
    ldCurrency ??
    meta("product:price:currency", "og:price:currency")?.toUpperCase() ??
    itempropCurrency?.toUpperCase() ??
    null;

  // Last resort: a twitter:data1 "Price" field, or a prominent price element.
  if (price == null) {
    const candidates = [
      meta("twitter:data1"),
      $('[class*="price"]:not(:has([class*="price"]))').first().text(),
      $('[data-price]').first().attr("data-price"),
    ];
    for (const c of candidates) {
      const p = parsePrice(c);
      if (p != null && p > 0) {
        price = p;
        currency = currency ?? detectCurrency(c);
        break;
      }
    }
  }

  const images: string[] = [];
  const pushImg = (s: string | null | undefined) => {
    const abs = absolutize(s, url);
    if (abs && !images.includes(abs)) images.push(abs);
  };
  pushImg(ldImage);
  $('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]').each((_, el) =>
    pushImg($(el).attr("content")),
  );
  if (!images.length) pushImg($('[itemprop="image"]').first().attr("content") ?? $('[itemprop="image"]').first().attr("src"));

  const title = cleanTitle(rawTitle, store);
  const brand = ldBrand || meta("product:brand", "og:brand", "brand");

  return {
    url,
    title,
    brand,
    price,
    originalPrice,
    currency,
    image: images[0] ?? null,
    images: images.slice(0, 8),
    store: store || brand,
    suggestedCategory: suggestCategory(title, new URL(url).pathname),
  };
}

/** Merge data from a Shopify product .js/.json payload (more reliable prices). */
export function mergeShopifyProduct(base: ScrapeResult, product: Record<string, Json>, variantId?: string | null): ScrapeResult {
  const variants = asArray(product.variants as Record<string, Json>[]);
  const variant = (variantId && variants.find((v) => String(v.id) === variantId)) || variants[0];
  let price = base.price;
  let originalPrice = base.originalPrice;
  // .js payloads give integer cents, .json payloads give "123.45" strings.
  const money = (raw: Json) => (typeof raw === "number" ? raw / 100 : parsePrice(raw));
  if (variant) {
    price = money(variant.price) ?? price;
    const was = money(variant.compare_at_price);
    originalPrice = was != null && price != null && was > price ? was : null;
  }
  const vendor = typeof product.vendor === "string" && product.vendor ? product.vendor : null;
  const imgs = asArray(product.images as Json[])
    .map((i) => (typeof i === "string" ? i : ((i as Record<string, Json>)?.src as string)))
    .filter(Boolean)
    .map((s) => absolutize(s.startsWith("//") ? `https:${s}` : s, base.url)!)
    .filter(Boolean);
  const title = (typeof product.title === "string" && product.title) || base.title;
  return {
    ...base,
    title,
    brand: base.brand ?? vendor,
    price,
    originalPrice,
    image: base.image ?? imgs[0] ?? null,
    images: Array.from(new Set([...base.images, ...imgs])).slice(0, 8),
    suggestedCategory: base.suggestedCategory ?? suggestCategory(title),
  };
}
