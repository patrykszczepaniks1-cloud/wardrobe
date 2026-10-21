import { ImageResponse } from "next/og";

/** The app icon: a white hanger glyph on the brand gradient. */
export function appIcon(size: number, rounded = false) {
  const glyph = Math.round(size * 0.6);
  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #e0457b, #ff9a6b)",
          borderRadius: rounded ? size * 0.22 : 0,
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 7.5a2.5 2.5 0 1 1 2.5-2.5c0 1.2-1 1.7-2.5 2.6V9" />
          <path d="M12 9 2.8 15.6A1.3 1.3 0 0 0 3.6 18h16.8a1.3 1.3 0 0 0 .8-2.4Z" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
