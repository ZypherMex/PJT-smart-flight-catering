import { escapeHtml } from './util.js';
import { adminApi } from './adminApi.js';
import {
  CLASS_LABELS, HAUL_LABELS, CATEGORY_LABELS,
  errorText, toast, openModal, closeModal, tagPicker, checkedValues,
} from './adminUi.js';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const $ = (id) => document.getElementById(id);

let meals = [];
const filters = { search: '', classType: '', haulLength: '', category: '', review: false };

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

function matches(meal) {
  if (filters.search && !meal.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
  if (filters.classType && meal.classType !== filters.classType) return false;
  if (filters.haulLength && meal.haulLength !== filters.haulLength) return false;
  if (filters.category && meal.category !== filters.category) return false;
  if (filters.review && meal.tagsReviewed) return false;
  return true;
}

function mealRow(meal) {
  const photo = meal.thumbUrl
    ? `<img src="${escapeHtml(meal.thumbUrl)}" alt="" width="56" height="56" loading="lazy" decoding="async">`
    : '<span class="ad-thumb-empty">&#127860;</span>';
  const review = meal.tagsReviewed ? '' : '<span class="ad-badge ad-badge-warn" title="Allergen tags were suggested automatically">Needs tag review</span>';
  const used = meal.used ? `<span class="ad-badge">${meal.used} ordered</span>` : '';

  return `<article class="ad-meal" data-id="${meal.id}">
    <div class="ad-thumb">${photo}</div>
    <div class="ad-info">
      <div class="ad-name">${escapeHtml(meal.name)}</div>
      <div class="ad-badges">
        <span class="ad-badge ad-badge-class-${meal.classType}">${CLASS_LABELS[meal.classType]}</span>
        <span class="ad-badge">${HAUL_LABELS[meal.haulLength]}</span>
        <span class="ad-badge">${CATEGORY_LABELS[meal.category] || meal.category}</span>
        ${used}${review}
      </div>
    </div>
    <label class="ad-switch" title="Available to passengers">
      <input type="checkbox" data-action="avail" data-id="${meal.id}"${meal.isAvailable ? ' checked' : ''}>
      <span class="ad-switch-track"></span>
      <em>${meal.isAvailable ? 'Available' : 'Unavailable'}</em>
    </label>
    <div class="ad-stock">
      <label for="stock-${meal.id}">Stock</label>
      <input id="stock-${meal.id}" type="number" min="0" max="9999" step="1" inputmode="numeric" placeholder="Unlimited"
             data-action="stock" data-id="${meal.id}" value="${meal.stockQty === null ? '' : meal.stockQty}">
    </div>
    <button type="button" class="ad-btn" data-action="edit" data-id="${meal.id}">Edit</button>
  </article>`;
}

function render() {
  const visible = meals.filter(matches);
  $('mealList').innerHTML = visible.length
    ? visible.map(mealRow).join('')
    : '<div class="ad-empty">No meals match these filters.</div>';
  const needReview = meals.filter((meal) => !meal.tagsReviewed).length;
  $('mealCount').textContent = `Showing ${visible.length} of ${meals.length} meals` + (needReview ? ` · ${needReview} need tag review` : '');
}

async function reload() {
  try {
    meals = (await adminApi.listMeals()).meals;
    render();
  } catch (err) {
    $('mealList').innerHTML = `<div class="ad-empty">${escapeHtml(errorText(err))}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Quick controls on a row
// ---------------------------------------------------------------------------

async function quickUpdate(id, patch) {
  try {
    const { meal } = await adminApi.updateMeal(id, patch);
    meals = meals.map((existing) => (existing.id === id ? meal : existing));
  } catch (err) {
    toast(errorText(err), 'error');
  }
  render(); // also snaps any control back to the real saved value after an error
}

function onListChange(event) {
  const input = event.target;
  const id = Number(input.dataset.id);
  if (input.dataset.action === 'avail') {
    quickUpdate(id, { isAvailable: input.checked });
  } else if (input.dataset.action === 'stock') {
    const raw = input.value.trim();
    quickUpdate(id, { stockQty: raw === '' ? null : Number(raw) });
  }
}

// ---------------------------------------------------------------------------
// Add / edit form
// ---------------------------------------------------------------------------

function option(value, label, selected) {
  return `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

function mealForm(meal) {
  const editing = !!meal;
  const m = meal || { name: '', description: '', classType: 'Economy', haulLength: 'shortHaul', category: 'snack', dietaryTag: null, isAvailable: true, stockQty: null, tags: [], imageUrl: '', tagsReviewed: true };
  const photo = m.thumbUrl || m.imageUrl;

  return `<form id="mealForm" novalidate>
    ${editing && !m.tagsReviewed ? '<div class="ad-callout">The allergen and health tags below were suggested automatically from the dish description. Please check them, then save to mark them as reviewed.</div>' : ''}
    <div class="ad-form-grid">
      <label class="ad-field ad-span2"><span>Name</span><input name="name" type="text" maxlength="80" value="${escapeHtml(m.name)}" required></label>
      <label class="ad-field ad-span2"><span>Description <i>(optional)</i></span><textarea name="description" rows="2" maxlength="300">${escapeHtml(m.description || '')}</textarea></label>
      <label class="ad-field"><span>Cabin class</span><select name="classType"${editing ? ' disabled' : ''}>${Object.entries(CLASS_LABELS).map(([v, l]) => option(v, l, v === m.classType)).join('')}</select></label>
      <label class="ad-field"><span>Flight length</span><select name="haulLength"${editing ? ' disabled' : ''}>${Object.entries(HAUL_LABELS).map(([v, l]) => option(v, l, v === m.haulLength)).join('')}</select></label>
      <label class="ad-field"><span>Category</span><select name="category">${Object.entries(CATEGORY_LABELS).map(([v, l]) => option(v, l, v === m.category)).join('')}</select></label>
      <label class="ad-field"><span>Dietary label</span><select name="dietaryTag">${option('', 'None', !m.dietaryTag)}${option('vegetarian', 'Vegetarian', m.dietaryTag === 'vegetarian')}${option('healthier', 'Healthier choice', m.dietaryTag === 'healthier')}</select></label>
      <label class="ad-field"><span>Stock <i>(blank = unlimited)</i></span><input name="stockQty" type="number" min="0" max="9999" step="1" inputmode="numeric" value="${m.stockQty === null ? '' : m.stockQty}"></label>
      <label class="ad-field ad-check"><input name="isAvailable" type="checkbox"${m.isAvailable ? ' checked' : ''}><span>Available to passengers</span></label>
    </div>
    ${editing ? '<p class="ad-note">Cabin class and flight length can\'t be changed once a meal exists. Add a new meal for another class or flight.</p>' : ''}

    <div class="ad-section-label">Allergen &amp; health tags</div>
    <p class="ad-note">Tick everything this dish contains or is high in. Passengers with a matching health condition won't be able to order it.</p>
    ${tagPicker('tags', m.tags)}

    <div class="ad-section-label">Photo</div>
    <div class="ad-photo">
      <div class="ad-photo-preview" id="photoPreview">${photo ? `<img src="${escapeHtml(photo)}" alt="">` : '<span>No photo</span>'}</div>
      <div class="ad-photo-controls">
        <input id="photoInput" name="photo" type="file" accept="image/png,image/jpeg,image/webp">
        <p class="ad-note">JPG, PNG or WebP, up to 5 MB. It is resized automatically for fast loading.</p>
        ${editing && m.imageUrl ? '<button type="button" class="ad-btn ad-btn-ghost" id="removePhotoBtn">Remove current photo</button>' : ''}
      </div>
    </div>

    <div class="ad-error" id="formError" hidden></div>
    <div class="ad-modal-actions">
      ${editing ? '<button type="button" class="ad-btn ad-btn-danger" id="deleteMealBtn">Delete meal</button>' : ''}
      <span class="ad-spacer"></span>
      <button type="button" class="ad-btn ad-btn-ghost" data-close>Cancel</button>
      <button type="submit" class="ad-btn ad-btn-primary" id="saveMealBtn">${editing ? 'Save changes' : 'Add meal'}</button>
    </div>
  </form>`;
}

function showFormError(text) {
  const el = $('formError');
  el.textContent = text;
  el.hidden = !text;
}

function readForm(form, editing) {
  const data = new FormData(form);
  const stockRaw = String(data.get('stockQty') || '').trim();
  const body = {
    name: String(data.get('name') || '').trim(),
    description: String(data.get('description') || '').trim(),
    category: data.get('category'),
    dietaryTag: data.get('dietaryTag') || null,
    isAvailable: form.elements.isAvailable.checked,
    stockQty: stockRaw === '' ? null : Number(stockRaw),
    tags: checkedValues(form, 'tags'),
  };
  if (!editing) {
    body.classType = data.get('classType');
    body.haulLength = data.get('haulLength');
  }
  return body;
}

function openMealForm(meal) {
  const editing = !!meal;
  openModal(editing ? 'Edit meal' : 'Add meal', mealForm(meal));
  const form = $('mealForm');

  $('photoInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      event.target.value = '';
      showFormError('That photo is larger than 5 MB. Choose a smaller one.');
      return;
    }
    showFormError('');
    $('photoPreview').innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`;
  });

  const removeBtn = $('removePhotoBtn');
  if (removeBtn) {
    removeBtn.addEventListener('click', async () => {
      try {
        await adminApi.removeImage(meal.id);
        toast('Photo removed');
        closeModal();
        await reload();
      } catch (err) {
        showFormError(errorText(err));
      }
    });
  }

  const deleteBtn = $('deleteMealBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!window.confirm(`Delete "${meal.name}"? This can't be undone.`)) return;
      try {
        await adminApi.deleteMeal(meal.id);
        toast(`Deleted ${meal.name}`);
        closeModal();
        await reload();
      } catch (err) {
        showFormError(errorText(err)); // e.g. "on 2 active orders — mark it unavailable instead"
      }
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showFormError('');
    const body = readForm(form, editing);
    if (!body.name) return showFormError('Please enter a name for the meal.');
    if (body.stockQty !== null && (!Number.isInteger(body.stockQty) || body.stockQty < 0)) {
      return showFormError('Stock must be a whole number, or left blank for unlimited.');
    }

    const saveBtn = $('saveMealBtn');
    saveBtn.disabled = true;
    try {
      const { meal: saved } = editing ? await adminApi.updateMeal(meal.id, body) : await adminApi.createMeal(body);
      const file = $('photoInput').files[0];
      let photoFailed = null;
      if (file) {
        try {
          await adminApi.uploadImage(saved.id, file);
        } catch (err) {
          photoFailed = errorText(err);
        }
      }
      closeModal();
      await reload();
      if (photoFailed) toast(`Saved, but the photo was not uploaded: ${photoFailed}`, 'error');
      else toast(editing ? 'Changes saved' : `Added ${saved.name}`);
    } catch (err) {
      showFormError(errorText(err));
      saveBtn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------------

export async function initMeals() {
  const fillSelect = (id, entries) =>
    $(id).insertAdjacentHTML('beforeend', entries.map(([value, label]) => option(value, label, false)).join(''));
  fillSelect('mealClassFilter', Object.entries(CLASS_LABELS));
  fillSelect('mealHaulFilter', Object.entries(HAUL_LABELS));
  fillSelect('mealCategoryFilter', Object.entries(CATEGORY_LABELS));

  $('mealSearch').addEventListener('input', (e) => { filters.search = e.target.value.trim(); render(); });
  $('mealClassFilter').addEventListener('change', (e) => { filters.classType = e.target.value; render(); });
  $('mealHaulFilter').addEventListener('change', (e) => { filters.haulLength = e.target.value; render(); });
  $('mealCategoryFilter').addEventListener('change', (e) => { filters.category = e.target.value; render(); });
  $('mealReviewFilter').addEventListener('change', (e) => { filters.review = e.target.checked; render(); });
  $('addMealBtn').addEventListener('click', () => openMealForm(null));

  $('mealList').addEventListener('change', onListChange);
  $('mealList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="edit"]');
    if (!button) return;
    openMealForm(meals.find((meal) => meal.id === Number(button.dataset.id)));
  });

  await reload();
}

