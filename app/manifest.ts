import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wardrobe — all your clothing wishlists",
    short_name: "Wardrobe",
    description: "Collect clothes from any shop in your own lists — with prices, pictures and sale alerts.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f1ef",
    theme_color: "#d6336c",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  } as MetadataRoute.Manifest;
}
