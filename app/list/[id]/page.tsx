"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { Chip } from "@/components/Chip";
import { AddImagesSheet, InspirationGrid, Lightbox } from "@/components/Gallery";
import { BackIcon, ImageIcon, MoreIcon, PlusIcon, RefreshIcon, ShareIcon } from "@/components/icons";
import { ItemCard } from "@/components/ItemCard";
import { ItemSheet } from "@/components/ItemSheet";
import { ListSheet } from "@/components/ListSheet";
import { Sheet } from "@/components/Sheet";
import { TotalsCard } from "@/components/TotalsCard";
import { categoryEmoji } from "@/lib/categories";
import { formatMoney, listTotals, priceDrop } from "@/lib/format";
import { deleteList, downloadJson, refreshPrices, removeItem, upsertItem, useList, useLists } from "@/lib/store";
import type { Item, Wishlist } from "@/lib/types";

const ALL = "__all";
const FAVS = "__favs";
const SALE = "__sale";

export default function ListPage() {
  return (
    <Suspense>
      <ListView />
    </Suspense>
  );
}

function ListView() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { list, update } = useList(id);
  const lists = useLists();

  const [tab, setTab] = useState<"items" | "moodboard">("items");
  const [filter, setFilter] = useState(ALL);
  const [itemSheet, setItemSheet] = useState<{ item?: Item; url?: string } | null>(() => {
    const url = search.get("add");
    return url ? { url } : null;
  });
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [addImages, setAddImages] = useState(false);
  const [editList, setEditList] = useState(false);
  const [menu, setMenu] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const closeLightbox = useCallback(() => setLightbox(null), []);
  const closeItemSheet = useCallback(() => {
    setItemSheet(null);
    if (search.get("add")) router.replace(`/list/${id}`);
  }, [id, router, search]);

  const listOptions = useMemo(() => lists?.map(({ id, name, emoji, currency }) => ({ id, name, emoji, currency })) ?? [], [lists]);
  const categories = useMemo(() => Array.from(new Set(list?.items.map((p) => p.category) ?? [])), [list]);
  const filtered = useMemo(() => {
    if (!list) return [];
    if (filter === FAVS) return list.items.filter((p) => p.favorite);
    if (filter === SALE) return list.items.filter((p) => priceDrop(p));
    if (filter === ALL) return list.items;
    return list.items.filter((p) => p.category === filter);
  }, [list, filter]);

  if (list === undefined) return <div className="h-dvh" />;
  if (list === null)
    return (
      <main className="grid h-dvh place-items-center p-6 text-center">
        <div>
          <p className="font-semibold">This list doesn&apos;t exist on this device.</p>
          <Link href="/" className="mt-4 inline-block font-semibold text-accent-ink">
            Back to wardrobe
          </Link>
        </div>
      </main>
    );

  const totals = listTotals(list);
  const cover = list.images[0]?.src;
  const onSale = list.items.some((p) => priceDrop(p));

  async function runRefresh() {
    setMenu(false);
    setRefreshing("Checking prices…");
    const cheaper = await refreshPrices(id, (done, total) => setRefreshing(`Checking prices ${done}/${total}…`));
    setRefreshing(null);
    alert(cheaper ? `${cheaper} item${cheaper === 1 ? " got" : "s got"} cheaper! 🎉` : "Prices are up to date — no drops this time.");
  }

  return (
    <main className="mx-auto max-w-3xl pb-36">
      {/* Hero */}
      <div className="relative">
        <button
          onClick={() => (list.images.length ? setLightbox(0) : setAddImages(true))}
          className="relative block aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-accent to-[#ff9a6b] sm:mt-4 sm:rounded-card"
          aria-label={list.images.length ? "View photos" : "Add photos"}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3 text-white/90">
              <span className="text-6xl">{list.emoji}</span>
              <span className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur">Add a cover or outfit inspo</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />
        </button>

        <div className="pt-safe absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-3">
          <Link href="/" className="pressable grid size-11 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md" aria-label="Back">
            <BackIcon />
          </Link>
          <button onClick={() => setMenu(true)} className="pressable grid size-11 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md" aria-label="List options">
            <MoreIcon />
          </button>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 pb-9 text-white">
          <div className="min-w-0">
            <h1 className="text-2xl leading-tight font-extrabold tracking-tight">
              {cover && <span className="mr-1.5">{list.emoji}</span>}
              {list.name}
            </h1>
            {list.description && <p className="line-clamp-2 text-sm font-medium opacity-85">{list.description}</p>}
          </div>
          {list.images.length > 0 && (
            <span className="shrink-0 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold backdrop-blur">
              <ImageIcon width={14} height={14} className="mr-1 inline -translate-y-px" />
              {list.images.length}
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 -mt-5 space-y-4 px-4">
        <TotalsCard totals={totals} onCategory={(c) => (setTab("items"), setFilter(c))} />

        {refreshing && (
          <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 text-sm font-semibold">
            <span className="size-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" /> {refreshing}
          </div>
        )}

        {/* Tabs */}
        <div className="sticky top-0 z-20 -mx-4 bg-bg/85 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur-lg">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-card p-1">
            {(
              [
                ["items", `Items · ${list.items.length}`],
                ["moodboard", `Moodboard · ${list.images.length}`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-full py-2.5 text-sm font-semibold transition ${tab === k ? "bg-accent text-white shadow" : "text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "items" && list.items.length > 0 && (
            <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
              <Chip active={filter === ALL} onClick={() => setFilter(ALL)}>
                All
              </Chip>
              {list.items.some((p) => p.favorite) && (
                <Chip active={filter === FAVS} onClick={() => setFilter(FAVS)}>
                  ♥ Must-haves
                </Chip>
              )}
              {onSale && (
                <Chip active={filter === SALE} onClick={() => setFilter(SALE)}>
                  🏷️ On sale
                </Chip>
              )}
              {categories.map((c) => (
                <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          )}
        </div>

        {tab === "items" ? (
          list.items.length === 0 ? (
            <button
              onClick={() => setItemSheet({})}
              className="pressable flex w-full flex-col items-center gap-2 rounded-card border-2 border-dashed border-line px-6 py-10 text-center"
            >
              <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
                <PlusIcon width={26} height={26} />
              </span>
              <span className="font-bold">Add your first item</span>
              <span className="max-w-xs text-sm text-muted">Paste a link from any shop — jeans, a jacket, sneakers… We&apos;ll fetch the name, price and photo.</span>
            </button>
          ) : filter === ALL ? (
            <GroupedItems list={list} onOpen={(p) => setItemSheet({ item: p })} onFav={toggleFav} />
          ) : (
            <ItemGrid items={filtered} onOpen={(p) => setItemSheet({ item: p })} onFav={toggleFav} />
          )
        ) : (
          <InspirationGrid images={list.images} onOpen={setLightbox} onAdd={() => setAddImages(true)} />
        )}
      </div>

      {/* Floating action */}
      <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4">
        <button
          onClick={() => (tab === "items" ? setItemSheet({}) : setAddImages(true))}
          className="pressable pointer-events-auto mb-2 inline-flex h-14 items-center gap-2 rounded-full bg-accent px-7 font-semibold text-white shadow-xl shadow-accent/35"
        >
          <PlusIcon /> {tab === "items" ? "Add item" : "Add photos"}
        </button>
      </div>

      <ItemSheet
        open={!!itemSheet}
        onClose={closeItemSheet}
        item={itemSheet?.item}
        initialUrl={itemSheet?.url}
        lists={listOptions.length ? listOptions : [{ id: list.id, name: list.name, emoji: list.emoji, currency: list.currency }]}
        listId={list.id}
        categories={categories}
        defaultCategory={filter !== ALL && filter !== FAVS && filter !== SALE ? filter : undefined}
        onSave={async (item, to) => {
          await upsertItem(item, to, list.id);
          closeItemSheet();
        }}
        onSaveMany={async (items, to) => {
          for (const it of items) await upsertItem(it, to);
          closeItemSheet();
        }}
        onDelete={
          itemSheet?.item
            ? async () => {
                if (!confirm("Remove this item from the list?")) return;
                await removeItem(itemSheet.item!.id, list.id);
                closeItemSheet();
              }
            : undefined
        }
      />

      <AddImagesSheet
        open={addImages}
        onClose={() => setAddImages(false)}
        onAdd={(imgs) => void update((l) => ({ ...l, images: [...l.images, ...imgs] }))}
      />

      <Lightbox
        images={list.images}
        index={lightbox}
        onClose={closeLightbox}
        onDelete={(imgId) => void update((l) => ({ ...l, images: l.images.filter((i) => i.id !== imgId) }))}
        onMakeCover={(imgId) => {
          void update((l) => {
            const img = l.images.find((i) => i.id === imgId)!;
            return { ...l, images: [img, ...l.images.filter((i) => i.id !== imgId)] };
          });
          setLightbox(0);
        }}
      />

      <ListSheet
        open={editList}
        list={list}
        onClose={() => setEditList(false)}
        onSave={(input) => {
          void update((l) => ({ ...l, ...input }));
          setEditList(false);
        }}
        onDelete={async () => {
          if (!confirm(`Delete "${list.name}" and all its items?`)) return;
          await deleteList(list.id);
          router.replace("/");
        }}
      />

      <Sheet open={menu} onClose={() => setMenu(false)} title="List options">
        <div className="space-y-2 pb-4">
          <MenuItem onClick={() => void runRefresh()} disabled={!!refreshing || !list.items.some((i) => i.url)}>
            <RefreshIcon width={18} height={18} /> Check prices for sales
          </MenuItem>
          <MenuItem onClick={() => (setMenu(false), setEditList(true))}>Edit list</MenuItem>
          <MenuItem onClick={() => (setMenu(false), setAddImages(true))}>Add moodboard photos</MenuItem>
          <MenuItem onClick={() => (setMenu(false), void shareText(list))}>
            <ShareIcon width={18} height={18} /> Share list
          </MenuItem>
          <MenuItem onClick={() => (setMenu(false), void downloadJson(list, list.name))}>Export backup (.json)</MenuItem>
        </div>
      </Sheet>
    </main>
  );

  function toggleFav(p: Item) {
    void update((l) => ({ ...l, items: l.items.map((x) => (x.id === p.id ? { ...x, favorite: !x.favorite } : x)) }));
  }
}

function MenuItem({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="pressable flex h-14 w-full items-center gap-2 rounded-2xl bg-chip px-4 text-left font-semibold disabled:opacity-50">
      {children}
    </button>
  );
}

function ItemGrid({ items, onOpen, onFav }: { items: Item[]; onOpen: (p: Item) => void; onFav: (p: Item) => void }) {
  if (!items.length) return <p className="py-10 text-center text-sm text-muted">Nothing here yet.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((p) => (
        <ItemCard key={p.id} item={p} onOpen={() => onOpen(p)} onToggleFavorite={() => onFav(p)} />
      ))}
    </div>
  );
}

function GroupedItems({ list, onOpen, onFav }: { list: Wishlist; onOpen: (p: Item) => void; onFav: (p: Item) => void }) {
  const groups = listTotals(list).byCategory;
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.category}>
          <div className="mb-2.5 flex items-baseline justify-between px-1">
            <h3 className="font-bold">
              <span className="mr-1.5">{categoryEmoji(g.category)}</span>
              {g.category}
              <span className="ml-1.5 text-sm font-medium text-muted">{g.count}</span>
            </h3>
            <span className="text-sm font-semibold text-muted">{g.total ? formatMoney(g.total, list.currency, { compact: true }) : "—"}</span>
          </div>
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
            {list.items
              .filter((p) => p.category === g.category)
              .map((p) => (
                <div key={p.id} className="w-[44%] shrink-0 snap-start sm:w-[30%]">
                  <ItemCard item={p} onOpen={() => onOpen(p)} onToggleFavorite={() => onFav(p)} />
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function listAsText(l: Wishlist) {
  const t = listTotals(l);
  const lines = [`${l.emoji} ${l.name}`, ""];
  for (const g of t.byCategory) {
    lines.push(`${categoryEmoji(g.category)} ${g.category}`);
    for (const p of l.items.filter((x) => x.category === g.category)) {
      const price = p.price != null ? formatMoney(p.price, p.currency) : "—";
      const name = [p.brand, p.title].filter(Boolean).join(" ");
      const extra = [p.size && `size ${p.size}`, p.color].filter(Boolean).join(", ");
      lines.push(`• ${name}${extra ? ` (${extra})` : ""} — ${price}${p.url ? `\n  ${p.url}` : ""}`);
    }
    lines.push("");
  }
  lines.push(`Total: ${formatMoney(t.total, l.currency)}`);
  return lines.join("\n");
}

async function shareText(l: Wishlist) {
  const text = listAsText(l);
  try {
    if (navigator.share) return await navigator.share({ title: l.name, text });
    await navigator.clipboard.writeText(text);
    alert("List copied to clipboard");
  } catch {
    /* user cancelled */
  }
}
