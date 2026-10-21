import { NextResponse } from "next/server";
import { FetchError, PREVIEW_BOT_UA, safeFetchText } from "@/lib/safeFetch";
import { isShopify, mergeShopifyProduct, parseProductHtml } from "@/lib/scrape";
import {
  asosApiUrls,
  jinaRequest,
  mergeResults,
  microlinkRequest,
  parseAsosProduct,
  parseMicrolink,
  resultFromSlug,
  score,
  usable,
} from "@/lib/sources";
import type { ScrapeResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Two rounds of parallel requests (~9s, then ~15s) plus an optional Shopify JSON fetch.
export const maxDuration = 60;

const COMPLETE = 4; // title + price + image

type Page = { url: string; text: string; status: number };

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url")?.trim();
  if (!raw) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    target.hash = "";
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid link" }, { status: 400 });
  }
  const url = target.toString();

  try {
    // Round 1: the page itself as a browser and as a link-preview crawler, plus shop APIs.
    const [direct, crawler, ...apis] = await Promise.all([
      fetchPage(url),
      fetchPage(url, { userAgent: PREVIEW_BOT_UA }),
      ...asosApiUrls(url).map((api) =>
        safeFetchText(api, { accept: "application/json" })
          .then((r) => (r.status === 200 ? parseAsosProduct(JSON.parse(r.text), url) : null))
          .catch(() => null),
      ),
    ]);
    const pages = [direct, crawler].filter((p): p is Page & { result: ScrapeResult } => !!p?.result);
    let result = mergeResults([...pages.map((p) => p.result), ...apis.map(usable)]);

    // Round 2: blocked or JS-only page — have a rendering service load it in a real browser.
    if (score(result) < COMPLETE) {
      const jina = jinaRequest(url);
      const microlink = microlinkRequest(url);
      const rendered = await Promise.all([
        safeFetchText(jina.url, { headers: jina.headers, accept: "text/html", timeoutMs: 15_000 })
          .then((r) => (r.status === 200 ? usable(parseProductHtml(r.text, url)) : null))
          .catch(() => null),
        safeFetchText(microlink.url, { headers: microlink.headers, accept: "application/json", timeoutMs: 15_000 })
          .then((r) => usable(parseMicrolink(JSON.parse(r.text), url)))
          .catch(() => null),
      ]);
      result = mergeResults([result, ...rendered]);
    }

    // Shopify stores expose clean product JSON at <product-url>.js
    const shopPage = pages.find((p) => isShopify(p.text));
    if (result && shopPage) {
      const finalUrl = new URL(shopPage.url);
      if (/\/products\/[^/]+\/?$/.test(finalUrl.pathname)) {
        try {
          const jsUrl = new URL(finalUrl.pathname.replace(/\/$/, "") + ".js", finalUrl.origin);
          const js = await safeFetchText(jsUrl.toString(), { accept: "application/json" });
          if (js.status === 200) {
            result = mergeShopifyProduct(result, JSON.parse(js.text), finalUrl.searchParams.get("variant"));
          }
        } catch {
          // HTML metadata is good enough.
        }
      }
    }

    // Nothing could read the page: fall back to what the link itself says.
    if (!result) {
      const slug = resultFromSlug(url);
      const reason = direct?.status ? `The shop blocked us (${direct.status})` : "The shop didn't respond";
      return NextResponse.json({
        ...slug,
        warning: `${reason}, so only the name from the link was filled in. Add the price and picture yourself, or try again later.`,
      });
    }
    result = mergeResults([result, resultFromSlug(url)])!;
    return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    const status = e instanceof FetchError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status });
  }
}

/** Fetch and parse a product page. Error pages are parsed too: some shops send the product with a 404. */
async function fetchPage(url: string, opts?: { userAgent?: string }): Promise<(Page & { result: ScrapeResult | null }) | null> {
  try {
    const page = await safeFetchText(url, opts);
    const result = usable(parseProductHtml(page.text, page.url));
    return { ...page, result: page.status < 400 || result?.price != null ? result : null };
  } catch (e) {
    // Unresolvable or private hosts fail the same way every time; surface those.
    if (e instanceof FetchError && e.status === 400) throw e;
    return null;
  }
}
