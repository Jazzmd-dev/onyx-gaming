# Onyx — Shopify theme for Onyx Gaming

A custom Online Store 2.0 theme for a premium gaming and electronics store. It's built from scratch, with no base theme and no third-party JavaScript. Everything runs on native Shopify features: real products, variants, collections, the Cart AJAX API, storefront filtering, predictive search, product recommendations and Shopify's own checkout.

| | |
|---|---|
| Palette | `#05070B` · `#0B1018` · `#38BDF8` · `#7DD3FC` · `#FFFFFF` · `#A1AAB8` (all editable in **Theme settings › Colors**) |
| Type | Space Grotesk (headings) + Inter (body), served from Shopify's font CDN |
| JS | One deferred file (`assets/global.js`, about 10 KB gzipped) |
| CSS | One file (`assets/base.css`, about 15 KB gzipped) |
| Validation | `shopify theme check` reports 0 offenses |

## Install

```bash
npm i -g @shopify/cli
shopify theme push --store your-store.myshopify.com --unpublished   # upload as a new theme
# or preview locally against your store:
shopify theme dev --store your-store.myshopify.com
```

You can also zip the folders `assets config layout locales sections snippets templates` and upload the zip in **Online Store › Themes › Add theme › Upload zip file**.

## Store setup checklist

The theme reads live store data. Create the following so that every link and section shows your products.

### 1. Collections (Products › Collections)

The homepage and the fallback navigation use these handles:

| Purpose | Handle |
|---|---|
| Category cards | `gaming-pcs`, `gaming-accessories`, `keyboards`, `gaming-mice`, `headphones`, `gaming-headsets`, `monitors`, `consoles`, `smartphones`, `electronics`, `tech-accessories` |
| "The gear everyone wants" tabs | `trending`, `bestsellers`, `new-arrivals`, `limited-offers` |
| Navigation | `gaming`, `electronics` (plus the categories above) |

Tip: make `trending`, `bestsellers` and `new-arrivals` **smart collections**, for example "Product tag is trending", or sorted by best selling or by newest. Any collection can be swapped in the theme editor.

### 2. Navigation (Online Store › Navigation)

- **main-menu**: Home, Shop All (`/collections/all`), Gaming, Electronics, Trending, Bestsellers, Contact.
  - Nested links appear as a dropdown.
  - Third-level links turn into mega-menu columns.
  - The header's *Mega menu promo* blocks add a featured image tile to a matching top-level item.
- **footer**: any links you want in the footer's "Shop" column.

Until `main-menu` exists, the header shows a built-in fallback with exactly the links above.

### 3. Pages (Online Store › Pages)

| Page | Handle | Template |
|---|---|---|
| Contact | `contact` | `page.contact` (working Shopify contact form) |
| Wishlist | `wishlist` | `page.wishlist` |

### 4. Policies (Settings › Policies)

Add Refund, Privacy, Terms of service and Shipping policies. They're linked automatically in the footer, the cart and the product page's "Delivery information" and "Returns" tabs. The theme never invents delivery times or guarantees: it shows your policy text, or "calculated at checkout" if no policy exists.

### 5. Product data

| What | How |
|---|---|
| Badges | Sale badges come from a real compare-at price. Add the tags `new`, `bestseller`, `trending` or `limited` for those badges. |
| Specifications | Create a product metafield **`custom.specifications`** (multi-line text) with one `Label: Value` per line. It renders as a spec table on the product page. Without it, the theme shows real fields (brand, type, options, SKU, barcode, weight). |
| Ratings & reviews | Install a reviews app that writes Shopify's standard `reviews.rating` and `reviews.rating_count` metafields (for example Shopify Product Reviews, Judge.me, Loox or Okendo). Stars then appear on cards, the product page and in Google structured data. Add the app's block to the **Customer reviews** section. Nothing shows until real reviews exist. |
| Color swatches | Use Shopify's category metafields or option swatches. Color option values show swatches automatically. |
| Filters | Install **Search & Discovery** and enable filters (availability, price, vendor, color and so on). Collection and search pages pick them up. |
| Related products | Search & Discovery manages product recommendations. |

### 6. Theme settings

- Logo and favicon.
- Store information (support email, phone, hours, address): used in the footer, contact page and Organization structured data.
- Social links.
- Cart type (drawer or page).

## Feature map

| Spec item | Where |
|---|---|
| Hero "LEVEL UP YOUR WORLD." with animated ambient light, separate mobile image, optional video | `sections/hero.liquid` |
| Sticky glass header, mega menus, slide-out mobile menu, predictive search overlay | `sections/header.liquid`, `sections/predictive-search.liquid` |
| 11 visual category cards (bento grid) | `sections/category-grid.liquid` |
| "THE GEAR EVERYONE WANTS." tabs: Trending, Bestsellers, New arrivals, Limited offers | `sections/featured-tabs.liquid` |
| Product cards: hover image, real discount, rating, badges, quick add, wishlist | `snippets/product-card.liquid` |
| Limited-time offer with countdown (only when you set a real end date; hides after it passes) | `sections/promo-banner.liquid` |
| Product page: gallery with zoom, thumbnails and swipe; variants with unavailable states; live stock; specs; delivery and returns; Buy Now (dynamic checkout); sticky mobile add-to-cart; share | `sections/main-product.liquid`, `product-details`, `product-reviews`, `related-products` |
| Animated cart drawer: live updates, quantity, remove, discount codes, order note, subtotal, native checkout | `snippets/cart-drawer.liquid`, `snippets/cart-contents.liquid` |
| Collection and search pages: filter sidebar or mobile filter drawer with no page reload, sort, active-filter chips, pagination | `sections/main-collection.liquid`, `main-search.liquid`, `snippets/facets.liquid` |
| Wishlist (saved in the visitor's browser) | `sections/main-wishlist.liquid`, `templates/product.card.liquid` |
| Newsletter (adds a Shopify customer with accepted marketing) | `sections/newsletter.liquid`, footer block |
| Footer: brand, menus, customer service, contact, newsletter, social, policies, Shopify payment icons | `sections/footer.liquid` |
| Customer accounts (login, register, orders, addresses, activation, reset) | `sections/main-*.liquid`, `templates/customers/*` |

## Performance, SEO and accessibility

### Performance

- Responsive `srcset` images.
- `fetchpriority="high"` on the LCP image, lazy-loading below the fold.
- Font preloading with `font-display: swap`.
- Aspect-ratio boxes on all media, so there are no layout shifts.
- One CSS file and one deferred JS file.
- Recommendations load on scroll.

### SEO

- Unique titles with tag and page suffixes, meta descriptions, canonical URLs, Open Graph and Twitter cards.
- JSON-LD: Organization and WebSite SearchAction on the homepage, Product with per-variant Offers (GTIN and SKU, plus AggregateRating only when real reviews exist), and BreadcrumbList.
- One H1 per page.
- Search, cart and account pages are `noindex`.
- Shopify generates `sitemap.xml` and `robots.txt` automatically.

### Accessibility

- Skip link, visible focus rings, keyboard-operable menus.
- Tabs follow the ARIA pattern with arrow, Home and End keys.
- Focus-trapped dialogs that close with Esc.
- Labelled form fields and live regions for cart and stock changes.
- 44 px or larger touch targets and 16 px inputs (no iOS zoom).
- Animations are disabled under `prefers-reduced-motion`, and `forced-colors` is supported.

## QA performed

These checks used a local renderer with mocked store data. They can't replace testing on a live store.

### Layout

- Rendered every main template and screenshotted it at:
  - 320 px and 375 px (iPhone SE)
  - 390 px and 414 px (modern iPhone and Android)
  - 768 px and 820 px (iPad)
  - 1024 px (iPad Pro landscape)
  - 1440 px (laptop)
  - 2560 px (ultrawide)
- No horizontal scrolling at any width.

### Interactions (headless Chromium)

- Variant switching: price, URL, stock, sold-out and unavailable states.
- Gallery thumbnails.
- Mega menu, mobile menu, search overlay with focus and Esc, cart drawer, filter drawer.
- Product tabs with arrow keys, wishlist toggle, sticky mobile add-to-cart.
- No JavaScript errors.

### Not testable without a live store

Real cart AJAX calls, checkout, payments, contact and newsletter submission, predictive search results and filtering. These are standard Shopify endpoints. After installing, run through a test order using Shopify's Bogus Gateway or test mode, and check the theme in Safari, Chrome, Firefox, Edge and Samsung Internet on real devices.
