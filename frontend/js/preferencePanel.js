// Renders the bottom "huge text box" panel for one seat: the four multi-select
// checkbox groups, single-choice dining (wine for First/Business, veg/non-veg
// for Economy), and the static AI Suggestion placeholder. Persists changes to
// the backend (debounced) instead of localStorage.

import { getSeatPreferences, putSeatPreferences } from './api.js';

const HAUL_LABELS = { shortHaul: 'Short Haul', mediumHaul: 'Medium Haul', longHaul: 'Long Haul' };
const TIME_LABELS = {
  breakfast: 'Breakfast (05:00–10:59)',
  lunchDinner: 'Lunch/Dinner (11:00–18:59)',
  eveningSnack: 'Evening/Snack (19:00–04:59)',
};
const GROUP_LABELS = [
  ['allergies', 'Allergies'],
  ['intolerances', 'Intolerances'],
  ['medicalConditions', 'Medical conditions'],
  ['other', 'Other'],
];
const CABIN_KEY_TO_DINING_KEY = { first: 'firstClass', business: 'businessClass', economy: 'economy' };
const CABIN_KEY_TO_TAG_CLASS = { first: 'cabin-first-tag', business: 'cabin-business-tag', economy: 'cabin-economy-tag' };

let saveTimer = null;
let currentSeatState = null; // { seatId, cabin, prefs, diningMatrix } — scoped to whatever seat is open

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function radioRow(nameAttr, labelPrefix, dish, checked, value) {
  return `<label class="radio-row"><input type="radio" name="${nameAttr}" value="${escapeAttr(value)}" ${checked ? 'checked' : ''}>
    <div><strong>${labelPrefix}</strong><div class="dish-name">${dish}</div></div></label>`;
}

function renderCheckboxGroups(prefGroups, checks) {
  return `<div class="pref-groups">${GROUP_LABELS.map(([groupKey, groupLabel]) => {
    const items = prefGroups[groupKey] || [];
    const checkedList = checks[groupKey] || [];
    const boxes = items
      .map((item) => {
        const checked = checkedList.includes(item) ? 'checked' : '';
        return `<label class="chk"><input type="checkbox" data-pref-group="${groupKey}" data-pref-value="${escapeAttr(item)}" ${checked}><span>${item}</span></label>`;
      })
      .join('');
    return `<div class="pref-group"><h4>${groupLabel}</h4>${boxes}</div>`;
  }).join('')}</div>`;
}

function renderDiningSection(cabinKey, diningData, haul, time, prefs) {
  if (cabinKey === 'economy') {
    const haulData = diningData.economy[haul];
    const timeData = haulData[time];
    const mealContext = `${haul}_${time}`;
    const isCurrentContext = prefs.mealChoiceContext === mealContext;

    let body;
    if (timeData.snackOnly) {
      body = `<div class="snack-note">${timeData.item}</div>`;
    } else {
      const savedChoice = isCurrentContext ? prefs.mealChoice : '';
      body = `<div class="veg-choice">
        ${radioRow('mealChoice', 'Vegetarian', timeData.veg, savedChoice === 'veg', 'veg')}
        ${radioRow('mealChoice', 'Non-Vegetarian', timeData.nonVeg, savedChoice === 'nonVeg', 'nonVeg')}
      </div><p class="dining-note">No wine is served in Economy Class — selection is Veg / Non-Veg only (exactly one).</p>`;
    }
    return `<div class="dining-section" data-meal-context="${mealContext}">
      <h3>Dining — ${HAUL_LABELS[haul]} &middot; ${TIME_LABELS[time]}</h3>
      <p class="haul-example">${haulData.haulExample}</p>
      ${body}
    </div>`;
  }

  const diningKey = CABIN_KEY_TO_DINING_KEY[cabinKey];
  const haulData = diningData[diningKey][haul];
  const badgeClass = cabinKey === 'business' ? 'badge business' : 'badge';
  const mealContext = haul;
  const isCurrentContext = prefs.mealChoiceContext === mealContext;
  const savedWine = isCurrentContext ? prefs.mealChoice : '';

  const coursesHtml = haulData.courses.map((c) => `<li>${c}</li>`).join('');
  const wineHtml = haulData.wineList
    .map((w) => {
      const checked = savedWine === w ? 'checked' : '';
      return `<label class="chk wine-chk"><input type="radio" name="mealChoice" value="${escapeAttr(w)}" ${checked}><span>${w}</span></label>`;
    })
    .join('');

  return `<div class="dining-section" data-meal-context="${mealContext}">
    <h3>Dining — ${HAUL_LABELS[haul]}</h3>
    <p class="haul-example">${haulData.haulExample}</p>
    <span class="${badgeClass}">${haulData.courseCount} courses</span>
    <ol class="courses">${coursesHtml}</ol>
    <h4>Wine Selection <span class="${badgeClass}">${haulData.wineCount} options &middot; choose one</span></h4>
    <div class="wine-list">${wineHtml}</div>
    <p class="dining-note">${diningData[diningKey].note}</p>
  </div>`;
}

function renderAiSuggestionSection() {
  return `<div class="ai-suggestion-section">
    <h3>AI Suggestion <span class="badge ai-badge">Coming soon</span></h3>
    <p>AI-powered meal suggestions based on this passenger's profile will appear here in a future update.</p>
    <button type="button" class="ai-suggest-btn" disabled aria-disabled="true">Get AI Suggestion</button>
  </div>`;
}

function render() {
  const container = document.getElementById('panel');
  if (!currentSeatState) {
    container.innerHTML = '<div class="panel-placeholder">Select a seat on the map above to view and edit meal, allergy and dining preferences.</div>';
    return;
  }
  const { seatId, cabin, prefs, diningMatrix, haul, time } = currentSeatState;
  const tagClass = CABIN_KEY_TO_TAG_CLASS[cabin.key];

  container.innerHTML = `
    <div class="panel-header">
      <div><span class="panel-seat">${seatId}</span><span class="panel-class ${tagClass}">${cabin.name} Class</span>
        <span class="save-indicator" id="saveIndicator">Saved &#10003;</span></div>
      <button type="button" id="closePanelBtn" class="close-btn">&#10005; Close</button>
    </div>
    ${renderCheckboxGroups(diningMatrix.preferenceGroups, prefs.checks)}
    ${renderDiningSection(cabin.key, diningMatrix.dining, haul, time, prefs)}
    ${renderAiSuggestionSection()}
  `;

  document.getElementById('closePanelBtn').addEventListener('click', () => {
    closePanel();
  });

  container.querySelectorAll('[data-pref-group]').forEach((input) => {
    input.addEventListener('change', onCheckboxChange);
  });
  container.querySelectorAll('input[name="mealChoice"]').forEach((input) => {
    input.addEventListener('change', onMealChoiceChange);
  });
}

function showSavedIndicator() {
  const el = document.getElementById('saveIndicator');
  if (!el) return;
  el.classList.add('visible');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove('visible'), 1500);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!currentSeatState) return;
    const { seatId, prefs } = currentSeatState;
    await putSeatPreferences(seatId, {
      checks: prefs.checks,
      mealChoice: prefs.mealChoice,
      mealChoiceContext: prefs.mealChoiceContext,
    });
    showSavedIndicator();
    if (currentSeatState) currentSeatState.onSaved?.(seatId);
  }, 400);
}

function onCheckboxChange(e) {
  const group = e.target.getAttribute('data-pref-group');
  const value = e.target.getAttribute('data-pref-value');
  const checks = currentSeatState.prefs.checks;
  checks[group] = checks[group] || [];
  const idx = checks[group].indexOf(value);
  if (e.target.checked && idx === -1) checks[group].push(value);
  else if (!e.target.checked && idx !== -1) checks[group].splice(idx, 1);
  scheduleSave();
}

function onMealChoiceChange(e) {
  const section = e.target.closest('.dining-section');
  currentSeatState.prefs.mealChoice = e.target.value;
  currentSeatState.prefs.mealChoiceContext = section.getAttribute('data-meal-context');
  scheduleSave();
}

export async function openSeatPanel(seatId, cabin, diningMatrix, haul, time, onSaved) {
  const prefs = await getSeatPreferences(seatId);
  currentSeatState = { seatId, cabin, prefs, diningMatrix, haul, time, onSaved };
  render();
}

export function updateGlobalContext(haul, time) {
  if (!currentSeatState) return;
  currentSeatState.haul = haul;
  currentSeatState.time = time;
  render();
}

export function closePanel() {
  currentSeatState = null;
  render();
  document.dispatchEvent(new CustomEvent('panel-closed'));
}

export function isPanelOpenFor(seatId) {
  return !!currentSeatState && currentSeatState.seatId === seatId;
}
