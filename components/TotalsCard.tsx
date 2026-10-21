"use client";

import { useState } from "react";
import { categoryEmoji } from "@/lib/categories";
import { formatMoney, type Totals } from "@/lib/format";

export function TotalsCard({ totals, onCategory }: { totals: Totals; onCategory: (c: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { currency, total, spent, remaining } = totals;
  const pct = total ? (spent / total) * 100 : 0;
  const cats = totals.byCategory.filter((c) => c.total > 0);
  const max = Math.max(...cats.map((c) => c.total), 1);
  const shown = expanded ? cats : cats.slice(0, 4);
  const other = Object.entries(totals.other);

  return (
    <section className="rounded-card bg-card p-5 shadow-[0_8px_30px_rgba(20,20,60,0.08)]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">List total</p>
          <p className="text-[2rem] leading-none font-extrabold tracking-tight tabular-nums">{formatMoney(total, currency)}</p>
          {other.map(([cur, amt]) => (
            <p key={cur} className="mt-1 text-sm font-semibold text-muted tabular-nums">
              + {formatMoney(amt, cur)}
            </p>
          ))}
        </div>
        <span className="mb-1 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent-ink">{Math.round(pct)}% bought</span>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-chip">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <span>
          <span className="mr-1.5 inline-block size-2 rounded-full bg-accent" />
          <span className="text-muted">Bought</span> <b className="tabular-nums">{formatMoney(spent, currency, { compact: true })}</b>
        </span>
        <span>
          <span className="text-muted">To go</span> <b className="tabular-nums">{formatMoney(remaining, currency, { compact: true })}</b>
        </span>
      </div>

      {cats.length > 0 && (
        <div className="mt-5 space-y-2.5 border-t border-line pt-4">
          {shown.map((c) => (
            <button key={c.category} onClick={() => onCategory(c.category)} className="block w-full text-left">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="truncate font-medium">
                  <span className="mr-1.5">{categoryEmoji(c.category)}</span>
                  {c.category}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatMoney(c.total, currency, { compact: true })}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-chip">
                <div className="h-full rounded-full bg-accent/70" style={{ width: `${(c.total / max) * 100}%` }} />
              </div>
            </button>
          ))}
          {cats.length > 4 && (
            <button onClick={() => setExpanded((e) => !e)} className="pt-1 text-sm font-semibold text-accent-ink">
              {expanded ? "Show less" : `Show all ${cats.length} categories`}
            </button>
          )}
        </div>
      )}

      {totals.missingPrice > 0 && (
        <p className="mt-4 rounded-xl bg-warn/20 px-3 py-2 text-xs font-medium">
          {totals.missingPrice} item{totals.missingPrice === 1 ? " has" : "s have"} no price yet and {totals.missingPrice === 1 ? "isn't" : "aren't"} counted.
        </p>
      )}
    </section>
  );
}
