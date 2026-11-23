// Read-only crew view of a seat: what the passenger chose, never editable.
// No save calls happen anywhere in this file.

import { getSeatPreferences } from './api.js';

const HAUL_LABELS = { shortHaul: 'Short Haul', mediumHaul: 'Medium Haul', longHaul: 'Long Haul' };
const TIME_LABELS = { breakfast: 'Breakfast', lunchDinner: 'Lunch/Dinner', eveningSnack: 'Evening/Snack' };
const GROUP_LABELS = [
  ['allergies', 'Allergies'],
  ['intolerances', 'Intolerances'],
  ['medicalConditions', 'Medical conditions'],
  ['other', 'Other'],
];
const CABIN_KEY_TO_TAG_CLASS = { first: 'cabin-first-tag', business: 'cabin-business-tag', economy: 'cabin-economy-tag' };

let currentSeatId = null;

function renderTags(items) {
  if (!items.length) return '<span class="crew-none">None</span>';
  return items.map((item) => `<span class="badge crew-tag">${item}</span>`).join(' ');
}

function render(seatId, cabin, prefs) {
  const container = document.getElementById('panel');
  const tagClass = CABIN_KEY_TO_TAG_CLASS[cabin.key];

  container.innerHTML = `
    <div class="panel-header">
      <div><span class="panel-seat">${seatId}</span><span class="panel-class ${tagClass}">${cabin.name} Class</span></div>
      <button type="button" id="closePanelBtn" class="close-btn">&#10005; Close</button>
    </div>
    <div class="crew-summary">
      <div class="crew-row"><strong>Meal choice</strong><span>${prefs.mealChoice || '<span class="crew-none">Not selected</span>'}</span></div>
      <div class="crew-row"><strong>Haul length</strong><span>${prefs.haulLength ? HAUL_LABELS[prefs.haulLength] : '<span class="crew-none">Not set</span>'}</span></div>
      <div class="crew-row"><strong>Time of day</strong><span>${prefs.mealTime ? TIME_LABELS[prefs.mealTime] : '<span class="crew-none">Not set</span>'}</span></div>
      <div class="crew-row"><strong>Last updated</strong><span>${prefs.updatedAt || '<span class="crew-none">Never</span>'}</span></div>
    </div>
    <div class="pref-groups">${GROUP_LABELS.map(
      ([key, label]) => `<div class="pref-group"><h4>${label}</h4>${renderTags(prefs.checks[key] || [])}</div>`
    ).join('')}</div>
  `;

  document.getElementById('closePanelBtn').addEventListener('click', closeCrewPanel);
}

export async function openCrewPanel(seatId, cabin) {
  currentSeatId = seatId;
  const prefs = await getSeatPreferences(seatId);
  render(seatId, cabin, prefs);
}

export function closeCrewPanel() {
  currentSeatId = null;
  document.getElementById('panel').innerHTML =
    '<div class="panel-placeholder">Select a seat on the map above to view its saved meal, allergy and dining details.</div>';
  document.dispatchEvent(new CustomEvent('panel-closed'));
}

export function isCrewPanelOpenFor(seatId) {
  return currentSeatId === seatId;
}
