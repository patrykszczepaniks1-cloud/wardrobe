import { NextResponse } from "next/server";
import { FetchError, PREVIEW_BOT_UA, safeFetchText } from "@/lib/safeFetch";
import { isShopify, mergeShopifyProduct, parseProductHtml } from "@/lib/scrape";
import type { ScrapeResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Page fetch, a crawler retry and an optional Shopify JSON fetch can each take up to 10s.
export const maxDuration = 40;

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url")?.trim();
  if (!raw) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid link" }, { status: 400 });
  }

  try {
    let page = await safeFetchText(target.toString());
    let result: ScrapeResult | null = page.status < 400 ? parseProductHtml(page.text, page.url) : null;

    // Blocked, or a JS-only page with no product data: retry as a link-preview crawler.
    if (!result || result.price == null || !result.image) {
      const retry = await safeFetchText(target.toString(), { userAgent: PREVIEW_BOT_UA }).catch(() => null);
      if (retry && retry.status < 400) {
        const alt = parseProductHtml(retry.text, retry.url);
        if (!result || score(alt) > score(result)) {
          page = retry;
          result = alt;
        }
      }
    }
    if (!result) {
      return NextResponse.json(
        { error: `The shop responded with ${page.status}. You can still add the item manually.` },
        { status: 422 },
      );
    }

    // Shopify stores expose clean product JSON at <product-url>.js
    const finalUrl = new URL(page.url);
    if (isShopify(page.text) && /\/products\/[^/]+\/?$/.test(finalUrl.pathname)) {
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

    return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    const status = e instanceof FetchError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status });
  }
}

/** How much useful product data a parse found. */
function score(r: ScrapeResult) {
  return (r.title ? 1 : 0) + (r.price != null ? 2 : 0) + (r.image ? 1 : 0);
}
