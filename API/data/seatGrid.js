// Single source of truth for the A350-900 cabin layout: 24 First, 32 Business,
// 256 Economy (312 total). Row numbers run continuously nose-to-tail; letter
// "I" is never used. Economy's final row (43) is a real-world fuselage taper:
// 28 full 3-3-3 rows (252 seats) + one shortened A/B/D/E row (4 seats) = 256.

const FIRST_BUSINESS_SHAPE = [['A'], ['D', 'G'], ['K']];
const ECONOMY_FULL_SHAPE = [['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'J']];
const ECONOMY_TAPER_SHAPE = [['A', 'B'], ['D', 'E']];

const CABINS = [
  {
    key: 'first',
    name: 'First',
    rowStart: 1,
    rowEnd: 6,
    rowShape: () => FIRST_BUSINESS_SHAPE,
  },
  {
    key: 'business',
    name: 'Business',
    rowStart: 7,
    rowEnd: 14,
    rowShape: () => FIRST_BUSINESS_SHAPE,
  },
  {
    key: 'economy',
    name: 'Economy',
    rowStart: 15,
    rowEnd: 43,
    rowShape: (row) => (row === 43 ? ECONOMY_TAPER_SHAPE : ECONOMY_FULL_SHAPE),
  },
];

function flattenShape(groups) {
  return groups.reduce((letters, group) => letters.concat(group), []);
}

// Generates every seat as { seatId, row, letter, classType } in row order.
function generateAllSeats() {
  const seats = [];
  for (const cabin of CABINS) {
    for (let row = cabin.rowStart; row <= cabin.rowEnd; row++) {
      const letters = flattenShape(cabin.rowShape(row));
      for (const letter of letters) {
        seats.push({ seatId: `${row}${letter}`, row, letter, classType: cabin.name });
      }
    }
  }
  return seats;
}

// Serializable grid config for the frontend to render from (functions can't cross JSON).
function getGridConfig() {
  return {
    cabins: CABINS.map((cabin) => ({
      key: cabin.key,
      name: cabin.name,
      rowStart: cabin.rowStart,
      rowEnd: cabin.rowEnd,
      rows: Array.from({ length: cabin.rowEnd - cabin.rowStart + 1 }, (_, i) => {
        const row = cabin.rowStart + i;
        return { row, groups: cabin.rowShape(row) };
      }),
    })),
    totalSeats: generateAllSeats().length,
  };
}

module.exports = { CABINS, generateAllSeats, getGridConfig };
