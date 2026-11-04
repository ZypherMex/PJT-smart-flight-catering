// The list of aircraft the home page offers. Only the A350-900 has a real,
// built-out seat map/dining experience right now; the rest are listed as
// "Coming soon" so the fleet selector reflects what's actually implemented
// instead of linking to pages that don't exist yet.

const FLEET = [
  {
    key: 'a350-900',
    name: 'Airbus A350-900',
    tagline: 'Our newest widebody — First, Business & Economy',
    totalSeats: 312,
    status: 'available',
    href: 'a350.html',
  },
  {
    key: 'a380-800',
    name: 'Airbus A380-800',
    tagline: 'The world\'s largest passenger aircraft',
    totalSeats: null,
    status: 'coming-soon',
    href: null,
  },
  {
    key: 'b777-300er',
    name: 'Boeing 777-300ER',
    tagline: 'Long-haul workhorse of the Emirates fleet',
    totalSeats: null,
    status: 'coming-soon',
    href: null,
  },
  {
    key: 'b777-200lr',
    name: 'Boeing 777-200LR',
    tagline: 'Ultra-long-range nonstop service',
    totalSeats: null,
    status: 'coming-soon',
    href: null,
  },
];

function getFleet() {
  return FLEET;
}

module.exports = { getFleet };
