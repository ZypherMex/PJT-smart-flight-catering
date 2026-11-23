require('dotenv').config();

const app = require('./app');
const { migrateSeatPreferencesColumns, seedSeatsIfEmpty, seedMenuIfEmpty, syncMenuImages } = require('./db/seed');

const PORT = process.env.PORT || 3000;

if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-key-here') {
  console.warn('ANTHROPIC_API_KEY is not set — /api/meal/recommend will fail until .env is configured.');
}

migrateSeatPreferencesColumns();
const seatCount = seedSeatsIfEmpty();
console.log(`Seats table ready (${seatCount} seats).`);

const menuItemCount = seedMenuIfEmpty();
console.log(`Menu table ready (${menuItemCount} items).`);

const syncedImageCount = syncMenuImages();
console.log(`Menu photos synced (${syncedImageCount} items updated).`);

app.listen(PORT, () => {
  console.log(`Smart Flight Catering app running at http://localhost:${PORT}`);
});

//This is is a NGL I REALLY WANNA PUSH ITcomment i hope nothing breaks while it is at it.