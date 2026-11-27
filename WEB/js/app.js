import { getGridConfig, getAllSeats, getDiningMatrix, randomizeAllPreferences } from './api.js';
import { renderSeatMap, highlightSelectedSeat, setSeatHasPrefs } from './seatGrid.js';
import { openSeatPanel, closePanel } from './preferencePanel.js';
import { openCrewPanel, closeCrewPanel } from './crewPanel.js';
import { verifyCrewSession } from './crewAuth.js';

const mode = new URLSearchParams(window.location.search).get('mode') === 'crew' ? 'crew' : 'customer';

// Crew mode needs a valid crew session (checked with the server). A customer
// link never carries ?mode=crew, so this only blocks someone who typed it by
// hand without signing in on the role-selector page.
async function guardCrewAccess() {
  if (mode !== 'crew') return true;
  if (await verifyCrewSession()) return true;
  window.location.replace('index.html');
  return false;
}

const state = { haul: 'shortHaul', time: 'lunchDinner', gridConfig: null, diningMatrix: null, currentSeat: null, currentCabinKey: null };

function cabinByKey(gridConfig, key) {
  return gridConfig.cabins.find((c) => c.key === key);
}

function closeActivePanel() {
  if (mode === 'crew') closeCrewPanel();
  else closePanel();
}

async function onSeatClick(seatId, cabinKey) {
  highlightSelectedSeat(seatId);
  state.currentSeat = seatId;
  state.currentCabinKey = cabinKey;
  const cabin = cabinByKey(state.gridConfig, cabinKey);
  if (mode === 'crew') {
    await openCrewPanel(seatId, cabin);
  } else {
    await openSeatPanel(seatId, cabin, state.diningMatrix, (savedSeatId) => {
      setSeatHasPrefs(savedSeatId, true);
    });
  }
}

async function refreshSeatIndicators() {
  const seats = await getAllSeats();
  seats.forEach((seat) => setSeatHasPrefs(seat.seatId, !!seat.hasPreferences));
}

async function onRandomizeClick() {
  const confirmed = window.confirm(
    'This will overwrite every seat\'s saved allergy, medical and dining preferences with new random values. Continue?'
  );
  if (!confirmed) return;

  const btn = document.getElementById('randomizeBtn');
  btn.disabled = true;
  try {
    const { updatedCount } = await randomizeAllPreferences(state.haul, state.time);
    await refreshSeatIndicators();
    if (state.currentSeat) {
      await onSeatClick(state.currentSeat, state.currentCabinKey);
    }
    console.log(`Randomized preferences for ${updatedCount} seats.`);
  } catch (err) {
    console.error(err);
    window.alert('Failed to randomize seat preferences. Is the server running?');
  } finally {
    btn.disabled = false;
  }
}

// The page-level haul/time selectors only exist in crew mode, and only drive
// the bulk randomizer there — per-seat haul/time now lives in the customer's
// own panel (preferencePanel.js) and is saved per seat, not picked globally.
function wireCrewControls() {
  const haulSelect = document.getElementById('haulSelect');
  const timeSelect = document.getElementById('timeSelect');
  haulSelect.value = state.haul;
  timeSelect.value = state.time;

  haulSelect.addEventListener('change', (e) => {
    state.haul = e.target.value;
  });
  timeSelect.addEventListener('change', (e) => {
    state.time = e.target.value;
  });

  document.getElementById('randomizeBtn').addEventListener('click', onRandomizeClick);
}

document.addEventListener('panel-closed', () => {
  highlightSelectedSeat(null);
  state.currentSeat = null;
  state.currentCabinKey = null;
});

async function init() {
  if (!(await guardCrewAccess())) return;
  document.body.classList.add(mode === 'crew' ? 'mode-crew' : 'mode-customer');

  const [gridConfig, seats, diningMatrix] = await Promise.all([getGridConfig(), getAllSeats(), getDiningMatrix()]);
  state.gridConfig = gridConfig;
  state.diningMatrix = diningMatrix;

  renderSeatMap(gridConfig, seats, onSeatClick);
  if (mode === 'crew') wireCrewControls();
  closeActivePanel();
}

init().catch((err) => {
  console.error(err);
  document.getElementById('seatmap').innerHTML = '<div class="panel-placeholder">Failed to load seat map. Is the server running?</div>';
});
