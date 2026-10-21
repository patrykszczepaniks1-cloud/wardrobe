import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-dm-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Wardrobe — all your clothing wishlists",
  description: "Collect clothes from any shop in your own lists — with prices, pictures, categories and sale alerts.",
  applicationName: "Wardrobe",
  appleWebApp: { capable: true, title: "Wardrobe", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1ef" },
    { media: "(prefers-color-scheme: dark)", color: "#121011" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
