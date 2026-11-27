// Passengers may declare at most this many health conditions (applies to the
// seat map, the seat page and the ordering portal — enforced server-side).
const MAX_CONDITIONS = Number(process.env.MAX_CONDITIONS) || 5;

module.exports = { MAX_CONDITIONS };
