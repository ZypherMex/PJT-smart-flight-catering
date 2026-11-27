import { getFleet } from './api.js';
import { verifyCrewSession } from './crewAuth.js';
import { mountCrewNav } from './crewNav.js';

function renderFleetCard(aircraft) {
  const isAvailable = aircraft.status === 'available';
  const seatInfo = aircraft.totalSeats ? `${aircraft.totalSeats} seats` : 'Seat map coming soon';

  const inner = `
    <div class="aircraft-icon">&#9992;</div>
    <div class="aircraft-name">${aircraft.name}</div>
    <p class="aircraft-tagline">${aircraft.tagline}</p>
    <div class="aircraft-meta">
      <span class="seat-count">${seatInfo}</span>
      ${isAvailable ? '<span class="badge badge-live">Available</span>' : '<span class="badge badge-muted">Coming soon</span>'}
    </div>
  `;

  if (isAvailable) {
    return `<a class="aircraft-card" href="${aircraft.href}">${inner}</a>`;
  }
  return `<div class="aircraft-card aircraft-card-disabled">${inner}</div>`;
}

async function init() {
  // Fleet/flight selection is crew-only — anyone without a valid crew session
  // goes back to the role selector.
  if (!(await verifyCrewSession())) {
    window.location.replace('index.html');
    return;
  }
  mountCrewNav('fleet');

  const grid = document.getElementById('fleetGrid');
  try {
    const { fleet } = await getFleet();
    grid.innerHTML = fleet.map(renderFleetCard).join('');
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<div class="panel-placeholder">Failed to load fleet. Is the server running?</div>';
  }
}

init();
