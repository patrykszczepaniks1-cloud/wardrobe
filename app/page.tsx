"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { Chip } from "@/components/Chip";
import { HangerIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { ItemCard } from "@/components/ItemCard";
import { ItemSheet } from "@/components/ItemSheet";
import { ListSheet } from "@/components/ListSheet";
import { Sheet } from "@/components/Sheet";
import { categoryEmoji } from "@/lib/categories";
import { formatMoney, listTotals, priceDrop } from "@/lib/format";
import { downloadJson, importLists, newList, removeItem, saveList, toggleFavorite, upsertItem, useLists } from "@/lib/store";
import type { Item, Wishlist } from "@/lib/types";

const ALL = "__all";
const FAVS = "__favs";
const SALE = "__sale";

export default function Home() {
  return (
    <Suspense>
      <HomeView />
    </Suspense>
  );
}

function HomeView() {
  const lists = useLists();
  const router = useRouter();
  const search = useSearchParams();
  const [tab, setTab] = useState<"lists" | "items">(search.get("tab") === "items" ? "items" : "lists");
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState(false);
  const [itemSheet, setItemSheet] = useState<{ item?: Item; listId: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const listOptions = useMemo(() => lists?.map(({ id, name, emoji, currency }) => ({ id, name, emoji, currency })) ?? [], [lists]);
  const categories = useMemo(() => Array.from(new Set(lists?.flatMap((l) => l.items.map((i) => i.category)) ?? [])), [lists]);

  return (
    <main className="pt-safe mx-auto max-w-3xl px-4 pb-32">
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-accent to-[#ff9a6b] text-white shadow-lg shadow-accent/30">
            <HangerIcon />
          </span>
          <div>
            <h1 className="text-xl leading-none font-extrabold tracking-tight">Wardrobe</h1>
            <p className="mt-1 text-xs text-muted">Every wishlist, one place</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const n = await importLists(await f.text());
              alert(`Imported ${n} list${n === 1 ? "" : "s"}`);
            } catch {
              alert("That file couldn't be imported.");
            }
          }}
        />
        <button onClick={() => setMenu(true)} className="pressable h-10 rounded-full px-3.5 text-sm font-semibold text-muted">
          Backup
        </button>
      </header>

      {lists && lists.length > 0 && (
        <div className="sticky top-0 z-20 -mx-4 bg-bg/85 px-4 pt-[max(0.25rem,env(safe-area-inset-top))] pb-3 backdrop-blur-lg">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-card p-1">
            {(
              [
                ["lists", `Lists · ${lists.length}`],
                ["items", `All items · ${lists.reduce((n, l) => n + l.items.length, 0)}`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => {
                  setTab(k);
                  router.replace(k === "items" ? "/?tab=items" : "/", { scroll: false });
                }}
                className={`rounded-full py-2.5 text-sm font-semibold transition ${tab === k ? "bg-accent text-white shadow" : "text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {lists === null ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-card bg-card" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : tab === "lists" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {lists.map((l) => (
            <ListCard key={l.id} list={l} />
          ))}
          <button
            onClick={() => setCreating(true)}
            className="pressable flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line text-sm font-semibold text-muted"
          >
            <PlusIcon width={26} height={26} />
            New list
          </button>
        </div>
      ) : (
        <AllItems lists={lists} onOpen={(item, listId) => setItemSheet({ item, listId })} />
      )}

      {lists && lists.length > 0 && (
        <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4">
          <button
            onClick={() => (tab === "lists" ? setCreating(true) : setItemSheet({ listId: lists[0].id }))}
            className="pressable pointer-events-auto mb-2 inline-flex h-14 items-center gap-2 rounded-full bg-accent px-7 font-semibold text-white shadow-xl shadow-accent/35"
          >
            <PlusIcon /> {tab === "lists" ? "New list" : "Add item"}
          </button>
        </div>
      )}

      <ListSheet
        open={creating}
        existing={lists?.map((l) => l.name)}
        onClose={() => setCreating(false)}
        onSave={async (input) => {
          const l = newList(input);
          await saveList(l);
          setCreating(false);
          router.push(`/list/${l.id}`);
        }}
      />

      {itemSheet && (
        <ItemSheet
          open
          onClose={() => setItemSheet(null)}
          item={itemSheet.item}
          lists={listOptions}
          listId={itemSheet.listId}
          categories={categories}
          onSave={async (item, to) => {
            await upsertItem(item, to, itemSheet.item ? itemSheet.listId : undefined);
            setItemSheet(null);
          }}
          onSaveMany={async (items, to) => {
            for (const it of items) await upsertItem(it, to);
            setItemSheet(null);
          }}
          onDelete={
            itemSheet.item
              ? async () => {
                  if (!confirm("Remove this item?")) return;
                  await removeItem(itemSheet.item!.id, itemSheet.listId);
                  setItemSheet(null);
                }
              : undefined
          }
        />
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title="Backup">
        <div className="space-y-2 pb-4">
          <p className="pb-2 text-sm text-muted">
            Your wardrobe is saved on this device only. Export a backup to move it to another phone or browser.
          </p>
          <button
            disabled={!lists?.length}
            onClick={() => (setMenu(false), void downloadJson(lists, "wardrobe-backup"))}
            className="pressable flex h-14 w-full items-center rounded-2xl bg-chip px-4 font-semibold disabled:opacity-50"
          >
            Export all lists (.json)
          </button>
          <button onClick={() => (setMenu(false), fileRef.current?.click())} className="pressable flex h-14 w-full items-center rounded-2xl bg-chip px-4 font-semibold">
            Import from backup
          </button>
        </div>
      </Sheet>
    </main>
  );
}

function ListCard({ list }: { list: Wishlist }) {
  const totals = listTotals(list);
  const cover = list.images[0]?.src;
  const thumbs = list.items.filter((i) => i.image).slice(0, 4);
  return (
    <Link href={`/list/${list.id}`} className="pressable block overflow-hidden rounded-card bg-card">
      <div className="relative aspect-square bg-gradient-to-br from-accent-soft to-chip">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : thumbs.length > 0 ? (
          <div className={`grid size-full gap-0.5 ${thumbs.length > 1 ? "grid-cols-2" : ""} ${thumbs.length > 2 ? "grid-rows-2" : ""}`}>
            {thumbs.map((t, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={t.id}
                src={t.image}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className={`size-full min-h-0 object-cover ${thumbs.length === 3 && i === 0 ? "row-span-2" : ""}`}
              />
            ))}
          </div>
        ) : (
          <div className="grid size-full place-items-center text-5xl">{list.emoji}</div>
        )}
      </div>
      <div className="p-3">
        <h2 className="truncate leading-tight font-bold">
          <span className="mr-1">{list.emoji}</span>
          {list.name}
        </h2>
        <p className="mt-0.5 truncate text-xs text-muted">
          {list.items.length} item{list.items.length === 1 ? "" : "s"}
          {totals.total > 0 && ` · ${formatMoney(totals.total, list.currency, { compact: true })}`}
        </p>
      </div>
    </Link>
  );
}

function AllItems({ lists, onOpen }: { lists: Wishlist[]; onOpen: (item: Item, listId: string) => void }) {
  const [filter, setFilter] = useState(ALL);
  const [query, setQuery] = useState("");
  const all = useMemo(
    () => lists.flatMap((l) => l.items.map((item) => ({ item, list: l }))).sort((a, b) => b.item.createdAt - a.item.createdAt),
    [lists],
  );
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    all.forEach(({ item }) => counts.set(item.category, (counts.get(item.category) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [all]);
  const q = query.trim().toLowerCase();
  const shown = all.filter(({ item }) => {
    if (filter === FAVS && !item.favorite) return false;
    if (filter === SALE && !priceDrop(item)) return false;
    if (filter !== ALL && filter !== FAVS && filter !== SALE && item.category !== filter) return false;
    return !q || [item.title, item.brand, item.store, item.color, item.notes].some((s) => s?.toLowerCase().includes(q));
  });

  if (!all.length) {
    return <p className="py-16 text-center text-sm text-muted">No items yet — open a list and paste some links.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <input
          className="w-full rounded-full bg-card py-3 pr-4 pl-11 outline-none placeholder:text-muted/70 focus:ring-4 focus:ring-accent/15"
          placeholder="Search brand, item, colour…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <Chip active={filter === ALL} onClick={() => setFilter(ALL)}>
          All
        </Chip>
        {all.some(({ item }) => item.favorite) && (
          <Chip active={filter === FAVS} onClick={() => setFilter(FAVS)}>
            ♥ Must-haves
          </Chip>
        )}
        {all.some(({ item }) => priceDrop(item)) && (
          <Chip active={filter === SALE} onClick={() => setFilter(SALE)}>
            🏷️ On sale
          </Chip>
        )}
        {categories.map((c) => (
          <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
            {categoryEmoji(c)} {c}
          </Chip>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Nothing matches.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map(({ item, list }) => (
            <ItemCard
              key={item.id}
              item={item}
              badge={`${list.emoji} ${list.name}`}
              onOpen={() => onOpen(item, list.id)}
              onToggleFavorite={() => void toggleFavorite(item.id, list.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-6 rounded-card bg-card p-6 text-center">
      <div className="mx-auto mb-4 grid size-20 place-items-center rounded-3xl bg-accent-soft text-accent">
        <HangerIcon width={40} height={40} />
      </div>
      <h2 className="text-xl font-extrabold">Build your wardrobe</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
        Stop juggling wishlists in every shop&apos;s app. Collect clothes from any store in your own lists — with prices, pictures and sale alerts.
      </p>
      <ol className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm">
        {["Create a list — Work clothes, Winter outfits…", "Paste product links from any shop", "See totals and spot price drops"].map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-chip text-xs font-bold">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <button
        onClick={onCreate}
        className="pressable mt-6 inline-flex h-13 items-center gap-2 rounded-full bg-accent px-7 font-semibold text-white shadow-lg shadow-accent/30"
      >
        <PlusIcon /> Create a list
      </button>
    </div>
  );
}
