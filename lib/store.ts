
"use client";
 
import { createStore, del, get, set, values } from "idb-keyval";
import { useCallback, useEffect, useState } from "react";
import type { Item, ScrapeResult, Wishlist } from "./types";
 
const db = typeof indexedDB !== "undefined" ? createStore("wardrobe", "lists") : undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
 
export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
 
export async function listLists(): Promise<Wishlist[]> {
  if (!db) return [];
  const all = await values<Wishlist>(db);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}
 
export async function getList(id: string): Promise<Wishlist | undefined> {
  if (!db) return undefined;
  return get<Wishlist>(id, db);
}
 
export async function saveList(list: Wishlist): Promise<void> {
  if (!db) return;
  await set(list.id, { ...list, updatedAt: Date.now() }, db);
  notify();
}
 
export async function deleteList(id: string): Promise<void> {
  if (!db) return;
  await del(id, db);
  notify();
}
 
/** Apply a mutation to a stored list and persist it. */
export async function updateList(id: string, fn: (l: Wishlist) => Wishlist): Promise<Wishlist | undefined> {
  const current = await getList(id);
  if (!current) return;
  const next = fn(current);
  await saveList(next);
  return next;
}
 
export function newList(input: Pick<Wishlist, "name" | "emoji" | "currency"> & Partial<Pick<Wishlist, "description" | "images">>): Wishlist {
  const now = Date.now();
  return { id: uid(), images: [], items: [], createdAt: now, updatedAt: now, ...input };
}
 
/** Insert or replace an item, moving it if it now belongs to a different list. */
export async function upsertItem(item: Item, toId: string, fromId?: string) {
  if (fromId && fromId !== toId) {
    await updateList(fromId, (l) => ({ ...l, items: l.items.filter((i) => i.id !== item.id) }));
  }
  await updateList(toId, (l) => {
    const exists = l.items.some((i) => i.id === item.id);
    return { ...l, items: exists ? l.items.map((i) => (i.id === item.id ? item : i)) : [item, ...l.items] };
  });
}
 
export async function removeItem(itemId: string, listId: string) {
  await updateList(listId, (l) => ({ ...l, items: l.items.filter((i) => i.id !== itemId) }));
}
 
export async function toggleFavorite(itemId: string, listId: string) {
  await updateList(listId, (l) => ({ ...l, items: l.items.map((i) => (i.id === itemId ? { ...i, favorite: !i.favorite } : i)) }));
}
 
/** Re-fetch every linked item in a list and record price changes. Returns how many got cheaper. */
export async function refreshPrices(listId: string, onProgress?: (done: number, total: number) => void): Promise<number> {
  const list = await getList(listId);
  if (!list) return 0;
  const linked = list.items.filter((i) => i.url);
  const fresh = new Map<string, ScrapeResult>();
  let done = 0;
  // A few at a time so one slow store doesn't hold everything up.
  const queue = [...linked];
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      for (let it = queue.shift(); it; it = queue.shift()) {
        try {
          const res = await fetch(`/api/scrape?url=${encodeURIComponent(it.url)}`);
          if (res.ok) fresh.set(it.id, await res.json());
        } catch {
          /* keep the old price */
        }
        onProgress?.(++done, linked.length);
      }
    }),
  );
  let cheaper = 0;
  await updateList(listId, (l) => ({
    ...l,
    items: l.items.map((it) => {
      const r = fresh.get(it.id);
      if (!r || r.price == null || (r.currency && r.currency !== it.currency)) return it;
      if (it.price != null && r.price < it.price) cheaper++;
      return withPrice(it, r.price, r.originalPrice);
    }),
  }));
  return cheaper;
}
 
/** Set a new price, remembering the previous one in the item's history. */
export function withPrice(item: Item, price: number | null, originalPrice?: number | null): Item {
  const history = [...(item.priceHistory ?? [])];
  if (item.price != null && !history.length) history.push({ price: item.price, at: item.createdAt });
  if (price != null && history[history.length - 1]?.price !== price) history.push({ price, at: Date.now() });
  return { ...item, price, originalPrice: originalPrice ?? null, priceHistory: history.slice(-30) };
}
 
export async function importLists(json: string): Promise<number> {
  const data = JSON.parse(json);
  const lists: Wishlist[] = Array.isArray(data) ? data : [data];
  let count = 0;
  for (const l of lists) {
    if (!l || typeof l.id !== "string" || typeof l.name !== "string" || !Array.isArray(l.items)) continue;
    await set(l.id, { ...l, emoji: l.emoji ?? "👕", images: l.images ?? [] }, db);
    count++;
  }
  notify();
  return count;
}
 
export function useLists() {
  const [lists, setLists] = useState<Wishlist[] | null>(null);
  useEffect(() => {
    const load = () => listLists().then(setLists);
    load();
    listeners.add(load);
    return () => void listeners.delete(load);
  }, []);
  return lists;
}
 
/** Live list + an `update` helper that applies a mutation and persists it. */
export function useList(id: string) {
  const [list, setList] = useState<Wishlist | null | undefined>(undefined);
  useEffect(() => {
    const load = () => getList(id).then((l) => setList(l ?? null));
    load();
    listeners.add(load);
    return () => void listeners.delete(load);
  }, [id]);
 
  const update = useCallback(
    async (fn: (l: Wishlist) => Wishlist) => {
      const next = await updateList(id, fn);
      if (next) setList(next);
    },
    [id],
  );
 
  return { list, update };
}
 
export async function downloadJson(data: unknown, name: string) {
  const filename = `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "wardrobe"}.json`;
  const file = new File([JSON.stringify(data)], filename, { type: "application/json" });
 
  // Only use the share sheet on phones/tablets; desktop gets a normal download.
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // user closed the share sheet
      // any other error: fall through to the download below
    }
  }
 
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
 
