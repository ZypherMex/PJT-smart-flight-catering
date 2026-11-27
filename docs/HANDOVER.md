# Smart Flight Catering: Engineering Handover

Status date: 2026-11-27. Branch `mainrepofrfr`; the newest code commit is `ed53c71` (AI reply-parsing fix), followed by the commit that adds this document. Remote: `github.com/ZypherMex/PJT-smart-flight-catering`. **The most recent commits (everything from the seven build phases onward) exist only on the owner's laptop and have not been pushed.** Run `git status -sb` to see how many.

## 0. How to read this document

This is written so a senior engineer (or an AI assistant) can take over with no access to the original developer.

- Facts about the **code** (sections 4 to 15) were read directly from the repository and are high confidence.
- The **history before commit `7d003a6`** (sections 3 and 21) was reconstructed from a conversation summary and git history, so it is medium confidence.
- Anything marked **ASSUMPTION** is a reasoned guess. Each one has a confidence level and a recommended way to confirm it (section 20).
- The project is **Node.js / JavaScript only. There is no Python anywhere.** Where a template asks for "Python libraries", the answer is: none.

### Executive summary

A web system for aircraft meal service. Passengers scan a QR code on their phone, enter a seat number, declare up to 5 health conditions, and order at most one dish per category (snack, breakfast, lunch, dinner, beverage). Dishes that conflict with a declared condition are blocked with an explanation. Cabin crew watch every order arrive live on a dashboard and move it through five statuses. Staff manage meals, photos, stock and health rules in an admin area, see reports, and export Excel/PDF. An optional AI feature (Claude, via an organisation's internal gateway) suggests meals. Everything runs from one laptop on a local Wi-Fi network (single Node process, SQLite file), tested up to 300 simultaneous simulated passengers.

Only one aircraft (Airbus A350-900, 312 seats) is built. It is a **working, well-tested demo-grade system, not yet production-hardened** (see sections 12, 17 and 18).

---

## 1. Purpose, users and business value

| Item | Detail |
|---|---|
| Problem | Inflight meal choice is done by crew asking each passenger, with allergy information handled verbally. This is slow, error-prone and gives crew no real-time picture of demand. |
| Solution | Self-service ordering from the passenger's own phone, with automatic allergen/health blocking, and a live crew board. |
| Passengers | Anyone with a phone and a browser. No app, no account. |
| Cabin crew | Use the order board, seat map, QR sheet. Sign in with a shared passkey. |
| Staff / catering managers | Use the admin area (menu, photos, stock, health rules, reports, exports). Same passkey as crew. |
| Value | Faster service, fewer allergy mistakes, live demand and stock visibility, printable reports, no internet needed for the core system. |

Origin (ASSUMPTION, medium confidence): the project started as a university/portfolio-style build themed on Emirates (A350-900 seat map and menus). It is not an official Emirates system, although the AI part is routed through an Emirates internal AI gateway on the original developer's machine.

---

## 2. Feature inventory and completion status

| Area | Feature | Status |
|---|---|---|
| Entry | Role selector (Customer / Cabin Crew with 6-digit passkey) | Done |
| Passenger | Order page: seat, optional name, flight length, condition chips (max 5), 5 category menus with photos, blocked/sold-out explanations, Place Order, live status card, edit while pending, restore on reload | Done |
| Passenger | AI "Suggest meals for me" (uses only declared conditions; filters to orderable dishes) | Done (needs AI key; degrades cleanly without) |
| Passenger | Visual seat picker (aircraft map opens the order page for the tapped seat) | Done |
| Crew | Live order board: search, class/condition/status filters, seat sort, one-tap status advance + dropdown, release seat | Done |
| Crew | Seat map (crew mode) showing saved details per seat; "Randomize all seats" demo tool | Done |
| Crew | QR page: scannable code, network address picker, print/download/copy | Done |
| Admin | Meals CRUD, category, dietary label, availability, stock, tags, photo upload (validated, resized to WebP + thumbnail) | Done |
| Admin | Health conditions CRUD, forbidden tags, custom tags, enable/disable | Done |
| Admin | Reports: KPIs, 7 charts with table views, stock meters, live refresh, cabin filter | Done |
| Admin | Excel (4 sheets) and PDF export | Done |
| Platform | Socket.IO realtime, server-enforced crew auth, rate limits, dark mode, gzip, image optimisation, backup script | Done |
| Platform | Public Dining menu page (`menu.html`) | Done (legacy-style, read-only) |
| Aircraft | A350-900 | Done |
| Aircraft | A380-800, 777-300ER, 777-200LR | **Not built** ("Coming soon" tiles) |
| Quality | Automated test suite | **Not present** (see 16) |
| Quality | CI/CD pipeline | **Not present** |
| Quality | Real-phone Wi-Fi test | **Not done** (checklist in README) |
| Safety | Human review of allergen tags | **Not done** (all 88 dishes flagged "needs review") |
| Ops | Multi-flight support, order history/archive | **Not built** (see TD-01) |
| Ops | Per-user crew accounts, audit log | **Not built** |
| i18n | Arabic / RTL / other languages | **Not built** |

---

## 3. Chronological timeline

Git history (authoritative):

| Date | Commit | What |
|---|---|---|
| 2026-10-22 | `9d1419b` | Initial seat map app: Node/Express/SQLite backend |
| 2026-11-04 | `86e3701` | Renamed backend/frontend to `API/WEB`; added menu catalog; first Claude meal recommendations |
| 2026-11-23 | `9fa5d1f`, `2204217` | Commit messages are vague ("Messages request", "Update API and WEB files"). INFERRED from the conversation history: the Customer vs Cabin Crew landing page, passkey gate and haul/time selection landed around here. Check the diffs to confirm |
| 2026-11-24 | `db1c69f`, `1fa2610` | Dish photos wired in; duplicate photo folder removed |
| 2026-11-27 | `7d003a6` | Phase 1: health-condition rules, dish tags, order tables, 5-condition cap |
| 2026-11-27 | `193ae90` | Phase 2: orders API, Socket.IO, server-side crew auth |
| 2026-11-27 | `246020c` | Phase 3: passenger ordering page |
| 2026-11-27 | `e79de8d` | Phase 4: crew order dashboard |
| 2026-11-27 | `9568d68` | Phase 5: admin area (meals, photos, health rules) |
| 2026-11-27 | `a418700` | Phase 6: reports, Excel/PDF export |
| 2026-11-27 | `63aebe4` | Phase 7: QR, dark mode, faster photos, privacy lockdown, deploy guide |
| 2026-11-27 | `9014b3c` | AI-key setup with graceful fallback; order-page photo quality fix |
| 2026-11-27 | `ed53c71` | Fix AI suggestions failing when the model wraps its JSON in a markdown code fence; one automatic retry |
| 2026-11-27 | (next commit) | This handover document |

Narrative (reconstructed, medium confidence for the early part):

1. **Foundation.** A seat map of the A350-900 (3 cabins, 312 seats) with per-seat allergy/medical/dining preferences stored as 13 boolean columns.
2. **Menus and AI.** Menu catalog for 3 classes x 3 flight lengths (88 dish rows). Claude recommends dishes using seat preferences.
3. **Role split.** Landing page with Customer vs Cabin Crew (passkey `123490`), flight selection crew-only, haul/time-of-day selection.
4. **Photos.** 36 dish photos supplied by the owner; wine/champagne deliberately left without photos.
5. **Big rebuild (the "ordering ecosystem").** Driven by a long requirements spec: QR access, health-compatible ordering, live crew dashboard, admin, reports, export, dark mode, LAN deployment. Built in seven phases, each tested and committed only after the owner's explicit permission.
6. **Hardening pass (Phase 7).** Privacy lockdown of health data, performance, deploy guide, contrast audit, load test.
7. **Polish.** AI key made an expected-but-optional setting; photo sharpness fix.

Working rule from the owner (also saved in the assistant's memory): **ask permission before every commit; the owner pushes themselves.**

---

## 4. Architecture

```
 Passenger phone                Crew tablet/laptop              Admin (same app)
 order.html, a350.html          crew.html, qr.html              admin.html
        |  HTTP (REST) + WebSocket (Socket.IO)  |
        +------------------+--------------------+
                           v
        +--------------------------------------------------+
        |  ONE Node.js process (Express 4 + Socket.IO 4)   |
        |  routes -> controllers -> models -> SQLite       |
        |  services: Claude client, images, exports, QR    |
        +----+---------------------------+-----------------+
             |                           |
   better-sqlite3 (sync, WAL)      Claude API / internal AI gateway
   DATABASE/catering.sqlite        (optional; HTTPS outbound)
             |
   WEB/images/menu/*.webp  (served statically)
```

Key design decisions:

- **Single process, single machine, local network.** No cloud, no external database. Chosen for the aircraft/LAN scenario and 50 to 500 users.
- **REST is authoritative; WebSockets only push.** Every write is an HTTP request; after the database commit the server emits an event. Clients re-sync from REST on every reconnect, so a missed event is never fatal.
- **better-sqlite3 is synchronous**, so each request's transaction runs atomically. This is what makes stock checks race-free (tested: 120 people racing for 20 portions gives exactly 20).
- **Layering:** `routes` (URLs, limiters, auth) -> `controllers` (HTTP shape) -> `models` (SQL + rules) -> `db`. `services` hold side-effecting integrations.
- **Database is the source of truth** after first start. `menuCatalog.js` and `healthConditions.js` are only initial seed data.
- **Frontend:** plain ES modules, no build step, no framework. Each page has an `*.html`, one entry module, an `*Api.js` fetch wrapper, and shared helpers.

### Passenger order flow

1. `GET /api/health-conditions` -> condition list. Passenger enters seat -> `GET /api/seats/:id` (validates the seat and shows locked class).
2. `GET /api/portal/menu?seat=&haul=&conditions=` -> five categories; each dish carries `conflicts[]`, `soldOut`, `remaining`.
3. `POST /api/orders` -> validates in one transaction; returns `{order, token}` (201 new / 200 edit). The **token** is a random 32-hex `edit_token` saved in the browser's localStorage and sent as `x-order-token`.
4. Browser joins socket room `seat:<id>` using the token; receives `order:upserted` on every status change.
5. On every reconnect the page calls `GET /api/orders/seat/:id` to re-sync (handles missed events and crew-released orders).

---

## 5. Technology stack and dependencies

| Layer | Choice | Version (package.json) | Why |
|---|---|---|---|
| Runtime | Node.js | built/tested on 22.12 (needs >= 20.9 because of `sharp`) | |
| Web framework | express | ^4.21 | Express 4: async handlers need the `wrap()` helper to reach the error middleware |
| Database | SQLite via better-sqlite3 | ^11.3 | Embedded, synchronous, WAL mode, foreign keys ON |
| Realtime | socket.io | ^4.8 | Rooms: `crew`, `seat:<id>` |
| AI | @anthropic-ai/sdk | ^1.3 | Claude Messages API |
| TLS workaround | undici | ^7.30 | Only for the optional insecure-TLS agent |
| Rate limiting | express-rate-limit | ^8.7 | Login, orders, AI |
| Uploads | multer | ^2.5 | Memory storage, 5 MB, 1 file |
| Images | sharp | ^0.35 | Decode-validate, resize to 640px WebP + 96px thumb |
| Excel | exceljs | ^4.4 | 4-sheet workbook |
| PDF | pdfkit | ^0.21 | Built-in Helvetica (Latin-1 only) |
| QR | qrcode | ^1.5 | SVG and PNG |
| Compression | compression | ^1.8 | gzip |
| Config | dotenv | ^18 | `.env` loading |
| Dev | nodemon | ^3.1 | `npm run dev` |
| Frontend | Vanilla JS ES modules, CSS variables | n/a | No bundler, no framework |

No Python, no Docker, no cloud services, no message broker, no cache. Outbound internet is only needed for the optional Claude calls (and `npm install`).

npm scripts: `start`, `dev`, `optimize-images`, `backup`.

---

## 6. Repository map

```
API/
  server.js            boot: seed + migrations, http+socket server, startup banners
  app.js               middleware (compression, json 100kb, static) and route mounting
  config.js            MAX_CONDITIONS
  db/                  connection.js (WAL, FK on, runs schema.sql), schema.sql, seed.js, migrate.js
  data/                seatGrid, aircraftFleet, menuCatalog (seed), healthConditions (seed + tag rules), diningMatrix (legacy)
  routes/              one file per area (see section 9)
  controllers/         HTTP layer
  models/              SQL + business rules (order, compatibility, preference, healthCondition, adminMeal, adminCondition, report, recommendation, menu, seat)
  services/            claudeClient, aiConfig, imageService, exportService, networkService
  middleware/          crewAuth (tokens), errorHandler
  realtime/socket.js   Socket.IO rooms and emitters
  utils/               HttpError, images (thumbFor)
  scripts/             optimizeMenuImages.js, backupDatabase.js
WEB/
  *.html               index, fleet, a350 (seat map), menu, order, crew, admin, qr
  js/                  page modules + shared (crewAuth, crewNav, util, theme, *Api)
  css/                 style.css (base + dark theme), order, crew, admin, reports, qr
  images/menu/         36 dish photos (.webp) + thumb/ (96px)
assets/menu-originals/ full-size source photos (not served)
DATABASE/              catering.sqlite (git-ignored), backups/
docs/HANDOVER.md       this file
README.md              quick start, LAN setup, settings, backups
.env.example           all settings documented
```

56 backend files (about 3,950 lines) and 38 frontend files (about 4,520 lines): roughly 8,500 lines of hand-written code in total, measured on 2026-11-27.

---

## 7. Database

SQLite, file `DATABASE/catering.sqlite`. `schema.sql` is idempotent (`CREATE TABLE IF NOT EXISTS`) and runs every time `db/connection.js` is required. Anything that changes an **existing** table is done in `db/migrate.js` / `db/seed.js` (guarded by `PRAGMA table_info` or a `meta` flag so it runs once).

### Relationships

```
seats (312) --< seat_conditions >-- health_conditions --< condition_restrictions >-- restriction_tags
   |  \                                                                                    |
   |   seat_preferences (legacy columns + haul/meal fields)                  menu_item_tags
   |                                                                                       |
   +--(1:1)-- orders --< order_items >-- menu_items >-- menu_sections ----------------------+
                 |
                 +--< order_conditions   (snapshot: condition_id + label, no FK)
```

### Tables

| Table | Purpose | Notes |
|---|---|---|
| `seats` | 312 seats: id like `12A`, row, letter, class | First rows 1-6 (24), Business 7-14 (32), Economy 15-43 (256) |
| `seat_preferences` | Legacy per-seat saved prefs | 13 old boolean condition columns are **unused**; `haul_length`, `meal_choice*`, `meal_time` still written/read by the crew panel |
| `seat_conditions` | Source of truth for a seat's saved conditions | Mirrors the latest order's conditions |
| `health_conditions` | id, label (unique), group, active, builtin | 13 built-in; custom ones id `c_<slug>` |
| `restriction_tags` | 14 built-in tags (ingredient / nutrition) + custom | e.g. `egg`, `dairy`, `high_sodium` |
| `condition_restrictions` | Which tags a condition forbids | |
| `menu_sections` | class x haul x section name | 3 x 3 combinations |
| `menu_items` | 88 dishes | `category`, `is_available`, `stock_qty` (NULL = unlimited), `tags_reviewed`, `image_url` (`''` means "photo removed on purpose") |
| `menu_item_tags` | Tags per dish | Inferred by keyword at first seed, then edited in admin |
| `orders` | One live order per seat (`seat_id UNIQUE`) | status CHECK pending/preparing/prepared/delivered/completed; `edit_token` secret |
| `order_items` | PK (order_id, category) enforces one dish per category | |
| `order_conditions` | Conditions declared at order time | Snapshot, survives later renames/deletes |
| `meta` | One-off migration flags | |

Counts after a fresh start: 312 seats, 88 menu items, 13 conditions, 14 tags. 36 distinct photographed dishes (66 dish rows share them across classes); 15 wine/champagne rows have no photo by decision.

### Data safety facts

- Foreign keys are ON. Deleting an order cascades its items/conditions. A dish used by any order cannot be deleted (admin gets a 409 and is told to mark it unavailable).
- WAL mode means recent writes live in `catering.sqlite-wal`. **Never copy the .sqlite file by hand while running.** Use `npm run backup` (uses SQLite's online backup API).
- Admin-uploaded photos are **files** in `WEB/images/menu/<uuid>.webp` (+ `thumb/`), referenced from the database. They are not in backups (TD-09).

---

## 8. Business rules (the part to preserve)

**Ordering** (`models/orderModel.js`, one DB transaction):
1. Seat must exist; **cabin class is derived from the seat**, never trusted from the client.
2. Declared conditions: strings, unique, must be active, at most `MAX_CONDITIONS` (default 5).
3. At least one dish. At most one per category (database primary key enforces it).
4. Every dish must belong to that class + flight length and match the category.
5. Not sold out: `is_available` and `used < stock_qty`, where `used` counts other orders' items (an editing passenger's own pick is excluded).
6. No health conflict: for the declared conditions, any tag the dish carries that a condition forbids blocks the dish (422 with explanation, e.g. "Contains eggs: not suitable with Eggs.").
7. Existing order: only the holder of `edit_token` may change it (403 otherwise), and only while `pending` (409 after).
8. Status values are free to move between any two states (crew can undo).
9. After a successful order the seat's saved conditions/haul are mirrored (`upsertPreferences`) so the crew seat map and AI view stay consistent.

**Health compatibility** (`models/compatibilityModel.js`): a dish conflicts with a condition if `menu_item_tags` intersects `condition_restrictions`. Message format is user-facing.

**Tag inference** (`data/healthConditions.js`): regex keyword rules over name + description, deliberately conservative; wine/champagne get only `alcohol`. These are **defaults needing human review**; this is the main safety-critical caveat in the whole system.

**Passenger privacy:** order payloads include health data. Passengers can only read/subscribe to their own seat using the order token. A seat's stored conditions and the full seat list are crew-only; the public seat list returns layout only. The AI endpoint never reads stored seat data; it uses conditions sent in the request.

---

## 9. API reference

Auth legend: **Public**, **Crew** (`Authorization: Bearer <crew token>`), **Owner** (`x-order-token` header proving the order). All JSON unless noted. Errors are `{ "error": "message", ...extra }`.

| Method & path | Auth | Purpose / notes |
|---|---|---|
| POST `/api/crew/login` | Public, 10/min/IP | `{passkey}` -> `{token}`. Token valid 12 h, in memory |
| GET `/api/crew/session` | Crew | 200 if the token is still valid |
| GET `/api/fleet` | Public | Aircraft list (only A350-900 available) |
| GET `/api/seat-grid-config` | Public | Cabin layout for the seat map |
| GET `/api/seats` | Public (layout) / Crew (full) | Public: `seatId,row,letter,classType`. Crew adds `hasPreferences`, meal/haul/time |
| GET `/api/seats/:seatId` | Public | Seat + class |
| GET/PUT `/api/seats/:seatId/preferences` | Crew | Saved conditions and extras |
| POST `/api/seats/randomize-preferences` | Crew | Demo tool: overwrites all seats' prefs |
| GET `/api/health-conditions` | Public | `{maxConditions, conditions[]}` active only |
| GET `/api/portal/menu?seat=&haul=&conditions=` | Public | Menu by category with `conflicts`, `soldOut`, `remaining` |
| POST `/api/orders` | Public, 60/min/IP (`ORDER_RATE_LIMIT`) | Place/edit. Body `{seatId, passengerName?, haulLength, conditions[], selections{category:id\|null}}`. 201 new + `token`; 200 edit. 400/403/404/409/422 |
| GET `/api/orders/seat/:seatId` | Owner | The caller's own order |
| GET `/api/orders` | Crew | List; query `search,classType,status,condition` |
| PATCH `/api/orders/:id/status` | Crew | `{status}` |
| DELETE `/api/orders/:id` | Crew | Release the seat |
| GET `/api/menu/:classType/:haulLength` | Public | Dining page menu (sections) |
| GET `/api/dining-matrix` | Public | **Legacy**, no longer used by the frontend |
| POST `/api/meal/recommend` | Public, 6/min/IP (`AI_RATE_LIMIT`) | `{seatNumber, haulType, conditions[], selectedMeals[]}`. 503 `ai_not_configured` if no key; 502 on AI failure |
| GET `/api/features` | Public | `{aiSuggestions: boolean}` |
| GET `/api/qr.svg`, `/api/qr.png?url=` | Public | Encodes an http(s) URL only. `&download=1` for attachment |
| GET `/api/server-info` | Crew | LAN addresses, best guess first |
| GET `/api/admin/meta` | Crew | Dropdown options, tags |
| GET/POST `/api/admin/meals`, PUT/DELETE `/api/admin/meals/:id` | Crew | CRUD; PUT is partial; DELETE blocked (409) if on an order |
| POST/DELETE `/api/admin/meals/:id/image` | Crew | multipart field `image`; PNG/JPG/WebP, 5 MB |
| GET/POST `/api/admin/conditions`, PUT/DELETE `/api/admin/conditions/:id` | Crew | Built-in conditions cannot be deleted |
| POST `/api/admin/tags`, DELETE `/api/admin/tags/:tag` | Crew | Built-in tags cannot be deleted |
| GET `/api/admin/reports/summary?classType=` | Crew | KPIs, breakdowns, top dishes, inventory, hourly times |
| GET `/api/admin/export/orders.xlsx` / `.pdf` (`?classType=`) | Crew | File downloads |

### Socket.IO events

- Handshake: `io({ auth: { token: <crew token> } })` joins room `crew` (all events).
- Client -> server: `join:seat {seatId, token}` with ack `{ok}`; joins `seat:<id>` only if the order token matches.
- Server -> clients: `order:upserted <order>` (to `crew` + that seat), `order:deleted {id, seatId}` (same), `menu:changed` (everyone).

---

## 10. Frontend

| Page | Entry module | Audience |
|---|---|---|
| `index.html` | `roleSelect.js` | everyone (passkey modal for crew) |
| `order.html` | `order.js` (+ `orderApi.js`, `recommendApi.js`) | passengers |
| `a350.html` | `app.js`, `seatGrid.js`, `crewPanel.js` | passengers (picker) / crew (`?mode=crew`) |
| `crew.html` | `crew.js`, `crewApi.js` | crew |
| `admin.html` | `admin.js` + `adminMeals/Conditions/Reports/Ui/Api.js` | staff |
| `qr.html` | `qr.js` | crew |
| `fleet.html` | `home.js` | crew |
| `menu.html` | `menu.js`, `menuApi.js` | everyone |

Conventions: HTML built with template strings and **always** passed through `escapeHtml` (staff-editable text); event delegation; keyed DOM updates on the crew board; `[hidden]` rule forced in CSS; CSS variables for light/dark (`[data-theme]` set before paint by `theme.js`); a shared crew navigation (`crewNav.js`); crew token in `localStorage` (`crewToken`), passenger order tokens in `localStorage` (`meal.token.<seat>`).

Accessibility: all text measured against WCAG contrast in both themes (13 pages x 2); keyboard focus on charts; tables as chart alternatives. Not audited with a screen reader.

---

## 11. AI integration

- Library: `@anthropic-ai/sdk`. Model from `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`). Request uses adaptive thinking (omitted), low effort, `max_tokens 4096`.
- Input: class, flight length, condition labels, already-selected meal ids, and **only dishes the passenger could actually order** (not sold out, no conflicts, correct class/haul).
- Output contract: JSON with up to 3 `recommendedMeals {mealId, mealName, score, reason}`, `summary`, `confidence`. The server **discards any mealId not in the menu it sent** (the real guard against invented dishes).
- Gateway: set `ANTHROPIC_BASE_URL` (and a model id the gateway accepts). On the owner's network an SSL-inspection proxy required `ANTHROPIC_ALLOW_INSECURE_TLS=true`, which disables certificate verification for this client only (security trade-off; prefer `NODE_EXTRA_CA_CERTS`).
- **Reply parsing (`extractJson` in `claudeClient.js`).** The prompt asks for bare JSON, but the model intermittently wraps it in a markdown fence (` ```json ... ``` `) or adds a sentence around it. This once caused passengers to see "suggestion service is not available" even though the model had answered correctly. The reader now accepts bare JSON, fenced JSON (with or without the `json` label) and JSON with surrounding text. It still rejects, rather than guesses at, truncated replies, prose-only replies, empty replies and JSON without a `recommendedMeals` list. If a reply is still unreadable the server asks the model once more (2 attempts total). Network and gateway errors are not retried.
- Failure behaviour: no key -> 503 + UI note + admin banner; AI error or unreadable reply after the retry -> 502 with a generic message (detail only in the server log); per-device rate limit 6/min.
- Verified live end-to-end through the owner's gateway: 5 of 5 requests (diabetes + high cholesterol + halal on a Business seat) returned 3 valid suggestions each, all orderable, none blocked, about 5 s per request. Parser covered by 9 checks. The fence case itself is proven by those parser checks and by the owner's real error log, not by a live reproduction (none of the 5 live replies happened to be fenced).
- Known weakness: correctness still depends on the model following the output format. See TD-20 for the sturdier approach (structured output / tool use).
- Not done: response caching, cost/usage tracking, prompt evaluation set, moderation of free text (there is no free text sent).

---

## 12. Security audit

Threat model (ASSUMPTION, high confidence): closed local network on an aircraft/demo; passengers are semi-trusted; the main assets are passengers' health information and the integrity of crew/admin functions.

| ID | Finding | Severity | Status / recommendation |
|---|---|---|---|
| S-01 | Single shared crew/admin passkey (default `123490`, 6 digits); admin = crew | **High** | Change `CREW_PASSKEY`. Longer term: per-user accounts and a separate admin role |
| S-02 | Crew tokens are in server memory and in browser `localStorage`; lost on restart | Medium | Acceptable for demo; use signed/short-lived tokens or sessions for production |
| S-03 | Plain HTTP; no HTTPS, so tokens and health data are visible on the Wi-Fi to anyone sniffing | **High** for any shared/untrusted network | Run on an isolated, WPA2/3-protected network; or put a TLS reverse proxy in front |
| S-04 | No HTTP security headers (CSP, X-Frame-Options, etc.) | Medium | Add `helmet` with a CSP; the app uses no inline scripts except the `theme.js` file |
| S-05 | Order privacy relies on a 128-bit random token per order (strong) | Low | OK. Tokens in localStorage are exposed to XSS, mitigated by consistent escaping |
| S-06 | Health data (seat conditions, order conditions) exposed only to crew or the order owner; public seat list is layout only | Resolved | Verified by tests |
| S-07 | AI endpoint is open and spends quota; per-IP limit 6/min | Medium | If all passengers share one NAT IP, limits apply to everyone; consider per-order-token limits |
| S-08 | `ANTHROPIC_ALLOW_INSECURE_TLS=true` in the owner's `.env` | Medium | Only for the proxy case; prefer installing the proxy CA |
| S-09 | Brute-force of passkey limited to 10 attempts/min/IP | Medium | Add lockout/backoff, longer passkey |
| S-10 | Uploads validated by decoding (sharp), 5 MB cap, re-encoded to WebP, random uuid names; originals never served | Low | Good. Add per-admin upload quota if exposed more widely |
| S-11 | SQL is parameterised throughout; dynamic IN lists use placeholders; LIKE escaped | Low | Good |
| S-12 | Excel export treats names as plain strings (no formula injection) | Low | Verified |
| S-13 | `/api/qr.*` encode arbitrary http(s) URLs for anyone | Low | Harmless; could restrict to the server's own address |
| S-14 | Dependency audit not run | Unknown | Run `npm audit` and pin/update in CI |
| S-15 | `.env` is git-ignored; the real key value was verified absent from every tracked file | Resolved | Keep it that way. Rotate the key if `.env` is ever shared or a machine is lost |
| S-16 | **Allergen safety**: tags are keyword-inferred; unreviewed dishes can still be ordered | **High (safety)** | Human review required; consider blocking orders of unreviewed dishes, or showing a warning |

---

## 13. Performance and scalability

Measured (load test, localhost, one Node process, Windows laptop):

| Scenario | Result |
|---|---|
| 305 simultaneous live connections | opened in ~236 ms |
| 300 passengers load menu + place order at the same instant | whole wave ~972 ms; menu p95 692 ms; order p95 385 ms; 0 failures |
| 300 simultaneous status changes | ~339 ms total, p95 309 ms |
| 120 passengers racing for 20 portions | exactly 20 succeed, 100 get a clean "sold out" |
| Event privacy under load | no passenger received another seat's order; every passenger got their own status change |
| With 300 orders: crew list / report / Excel / PDF | 8 ms / 4 ms / 115 ms / 183 ms |
| Photos | 70 MB originals -> 0.85 MB total served; thumbnails ~2 KB |

Limits and risks:

- **Single writer.** SQLite WAL allows many readers and one writer; fine for hundreds of users, not for thousands or multiple servers.
- **Single process, single machine.** No failover; a crash loses nothing persisted but disconnects clients (they auto-reconnect and re-sync). Use a process manager (pm2).
- **In-memory** crew tokens and rate-limit counters reset on restart; multi-process scaling would need a shared store.
- Report summary and crew list recompute from SQL on each request/event (debounced 1.5 s on the client); fine at 300 orders, revisit beyond a few thousand rows.
- `thumbFor` caches "thumbnail exists?" per URL for the process lifetime.
- Untested: sustained soak (hours), 500+ users, slow/lossy Wi-Fi, low-end phones.

---

## 14. Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` (or `ANTHROPIC_AUTH_TOKEN`) | none | AI key. Missing/placeholder -> AI off, everything else works |
| `ANTHROPIC_BASE_URL` | api.anthropic.com | Internal gateway URL |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Model id the gateway accepts |
| `ANTHROPIC_ALLOW_INSECURE_TLS` | off | Skip TLS verification for AI calls only |
| `CREW_PASSKEY` | `123490` | Crew/admin passkey |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `3000` | Port |
| `PUBLIC_URL` | auto | Address used in the passenger QR code |
| `MAX_CONDITIONS` | `5` | Max declared conditions |
| `ORDER_RATE_LIMIT` | `60` | Orders per IP per minute |
| `AI_RATE_LIMIT` | `6` | Suggestions per IP per minute |
| `NODE_ENV` | not set | Recommended `production` (Express optimisations) |

Important for moving to another computer: on the original developer's laptop the AI settings (`ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`, and `NODE_TLS_REJECT_UNAUTHORIZED`) are also present in the environment of programs started from the developer's terminal (whether set by Windows or by a tool is not known), so a fresh clone started there reports AI ON even with no `.env` (verified). They are **not** in the repository. A different computer starts with the AI off until these are supplied in its `.env` (and, on a network with an SSL-inspection proxy, `ANTHROPIC_ALLOW_INSECURE_TLS=true` or `NODE_EXTRA_CA_CERTS`). The code accepts either `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`.

No `requirements.txt` exists or is needed; dependencies are in `package.json` / `package-lock.json`.

---

## 15. Deployment and operations

**Install on a new machine**
1. Install Node 22 LTS (>= 20.9) and Git.
2. `git clone https://github.com/ZypherMex/PJT-smart-flight-catering` then `git checkout mainrepofrfr` (after the owner pushes it).
3. `npm install`; copy `.env.example` to `.env`; set the AI key (optional but expected) and `CREW_PASSKEY`.
4. `npm start`; check the banner: `AI meal suggestions: ON` and the printed passenger URL.
5. Windows firewall (admin PowerShell): `netsh advfirewall firewall add rule name="Smart Catering 3000" dir=in action=allow protocol=TCP localport=3000 profile=private`.
6. Sign in as crew, open **QR**, print the code.

**Operate**
- Backup: `npm run backup` (safe while running) -> `DATABASE/backups/`. Restore: stop the server, copy the backup over `DATABASE/catering.sqlite`, delete `-wal`/`-shm`.
- Move data to another laptop: backup file + copy `WEB/images/menu/` (uploaded photos).
- New photo: drop the original in `assets/menu-originals/`, run `npm run optimize-images`.
- Keep alive: `pm2 start API/server.js --name catering`.
- Logs: stdout only.

**Not in place:** CI/CD, containerisation, infrastructure as code, monitoring/alerting, log shipping, environment separation (dev/staging/prod), release process.

Environment-specific gotchas learned the hard way:
- Windows: stop the server with `taskkill //F //PID <windows pid from netstat>`.
- The shell used during development mishandled backslash-apostrophes in heredocs; write files with an editor tool.
- Do not copy the live SQLite file by hand (WAL).
- LF/CRLF warnings appear on every commit because there is no `.gitattributes`.

---

## 16. Testing status

**There is no automated test suite in the repository.** All verification was done with throwaway scripts (Playwright browser tests, `socket.io-client`, direct `fetch`), run and then deleted at the end of each phase. Their results:

| Phase | Checks passed |
|---|---|
| 2 orders/auth | 63 API + 9 browser |
| 3 passenger page | 33 browser |
| 4 crew board | 41 browser |
| 5 admin | 70 API + 40 browser |
| 6 reports/export | 50 API (opens real xlsx/pdf) + 32 browser |
| 7 QR / privacy / AI | 34 + 35 + 63 (dark-mode contrast audit, 13 pages x 2 themes) + 14 load test |
| AI key states | 11 (key present) + 12 (key missing) |
| AI reply parsing fix | 9 parser checks + 5 live gateway requests |

What these covered: auth on every protected route, validation (400/403/404/409/422/429), health blocking, stock races, ownership tokens, realtime delivery and privacy, migrations idempotent on restart, exports contents, QR decoding, contrast, responsive layouts at 340-1920 px, load.

**Highest-value next step:** turn these into a committed suite (`npm test`) and run it in CI. Suggested layout: `tests/api/*.test.js` (node:test + fetch against an in-memory/temp DB), `tests/e2e/*.spec.js` (Playwright), `tests/load/`. The scenarios above are the spec.

Known gaps: never tested on real phones over real Wi-Fi; no screen-reader testing; no Safari/iOS testing (Chromium only); no long soak test.

---

## 17. Production readiness checklist

| Item | Status |
|---|---|
| Functional completeness for the A350 flow | Done |
| Input validation and consistent error shapes | Done |
| AuthN/AuthZ server-side | Partial (shared passkey, in-memory tokens) |
| Transport security (HTTPS) | **Not done** |
| Secrets management | Partial (`.env`, git-ignored; no vault) |
| Rate limiting | Done (login, orders, AI) |
| Health data privacy | Done for API; **not** encrypted at rest |
| Allergen data reviewed by a qualified person | **Not done** |
| Backups | Partial (DB only, manual, no schedule, uploaded photos excluded) |
| Monitoring / alerting / structured logs | **Not done** |
| Automated tests + CI | **Not done** |
| Real-device Wi-Fi test | **Not done** |
| Load tested | Done to 300 users (localhost) |
| Graceful degradation (AI down/missing) | Done |
| Accessibility basics (contrast, focus) | Partial |
| Documentation | Done (README, this file) |
| Release/versioning process | **Not done** |
| Legal/compliance review (health-data handling, privacy notice) | **Not done** |

Verdict: ready for a **supervised demo or pilot on an isolated network**; not ready for unsupervised passenger use until at least S-01, S-03, S-16, the real-device test, and automated tests are addressed.

---

## 18. Technical debt register

| ID | Debt | Impact | Effort | Suggested fix |
|---|---|---|---|---|
| TD-01 | No "flight" concept: orders aren't tied to a flight; reports are all-time; resetting for a new flight means releasing orders one by one | High | M | Add `flights` table, `flight_id` on orders, "end flight" archive, flight-level haul |
| TD-02 | **Flight length is chosen by the passenger**, so someone could order from a long-haul menu on a short flight | High | S-M | Make haul/time a crew-set flight property; ignore client value |
| TD-03 | `seat_preferences` has 13 dead boolean columns and duplicate state with `seat_conditions` (dual-write on each order) | Medium | M | Drop unused columns via a rebuild migration; single source |
| TD-04 | Legacy pieces still present: `diningMatrix.js` + `/api/dining-matrix`, `menu_items`-based Dining page, `meal_choice` fields, `getFlatMenu`, randomize tool | Low | S | Remove or move behind a "demo tools" flag |
| TD-05 | No automated tests | High | M | See section 16 |
| TD-06 | Shared passkey, no roles, no audit trail (who changed which status/meal) | High | M-L | Users table, roles, audit log |
| TD-07 | Crew tokens in memory | Medium | S | Persist sessions or sign tokens (JWT with rotation) |
| TD-08 | Express 4 requires manual async wrapping (`wrap()` used in places; sync handlers elsewhere) | Low | S | Upgrade to Express 5 or wrap all async handlers consistently |
| TD-09 | Backup excludes uploaded photos; no schedule or retention | Medium | S | Include `WEB/images/menu` uploads in backup; add scheduled task |
| TD-10 | `package.json` description is stale ("seat map and dining preference system"); no `engines` field | Low | S | Update, add `"engines": {"node": ">=20.9"}` |
| TD-11 | No `.gitattributes`, so CRLF/LF churn | Low | S | Add `* text=auto` and normalise |
| TD-12 | `thumbFor` negative-cache never expires | Low | S | Short TTL or invalidate on upload/optimise |
| TD-13 | Hard-coded English strings; no i18n/RTL | Medium (business) | L | Extract strings, add Arabic + RTL layout |
| TD-14 | Frontend duplicates small helpers (`friendlyError`, `pct`, escape variants) and large page modules (`order.js` is 740 lines) | Low | M | Extract shared modules; consider a tiny component pattern |
| TD-15 | PDF cannot render non-Latin scripts | Medium | M | Embed a Unicode font (e.g. Noto) in pdfkit |
| TD-16 | Status transitions unconstrained and unaudited; passengers cannot cancel their own order | Medium | S-M | Optional state machine; passenger cancel while pending |
| TD-17 | All 88 dishes flagged "needs tag review"; unreviewed dishes are still orderable | High (safety) | M | Review workflow with sign-off; block or warn on unreviewed |
| TD-18 | Folder name casing `DATABASE/` vs a lowercase `database` directory seen on disk; code assumes `DATABASE` (case-sensitive filesystems) | Low | S | Verify on Linux; normalise name |
| TD-19 | Admin password/passkey shown in README default | Low | S | Remove default or force first-run change |
| TD-20 | AI output format relies on the model obeying a prompt ("return only JSON"); it has already misbehaved once (code fences). The tolerant parser and one retry mitigate this but do not guarantee it | Medium | S-M | Use the API's structured output or a forced tool call with a JSON schema; validate each field (`mealId` integer, `score` 0-100); log reply failures with counts so drift is visible |

---

## 19. Roadmap

**Now (before any real use)**
1. Push the local commits (check `git status -sb`); verify a fresh clone runs.
2. Change `CREW_PASSKEY`; decide on network isolation / TLS (S-01, S-03).
3. Human review of allergen tags for all dishes (TD-17); decide policy for unreviewed dishes.
4. Real-phone Wi-Fi test using the README checklist.
5. Commit a test suite from the verified scenarios; add CI (GitLab or GitHub Actions) running tests + `npm audit`.

**Next**
6. Flight entity, crew-set haul, end-of-flight archive (TD-01, TD-02).
7. Per-user accounts, roles, audit log (TD-06, TD-07); `helmet` + CSP (S-04).
8. Remove legacy code and dead columns (TD-03, TD-04).
9. Backups: include uploads, schedule, retention (TD-09). Monitoring and structured logging.
10. Unicode PDF fonts; Arabic/RTL (TD-15, TD-13); structured AI output with schema validation (TD-20).

**Later**
11. Additional aircraft (A380, 777 variants): needs seat-grid configs, menus, fleet entries.
12. Optional move to PostgreSQL only if multi-server or very large scale is a real requirement.
13. Passenger cancel/reorder, crew notifications/sounds, kitchen printing, inventory forecasting from reports, PWA/offline, i18n.

---

## 20. Assumptions, unknowns and confidence

| # | Assumption / unknown | Confidence | Risk if wrong | How to confirm |
|---|---|---|---|---|
| A1 | Deployment target is a single laptop on an isolated Wi-Fi/LAN, 50-500 users | High (stated in the spec) | Architecture too small | Confirm expected peak and network |
| A2 | The project is a demo/portfolio/pilot, not an official airline system | Medium | Compliance gaps are larger than assumed | Ask the owner; check any contractual constraints |
| A3 | Allergen tags are not medically validated | High (known) | Safety/liability | Catering/medical review |
| A4 | Owner uses Windows 11; teammates may use Mac/Linux | Medium | Path/case issues (TD-18), scripts | Test a Linux clone |
| A5 | AI key and gateway belong to the owner's organisation; policy on sending dish names/conditions (no personal identifiers) to an external model is acceptable | Medium | Data-protection breach | Check organisational policy: note conditions are health data even without a name |
| A6 | Jira/Confluence/GitLab were discussed early (testing, pipeline) but nothing was created; repo is on GitHub | Medium | Pipeline choice | Ask which platform is authoritative |
| A7 | Early history (before `7d003a6`) reconstructed from summaries | Medium | Missed rationale | Read git log and old commits' diffs |
| A8 | Phones will reach the laptop directly (no client isolation on the AP) | Low-Medium | Passengers cannot connect | Real-device test; many guest/hotspot networks isolate clients |
| A9 | Order rate limit per IP is fine because each phone has its own LAN IP | Medium | NAT/proxy would throttle everyone | Check how the aircraft/venue Wi-Fi assigns addresses |
| A10 | One live order per seat is the intended model | High (spec) | Re-ordering unsupported | Confirm product intent |

Overall confidence that this document lets a new engineer continue immediately: **high (about 90%)** for the codebase and behaviour; **medium** for product intent and early history.

---

## 21. Key decisions log

| Decision | Reason |
|---|---|
| Extend the existing stack; add Socket.IO; no React/Postgres | Smallest change that meets 50-500 users on one LAN; nothing extra to install |
| Fold ordering into the existing app (Customer card -> `order.html`) | One product, one server |
| Keep 3 real cabin classes (no Premium Economy) | No seats/menus exist for it |
| Reuse the crew passkey for admin | Owner's choice (simplicity) |
| Class derived from seat on the server | Prevents claiming a higher cabin |
| Max 5 conditions, enforced server-side | Spec; configurable |
| Per-order edit token; passengers subscribe only to their own seat | Seat numbers are guessable; payloads contain health data |
| Crew auth moved from a front-end flag to server tokens | Passengers' phones share the server |
| Photos converted to WebP, originals kept outside the served folder | 70 MB -> under 1 MB |
| Customer seat map reduced to a picker; AI moved into the order page using request-supplied conditions | Close the health-data leak without losing the AI feature |
| AI key "expected but optional" | Owner wanted it prominent but not blocking |
| Commit only on owner approval; owner pushes | Standing owner instruction |

---

## 22. Starting prompt for the next AI assistant

> You are taking over "Smart Flight Catering", a Node.js/Express/SQLite/Socket.IO meal-ordering system for aircraft. Read `docs/HANDOVER.md` fully, then `README.md`. The code is in `API/` (backend) and `WEB/` (frontend, vanilla ES modules). It runs with `npm install && npm start`. Follow these rules: ask the owner before every git commit, never push, never commit `.env` or the database; write tests for anything you change; keep the passenger health-data privacy rules in section 8; check section 18 and 19 before choosing what to work on. First task suggestions: (1) turn the verified scenarios in section 16 into a committed test suite, (2) fix TD-02 (flight-level haul), (3) allergen tag review workflow (TD-17).
