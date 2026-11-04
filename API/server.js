require('dotenv').config();

const app = require('./app');
const { seedSeatsIfEmpty, seedMenuIfEmpty } = require('./db/seed');

const PORT = process.env.PORT || 3000;

if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-key-here') {
  console.warn('ANTHROPIC_API_KEY is not set — /api/meal/recommend will fail until .env is configured.');
}

const seatCount = seedSeatsIfEmpty();
console.log(`Seats table ready (${seatCount} seats).`);

const menuItemCount = seedMenuIfEmpty();
console.log(`Menu table ready (${menuItemCount} items).`);

app.listen(PORT, () => {
  console.log(`Smart Flight Catering app running at http://localhost:${PORT}`);
});
