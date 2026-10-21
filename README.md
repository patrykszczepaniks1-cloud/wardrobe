# Wardrobe — every clothing wishlist in one place

A mobile-first web app for collecting clothes from any shop, a bit like GoWish but for your wardrobe. Use it instead of a separate wishlist in every store's app.

- **Lists**: as many as you like, for example *Work clothes*, *Winter outfits*, *Gym* or *Wedding guest*. Each one has an icon, an optional cover and a moodboard for outfit inspiration.
- **Paste a link from any shop** and the app fetches the name, brand, price, currency, sale price and pictures. It reads JSON-LD, OpenGraph and microdata, and uses the product JSON on Shopify stores. If a shop blocks the request, it tries again as a link-preview crawler.
- **Paste several links at once** to add them all in one go.
- **Categories** such as Jeans, Jackets & coats, Knitwear, Shoes or Accessories are suggested from the product title. The keywords are in English, Swedish and Polish. You can also add your own categories.
- **All items** view: search and filter across every list by category, must-haves or *On sale*.
- **Sale tracking**: *Check prices for sales* fetches every item again, keeps a price history and shows a −% badge when something gets cheaper or the shop shows a "was" price.
- Size, colour, status (Wishlist / Ordered / Owned), must-have hearts, notes. Items can be moved between lists.
- **Totals** per list: what you've bought, what's left, and a breakdown by category.
- **Share** a list as text, or export and import a `.json` backup.
- **Installable PWA**: once installed on Android, you can use *Share → Wardrobe* in any shop app or browser to add the product to a list.

All data is stored on your device in IndexedDB. There are no accounts. The server only fetches links (`/api/scrape`), and it blocks private and internal addresses.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # scraper + category unit tests
npm run typecheck
```

## Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the `wardrobe` GitHub repository.
2. Leave every setting at its default (Vercel detects Next.js). You don't need any environment variables.
3. Click **Deploy**.

The link scraper runs as a Node.js serverless function, so a static export won't work.

### How links are read

Big fashion shops (Zalando, ASOS, H&M, Zara) use bot protection that often blocks cloud servers. The scraper tries several routes and combines whatever they return:

1. The product page itself, requested with full browser headers and again as a link-preview crawler.
2. Shop APIs where one exists (ASOS's product API).
3. If that still doesn't get the full product, two free page-rendering services, [Jina Reader](https://jina.ai/reader) and [Microlink](https://microlink.io), which load the page in a real browser. The product link is sent to them. Their free tiers are rate-limited. Add `JINA_API_KEY` or `MICROLINK_API_KEY` in Vercel → Settings → Environment Variables for higher limits.
4. If nothing works, the name and category are taken from the link itself. When you share from a shop's app, the title the app shares is used instead. You can then add the price and picture by hand.

The function runs in Vercel's Stockholm region (`arn1`, set in `vercel.json`), which European shops are less likely to block than the default US region.
