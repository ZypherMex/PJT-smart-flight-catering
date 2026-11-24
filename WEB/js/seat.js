import { getSeatPreferences, putSeatPreferences } from './api.js';
import { getMenu } from './menuApi.js';
import { getSeat, recommendMeal } from './recommendApi.js';

const GROUP_LABELS = [
  ['allergies', 'Allergies'],
  ['intolerances', 'Intolerances'],
  ['medicalConditions', 'Medical conditions'],
  ['other', 'Other'],
];
const PREFERENCE_GROUPS = {
  allergies: ['Peanuts', 'Eggs', 'Milk / dairy', 'Sesame', 'Soy'],
  intolerances: ['Lactose / Gluten intolerance'],
  medicalConditions: ['Diabetes', 'High blood pressure', 'High cholesterol', 'Heart disease', 'Kidney disease'],
  other: ['Vegetarian / vegan', 'Halal'],
};

const params = new URLSearchParams(window.location.search);
const seatId = params.get('seat');

const state = { haul: 'shortHaul', prefs: null, selectedMealIds: new Set(), seat: null };
let saveTimer = null;

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function renderPrefs() {
  const container = document.getElementById('prefsContent');
  container.innerHTML = `<div class="pref-groups">${GROUP_LABELS.map(([groupKey, groupLabel]) => {
    const items = PREFERENCE_GROUPS[groupKey];
    const checkedList = state.prefs.checks[groupKey] || [];
    const boxes = items
      .map((item) => {
        const checked = checkedList.includes(item) ? 'checked' : '';
        return `<label class="chk"><input type="checkbox" data-pref-group="${groupKey}" data-pref-value="${escapeAttr(item)}" ${checked}><span>${item}</span></label>`;
      })
      .join('');
    return `<div class="pref-group"><h4>${groupLabel}</h4>${boxes}</div>`;
  }).join('')}</div>`;

  container.querySelectorAll('[data-pref-group]').forEach((input) => {
    input.addEventListener('change', onCheckboxChange);
  });
}

function showSavedIndicator() {
  const el = document.getElementById('saveIndicator');
  el.classList.add('visible');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove('visible'), 1500);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await putSeatPreferences(seatId, {
      checks: state.prefs.checks,
      mealChoice: state.prefs.mealChoice,
      mealChoiceContext: state.prefs.mealChoiceContext,
      haulLength: state.haul,
    });
    showSavedIndicator();
  }, 400);
}

function onCheckboxChange(e) {
  const group = e.target.getAttribute('data-pref-group');
  const value = e.target.getAttribute('data-pref-value');
  const checks = state.prefs.checks;
  checks[group] = checks[group] || [];
  const idx = checks[group].indexOf(value);
  if (e.target.checked && idx === -1) checks[group].push(value);
  else if (!e.target.checked && idx !== -1) checks[group].splice(idx, 1);
  scheduleSave();
}

function renderDishSelectCard(item) {
  const photo = item.imageUrl
    ? `<img src="${item.imageUrl}" alt="${item.name}">`
    : `<div class="dish-photo-placeholder"><span>&#127860;</span></div>`;
  const checked = state.selectedMealIds.has(item.id) ? 'checked' : '';

  return `<label class="dish-card dish-card-select">
    <div class="dish-photo">${photo}</div>
    <div class="dish-body">
      <div class="dish-name">
        <input type="checkbox" data-meal-id="${item.id}" ${checked}>
        <span>${item.name}</span>
      </div>
      ${item.description ? `<p class="dish-desc">${item.description}</p>` : ''}
    </div>
  </label>`;
}

function renderMenu(sections) {
  const container = document.getElementById('menuContent');
  if (!sections.length) {
    container.innerHTML = '<div class="panel-placeholder">No menu available for this class/haul yet.</div>';
    return;
  }
  container.innerHTML = sections
    .map(
      (section) => `
    <div class="menu-section" style="margin-bottom:20px;">
      <h4 class="dish-select-section-title">${section.sectionName}</h4>
      <div class="dish-select-grid">${section.items.map(renderDishSelectCard).join('')}</div>
    </div>`
    )
    .join('');

  container.querySelectorAll('[data-meal-id]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const id = Number(e.target.getAttribute('data-meal-id'));
      if (e.target.checked) state.selectedMealIds.add(id);
      else state.selectedMealIds.delete(id);
    });
  });
}

function renderRecommendation(result) {
  const container = document.getElementById('recommendResult');
  if (!result.recommendedMeals.length) {
    container.innerHTML = '<div class="panel-placeholder">No confident recommendation could be made from the available menu.</div>';
    return;
  }
  container.innerHTML = `
    <p style="color:var(--text);font-size:14px;margin:0 0 6px;"><strong>Confidence:</strong> ${result.confidence ?? 'n/a'}%</p>
    <p style="color:var(--muted);font-size:13.5px;margin:0 0 18px;">${result.summary}</p>
    <div class="fleet-grid">
      ${result.recommendedMeals
        .map(
          (meal) => `<div class="aircraft-card">
            <div class="aircraft-name">${meal.mealName}</div>
            <div class="aircraft-meta" style="margin-bottom:8px;"><span class="badge badge-live">${meal.score}% match</span></div>
            <p class="aircraft-tagline">${meal.reason}</p>
          </div>`
        )
        .join('')}
    </div>`;
}

async function onRecommendClick() {
  const btn = document.getElementById('recommendBtn');
  const container = document.getElementById('recommendResult');
  btn.disabled = true;
  container.innerHTML = '<div class="panel-placeholder">Asking the AI&hellip;</div>';
  try {
    const result = await recommendMeal({
      seatNumber: seatId,
      haulType: state.haul,
      selectedMeals: Array.from(state.selectedMealIds),
    });
    renderRecommendation(result);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="panel-placeholder">${err.message || 'Failed to get a recommendation.'}</div>`;
  } finally {
    btn.disabled = false;
  }
}

async function loadMenu() {
  document.getElementById('menuContent').innerHTML = '<div class="panel-placeholder">Loading menu&hellip;</div>';
  const { sections } = await getMenu(state.seat.classType, state.haul);
  renderMenu(sections);
}

async function init() {
  if (!seatId) {
    document.getElementById('seatHeading').textContent = 'No seat specified';
    return;
  }

  try {
    state.seat = await getSeat(seatId);
  } catch (err) {
    document.getElementById('seatHeading').textContent = 'Seat not found';
    return;
  }

  document.getElementById('seatHeading').innerHTML = `Seat <span style="color:var(--accent);">${state.seat.seatId}</span> &middot; ${state.seat.classType} Class`;

  state.prefs = await getSeatPreferences(seatId);
  state.haul = state.prefs.haulLength || 'shortHaul';
  renderPrefs();

  const haulSelect = document.getElementById('haulSelect');
  haulSelect.value = state.haul;
  haulSelect.addEventListener('change', async (e) => {
    state.haul = e.target.value;
    await loadMenu();
    scheduleSave();
  });

  document.getElementById('recommendBtn').addEventListener('click', onRecommendClick);

  await loadMenu();
}

init().catch((err) => {
  console.error(err);
});
