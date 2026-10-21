"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";

/**
 * Mobile bottom sheet (centered dialog on wide screens). Drag the handle down to dismiss.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="animate-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-[1.75rem] bg-card shadow-2xl sm:max-w-lg sm:rounded-[1.75rem]"
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: startY.current == null ? "transform 200ms" : "none" }}
      >
        <div
          className="flex shrink-0 touch-none flex-col items-center px-5 pt-2.5 pb-1"
          onPointerDown={(e) => {
            startY.current = e.clientY;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => startY.current != null && setDragY(Math.max(0, e.clientY - startY.current))}
          onPointerUp={() => {
            startY.current = null;
            if (dragY > 110) onClose();
            else setDragY(0);
          }}
        >
          <div className="h-1.5 w-10 rounded-full bg-line" />
          <div className="mt-2 flex w-full items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="pressable -mr-2 grid size-10 place-items-center rounded-full text-muted hover:bg-chip"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="pb-safe shrink-0 border-t border-line px-5 pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Labelled form row. Use `group` for button groups so the label doesn't forward clicks to the first button. */
export function Field({ label, children, hint, group }: { label: string; children: React.ReactNode; hint?: string; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block" role={group ? "group" : undefined} aria-label={group ? label : undefined}>
      <span className="mb-1.5 block text-sm font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </Tag>
  );
}

export const inputCls =
  "w-full rounded-2xl border border-line bg-chip px-4 py-3 text-ink outline-none placeholder:text-muted/70 focus:border-accent focus:bg-card focus:ring-4 focus:ring-accent/15";

export const primaryBtn =
  "pressable inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 font-semibold text-white shadow-lg shadow-accent/25 disabled:opacity-50 disabled:shadow-none";

export const secondaryBtn =
  "pressable inline-flex h-12 items-center justify-center gap-2 rounded-full bg-chip px-5 font-semibold text-ink";
