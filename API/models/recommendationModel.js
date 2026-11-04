const { getSeat } = require('./seatModel');
const { getPreferences } = require('./preferenceModel');
const { getFlatMenu } = require('./menuModel');

// Flattens the seat's four checkbox groups (allergies, intolerances, medical
// conditions, other/dietary) into one list — this IS the passenger's health
// conditions + dietary restrictions, taken directly from the checkboxes
// already saved for this seat. No separate health-conditions list.
function flattenChecks(checks) {
  return [
    ...checks.allergies,
    ...checks.intolerances,
    ...checks.medicalConditions,
    ...checks.other,
  ];
}

// Builds everything the Claude recommendation call needs for one seat: its
// real cabin class (from the DB, never trusted from the client), its saved
// health/dietary checkboxes, and the exact menu rows available for that
// class+haul — the only meals Claude is allowed to recommend from.
function buildRecommendationContext(seatId, haulLength) {
  const seat = getSeat(seatId);
  if (!seat) return null;

  const preferences = getPreferences(seatId);
  const healthConditions = flattenChecks(preferences.checks);
  const availableMenu = getFlatMenu(seat.classType, haulLength);

  return {
    seatId,
    flightClass: seat.classType,
    haulLength,
    healthConditions,
    availableMenu,
  };
}

module.exports = { buildRecommendationContext };
