"use client";

import { useEffect, useState } from "react";
import { LIST_EMOJIS, LIST_TEMPLATES } from "@/lib/categories";
import { CURRENCIES } from "@/lib/format";
import type { GalleryImage, Wishlist } from "@/lib/types";
import { usePhotoPicker } from "./Gallery";
import { ImageIcon } from "./icons";
import { Field, inputCls, primaryBtn, Sheet } from "./Sheet";

export interface ListInput {
  name: string;
  emoji: string;
  currency: string;
  description?: string;
  images: GalleryImage[];
}

export function ListSheet({
  open,
  onClose,
  onSave,
  onDelete,
  list,
  existing = [],
}: {
  open: boolean;
  onClose: () => void;
  onSave: (l: ListInput) => void;
  onDelete?: () => void;
  list?: Wishlist;
  /** Names already in use, so templates for them are hidden */
  existing?: string[];
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(LIST_EMOJIS[0]);
  const [currency, setCurrency] = useState("EUR");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<GalleryImage[]>([]);
  const picker = usePhotoPicker((imgs) => setImages((cur) => [...cur, ...imgs]));

  useEffect(() => {
    if (!open) return;
    setName(list?.name ?? "");
    setEmoji(list?.emoji ?? LIST_EMOJIS[0]);
    setCurrency(list?.currency ?? guessCurrency());
    setDescription(list?.description ?? "");
    setImages(list?.images ?? []);
  }, [open, list]);

  const templates = LIST_TEMPLATES.filter((t) => !existing.some((n) => n.toLowerCase() === t.name.toLowerCase()));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={list ? "Edit list" : "New list"}
      footer={
        <div className="flex gap-2">
          {onDelete && (
            <button onClick={onDelete} className="pressable h-13 rounded-full px-5 font-semibold text-red-500">
              Delete
            </button>
          )}
          <button
            className={primaryBtn}
            disabled={!name.trim()}
            onClick={() => onSave({ name: name.trim(), emoji, currency, description: description.trim() || undefined, images })}
          >
            {list ? "Save" : "Create list"}
          </button>
        </div>
      }
    >
      {picker.input}
      <div className="space-y-5 pt-1">
        {!list && templates.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-muted">Quick start</p>
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => (setName(t.name), setEmoji(t.emoji))}
                  className={`pressable rounded-full px-3.5 py-2 text-sm font-medium ${name === t.name ? "bg-accent text-white" : "bg-chip"}`}
                >
                  {t.emoji} {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <Field label="Name">
          <div className="flex gap-2">
            <span className="grid size-[3.25rem] shrink-0 place-items-center rounded-2xl bg-accent-soft text-2xl">{emoji}</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Work clothes, Winter outfits…" />
          </div>
        </Field>
        <Field label="Icon" group>
          <div className="flex flex-wrap gap-1.5">
            {LIST_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-label={e}
                className={`pressable grid size-10 place-items-center rounded-xl text-xl ${emoji === e ? "bg-accent-soft ring-2 ring-accent" : "bg-chip"}`}
              >
                {e}
              </button>
            ))}
          </div>
        </Field>
        <button
          type="button"
          onClick={picker.pick}
          className="pressable relative flex aspect-[16/7] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border-2 border-dashed border-line bg-chip text-muted"
        >
          {images[0] ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[0].src} alt="" className="absolute inset-0 size-full object-cover" />
              <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                {images.length > 1 ? `+${images.length - 1} more · ` : ""}Add more
              </span>
            </>
          ) : (
            <>
              <ImageIcon width={28} height={28} />
              <span className="text-sm font-semibold">{picker.busy ? "Processing…" : "Cover / moodboard photos (optional)"}</span>
            </>
          )}
        </button>
        <Field label="Currency" hint="Totals are calculated in this currency.">
          <select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <textarea className={`${inputCls} resize-none`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="The vibe, the budget, the occasion…" />
        </Field>
      </div>
    </Sheet>
  );
}

export function guessCurrency() {
  if (typeof navigator === "undefined") return "EUR";
  const region = navigator.language.split("-")[1]?.toUpperCase();
  const map: Record<string, string> = { US: "USD", GB: "GBP", PL: "PLN", SE: "SEK", NO: "NOK", DK: "DKK", CH: "CHF", CZ: "CZK", CA: "CAD", AU: "AUD" };
  return (region && map[region]) || "EUR";
}
