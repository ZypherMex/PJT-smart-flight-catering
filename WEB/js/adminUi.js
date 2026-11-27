import { escapeHtml } from './util.js';
import { ApiError } from './orderApi.js';

// Data both admin tabs need (dropdown options, the tag list). Refreshed by admin.js.
export const shared = { meta: null };

export const CLASS_LABELS = { First: 'First', Business: 'Business', Economy: 'Economy' };
export const HAUL_LABELS = { shortHaul: 'Short haul', mediumHaul: 'Medium haul', longHaul: 'Long haul' };
export const CATEGORY_LABELS = {
  snack: 'Snack',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  beverage: 'Champagne & Beverage',
};
export const GROUP_LABELS = {
  allergies: 'Allergies',
  intolerances: 'Intolerances',
  medicalConditions: 'Medical conditions',
  other: 'Dietary & other',
};

export function errorText(err) {
  return err instanceof ApiError ? err.message : "Can't reach the server. Check the Wi-Fi connection.";
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

let toastTimer = null;
export function toast(message, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `ad-toast ad-toast-${type}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), type === 'error' ? 7000 : 3500);
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function openModal(title, bodyHtml) {
  const overlay = document.getElementById('modal');
  const box = document.getElementById('modalBox');
  box.innerHTML = `<div class="ad-modal-head"><h3>${escapeHtml(title)}</h3><button type="button" class="ad-modal-x" data-close aria-label="Close">&times;</button></div>${bodyHtml}`;
  overlay.hidden = false;
  document.body.classList.add('ad-noscroll');
  box.scrollTop = 0;
  return box;
}

export function closeModal() {
  document.getElementById('modal').hidden = true;
  document.getElementById('modalBox').innerHTML = ''; // no stale form (and duplicate ids) left behind
  document.body.classList.remove('ad-noscroll');
}

export function initModalDismissal() {
  const overlay = document.getElementById('modal');
  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) closeModal();
  });
  overlay.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.hidden) closeModal();
  });
}

// ---------------------------------------------------------------------------
// Tag picker (used by both the meal form and the condition form)
// ---------------------------------------------------------------------------

export function tagPicker(name, selected) {
  const chosen = new Set(selected);
  const section = (kind, heading) => {
    const tags = shared.meta.tags.filter((tag) => tag.kind === kind);
    if (!tags.length) return '';
    return `<div class="ad-pill-group"><div class="ad-pill-title">${heading}</div><div class="ad-pills">${tags
      .map(
        (tag) =>
          `<label class="ad-pill"><input type="checkbox" name="${name}" value="${escapeHtml(tag.tag)}"${chosen.has(tag.tag) ? ' checked' : ''}><span>${escapeHtml(tag.label)}</span></label>`
      )
      .join('')}</div></div>`;
  };
  return section('ingredient', 'Ingredients') + section('nutrition', 'Nutrition (high in)');
}

export function checkedValues(form, name) {
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

export function tagLabel(tag) {
  const found = shared.meta.tags.find((entry) => entry.tag === tag);
  return found ? found.label : tag;
}
