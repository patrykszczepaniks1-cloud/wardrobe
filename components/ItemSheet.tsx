"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, DEFAULT_CATEGORY } from "@/lib/categories";
import { CURRENCIES, hostOf } from "@/lib/format";
import { uid } from "@/lib/store";
import type { Item, ItemStatus, ScrapeResult } from "@/lib/types";
import { Field, inputCls, primaryBtn, Sheet } from "./Sheet";
import { CheckIcon, LinkIcon, SparkIcon } from "./icons";

export const STATUS_LABEL: Record<ItemStatus, string> = {
  wanted: "Wishlist",
  ordered: "Ordered",
  owned: "Owned",
};

export interface ListOption {
  id: string;
  name: string;
  emoji: string;
  currency: string;
}

type Draft = Omit<Item, "id" | "createdAt" | "price" | "originalPrice"> & { price: string; originalPrice: number | null };

function toDraft(it: Partial<Item>, currency: string): Draft {
  return {
    url: it.url ?? "",
    title: it.title ?? "",
    brand: it.brand,
    price: it.price != null ? String(it.price) : "",
    originalPrice: it.originalPrice ?? null,
    currency: it.currency ?? currency,
    image: it.image,
    store: it.store,
    category: it.category ?? DEFAULT_CATEGORY,
    size: it.size,
    color: it.color,
    status: it.status ?? "wanted",
    favorite: it.favorite,
    notes: it.notes,
    priceHistory: it.priceHistory,
  };
}

const findLinks = (text: string) => Array.from(new Set(text.match(/https?:\/\/[^\s<>"']+/g) ?? []));

async function fetchProduct(url: string): Promise<ScrapeResult> {
  const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
  const data = (await res.json()) as ScrapeResult & { error?: string };
  if (!res.ok || data.error) throw new Error(data.error || "Could not read that page");
  return data;
}

/** Build an item straight from scraped data (used when adding several links at once). */
function itemFromScrape(url: string, data: ScrapeResult | null, currency: string, category?: string): Item {
  return {
    id: uid(),
    createdAt: Date.now(),
    url: data?.url || url,
    title: data?.title || hostOf(url),
    brand: data?.brand ?? undefined,
    price: data?.price ?? null,
    originalPrice: data?.originalPrice ?? null,
    currency: data?.currency ?? currency,
    image: data?.image ?? undefined,
    store: data?.store ?? hostOf(url),
    category: (category !== DEFAULT_CATEGORY && category) || data?.suggestedCategory || DEFAULT_CATEGORY,
    status: "wanted",
  };
}

/**
 * Add or edit an item. In "add" mode it starts with a link field and scrapes the product page.
 * Pasting several links adds them all in one go.
 */
export function ItemSheet({
  open,
  onClose,
  onSave,
  onSaveMany,
  onDelete,
  item,
  lists,
  listId,
  categories,
  initialUrl,
  defaultCategory,
}: {
  open: boolean;
  onClose: () => void;
  /** `listId` is the list the item should end up in (it may have been moved). */
  onSave: (item: Item, listId: string) => void;
  onSaveMany: (items: Item[], listId: string) => void;
  onDelete?: () => void;
  item?: Item;
  lists: ListOption[];
  listId: string;
  categories: string[];
  initialUrl?: string;
  defaultCategory?: string;
}) {
  const editing = !!item;
  const [target, setTarget] = useState(listId);
  const currency = lists.find((l) => l.id === target)?.currency ?? "EUR";
  const [step, setStep] = useState<"link" | "details">(editing ? "details" : "link");
  const [link, setLink] = useState(initialUrl ?? "");
  const [draft, setDraft] = useState<Draft>(() => toDraft(item ?? { category: defaultCategory }, currency));
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customCat, setCustomCat] = useState("");
  const [extraCats, setExtraCats] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const cur = lists.find((l) => l.id === listId)?.currency ?? "EUR";
    setTarget(listId);
    setStep(item ? "details" : "link");
    setDraft(toDraft(item ?? { category: defaultCategory }, cur));
    setImages(item?.image ? [item.image] : []);
    setLink(initialUrl ?? "");
    setError(null);
    setProgress(null);
    setCustomCat("");
    if (!item && initialUrl) void scrape(initialUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, initialUrl]);

  const links = findLinks(link);

  async function scrape(input: string) {
    const found = findLinks(input);
    if (found.length > 1) return addMany(found);
    const url = found[0] ?? input.trim();
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProduct(url);
      setDraft((d) => ({
        ...d,
        url: data.url || url,
        title: data.title ?? "",
        brand: data.brand ?? undefined,
        price: data.price != null ? String(data.price) : "",
        originalPrice: data.originalPrice,
        currency: data.currency ?? d.currency,
        image: data.image ?? undefined,
        store: data.store ?? hostOf(url),
        category: data.suggestedCategory && d.category === (defaultCategory ?? DEFAULT_CATEGORY) ? data.suggestedCategory : d.category,
      }));
      setImages(data.images);
      setStep("details");
    } catch (e) {
      setError((e as Error).message);
      setDraft((d) => ({ ...d, url, store: hostOf(url) }));
    } finally {
      setLoading(false);
    }
  }

  async function addMany(urls: string[]) {
    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: urls.length });
    const results: Item[] = new Array(urls.length);
    const queue = urls.map((u, i) => [u, i] as const);
    let failed = 0;
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const [url, i] = next;
          const data = await fetchProduct(url).catch(() => (failed++, null));
          results[i] = itemFromScrape(url, data, currency, defaultCategory);
          setProgress((p) => p && { ...p, done: p.done + 1 });
        }
      }),
    );
    setLoading(false);
    onSaveMany(results, target);
    if (failed) alert(`${failed} of ${urls.length} links couldn't be read — they were added with just the link. Tap them to fill in the details.`);
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setLink(text);
      if (findLinks(text).length) void scrape(text);
    } catch {
      setError("Clipboard access was blocked — long-press the field and paste instead.");
    }
  }

  function save() {
    const price = draft.price.trim() ? Number(draft.price.replace(",", ".")) : null;
    const validPrice = price != null && Number.isFinite(price) ? price : null;
    onSave(
      {
        id: item?.id ?? uid(),
        createdAt: item?.createdAt ?? Date.now(),
        ...draft,
        title: draft.title.trim() || hostOf(draft.url) || "Untitled item",
        brand: draft.brand?.trim() || undefined,
        price: validPrice,
        // A manually changed price invalidates the store's "was" price.
        originalPrice: validPrice != null && draft.originalPrice != null && draft.originalPrice > validPrice ? draft.originalPrice : null,
        size: draft.size?.trim() || undefined,
        color: draft.color?.trim() || undefined,
        notes: draft.notes?.trim() || undefined,
      },
      target,
    );
  }

  const allCats = Array.from(new Set([...CATEGORIES.map((c) => c.name), ...categories, ...extraCats, draft.category]));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit item" : step === "link" ? "Add to wardrobe" : "Item details"}
      footer={
        step === "details" ? (
          <div className="flex gap-2">
            {onDelete && (
              <button onClick={onDelete} className="pressable h-13 rounded-full px-5 font-semibold text-red-500">
                Delete
              </button>
            )}
            <button className={primaryBtn} onClick={save}>
              <CheckIcon /> {editing ? "Save changes" : "Add to list"}
            </button>
          </div>
        ) : undefined
      }
    >
      {step === "link" ? (
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted">
            Paste a product link from any shop — Zalando, ASOS, H&amp;M, Nike, Shopify stores… We&apos;ll grab the name, price and
            pictures. Paste several links at once to add them all.
          </p>
          {lists.length > 1 && <ListPicker lists={lists} value={target} onChange={setTarget} />}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void scrape(link);
            }}
            className="space-y-3"
          >
            <div className="relative">
              <LinkIcon className="pointer-events-none absolute top-4 left-4 text-muted" />
              <textarea
                className={`${inputCls} min-h-[3.25rem] resize-none pl-11`}
                rows={links.length > 1 ? 4 : 1}
                inputMode="url"
                autoFocus
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="https://shop.com/product…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && links.length <= 1) {
                    e.preventDefault();
                    void scrape(link);
                  }
                }}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={pasteFromClipboard} className="pressable h-13 shrink-0 rounded-full bg-chip px-5 font-semibold">
                Paste
              </button>
              <button className={primaryBtn} disabled={!link.trim() || loading}>
                {loading ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    {progress ? `Fetching ${progress.done}/${progress.total}…` : "Fetching…"}
                  </>
                ) : (
                  <>
                    <SparkIcon /> {links.length > 1 ? `Add ${links.length} items` : "Fetch details"}
                  </>
                )}
              </button>
            </div>
          </form>
          {error && (
            <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
              <p className="font-semibold">{error}</p>
              <p className="mt-1 opacity-80">Some shops block automatic reading. You can fill in the details yourself.</p>
            </div>
          )}
          <button onClick={() => setStep("details")} className="w-full py-2 text-sm font-semibold text-accent-ink">
            Enter details manually
          </button>
        </div>
      ) : (
        <div className="space-y-5 pt-1">
          {(images.length > 0 || draft.image) && (
            <div>
              <div className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
                {(images.length ? images : [draft.image!]).map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => set("image", src)}
                    className={`relative aspect-[3/4] w-28 shrink-0 snap-start overflow-hidden rounded-2xl bg-white ring-2 ${draft.image === src ? "ring-accent" : "ring-transparent"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
                    {draft.image === src && images.length > 1 && (
                      <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-accent text-white">
                        <CheckIcon width={14} height={14} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {images.length > 1 && <p className="mt-1.5 text-xs text-muted">Tap to choose the picture</p>}
            </div>
          )}

          <Field label="Name">
            <textarea className={`${inputCls} resize-none`} rows={2} value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Wool overcoat" />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Brand">
              <input className={inputCls} value={draft.brand ?? ""} onChange={(e) => set("brand", e.target.value)} placeholder="Brand" />
            </Field>
            <Field label="Store">
              <input className={inputCls} value={draft.store ?? ""} onChange={(e) => set("store", e.target.value)} placeholder="Store" />
            </Field>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field label="Price" hint={draft.originalPrice ? `On sale — was ${draft.originalPrice}` : undefined}>
              <input className={inputCls} inputMode="decimal" value={draft.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Currency">
              <select className={`${inputCls} pr-8`} value={draft.currency} onChange={(e) => set("currency", e.target.value)}>
                {Array.from(new Set([draft.currency, ...CURRENCIES])).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Size">
              <input className={inputCls} value={draft.size ?? ""} onChange={(e) => set("size", e.target.value)} placeholder="M, 32/32, 43…" />
            </Field>
            <Field label="Colour">
              <input className={inputCls} value={draft.color ?? ""} onChange={(e) => set("color", e.target.value)} placeholder="Navy" />
            </Field>
          </div>

          <Field label="Category" group>
            <div className="flex flex-wrap gap-2">
              {allCats.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => set("category", c)}
                  className={`pressable rounded-full px-3.5 py-2 text-sm font-medium ${draft.category === c ? "bg-accent text-white" : "bg-chip text-ink"}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input className={`${inputCls} py-2.5`} placeholder="New category…" value={customCat} onChange={(e) => setCustomCat(e.target.value)} />
              <button
                type="button"
                disabled={!customCat.trim()}
                onClick={() => {
                  set("category", customCat.trim());
                  setExtraCats((c) => [...c, customCat.trim()]);
                  setCustomCat("");
                }}
                className="pressable shrink-0 rounded-2xl bg-chip px-4 font-semibold disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </Field>

          {lists.length > 1 && (
            <Field label="List" group>
              <ListPicker lists={lists} value={target} onChange={setTarget} />
            </Field>
          )}

          <Field label="Status" group>
            <div className="grid grid-cols-3 gap-1 rounded-full bg-chip p-1">
              {(Object.keys(STATUS_LABEL) as ItemStatus[]).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => set("status", s)}
                  className={`rounded-full py-2.5 text-sm font-semibold transition ${draft.status === s ? "bg-accent text-white shadow" : "text-muted"}`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Link">
            <input className={inputCls} type="url" inputMode="url" autoCapitalize="off" value={draft.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" />
          </Field>
          <Field label="Image URL">
            <input className={inputCls} type="url" inputMode="url" autoCapitalize="off" value={draft.image ?? ""} onChange={(e) => set("image", e.target.value || undefined)} placeholder="https://…jpg" />
          </Field>
          <Field label="Notes">
            <textarea className={`${inputCls} resize-none`} rows={3} value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Fit, discount code, wear it with…" />
          </Field>
        </div>
      )}
    </Sheet>
  );
}

function ListPicker({ lists, value, onChange }: { lists: ListOption[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
      {lists.map((l) => (
        <button
          type="button"
          key={l.id}
          onClick={() => onChange(l.id)}
          className={`pressable shrink-0 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap ${value === l.id ? "bg-accent text-white" : "bg-chip text-ink"}`}
        >
          {l.emoji} {l.name}
        </button>
      ))}
    </div>
  );
}
