# PetWants — Shopify theme

A complete Online Store 2.0 theme for **PetWants**. The layout and shopping flow follow Chewy's
(big search bar, "Shop by pet", mega menus, deal carousels, Autoship, a free-shipping progress bar),
but the brand, colors and code are PetWants' own.

## Install (5 minutes)

1. Download `petwants-shopify-theme.zip` from the repo root.
2. In Shopify admin go to **Online Store → Themes → Add theme → Upload zip file**.
3. Click **Customize** to edit, then **Publish** when you're ready.

Or connect this repo with **Add theme → Connect from GitHub** and pick the `petwants-shopify-theme` folder.

## Set these up so the theme looks like the preview

| What | Where in Shopify | Why |
|---|---|---|
| **Main menu** with 3 levels (Dog → Food → Dry Food) | Content → Menus → `main-menu` | Builds the mega menus |
| **Footer menu** (Help, Track order, Returns, Contact) | Content → Menus → `footer` | Footer links |
| Collections: Dog, Cat, Fish, Bird, Small Pet, Reptile, Deals, Pharmacy | Products → Collections | "Shop by pet" circles |
| Pick collections for **Today's top deals**, **Best sellers for dogs**, **Cat favorites** | Theme editor → Home page | Product carousels |
| **Search & Discovery** app, with filters for Brand, Price, Food form, Special diet | Apps | Sidebar filters on collection pages |
| **Subscriptions app** (e.g. Shopify Subscriptions), with a plan on each repeat-buy product | Apps | Turns on Autoship on product pages, cards and cart |
| A **reviews app** (Shopify Product Reviews, Judge.me, Okendo…) | Apps | Star ratings on cards and product pages |
| Free-shipping threshold, phone, hours, returns promise | Theme settings → Shipping & trust | Used across the whole site. Keep them accurate. |

### Product tags that add badges
`best-seller`, `vet-recommended`, `grain-free`, `made-in-usa`

### Product page tabs (metafields)
The product template has tabs for **Specifications**, **Ingredients & nutrition** and **Feeding instructions**.
Create rich-text metafields (e.g. `custom.ingredients`) and connect each tab to one with the dynamic-source
icon in the theme editor. A tab with no content stays hidden.

## What's included

- **Header:** rotating announcement bar, support-phone strip, logo, large search with live suggestions
  (products, categories, suggested searches), Autoship, account and cart with a running total,
  mega menu with an optional promo tile, and a mobile slide-out menu.
- **Home page sections** (all editable and reorderable): hero slider, Shop by pet circles, trust bar,
  product carousels, promo tiles, Autoship explainer, popular categories, brand logos, image with text,
  customer reviews, newsletter, recently viewed.
- **Product card:** brand, title, stars and review count, price with savings, Autoship price,
  shipping line, Deal/New/Best seller badges, favorite heart, one-tap Add to Cart.
- **Product page:** thumbnail gallery with swipe and zoom, size chips, one-time vs Autoship choice
  with delivery frequency, real low-stock warning, estimated delivery date, guarantees, tabs,
  sticky Add to Cart bar, "Goes great with" and "Customers also bought", recently viewed, SEO markup.
- **Collection and search:** filters (checkboxes and price range), active-filter pills, sorting,
  mobile filter drawer, pagination.
- **Cart:** slide-out drawer and full cart page, free-shipping progress bar, "You're saving",
  "Don't forget these" add-ons, secure-checkout reassurance.
- **Also:** account pages (login, register, orders, addresses), blog, contact form, 404, password page,
  gift card, optional welcome email popup.

## Color system

| Token | Default | Role |
|---|---|---|
| Brand orange | `#D08A45` | Buttons and highlights. Warm and friendly, and matches the logo. |
| Charcoal | `#262626` | Text and the logo's black. Dark text on orange buttons stays readable (AA contrast). |
| Trust blue | `#1B4B8F` | Links, Autoship, guarantees. Blue reads as reliable, which is why Chewy uses it. |
| Savings green | `#1E7B45` | "Save X%" and free-shipping progress. |
| Deal red | `#C62828` | Sale prices and the Deals menu item, used sparingly. |
| Cream | `#FBF6F0` | Soft section backgrounds. |

All of these can be changed in **Theme settings → Colors**.

## The psychology behind it (honest by design)

| Principle | Where it's used |
|---|---|
| **Goal gradient** | Free-shipping progress bar: "You're $12.03 away from FREE shipping" |
| **Anchoring** | Crossed-out compare-at price next to the sale price and "Save 14%" |
| **Loss aversion / savings** | Autoship shows the dollar amount saved on every order |
| **Risk reversal** | "Skip, pause or cancel anytime", returns promise and secure checkout next to the button |
| **Social proof** | Star ratings, review counts and a reviews section (real reviews only) |
| **Authority** | "Vet recommended" badge, a real support phone number in the header |
| **Scarcity (real only)** | "Only 5 left" appears only when tracked inventory is truly low |
| **Reciprocity** | Optional welcome popup that trades a real perk for an email |
| **Less friction** | One-tap Add to Cart, slide-out cart, sticky buy bar, express checkout buttons |
| **Completion** | "Don't forget these" low-price add-ons in the cart |

Nothing is fake. There are no made-up countdown timers, no invented "X people are viewing" counters,
and no placeholder reviews shown as real. The reviews section stays hidden until you add genuine
reviews, and the low-stock message only uses your real inventory. That keeps you on the right side of
FTC rules and protects the trust you're building.

## Before launch, check

- [ ] Replace the demo hero and promo copy and add your own photos (2400×880 hero, 1200×900 tiles)
- [ ] Set real shipping, returns and support details in Theme settings
- [ ] Match the Autoship discount you advertise to your subscription app's plans
- [ ] Only add real reviews and numbers you can back up
- [ ] Place a test order on phone and desktop
