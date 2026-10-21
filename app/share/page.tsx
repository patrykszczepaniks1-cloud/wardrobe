"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useLists } from "@/lib/store";

/** Web Share Target: share a product page from any shop app straight into a list. */
export default function SharePage() {
  return (
    <Suspense>
      <ShareView />
    </Suspense>
  );
}

function ShareView() {
  const params = useSearchParams();
  const router = useRouter();
  const lists = useLists();
  const shared = [params.get("url"), params.get("text"), params.get("title")].filter(Boolean).join(" ");
  const url = shared.match(/https?:\/\/\S+/)?.[0];

  return (
    <main className="pt-safe mx-auto max-w-lg px-4 py-6">
      <h1 className="text-2xl font-extrabold">Add to which list?</h1>
      {url ? (
        <p className="mt-1 truncate text-sm text-muted">{url}</p>
      ) : (
        <p className="mt-2 text-sm text-red-500">No link was shared.</p>
      )}
      <div className="mt-5 space-y-3">
        {lists?.map((b) => (
          <button
            key={b.id}
            disabled={!url}
            onClick={() => router.replace(`/list/${b.id}?add=${encodeURIComponent(url!)}`)}
            className="pressable flex w-full items-center gap-3 rounded-card bg-card p-3 text-left disabled:opacity-50"
          >
            <span className="size-14 shrink-0 overflow-hidden rounded-2xl bg-accent-soft">
              {b.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.images[0].src} alt="" className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-2xl">{b.emoji}</span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-bold">{b.name}</span>
              <span className="block truncate text-sm text-muted">
                {b.items.length} item{b.items.length === 1 ? "" : "s"}
              </span>
            </span>
          </button>
        ))}
        {lists?.length === 0 && (
          <p className="text-sm text-muted">
            You don&apos;t have any lists yet.{" "}
            <Link href="/" className="font-semibold text-accent-ink">
              Create one first
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
