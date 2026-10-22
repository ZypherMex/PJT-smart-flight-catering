const app = require('./app');
const { seedSeatsIfEmpty } = require('./db/seed');

const PORT = process.env.PORT || 3000;

const seatCount = seedSeatsIfEmpty();
console.log(`Seats table ready (${seatCount} seats).`);

app.listen(PORT, () => {
  console.log(`Smart Flight Catering app running at http://localhost:${PORT}`);
});
