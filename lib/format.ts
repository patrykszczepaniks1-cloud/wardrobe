import type { Item, Wishlist } from "./types";

export const CURRENCIES = ["EUR", "USD", "GBP", "PLN", "SEK", "NOK", "DKK", "CHF", "CZK", "CAD", "AUD"];

export function formatMoney(amount: number, currency: string, opts: { compact?: boolean } = {}) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: opts.compact || Number.isInteger(amount) ? 0 : 2,
      minimumFractionDigits: opts.compact || Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** How much cheaper the item is than its "was" price or the highest price we've seen. */
export function priceDrop(item: Item): { from: number; pct: number } | null {
  if (item.price == null) return null;
  const seen = Math.max(item.originalPrice ?? 0, ...(item.priceHistory ?? []).map((p) => p.price));
  if (seen <= item.price) return null;
  const pct = Math.round(((seen - item.price) / seen) * 100);
  return pct >= 1 ? { from: seen, pct } : null;
}

export interface Totals {
  currency: string;
  total: number;
  /** items with status ordered or owned */
  spent: number;
  remaining: number;
  /** sums for items priced in a different currency than the list */
  other: Record<string, number>;
  byCategory: { category: string; total: number; count: number }[];
  missingPrice: number;
}

export function computeTotals(currency: string, items: Item[]): Totals {
  const t: Totals = { currency, total: 0, spent: 0, remaining: 0, other: {}, byCategory: [], missingPrice: 0 };
  const cats = new Map<string, { total: number; count: number }>();
  for (const it of items) {
    const amount = it.price ?? 0;
    const c = cats.get(it.category) ?? { total: 0, count: 0 };
    c.count++;
    if (it.price == null) t.missingPrice++;
    if (it.currency && it.currency !== currency) {
      t.other[it.currency] = (t.other[it.currency] ?? 0) + amount;
    } else {
      t.total += amount;
      c.total += amount;
      if (it.status === "wanted") t.remaining += amount;
      else t.spent += amount;
    }
    cats.set(it.category, c);
  }
  t.byCategory = [...cats.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.count - a.count || b.total - a.total);
  return t;
}

export const listTotals = (l: Wishlist) => computeTotals(l.currency, l.items);

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
