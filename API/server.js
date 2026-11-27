require('dotenv').config();

const http = require('http');
const app = require('./app');
const { initSocket } = require('./realtime/socket');
const { getAccessUrls } = require('./services/networkService');
const { isAiConfigured, describeAi } = require('./services/aiConfig');
const { migrateSeatPreferencesColumns, seedSeatsIfEmpty, seedMenuIfEmpty, syncMenuImages } = require('./db/seed');
const {
  migrateMenuColumns,
  migrateOrderColumns,
  backfillMenuCategories,
  seedHealthConditionsIfEmpty,
  migrateSeatConditionsFromColumns,
  capSeatConditionsOnce,
  migrateMenuImagesToWebp,
  tagUnreviewedMenuItems,
} = require('./db/migrate');

const PORT = process.env.PORT || 3000;

if (isAiConfigured()) {
  console.log(`AI meal suggestions: ON (${describeAi()})`);
} else {
  console.warn('');
  console.warn('  *** AI KEY MISSING: meal suggestions are switched OFF ***');
  console.warn('  Ordering, the crew board, admin and reports all work normally.');
  console.warn('  To turn suggestions on: put your key in the .env file as ANTHROPIC_API_KEY=... and restart.');
  console.warn('');
}

migrateSeatPreferencesColumns();
const seatCount = seedSeatsIfEmpty();
console.log(`Seats table ready (${seatCount} seats).`);

const menuItemCount = seedMenuIfEmpty();
console.log(`Menu table ready (${menuItemCount} items).`);

migrateMenuColumns();
migrateOrderColumns();
const categorizedCount = backfillMenuCategories();
if (categorizedCount) console.log(`Menu categories assigned (${categorizedCount} items).`);

const webpMoved = migrateMenuImagesToWebp();
if (webpMoved) console.log(`Dish photos switched to optimised WebP (${webpMoved} dishes).`);
const syncedImageCount = syncMenuImages();
console.log(`Menu photos synced (${syncedImageCount} items updated).`);

const conditionCount = seedHealthConditionsIfEmpty();
if (conditionCount) console.log(`Health conditions seeded (${conditionCount}).`);
const copiedConditions = migrateSeatConditionsFromColumns();
if (copiedConditions) console.log(`Migrated ${copiedConditions} existing seat condition selections.`);
const trimmedConditions = capSeatConditionsOnce();
if (trimmedConditions) console.log(`Trimmed ${trimmedConditions} condition selections on seats over the limit.`);
const taggedCount = tagUnreviewedMenuItems();
if (taggedCount) console.log(`Dish allergen/health tags inferred (${taggedCount} tags — pending staff review).`);

// 0.0.0.0 so phones on the same Wi-Fi can reach the server, not just this machine.
const HOST = process.env.HOST || '0.0.0.0';
const server = http.createServer(app);
initSocket(server);

server.listen(PORT, HOST, () => {
  console.log(`Smart Flight Catering app running at http://localhost:${PORT}`);
  const urls = getAccessUrls(PORT);
  if (urls.length) {
    console.log('Passengers on the same network can open:');
    urls.forEach((entry) => console.log(`  ${entry.url}/order.html   (${entry.interface})`));
    console.log('Crew: sign in and open QR in the menu to print the passenger QR code.');
  } else {
    console.log('No network address found: connect this computer to the Wi-Fi/network passengers will use.');
  }
});

//This is is a NGL I REALLY WANNA PUSH ITcomment i hope nothing breaks while it is at it.