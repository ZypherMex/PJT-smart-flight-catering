import { escapeHtml } from './util.js';
import { adminApi } from './adminApi.js';
import {
  shared, GROUP_LABELS, errorText, toast, openModal, closeModal, tagPicker, checkedValues, tagLabel,
} from './adminUi.js';

const $ = (id) => document.getElementById(id);

let conditions = [];

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

function conditionRow(condition) {
  const forbids = condition.forbids.length
    ? condition.forbids.map((tag) => `<span class="ad-badge ad-badge-red">${escapeHtml(tagLabel(tag))}</span>`).join('')
    : '<span class="ad-muted">Nothing blocked</span>';

  return `<article class="ad-cond${condition.active ? '' : ' is-off'}" data-id="${escapeHtml(condition.id)}">
    <div class="ad-info">
      <div class="ad-name">${escapeHtml(condition.label)}${condition.builtin ? ' <span class="ad-badge">Built-in</span>' : ''}</div>
      <div class="ad-badges"><span class="ad-muted">Blocks dishes that are:</span> ${forbids}</div>
    </div>
    <label class="ad-switch" title="Offered to passengers">
      <input type="checkbox" data-action="active" data-id="${escapeHtml(condition.id)}"${condition.active ? ' checked' : ''}>
      <span class="ad-switch-track"></span>
      <em>${condition.active ? 'Shown' : 'Hidden'}</em>
    </label>
    <button type="button" class="ad-btn" data-action="edit" data-id="${escapeHtml(condition.id)}">Edit</button>
  </article>`;
}

function renderConditions() {
  const groups = Object.entries(GROUP_LABELS)
    .map(([group, label]) => {
      const items = conditions.filter((condition) => condition.group === group);
      if (!items.length) return '';
      return `<h3 class="ad-group-title">${label}</h3><div class="ad-list">${items.map(conditionRow).join('')}</div>`;
    })
    .join('');
  $('conditionList').innerHTML = groups || '<div class="ad-empty">No health conditions yet.</div>';
}

function renderTags() {
  const chip = (tag) => `<span class="ad-tagchip ad-tagchip-${tag.kind}">
      <b>${escapeHtml(tag.label)}</b><small>${tag.dishCount} dish${tag.dishCount === 1 ? '' : 'es'}</small>
      ${tag.builtin ? '' : `<button type="button" data-action="delete-tag" data-tag="${escapeHtml(tag.tag)}" aria-label="Delete tag ${escapeHtml(tag.label)}">&times;</button>`}
    </span>`;
  const byKind = (kind) => shared.meta.tags.filter((tag) => tag.kind === kind).map(chip).join('');
  $('tagList').innerHTML = `
    <div class="ad-tag-row"><div class="ad-pill-title">Ingredients</div><div class="ad-tagchips">${byKind('ingredient')}</div></div>
    <div class="ad-tag-row"><div class="ad-pill-title">Nutrition (high in)</div><div class="ad-tagchips">${byKind('nutrition')}</div></div>`;
}

async function reload() {
  try {
    const data = await adminApi.listConditions();
    conditions = data.conditions;
    shared.meta.tags = data.tags; // keep the meal form's tag picker in step
    renderConditions();
    renderTags();
  } catch (err) {
    $('conditionList').innerHTML = `<div class="ad-empty">${escapeHtml(errorText(err))}</div>`;
  }
}

function conditionForm(condition) {
  const editing = !!condition;
  const c = condition || { label: '', group: 'allergies', forbids: [], active: true, builtin: false };
  return `<form id="conditionForm" novalidate>
    <div class="ad-form-grid">
      <label class="ad-field ad-span2"><span>Name shown to passengers</span><input name="label" type="text" maxlength="60" value="${escapeHtml(c.label)}" required></label>
      <label class="ad-field"><span>Group</span><select name="group">${Object.entries(GROUP_LABELS).map(([v, l]) => `<option value="${v}"${v === c.group ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="ad-field ad-check"><input name="active" type="checkbox"${c.active ? ' checked' : ''}><span>Shown to passengers</span></label>
    </div>
    <div class="ad-section-label">Block dishes that contain or are high in…</div>
    <p class="ad-note">A passenger who selects this condition can't order any dish carrying one of the ticked tags.</p>
    ${tagPicker('forbids', c.forbids)}
    <div class="ad-error" id="formError" hidden></div>
    <div class="ad-modal-actions">
      ${editing && !c.builtin ? '<button type="button" class="ad-btn ad-btn-danger" id="deleteConditionBtn">Delete</button>' : ''}
      <span class="ad-spacer"></span>
      <button type="button" class="ad-btn ad-btn-ghost" data-close>Cancel</button>
      <button type="submit" class="ad-btn ad-btn-primary" id="saveConditionBtn">${editing ? 'Save changes' : 'Add condition'}</button>
    </div>
  </form>`;
}

function showFormError(text) {
  const el = $('formError');
  el.textContent = text;
  el.hidden = !text;
}

function openConditionForm(condition) {
  const editing = !!condition;
  openModal(editing ? 'Edit health condition' : 'Add health condition', conditionForm(condition));
  const form = $('conditionForm');

  const deleteBtn = $('deleteConditionBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const msg = `Delete "${condition.label}"? It will be removed from the ${condition.seatCount} seat${condition.seatCount === 1 ? '' : 's'} that selected it. Past orders keep their record.`;
      if (!window.confirm(msg)) return;
      try {
        await adminApi.deleteCondition(condition.id);
        toast('Condition deleted');
        closeModal();
        await reload();
      } catch (err) {
        showFormError(errorText(err));
      }
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showFormError('');
    const data = new FormData(form);
    const label = String(data.get('label') || '').trim();
    if (!label) return showFormError('Please enter a name.');

    const body = { label, group: data.get('group'), forbids: checkedValues(form, 'forbids') };
    if (editing) body.active = form.elements.active.checked;

    const saveBtn = $('saveConditionBtn');
    saveBtn.disabled = true;
    try {
      if (editing) await adminApi.updateCondition(condition.id, body);
      else await adminApi.createCondition(body);
      toast(editing ? 'Changes saved' : `Added ${label}`);
      closeModal();
      await reload();
    } catch (err) {
      showFormError(errorText(err));
      saveBtn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------------

export async function initConditions() {
  $('addConditionBtn').addEventListener('click', () => openConditionForm(null));

  $('conditionList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="edit"]');
    if (button) openConditionForm(conditions.find((condition) => condition.id === button.dataset.id));
  });

  $('conditionList').addEventListener('change', async (event) => {
    const input = event.target.closest('[data-action="active"]');
    if (!input) return;
    try {
      await adminApi.updateCondition(input.dataset.id, { active: input.checked });
    } catch (err) {
      toast(errorText(err), 'error');
    }
    await reload();
  });

  $('tagForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const label = $('tagLabel').value.trim();
    if (!label) return;
    try {
      await adminApi.createTag({ label, kind: $('tagKind').value });
      $('tagLabel').value = '';
      toast(`Added tag ${label}`);
      await reload();
    } catch (err) {
      toast(errorText(err), 'error');
    }
  });

  $('tagList').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action="delete-tag"]');
    if (!button) return;
    const tag = shared.meta.tags.find((entry) => entry.tag === button.dataset.tag);
    const msg = `Delete the tag "${tag.label}"? It will be removed from ${tag.dishCount} dish${tag.dishCount === 1 ? '' : 'es'} and from any condition that blocks it.`;
    if (!window.confirm(msg)) return;
    try {
      await adminApi.deleteTag(tag.tag);
      toast('Tag deleted');
      await reload();
    } catch (err) {
      toast(errorText(err), 'error');
    }
  });

  await reload();
}
