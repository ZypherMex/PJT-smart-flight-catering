require('dotenv').config();

const http = require('http');
const app = require('./app');
const { initSocket } = require('./realtime/socket');
const { migrateSeatPreferencesColumns, seedSeatsIfEmpty, seedMenuIfEmpty, syncMenuImages } = require('./db/seed');
const {
  migrateMenuColumns,
  migrateOrderColumns,
  backfillMenuCategories,
  seedHealthConditionsIfEmpty,
  migrateSeatConditionsFromColumns,
  capSeatConditionsOnce,
  tagUnreviewedMenuItems,
} = require('./db/migrate');

const PORT = process.env.PORT || 3000;

if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-key-here') {
  console.warn('ANTHROPIC_API_KEY is not set — /api/meal/recommend will fail until .env is configured.');
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
});

//This is is a NGL I REALLY WANNA PUSH ITcomment i hope nothing breaks while it is at it.