import { getGridConfig, getAllSeats, getDiningMatrix, randomizeAllPreferences } from './api.js';
import { renderSeatMap, highlightSelectedSeat, setSeatHasPrefs } from './seatGrid.js';
import { openSeatPanel, updateGlobalContext, closePanel } from './preferencePanel.js';

const state = { haul: 'shortHaul', time: 'lunchDinner', gridConfig: null, diningMatrix: null, currentSeat: null, currentCabinKey: null };

function cabinByKey(gridConfig, key) {
  return gridConfig.cabins.find((c) => c.key === key);
}

async function onSeatClick(seatId, cabinKey) {
  highlightSelectedSeat(seatId);
  state.currentSeat = seatId;
  state.currentCabinKey = cabinKey;
  const cabin = cabinByKey(state.gridConfig, cabinKey);
  await openSeatPanel(seatId, cabin, state.diningMatrix, state.haul, state.time, (savedSeatId) => {
    setSeatHasPrefs(savedSeatId, true);
  });
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

function wireControls() {
  const haulSelect = document.getElementById('haulSelect');
  const timeSelect = document.getElementById('timeSelect');
  haulSelect.value = state.haul;
  timeSelect.value = state.time;

  haulSelect.addEventListener('change', (e) => {
    state.haul = e.target.value;
    updateGlobalContext(state.haul, state.time);
  });
  timeSelect.addEventListener('change', (e) => {
    state.time = e.target.value;
    updateGlobalContext(state.haul, state.time);
  });

  document.getElementById('randomizeBtn').addEventListener('click', onRandomizeClick);
}

document.addEventListener('panel-closed', () => {
  highlightSelectedSeat(null);
  state.currentSeat = null;
  state.currentCabinKey = null;
});

async function init() {
  const [gridConfig, seats, diningMatrix] = await Promise.all([getGridConfig(), getAllSeats(), getDiningMatrix()]);
  state.gridConfig = gridConfig;
  state.diningMatrix = diningMatrix;

  renderSeatMap(gridConfig, seats, onSeatClick);
  wireControls();
  closePanel();
}

init().catch((err) => {
  console.error(err);
  document.getElementById('seatmap').innerHTML = '<div class="panel-placeholder">Failed to load seat map. Is the server running?</div>';
});
