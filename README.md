# Smart Flight Catering

A meal-ordering system for an aircraft cabin. Passengers scan a QR code, pick a seat, say if they have any health conditions, and order their meals from their own phone. Cabin crew watch every order arrive live and move it through preparation and delivery. Staff manage the menu, photos and health rules, and export reports. Everything runs from one laptop on a local network, with no internet needed for the core system.

## Quick start

You need [Node.js](https://nodejs.org). It was built and tested on version 22; version 20 or newer should also work.

```
npm install
copy .env.example .env      (macOS/Linux: cp .env.example .env)
npm start
```

Open http://localhost:3000. The first start creates the database and loads the menu. The terminal also prints the address passengers should use, for example `http://192.168.1.23:3000/order.html`.

Edit `.env` before real use. At minimum change `CREW_PASSKEY` (the default is `123490`).

## Who uses what

| Page | For | What it does |
|---|---|---|
| `index.html` | Everyone | Choose **Customer** or **Cabin Crew** (crew enter the passkey) |
| `order.html` | Passengers (the QR code opens this) | Enter seat, health conditions, choose meals, place and track the order |
| `a350.html` | Passengers | Tap a seat on the aircraft map to start an order |
| `crew.html` | Crew | Live order board: search, filter, change status |
| `a350.html?mode=crew` | Crew | Seat map showing what each seat has saved |
| `admin.html` | Staff | Meals, photos, stock, health rules, reports, Excel/PDF export |
| `qr.html` | Crew | Print the passenger QR code |
| `menu.html` | Everyone | The full dining menu with photos |

Passengers need no account. An order is tied to the device that placed it, so nobody else can read or change it.

## Running it on a local network (Wi-Fi)

1. Connect this computer to the network passengers will join (a router or a hotspot).
2. Start the server (`npm start`). It prints the address(es) other devices can use.
3. **Windows only, first time:** allow the port through the firewall. Run PowerShell **as Administrator**:
   ```
   netsh advfirewall firewall add rule name="Smart Catering 3000" dir=in action=allow protocol=TCP localport=3000 profile=private
   ```
   (Or choose "Allow" when Windows asks the first time Node starts.)
4. Sign in as crew, open **QR**, check the address is the right network, and print it.
5. Phones on the same network scan it and the order page opens.

If this computer is on several networks (Wi-Fi and Ethernet, VPN, virtual adapters), the QR page lists them with the most likely one first. Pick the one passengers use, or set `PUBLIC_URL` in `.env`.

### Phone test checklist (not yet done on real devices)

The system has been tested with simulated phones, a 300-passenger load test and a real browser, but **not yet on physical phones over Wi-Fi**. Before relying on it, try this once with two or three real phones:

- [ ] Phone joins the same Wi-Fi, scans the printed QR code, and the order page opens
- [ ] Pick a seat, tick a health condition, and confirm blocked dishes show a reason
- [ ] Place an order; it appears on the crew board within about a second
- [ ] Crew press "Start preparing"; the phone's status card changes without a refresh
- [ ] Turn the phone's Wi-Fi off and on during an order; the page recovers and shows the right status
- [ ] Try light and dark mode (the moon/sun button in the top bar)

## Settings (`.env`)

| Setting | Default | What it does |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `HOST` | `0.0.0.0` | `0.0.0.0` lets other devices connect; `127.0.0.1` keeps it to this computer |
| `PUBLIC_URL` | (detected) | The address to put in the QR code, e.g. `http://192.168.1.23:3000` |
| `CREW_PASSKEY` | `123490` | Passkey for crew and admin. **Change this.** |
| `MAX_CONDITIONS` | `5` | Most health conditions a passenger may declare |
| `ORDER_RATE_LIMIT` | `60` | Orders/menu changes per device per minute |
| `AI_RATE_LIMIT` | `6` | Meal suggestions per device per minute |
| `ANTHROPIC_API_KEY` etc. | | For the optional AI meal suggestions (see `.env.example`) |

## Data and backups

Everything lives in `DATABASE/catering.sqlite`. To make a safe copy (works while the server is running):

```
npm run backup
```

Backups go to `DATABASE/backups/`. Do not copy the `.sqlite` file by hand while the server runs: the newest orders can be sitting in a side file and would be missed. To restore, stop the server and copy a backup over `DATABASE/catering.sqlite`.

## Dish photos

Put the full-size photo in `assets/menu-originals/` (named after the dish, for example `caviar.png`) and run:

```
npm run optimize-images
```

This creates the small, fast versions the website serves (about 99% smaller). Staff can also upload photos in **Admin > Meals**, which are resized automatically.

## Keeping it running

For a demo, `npm start` in a terminal is enough. To restart automatically if it crashes, use a process manager such as [pm2](https://pm2.keymetrics.io): `npm install -g pm2`, then `pm2 start API/server.js --name catering`.

## Things to know

- **Allergen tags need a human review.** The tags that stop a passenger ordering an unsuitable dish were suggested automatically from dish descriptions. In **Admin > Meals**, dishes marked "Needs tag review" should be checked by someone who knows the menu. Passengers are told it is a guide only.
- **Same network only.** The system is designed for a closed local network. It uses plain `http` (no HTTPS) and a shared crew passkey. Do not expose it to the internet.
- **PDF reports** cannot print non-Latin scripts (for example Arabic names appear as `?`). The Excel export keeps them.
- The crew passkey is kept on the server and checked there; crew sign-ins end when the server restarts or after 12 hours.
