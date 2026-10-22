const db = require('./connection');
const { generateAllSeats } = require('../data/seatGrid');

function seedSeatsIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM seats').get();
  if (count > 0) return count;

  const insert = db.prepare(
    'INSERT INTO seats (seat_id, row_number, seat_letter, class_type) VALUES (?, ?, ?, ?)'
  );
  const insertMany = db.transaction((seats) => {
    for (const seat of seats) {
      insert.run(seat.seatId, seat.row, seat.letter, seat.classType);
    }
  });

  const seats = generateAllSeats();
  insertMany(seats);
  return seats.length;
}

module.exports = { seedSeatsIfEmpty };
