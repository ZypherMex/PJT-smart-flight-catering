const { getPortalMenu } = require('./orderModel');

// Builds everything the Claude call needs for one passenger. The passenger's
// conditions come from the request (never from stored seat data, which would let
// anyone read another seat's health information). The menu is the same
// class + flight-length menu the ordering portal shows, minus anything the
// passenger can't have — conflicting with their conditions, sold out or switched
// off — so the AI is never even offered a dish they couldn't order.
function buildRecommendationContext(seatId, haulLength, conditions) {
  const menu = getPortalMenu(seatId, haulLength, conditions.map((condition) => condition.id));

  const availableMenu = menu.categories
    .flatMap((group) => group.items)
    .filter((item) => !item.soldOut && item.conflicts.length === 0)
    .map(({ id, name, description, category }) => ({ id, name, description, category }));

  return {
    seatId,
    flightClass: menu.seat.classType,
    haulLength,
    healthConditions: conditions.map((condition) => condition.label),
    availableMenu,
  };
}

module.exports = { buildRecommendationContext };
