"use client";

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`pressable shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap ${active ? "bg-accent text-white" : "bg-card text-ink"}`}
    >
      {children}
    </button>
  );
}
