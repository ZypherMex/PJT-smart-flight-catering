import { getGridConfig, getAllSeats, getDiningMatrix } from './api.js';
import { renderSeatMap, highlightSelectedSeat, setSeatHasPrefs } from './seatGrid.js';
import { openSeatPanel, updateGlobalContext, closePanel } from './preferencePanel.js';

const state = { haul: 'shortHaul', time: 'lunchDinner', gridConfig: null, diningMatrix: null };

function cabinByKey(gridConfig, key) {
  return gridConfig.cabins.find((c) => c.key === key);
}

async function onSeatClick(seatId, cabinKey) {
  highlightSelectedSeat(seatId);
  const cabin = cabinByKey(state.gridConfig, cabinKey);
  await openSeatPanel(seatId, cabin, state.diningMatrix, state.haul, state.time, (savedSeatId) => {
    setSeatHasPrefs(savedSeatId, true);
  });
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
}

document.addEventListener('panel-closed', () => highlightSelectedSeat(null));

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
