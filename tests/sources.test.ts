import { describe, expect, it } from "vitest";
import { asosApiUrls, mergeResults, parseAsosProduct, parseMicrolink, resultFromSlug, usable } from "@/lib/sources";
import type { ScrapeResult } from "@/lib/types";

const ZALANDO = "https://www.zalando.se/adidas-originals-samba-og-unisex-sneakers-aluminalight-brown-ad115p04q-c11.html";
const ASOS = "https://www.asos.com/se/carhartt-wip/carhartt-wip-og-detroit-jacka-i-svart/prd/211063383#colourWayId-211063386";

describe("resultFromSlug", () => {
  it("reads the product name from a Zalando link", () => {
    const r = resultFromSlug(ZALANDO);
    expect(r.title).toBe("Adidas Originals Samba Og Unisex Sneakers Aluminalight Brown");
    expect(r.store).toBe("Zalando");
    expect(r.suggestedCategory).toBe("Shoes");
  });

  it("reads the product name from an ASOS link", () => {
    const r = resultFromSlug(ASOS);
    expect(r.title).toBe("Carhartt Wip Og Detroit Jacka I Svart");
    expect(r.store).toBe("ASOS");
    expect(r.suggestedCategory).toBe("Jackets & coats");
  });

  it("gives no title for links without a readable name", () => {
    expect(resultFromSlug("https://shop.example.com/p/123456").title).toBeNull();
  });
});

describe("ASOS API", () => {
  it("builds API links for the right store", () => {
    const urls = asosApiUrls(ASOS);
    expect(urls[0]).toBe("https://www.asos.com/api/product/catalogue/v4/products/211063383?store=SE&sizeSchema=EU");
    expect(asosApiUrls("https://www.asos.com/nike/air/prd/123")[0]).toContain("store=COM");
    expect(asosApiUrls(ZALANDO)).toEqual([]);
  });

  it("parses a product", () => {
    const r = parseAsosProduct(
      {
        name: "Carhartt WIP OG Detroit jacka i svart",
        brand: { name: "Carhartt WIP" },
        media: { images: [{ url: "images.asos-media.com/products/x/211063383-1-black" }] },
        price: { current: { value: 2199 }, previous: { value: 2799 }, currency: "SEK" },
      },
      ASOS,
    )!;
    expect(r.title).toBe("Carhartt WIP OG Detroit jacka i svart");
    expect(r.brand).toBe("Carhartt WIP");
    expect(r.price).toBe(2199);
    expect(r.originalPrice).toBe(2799);
    expect(r.currency).toBe("SEK");
    expect(r.image).toMatch(/^https:\/\/images\.asos-media\.com\/products\/x\/211063383-1-black\?/);
    expect(r.suggestedCategory).toBe("Jackets & coats");
  });
});

describe("parseMicrolink", () => {
  it("reads metadata and JSON-LD", () => {
    const r = parseMicrolink(
      {
        status: "success",
        data: {
          title: "adidas Originals SAMBA OG - Sneakers - Zalando.se",
          publisher: "Zalando.se",
          image: { url: "https://img01.ztat.net/article/samba.jpg" },
          url: ZALANDO,
          ld: ['{"@type":"Product","name":"SAMBA OG UNISEX - Sneakers","brand":{"name":"adidas Originals"},"offers":{"price":"1295.00","priceCurrency":"SEK"}}'],
        },
      },
      ZALANDO,
    )!;
    expect(r.title).toBe("SAMBA OG UNISEX - Sneakers");
    expect(r.brand).toBe("adidas Originals");
    expect(r.price).toBe(1295);
    expect(r.currency).toBe("SEK");
    expect(r.image).toBe("https://img01.ztat.net/article/samba.jpg");
  });

  it("ignores failed lookups", () => {
    expect(parseMicrolink({ status: "fail" }, ZALANDO)).toBeNull();
  });
});

describe("usable and mergeResults", () => {
  const base: ScrapeResult = {
    url: ZALANDO, title: null, brand: null, price: null, originalPrice: null, currency: null, image: null, images: [], store: null, suggestedCategory: null,
  };

  it("drops bot-filter pages", () => {
    expect(usable({ ...base, title: "Access Denied" })).toBeNull();
    expect(usable({ ...base, title: "Just a moment..." })).toBeNull();
    expect(usable({ ...base, title: "Samba OG" })).not.toBeNull();
  });

  it("fills gaps from weaker results", () => {
    const r = mergeResults([
      { ...base, title: "Samba OG", image: "a.jpg", images: ["a.jpg"] },
      { ...base, price: 1295, currency: "SEK", images: ["b.jpg"] },
      null,
    ])!;
    expect(r.price).toBe(1295);
    expect(r.title).toBe("Samba OG");
    expect(r.images).toEqual(["a.jpg", "b.jpg"]);
  });
});
