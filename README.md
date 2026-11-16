# REPVAULT

A premium, private shopping toolkit for agent shoppers. Plain HTML, CSS and JavaScript; no build step, no backend.
All data lives in your browser's `localStorage` under the key `repvault:v1`.

**Live:** https://darenazhekbarovaboba-source.github.io/repvault/

## Tools
| Route | Tool | What it does |
| --- | --- | --- |
| `#/dashboard` | Dashboard | Stats, recently used tools, quick actions, live CNY rate, link quick-convert |
| `#/qc` | QC Finder | Parse a product link, open RepTools QC finder / the listing / your agent; QC photo folders with GL/RL verdicts, uploads (compressed) or image URLs, lightbox |
| `#/packages` | Package Tracker | Carrier auto-detect, manual status + timestamped history, ETA countdown/overdue, official carrier + 17TRACK links. **Live status is not fetched.** |
| `#/sizes` | Size Converter | Shoes (US M/W, UK, EU, CM), tops/bottoms charts incl. Asian sizing, saved measurements (cm/in) and recommendations |
| `#/shipping` | Shipping Calculator | Actual vs volumetric weight (÷5000/÷6000), 0.5 kg billing, editable **sample** rate table in CNY, destination multipliers, CNY → display currency |
| `#/converter` | Link Converter | Agent ↔ original link conversion, batch (200 lines), copy, history |
| `#/products` | Product Organizer | Products with price, photos, category, tags, status; grid/list, search, filter, sort, edit, delete, JSON import/export |
| `#/settings` | Settings | Display currency, preferred agent, units, full backup/restore, clear data |

## Real APIs
- **ExchangeRate-API open endpoint** `https://open.er-api.com/v6/latest/CNY` (free, no key, CORS `*`). Cached 6 h; on failure the cached rate is shown and labelled as cached.

No other network calls are made. Carrier tracking and QC photos open on the official/third-party sites.

## Verified agent link formats (checked 15 Nov 2026)
| Agent | Format | Evidence |
| --- | --- | --- |
| KakoBuy | `kakobuy.com/item/details?url=<encoded original>` | Live kakobuy.com page indexed with this URL; HTTP 200; multiple converter docs |
| Superbuy | `superbuy.com/en/page/buy/?nTag=Home-search&from=search-input&_search=url&position=&url=<encoded>` | Live superbuy.com URL in search index |
| Sugargoo | `sugargoo.com/products?productLink=<encoded>` | Route in Sugargoo's live JS bundle (`/productDetail` redirects to `/products`); old `#/home/productDetail` links still unwrap |
| OopBuy | `oopbuy.com/product/<id>` (Taobao), `/product/weidian/<id>`, `/product/1688/<id>` | Converter docs; HTTP 200 |
| CSSBuy | `cssbuy.com/item-<id>.html` (Taobao), `item-micro-<id>` (Weidian), `item-1688-<id>` | rep.tools + GRAILS docs; HTTP 200 |
| USFans | `usfans.com/product/<3 Weidian, 2 Taobao, 1 1688>/<id>` | Two independent converter docs; HTTP 200 |
| ACBuy | `acbuy.com/product?id=<id>&source=WD` (Weidian), `TB` (Taobao/Tmall), `AL` (1688) | repbuytools.com + taofind.com docs, Apify agent-link output, many Reddit WD examples |

Tmall: OopBuy, CSSBuy, USFans and ACBuy have no separate Tmall code, so Tmall items are built with the Taobao code (same ID) and the app shows a note; KakoBuy, Superbuy and Sugargoo keep the full Tmall URL.

Read-only (unwrapped to the original, not generated): CNFans and AllChinaBuy (closed/maintenance since Aug 2026), Mulebuy and Hoobuy (unreachable), Joyagoo (conflicting formats).

QC search links use RepTools' public form: `https://rep.tools/qc-finder?link=<encoded original>`.

## Structure
```
index.html        app shell (sidebar nav, modal, lightbox, toasts)
css/styles.css    design system (strict 6-colour palette)
js/core.js        storage, helpers, toasts, modals, lightbox, images, exchange rates
js/links.js       marketplace + agent link parsing/building
js/tools/*.js     one module per tool
js/app.js         hash router + nav
```

Run locally: `python3 -m http.server` in this folder and open http://localhost:8000.
