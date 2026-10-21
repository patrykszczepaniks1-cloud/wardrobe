"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { compressImage } from "@/lib/image";
import { uid } from "@/lib/store";
import type { GalleryImage } from "@/lib/types";
import { CloseIcon, ImageIcon, LinkIcon, PlusIcon, TrashIcon } from "./icons";
import { inputCls, primaryBtn, Sheet } from "./Sheet";

/** Hidden file input that compresses and returns picked photos. */
export function usePhotoPicker(onPicked: (imgs: GalleryImage[]) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={async (e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (!files.length) return;
        setBusy(true);
        try {
          const imgs = await Promise.all(files.map(async (f) => ({ id: uid(), src: await compressImage(f) })));
          onPicked(imgs);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
  return { input, pick: () => ref.current?.click(), busy };
}

export function AddImagesSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (imgs: GalleryImage[]) => void }) {
  const [url, setUrl] = useState("");
  const picker = usePhotoPicker((imgs) => {
    onAdd(imgs);
    onClose();
  });
  return (
    <Sheet open={open} onClose={onClose} title="Add to moodboard">
      {picker.input}
      <div className="space-y-4 pt-1 pb-2">
        <button onClick={picker.pick} disabled={picker.busy} className={primaryBtn}>
          <ImageIcon /> {picker.busy ? "Processing…" : "Choose photos"}
        </button>
        <div className="flex items-center gap-3 text-xs font-semibold text-muted uppercase">
          <div className="h-px flex-1 bg-line" /> or paste an image link <div className="h-px flex-1 bg-line" />
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^https?:\/\//.test(url.trim())) return;
            onAdd([{ id: uid(), src: url.trim() }]);
            setUrl("");
            onClose();
          }}
        >
          <div className="relative flex-1">
            <LinkIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
            <input
              className={`${inputCls} pl-11`}
              type="url"
              inputMode="url"
              autoCapitalize="off"
              placeholder="https://…/photo.jpg"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <button className="pressable shrink-0 rounded-2xl bg-chip px-5 font-semibold" disabled={!url.trim()}>
            Add
          </button>
        </form>
        <p className="text-xs text-muted">Tip: save outfit screenshots from Instagram or Pinterest and add them here.</p>
      </div>
    </Sheet>
  );
}

/** Swipeable full-screen viewer. */
export function Lightbox({
  images,
  index,
  onClose,
  onDelete,
  onMakeCover,
}: {
  images: GalleryImage[];
  index: number | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onMakeCover?: (id: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(index ?? 0);

  useEffect(() => {
    if (index == null) return;
    setCurrent(index);
    const el = scroller.current;
    if (el) el.scrollTo({ left: index * el.clientWidth, behavior: "instant" as ScrollBehavior });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") el?.scrollBy({ left: el.clientWidth, behavior: "smooth" });
      if (e.key === "ArrowLeft") el?.scrollBy({ left: -el.clientWidth, behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [index, onClose]);

  if (index == null || typeof document === "undefined") return null;
  const img = images[current];

  return createPortal(
    <div className="animate-fade fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="pt-safe flex items-center justify-between px-3 py-2">
        <button onClick={onClose} className="grid size-11 place-items-center rounded-full bg-white/10" aria-label="Close">
          <CloseIcon />
        </button>
        <span className="text-sm font-semibold tabular-nums opacity-80">
          {current + 1} / {images.length}
        </span>
        <div className="flex gap-2">
          {onMakeCover && current !== 0 && img && (
            <button onClick={() => onMakeCover(img.id)} className="h-11 rounded-full bg-white/10 px-4 text-sm font-semibold">
              Set as cover
            </button>
          )}
          {onDelete && img && (
            <button
              onClick={() => {
                if (!confirm("Remove this photo?")) return;
                onDelete(img.id);
                if (images.length <= 1) onClose();
                else setCurrent((c) => Math.min(c, images.length - 2));
              }}
              className="grid size-11 place-items-center rounded-full bg-white/10"
              aria-label="Delete photo"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>
      <div
        ref={scroller}
        className="no-scrollbar flex flex-1 snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          setCurrent(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {images.map((im) => (
          <div key={im.id} className="grid w-full shrink-0 snap-center place-items-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.src} alt={im.caption ?? ""} referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
          </div>
        ))}
      </div>
      <div className="pb-safe flex justify-center gap-1.5 pt-3">
        {images.map((im, i) => (
          <span key={im.id} className={`h-1.5 rounded-full transition-all ${i === current ? "w-5 bg-white" : "w-1.5 bg-white/40"}`} />
        ))}
      </div>
    </div>,
    document.body,
  );
}

/** Masonry-ish inspiration grid with an "add" tile. */
export function InspirationGrid({ images, onOpen, onAdd }: { images: GalleryImage[]; onOpen: (i: number) => void; onAdd: () => void }) {
  return (
    <div className="columns-2 gap-3 sm:columns-3 [&>*]:mb-3">
      {images.map((img, i) => (
        <button key={img.id} onClick={() => onOpen(i)} className="pressable block w-full break-inside-avoid overflow-hidden rounded-2xl bg-chip">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.src} alt="" loading="lazy" referrerPolicy="no-referrer" className="block w-full" />
        </button>
      ))}
      <button
        onClick={onAdd}
        className="pressable flex aspect-[4/3] w-full break-inside-avoid flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-line text-sm font-semibold text-muted"
      >
        <PlusIcon /> Add photos
      </button>
    </div>
  );
}
