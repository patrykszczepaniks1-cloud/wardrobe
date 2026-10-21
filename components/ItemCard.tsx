"use client";

import { categoryEmoji } from "@/lib/categories";
import { formatMoney, priceDrop } from "@/lib/format";
import type { Item } from "@/lib/types";
import { HeartIcon } from "./icons";
import { STATUS_LABEL } from "./ItemSheet";

export function ItemCard({
  item,
  onOpen,
  onToggleFavorite,
  badge,
}: {
  item: Item;
  onOpen: () => void;
  onToggleFavorite: () => void;
  /** Small label under the price, e.g. the list name in the "All items" view */
  badge?: string;
}) {
  const drop = priceDrop(item);
  return (
    <div className="pressable relative flex flex-col overflow-hidden rounded-card bg-card shadow-[0_1px_2px_rgba(40,20,20,0.05)]">
      <button onClick={onOpen} className="flex flex-1 flex-col text-left" aria-label={`Open ${item.title}`}>
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-gradient-to-b from-[#f7f3f1] to-[#ede6e3] dark:from-[#262225] dark:to-[#1f1b1e]">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-5xl">{categoryEmoji(item.category)}</div>
          )}
          {drop && (
            <span className="absolute top-2 left-2 rounded-full bg-sale px-2 py-0.5 text-[11px] font-bold text-white">−{drop.pct}%</span>
          )}
          {item.status !== "wanted" && (
            <span
              className={`absolute bottom-2 left-2 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${
                item.status === "owned" ? "bg-ok text-white" : "bg-warn text-black"
              }`}
            >
              {STATUS_LABEL[item.status]}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-0.5 px-3 pt-2.5 pb-3">
          {(item.brand || item.store) && (
            <p className="truncate text-[11px] font-bold tracking-wide text-muted uppercase">{item.brand || item.store}</p>
          )}
          <p className="line-clamp-2 text-[13.5px] leading-tight font-medium">{item.title}</p>
          <div className="mt-auto flex items-baseline gap-1.5 pt-1.5">
            <span className={`text-[15px] font-extrabold tabular-nums ${drop ? "text-sale" : ""}`}>
              {item.price != null ? formatMoney(item.price, item.currency) : "No price"}
            </span>
            {drop && <span className="text-xs text-muted tabular-nums line-through">{formatMoney(drop.from, item.currency)}</span>}
          </div>
          {(item.size || badge) && (
            <p className="truncate text-[11px] text-muted">{[item.size && `Size ${item.size}`, badge].filter(Boolean).join(" · ")}</p>
          )}
        </div>
      </button>
      <button
        onClick={onToggleFavorite}
        aria-label={item.favorite ? "Remove from must-haves" : "Mark as must-have"}
        aria-pressed={!!item.favorite}
        className={`absolute top-2 right-2 grid size-9 place-items-center rounded-full shadow-sm transition ${
          item.favorite ? "bg-accent text-white" : "bg-card/90 text-accent backdrop-blur"
        }`}
      >
        <HeartIcon filled={item.favorite} width={17} height={17} />
      </button>
    </div>
  );
}
