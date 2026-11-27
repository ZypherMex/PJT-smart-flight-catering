import { escapeHtml } from './util.js';
import { ApiError, getHealthConditions, getSeatInfo, getPortalMenu, placeOrder, getMyOrder } from './orderApi.js';
import { recommendMeal } from './recommendApi.js';

const CATEGORY_LABELS = {
  snack: 'Snack',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  beverage: 'Champagne & Beverages',
};
const CATEGORIES = Object.keys(CATEGORY_LABELS);
const GROUP_LABELS = {
  allergies: 'Allergies',
  intolerances: 'Intolerances',
  medicalConditions: 'Medical conditions',
  other: 'Dietary & other',
};
const STATUS_STEPS = [
  ['pending', 'Ordered'],
  ['preparing', 'Preparing'],
  ['prepared', 'Prepared'],
  ['delivered', 'Delivered'],
  ['completed', 'Completed'],
];
const STATUS_TEXT = {
  pending: 'Waiting for the crew to start. You can still change your order.',
  preparing: 'The crew is preparing your order. It can no longer be changed.',
  prepared: 'Your order is ready and on its way to your seat.',
  delivered: 'Delivered. Enjoy your meal!',
  completed: 'This order is complete. Enjoy your flight!',
};
const LOW_STOCK_THRESHOLD = 3;

const $ = (id) => document.getElementById(id);

// localStorage can throw (private browsing, blocked storage) — the page must still work.
const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch (err) { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch (err) { /* ignore */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (err) { /* ignore */ }
  },
};

const emptySelections = () => Object.fromEntries(CATEGORIES.map((category) => [category, null]));

const state = {
  seatId: null,
  seat: null,
  name: '',
  haul: 'shortHaul',
  conditions: new Set(),
  selections: emptySelections(),
  menu: null,
  order: null,
  token: null,
  health: { maxConditions: 5, conditions: [] },
  notices: [],
  busy: false,
  ai: { loading: false, result: null, error: null },
};

const isLocked = () => !!state.order && state.order.status !== 'pending';
const pickCount = () => Object.values(state.selections).filter(Boolean).length;

function findMenuItem(itemId) {
  if (!state.menu) return null;
  for (const group of state.menu.categories) {
    const item = group.items.find((candidate) => candidate.id === itemId);
    if (item) return item;
  }
  return null;
}

function friendlyError(err) {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Too many requests. Please wait a moment and try again.';
    return err.message;
  }
  return "Can't reach the server. Check your Wi-Fi connection and try again.";
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderNotices() {
  $('notices').innerHTML = state.notices
    .map((notice) => `<div class="op-notice op-notice-${notice.type}">${escapeHtml(notice.text)}</div>`)
    .join('');
}

function setNotices(notices) {
  state.notices = notices;
  renderNotices();
}

function renderSeat() {
  const hasSeat = !!state.seat;
  $('seatForm').hidden = hasSeat;
  $('seatSummary').hidden = !hasSeat;
  $('detailSections').hidden = !hasSeat;
  if (!hasSeat) return;

  $('seatSummary').innerHTML = `
    <div>
      <div class="op-seat-id">Seat ${escapeHtml(state.seat.seatId)}</div>
      <span class="panel-class cabin-${state.seat.classType.toLowerCase()}-tag">${escapeHtml(state.seat.classType)} Class</span>
      ${state.name ? `<span class="op-seat-name">${escapeHtml(state.name)}</span>` : ''}
    </div>
    <button type="button" class="op-btn op-btn-ghost op-btn-small" id="changeSeatBtn">Change seat</button>`;
  $('changeSeatBtn').addEventListener('click', onChangeSeat);
}

function renderHaul() {
  document.querySelectorAll('#haulControl [data-haul]').forEach((button) => {
    const active = button.getAttribute('data-haul') === state.haul;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    button.disabled = isLocked();
  });
}

function renderConditions() {
  const max = state.health.maxConditions;
  const groups = {};
  for (const condition of state.health.conditions) {
    (groups[condition.group] ||= []).push(condition);
  }

  $('conditionChips').innerHTML = Object.keys(GROUP_LABELS)
    .filter((group) => groups[group])
    .map(
      (group) => `<div class="op-chip-group">
        <div class="op-chip-title">${GROUP_LABELS[group]}</div>
        <div class="op-chips">${groups[group]
          .map((condition) => {
            const on = state.conditions.has(condition.id);
            return `<button type="button" class="op-chip${on ? ' is-on' : ''}" data-condition="${escapeHtml(condition.id)}" aria-pressed="${on}">${escapeHtml(condition.label)}</button>`;
          })
          .join('')}</div>
      </div>`
    )
    .join('');

  applyConditionCap();
  $('conditionCounter').textContent = `${state.conditions.size} of ${max} selected.`;
}

function applyConditionCap() {
  const atCap = state.conditions.size >= state.health.maxConditions;
  document.querySelectorAll('#conditionChips .op-chip').forEach((chip) => {
    const on = chip.classList.contains('is-on');
    const disabled = isLocked() || (atCap && !on);
    chip.disabled = disabled;
  });
  $('conditionCounter').textContent = `${state.conditions.size} of ${state.health.maxConditions} selected.`;
}

function renderAi() {
  const button = $('aiBtn');
  const out = $('aiResult');
  const { loading, result, error } = state.ai;

  button.disabled = loading || isLocked();
  button.textContent = loading ? 'Thinking…' : result ? 'Suggest again' : 'Suggest meals for me';

  if (error) {
    out.innerHTML = `<div class="op-notice op-notice-error">${escapeHtml(error)}</div>`;
    return;
  }
  if (!result) {
    out.innerHTML = '';
    return;
  }

  const picks = result.recommendedMeals
    .map((meal) => ({ meal, item: findMenuItem(meal.mealId) }))
    .filter(({ item }) => item);
  const chosen = (item) => state.selections[item.category] === item.id;

  out.innerHTML = `
    ${result.summary ? `<p class="op-ai-summary">${escapeHtml(result.summary)}</p>` : ''}
    <div class="op-ai-list">${picks
      .map(
        ({ meal, item }) => `<div class="op-ai-pick">
          <div class="op-ai-head"><strong>${escapeHtml(item.name)}</strong><span class="badge badge-live">${Number(meal.score) || 0}% match</span></div>
          <div class="op-ai-cat">${CATEGORY_LABELS[item.category]}</div>
          <p>${escapeHtml(meal.reason)}</p>
          <button type="button" class="op-btn op-btn-small${chosen(item) ? ' op-btn-ghost' : ''}" data-ai-choose="${item.id}" ${isLocked() ? 'disabled' : ''}>${chosen(item) ? 'Chosen ✓' : 'Choose this'}</button>
        </div>`
      )
      .join('')}</div>${picks.length ? '' : '<p class="op-empty">No suggestions this time. Please choose from the menu below.</p>'}`;
}

async function onAiClick() {
  if (state.ai.loading || isLocked()) return;
  state.ai = { loading: true, result: null, error: null };
  renderAi();
  try {
    const result = await recommendMeal({
      seatNumber: state.seatId,
      haulType: state.haul,
      conditions: [...state.conditions],
      selectedMeals: Object.values(state.selections).filter(Boolean),
    });
    state.ai = { loading: false, result, error: null };
  } catch (err) {
    state.ai = { loading: false, result: null, error: friendlyError(err) };
  }
  renderAi();
}

function onAiChoose(event) {
  const button = event.target.closest('[data-ai-choose]');
  if (!button || isLocked()) return;
  const item = findMenuItem(Number(button.getAttribute('data-ai-choose')));
  if (!item || item.conflicts.length || item.soldOut) return;
  state.selections[item.category] = item.id;
  setNotices([]);
  syncSelectionUI();
  renderAi();
}

function mealCard(item) {
  const selected = state.selections[item.category] === item.id;
  const conflict = item.conflicts.length ? item.conflicts[0].message : null;
  const blocked = !!conflict || item.soldOut;

  let note = '';
  if (conflict) note = `<span class="op-meal-note op-note-conflict">${escapeHtml(conflict)}</span>`;
  else if (item.soldOut) note = '<span class="op-meal-note op-note-soldout">Sold out</span>';
  else if (item.remaining !== null && item.remaining <= LOW_STOCK_THRESHOLD) {
    note = `<span class="op-meal-note op-note-low">Only ${item.remaining} left</span>`;
  }

  const photo = item.thumbUrl
    ? `<img src="${escapeHtml(item.thumbUrl)}" alt="" loading="lazy" decoding="async">`
    : '<span class="op-meal-placeholder">&#127860;</span>';
  const tag = item.dietaryTag === 'vegetarian' ? '<span class="badge op-meal-badge">Vegetarian</span>' : '';

  return `<button type="button" class="op-meal${selected ? ' is-selected' : ''}${blocked ? ' is-blocked' : ''}"
      data-item-id="${item.id}" data-category="${item.category}"
      aria-pressed="${selected}" ${blocked ? 'aria-disabled="true"' : ''}>
    <span class="op-meal-photo">${photo}<span class="op-meal-check" aria-hidden="true">&#10003;</span></span>
    <span class="op-meal-body">
      <span class="op-meal-name">${escapeHtml(item.name)}</span>
      ${tag}
      ${item.description ? `<span class="op-meal-desc">${escapeHtml(item.description)}</span>` : ''}
      ${note}
    </span>
  </button>`;
}

function renderMenu() {
  if (!state.menu) return;
  $('menuCategories').innerHTML = state.menu.categories
    .map(
      (group) => `<section class="op-category" data-category-section="${group.category}">
        <h3>${CATEGORY_LABELS[group.category]} <span class="op-optional">(choose one, optional)</span></h3>
        ${
          group.items.length
            ? `<div class="op-meal-grid">${group.items.map(mealCard).join('')}</div>`
            : '<p class="op-empty">Not offered on this flight or in your cabin.</p>'
        }
      </section>`
    )
    .join('');
  applyLockState();
}

// Cheap in-place update after a tap — avoids rebuilding the cards (and reloading their images).
function syncSelectionUI() {
  document.querySelectorAll('#menuCategories .op-meal').forEach((card) => {
    const selected = state.selections[card.getAttribute('data-category')] === Number(card.getAttribute('data-item-id'));
    card.classList.toggle('is-selected', selected);
    card.setAttribute('aria-pressed', String(selected));
  });
  renderActionBar();
}

function applyLockState() {
  $('detailSections').classList.toggle('is-locked', isLocked());
  renderAi();
  renderHaul();
  applyConditionCap();
}

function renderStatus() {
  const card = $('statusCard');
  if (!state.order) {
    card.hidden = true;
    return;
  }
  const order = state.order;
  const currentIndex = STATUS_STEPS.findIndex(([status]) => status === order.status);

  const meals = CATEGORIES.filter((category) => order.items[category])
    .map((category) => {
      const item = order.items[category];
      const photo = item.thumbUrl ? `<img src="${escapeHtml(item.thumbUrl)}" alt="" loading="lazy" decoding="async">` : '<span>&#127860;</span>';
      return `<li><span class="op-order-photo">${photo}</span>
        <span><span class="op-order-cat">${CATEGORY_LABELS[category]}</span><span class="op-order-name">${escapeHtml(item.name)}</span></span></li>`;
    })
    .join('');

  card.innerHTML = `
    <div class="op-status-head">
      <span class="op-ordered-badge">Ordered &#10003;</span>
      <span class="op-status-seat">Seat ${escapeHtml(order.seatId)}</span>
    </div>
    <ol class="op-steps">${STATUS_STEPS.map(
      ([status, label], index) =>
        `<li class="${index < currentIndex ? 'is-done' : ''}${index === currentIndex ? ' is-current' : ''}"><span>${label}</span></li>`
    ).join('')}</ol>
    <p class="op-status-text">${STATUS_TEXT[order.status]}</p>
    <ul class="op-order-list">${meals}</ul>`;
  card.hidden = false;
}

function renderActionBar() {
  const bar = $('actionBar');
  if (!state.seat) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const count = pickCount();
  const button = $('placeOrderBtn');
  const locked = isLocked();

  button.textContent = state.busy ? 'Sending…' : state.order ? 'Update Order' : 'Place Order';
  button.disabled = state.busy || locked || count === 0;
  $('actionSummary').textContent = locked
    ? 'Order locked — the crew is on it'
    : count === 0
      ? 'Select at least one item'
      : `${count} item${count === 1 ? '' : 's'} selected`;
}

function renderAll() {
  renderSeat();
  renderHaul();
  renderConditions();
  renderMenu();
  renderAi();
  renderStatus();
  renderActionBar();
  renderNotices();
}

// ---------------------------------------------------------------------------
// Menu loading
// ---------------------------------------------------------------------------

let menuRequestId = 0;

// Items that stopped being orderable (new condition, sold out meanwhile) are
// dropped from the selection, and the passenger is told why.
function reconcileSelections() {
  const notices = [];
  for (const category of CATEGORIES) {
    const itemId = state.selections[category];
    if (!itemId) continue;
    const item = findMenuItem(itemId);
    if (!item) {
      state.selections[category] = null;
    } else if (item.conflicts.length) {
      state.selections[category] = null;
      notices.push({ type: 'warn', text: `Removed ${item.name}: ${item.conflicts[0].message}` });
    } else if (item.soldOut) {
      state.selections[category] = null;
      notices.push({ type: 'warn', text: `Removed ${item.name}: it just sold out.` });
    }
  }
  if (notices.length) setNotices(notices);
}

async function loadMenu() {
  if (!state.seatId) return;
  const requestId = ++menuRequestId;
  try {
    const menu = await getPortalMenu({
      seat: state.seatId,
      haul: state.haul,
      conditions: [...state.conditions],
      token: state.token,
    });
    if (requestId !== menuRequestId) return; // a newer request superseded this one
    state.menu = menu;
    reconcileSelections();
    renderMenu();
    renderActionBar();
  } catch (err) {
    if (requestId !== menuRequestId) return;
    $('menuCategories').innerHTML = `<div class="panel-placeholder">${escapeHtml(friendlyError(err))}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Seat + saved-order handling
// ---------------------------------------------------------------------------

function normalizeSeat(raw) {
  return String(raw || '').replace(/\s+/g, '').toUpperCase();
}

function hydrateFromOrder(order) {
  state.order = order;
  state.name = order.passengerName || state.name;
  state.haul = order.haulLength;
  state.conditions = new Set(order.conditions.map((condition) => condition.id));
  state.selections = emptySelections();
  for (const category of CATEGORIES) {
    if (order.items[category]) state.selections[category] = order.items[category].id;
  }
}

function resetForSeat() {
  state.order = null;
  state.token = null;
  state.menu = null;
  state.conditions = new Set();
  state.selections = emptySelections();
  setNotices([]);
}

async function submitSeat(rawSeat) {
  const seatId = normalizeSeat(rawSeat);
  const errorEl = $('seatError');
  errorEl.hidden = true;

  if (!seatId) {
    errorEl.textContent = 'Enter your seat number, for example 12A.';
    errorEl.hidden = false;
    return;
  }

  $('seatContinue').disabled = true;
  try {
    const seat = await getSeatInfo(seatId);
    resetForSeat();
    state.seatId = seat.seatId;
    state.seat = seat;
    state.name = $('nameInput').value.trim() || store.get('meal.name') || '';
    store.set('meal.seat', seat.seatId);
    if (state.name) store.set('meal.name', state.name);

    state.token = store.get(`meal.token.${seat.seatId}`);
    if (state.token) {
      try {
        const { order } = await getMyOrder(seat.seatId, state.token);
        hydrateFromOrder(order);
      } catch (err) {
        // The order was released or the token is stale — start fresh on this seat.
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
          store.remove(`meal.token.${seat.seatId}`);
          state.token = null;
        }
      }
    }

    renderAll();
    joinSeatRoom();
    await loadMenu();
  } catch (err) {
    errorEl.textContent =
      err instanceof ApiError && err.status === 404
        ? `We couldn't find seat ${seatId} on this aircraft. Check the number above your seat.`
        : friendlyError(err);
    errorEl.hidden = false;
  } finally {
    $('seatContinue').disabled = false;
  }
}

function onChangeSeat() {
  state.seat = null;
  state.seatId = null;
  resetForSeat();
  store.remove('meal.seat');
  $('seatInput').value = '';
  renderAll();
  $('seatInput').focus();
}

// ---------------------------------------------------------------------------
// User actions
// ---------------------------------------------------------------------------

let conditionTimer = null;

function onConditionClick(event) {
  const chip = event.target.closest('[data-condition]');
  if (!chip || isLocked()) return;
  const id = chip.getAttribute('data-condition');

  if (state.conditions.has(id)) {
    state.conditions.delete(id);
  } else if (state.conditions.size < state.health.maxConditions) {
    state.conditions.add(id);
  } else {
    return;
  }
  state.ai = { loading: false, result: null, error: null };
  renderAi();
  chip.classList.toggle('is-on', state.conditions.has(id));
  chip.setAttribute('aria-pressed', String(state.conditions.has(id)));
  applyConditionCap();

  // Debounced: a passenger ticking several conditions triggers one refresh, not several.
  clearTimeout(conditionTimer);
  conditionTimer = setTimeout(loadMenu, 250);
}

function onHaulClick(event) {
  const button = event.target.closest('[data-haul]');
  if (!button || isLocked()) return;
  const haul = button.getAttribute('data-haul');
  if (haul === state.haul) return;

  state.haul = haul;
  state.ai = { loading: false, result: null, error: null };
  renderAi();
  state.selections = emptySelections(); // dishes are specific to a flight length
  setNotices([{ type: 'info', text: 'Menu updated for your flight length — please choose again.' }]);
  renderHaul();
  loadMenu();
  renderActionBar();
}

function onMealClick(event) {
  const card = event.target.closest('.op-meal');
  if (!card || isLocked()) return;
  const item = findMenuItem(Number(card.getAttribute('data-item-id')));
  if (!item || item.conflicts.length || item.soldOut) return; // the reason is already shown on the card

  const category = item.category;
  state.selections[category] = state.selections[category] === item.id ? null : item.id;
  setNotices([]);
  syncSelectionUI();
}

function buildOrderBody() {
  return {
    seatId: state.seatId,
    passengerName: state.name || undefined,
    haulLength: state.haul,
    conditions: [...state.conditions],
    selections: { ...state.selections },
  };
}

async function onPlaceOrder() {
  if (state.busy || isLocked() || pickCount() === 0) return;
  state.busy = true;
  setNotices([]);
  renderActionBar();

  try {
    const result = await placeOrder(buildOrderBody(), state.token);
    if (result.token) {
      state.token = result.token;
      store.set(`meal.token.${state.seatId}`, result.token);
    }
    state.order = result.order;
    joinSeatRoom();
    renderStatus();
    applyLockState();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    await handleOrderError(err);
  } finally {
    state.busy = false;
    renderActionBar();
  }
}

async function handleOrderError(err) {
  if (err instanceof ApiError && err.status === 422 && Array.isArray(err.body.problems)) {
    // A meal stopped being orderable between choosing and sending (e.g. someone took the last one).
    const notices = err.body.problems.map((problem) => {
      state.selections[problem.category] = null;
      return { type: 'warn', text: `${problem.itemName}: ${problem.message}` };
    });
    await loadMenu();
    setNotices(notices);
    return;
  }
  if (err instanceof ApiError && err.status === 409) {
    try {
      const { order } = await getMyOrder(state.seatId, state.token);
      state.order = order;
      renderStatus();
      applyLockState();
    } catch (ignored) { /* the socket will bring the latest status */ }
  }
  setNotices([{ type: 'error', text: friendlyError(err) }]);
}

// ---------------------------------------------------------------------------
// Live updates
// ---------------------------------------------------------------------------

let socket = null;

function setLive(isLive) {
  const el = $('liveIndicator');
  el.textContent = isLive ? 'Live' : 'Reconnecting…';
  el.classList.toggle('is-live', isLive);
}

// The crew released this seat's order (or it vanished while the phone was offline).
function releaseOrder() {
  store.remove(`meal.token.${state.seatId}`);
  resetForSeat();
  setNotices([{ type: 'info', text: 'The cabin crew released your order. You can place a new one.' }]);
  renderAll();
  loadMenu();
}

// Events are only pushed while connected, so after every (re)join the page asks
// the server for the order's current state instead of trusting what it missed.
async function resyncOrder() {
  if (!state.seatId || !state.token) return;
  try {
    const { order } = await getMyOrder(state.seatId, state.token);
    state.order = order;
    renderStatus();
    applyLockState();
    renderActionBar();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) releaseOrder();
  }
}

function joinSeatRoom() {
  if (!socket || !socket.connected || !state.seatId || !state.token) return;
  socket.emit('join:seat', { seatId: state.seatId, token: state.token }, (ack) => {
    if (ack && ack.ok) resyncOrder();
    else releaseOrder(); // the token no longer matches an order: it was released
  });
}

function connectSocket() {
  if (typeof window.io !== 'function') {
    $('liveIndicator').textContent = 'Offline';
    return;
  }
  socket = window.io();
  socket.on('connect', () => {
    setLive(true);
    joinSeatRoom(); // also re-joins automatically after a Wi-Fi drop
  });
  socket.on('disconnect', () => setLive(false));

  socket.on('order:upserted', (order) => {
    if (order.seatId !== state.seatId) return;
    state.order = order;
    renderStatus();
    applyLockState();
    renderActionBar();
  });

  socket.on('order:deleted', ({ seatId }) => {
    if (seatId === state.seatId) releaseOrder();
  });

  // Staff changed availability/stock/meals — refresh what this passenger can pick.
  socket.on('menu:changed', () => loadMenu());
}

// ---------------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------------

function bindEvents() {
  $('seatContinue').addEventListener('click', () => submitSeat($('seatInput').value));
  $('seatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitSeat($('seatInput').value);
  });
  $('nameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitSeat($('seatInput').value);
  });
  $('haulControl').addEventListener('click', onHaulClick);
  $('conditionChips').addEventListener('click', onConditionClick);
  $('menuCategories').addEventListener('click', onMealClick);
  $('placeOrderBtn').addEventListener('click', onPlaceOrder);
  $('aiBtn').addEventListener('click', onAiClick);
  $('aiResult').addEventListener('click', onAiChoose);
}

async function init() {
  bindEvents();
  $('nameInput').value = store.get('meal.name') || '';

  try {
    state.health = await getHealthConditions();
  } catch (err) {
    $('seatError').textContent = friendlyError(err);
    $('seatError').hidden = false;
  }

  connectSocket();
  renderAll();

  const params = new URLSearchParams(window.location.search);
  const linkedSeat = params.get('seat');
  if (linkedSeat) window.history.replaceState(null, '', 'order.html'); // keep the address bar tidy
  const startSeat = linkedSeat || store.get('meal.seat');
  if (startSeat) {
    $('seatInput').value = startSeat;
    await submitSeat(startSeat);
  }
}

init();
