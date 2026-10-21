import { describe, expect, it } from "vitest";
import { mergeShopifyProduct, parsePrice, parseProductHtml } from "@/lib/scrape";
import { suggestCategory } from "@/lib/categories";
import { priceDrop } from "@/lib/format";
import type { Item } from "@/lib/types";

const SHOP_URL = "https://www.example-denim.com/collections/men/products/straight-fit-selvedge-jeans";

// Trimmed-down version of a typical Shopify product page.
const shopifyHtml = `<!doctype html><html><head>
<title>Straight Fit Selvedge Jeans – Example Denim</title>
<meta property="og:site_name" content="Example Denim">
<meta property="og:title" content="Straight Fit Selvedge Jeans">
<meta property="og:price:amount" content="1.099,00">
<meta property="og:price:currency" content="SEK">
<meta property="og:image" content="//www.example-denim.com/cdn/shop/products/jeans.jpg">
<script>window.Shopify = {}; Shopify.shop = "example-denim.myshopify.com";</script>
<script type="application/ld+json">{
  "@context": "http://schema.org/",
  "@type": "Product",
  "name": "Straight Fit Selvedge Jeans",
  "brand": { "@type": "Brand", "name": "Example Denim" },
  "image": ["https://cdn.shopify.com/s/files/jeans-1.jpg"],
  "offers": [{ "@type": "Offer", "price": "999.00", "priceCurrency": "SEK" }]
}</script>
</head><body><h1>Straight Fit Selvedge Jeans</h1></body></html>`;

describe("parsePrice", () => {
  it.each([
    ["219.00", 219],
    ["1.099,00", 1099],
    ["1,099.00", 1099],
    ["€ 1 299,95", 1299.95],
    ["12,99 zł", 12.99],
    ["$1,299", 1299],
    ["2.499", 2499],
    ["CHF 1'250.50", 1250.5],
    [42, 42],
    ["free", null],
  ])("%s → %s", (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });
});

describe("parseProductHtml", () => {
  it("prefers JSON-LD product data and cleans the title", () => {
    const r = parseProductHtml(shopifyHtml, SHOP_URL);
    expect(r.title).toBe("Straight Fit Selvedge Jeans");
    expect(r.brand).toBe("Example Denim");
    expect(r.price).toBe(999);
    expect(r.originalPrice).toBeNull();
    expect(r.currency).toBe("SEK");
    expect(r.store).toBe("Example Denim");
    expect(r.image).toBe("https://cdn.shopify.com/s/files/jeans-1.jpg");
    expect(r.images).toContain("https://www.example-denim.com/cdn/shop/products/jeans.jpg");
    expect(r.suggestedCategory).toBe("Jeans");
  });

  it("handles @graph, AggregateOffer and strikethrough sale prices", () => {
    const html = `<html><head><script type="application/ld+json">{"@graph":[
      {"@type":"WebPage","name":"x"},
      {"@type":["Product"],"name":"Wool Blend Overcoat","brand":"Example","offers":{"@type":"Offer","price":"120","priceCurrency":"GBP",
        "priceSpecification":[{"@type":"UnitPriceSpecification","price":"120"},{"@type":"UnitPriceSpecification","priceType":"https://schema.org/StrikethroughPrice","price":"180"}]}}
    ]}</script></head></html>`;
    const r = parseProductHtml(html, "https://www.example-store.co.uk/p/123");
    expect(r.title).toBe("Wool Blend Overcoat");
    expect(r.brand).toBe("Example");
    expect(r.price).toBe(120);
    expect(r.originalPrice).toBe(180);
    expect(r.currency).toBe("GBP");
    expect(r.store).toBe("Example-store");
    expect(r.suggestedCategory).toBe("Jackets & coats");
  });

  it("falls back to OpenGraph product tags, including sale prices", () => {
    const html = `<html><head>
      <meta property="og:title" content="Merino Crew Neck Sweater | Knit Shop">
      <meta property="og:site_name" content="Knit Shop">
      <meta property="product:price:amount" content="499.90">
      <meta property="product:sale_price:amount" content="349.90">
      <meta property="product:price:currency" content="pln">
    </head></html>`;
    const r = parseProductHtml(html, "https://knitshop.pl/merino");
    expect(r.title).toBe("Merino Crew Neck Sweater");
    expect(r.price).toBe(349.9);
    expect(r.originalPrice).toBe(499.9);
    expect(r.currency).toBe("PLN");
    expect(r.suggestedCategory).toBe("Knitwear");
  });

  it("finds a price element as a last resort", () => {
    const html = `<html><head><title>Leather Chelsea Boots</title></head>
      <body><h1>Leather Chelsea Boots</h1><span class="product-price">€149,00</span></body></html>`;
    const r = parseProductHtml(html, "https://shop.example.com/boots");
    expect(r.price).toBe(149);
    expect(r.currency).toBe("EUR");
    expect(r.suggestedCategory).toBe("Shoes");
  });
});

describe("mergeShopifyProduct", () => {
  it("uses the selected variant price and compare-at price in cents", () => {
    const base = parseProductHtml(shopifyHtml, SHOP_URL);
    const r = mergeShopifyProduct(
      base,
      {
        title: "Straight Fit Selvedge Jeans",
        vendor: "Example Denim",
        variants: [
          { id: 1, price: 99900, compare_at_price: null },
          { id: 2, price: 79900, compare_at_price: 99900 },
        ],
        images: ["//cdn.shopify.com/a.jpg"],
      },
      "2",
    );
    expect(r.price).toBe(799);
    expect(r.originalPrice).toBe(999);
    expect(r.images).toContain("https://cdn.shopify.com/a.jpg");
  });
});

describe("suggestCategory", () => {
  it.each([
    ["Denim Jacket Washed Blue", "Jackets & coats"],
    ["Slim Fit Oxford Shirt", "Shirts"],
    ["Oversized Graphic T-Shirt", "T-shirts & tops"],
    ["Relaxed Hoodie in Grey", "Hoodies & sweats"],
    ["Bootcut Jeans", "Jeans"],
    ["Air Max 90 Sneakers", "Shoes"],
    ["Pleated Chino Trousers", "Trousers"],
    ["Wool Blazer Navy", "Suits & blazers"],
    ["Satin Midi Dress", "Dresses & skirts"],
    ["Ribbed Beanie", "Accessories"],
    ["Leather Tote Bag", "Bags"],
    ["Vinterjacka herr", "Jackets & coats"],
    ["Löparskor dam", "Shoes"],
    ["Stickad tröja i ull", "Knitwear"],
    ["Oxfordskjorta", "Shirts"],
    ["Kurtka zimowa puchowa", "Jackets & coats"],
    ["Jack & Jones logo tee", "T-shirts & tops"],
    ["Suitable for everyday wear", null],
    ["Gift card", null],
  ])("%s → %s", (title, cat) => {
    expect(suggestCategory(title)).toBe(cat);
  });
});

describe("priceDrop", () => {
  const base: Item = { id: "1", url: "", title: "x", price: 80, currency: "EUR", category: "Other", status: "wanted", createdAt: 0 };
  it("uses the store's was-price", () => {
    expect(priceDrop({ ...base, originalPrice: 100 })).toEqual({ from: 100, pct: 20 });
  });
  it("uses the highest price we've seen", () => {
    expect(priceDrop({ ...base, priceHistory: [{ price: 120, at: 0 }, { price: 80, at: 1 }] })).toEqual({ from: 120, pct: 33 });
  });
  it("is null when nothing dropped", () => {
    expect(priceDrop({ ...base, priceHistory: [{ price: 80, at: 0 }] })).toBeNull();
  });
});
