import { lookup } from "node:dns/promises";
import net from "node:net";

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

/**
 * Link-preview crawlers are let through by many shops that block other bots,
 * and they get served the OpenGraph tags we need.
 */
export const PREVIEW_BOT_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

export class FetchError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchError("Only http(s) links are supported");
  if (url.username || url.password) throw new FetchError("Links with credentials are not supported");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new FetchError("That address is not allowed");
  }
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new FetchError("Could not resolve that website");
  if (addrs.some((a) => isPrivateIp(a.address))) throw new FetchError("That address is not allowed");
}

/** Fetch a public URL as text, following redirects manually so each hop is checked. */
export async function safeFetchText(
  input: string,
  opts: { accept?: string; userAgent?: string } = {},
): Promise<{ url: string; text: string; status: number }> {
  const headers = { ...BROWSER_HEADERS };
  if (opts.accept) headers.Accept = opts.accept;
  if (opts.userAgent) headers["User-Agent"] = opts.userAgent;
  let url = new URL(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicUrl(url);
      const res = await fetch(url, {
        headers,
        redirect: "manual",
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url);
        continue;
      }
      if (!res.body) return { url: url.toString(), text: "", status: res.status };
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
      const text = new TextDecoder("utf-8").decode(Buffer.concat(chunks));
      return { url: url.toString(), text, status: res.status };
    }
    throw new FetchError("Too many redirects");
  } catch (e) {
    if (e instanceof FetchError) throw e;
    if ((e as Error).name === "AbortError") throw new FetchError("The website took too long to respond", 504);
    throw new FetchError("Could not reach that website", 502);
  } finally {
    clearTimeout(timer);
  }
}
