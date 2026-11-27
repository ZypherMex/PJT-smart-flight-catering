import { verifyCrewSession, logoutCrew, getCrewToken } from './crewAuth.js';
import { mountCrewNav } from './crewNav.js';
import { escapeHtml } from './util.js';
import { ApiError, getHealthConditions } from './orderApi.js';
import { listOrders, setOrderStatus, releaseOrder } from './crewApi.js';

const CATEGORIES = [
  ['snack', 'Snack'],
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['dinner', 'Dinner'],
  ['beverage', 'Champagne / Beverage'],
];
const STATUSES = [
  ['pending', 'Pending'],
  ['preparing', 'Preparing'],
  ['prepared', 'Prepared'],
  ['delivered', 'Delivered'],
  ['completed', 'Completed'],
];
const STATUS_LABEL = Object.fromEntries(STATUSES);
// One tap moves an order to its natural next step; the dropdown allows any other change.
const NEXT_STEP = {
  pending: ['preparing', 'Start preparing'],
  preparing: ['prepared', 'Mark prepared'],
  prepared: ['delivered', 'Mark delivered'],
  delivered: ['completed', 'Complete'],
};
const CLASS_TAG = { First: 'cabin-first-tag', Business: 'cabin-business-tag', Economy: 'cabin-economy-tag' };

const $ = (id) => document.getElementById(id);

const orders = new Map(); // order id -> latest order
const rows = new Map(); // order id -> its DOM element
const pendingFlash = new Set(); // order ids changed by a live event, highlighted once on next render
const filters = { search: '', classType: '', condition: '', status: '', descending: false };

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function placedTime(order) {
  // SQLite CURRENT_TIMESTAMP is UTC without a zone marker.
  const date = new Date(`${order.placedAt.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function mealCell([category, label], order) {
  const item = order.items[category];
  if (!item) return `<div class="cr-meal" data-label="${label}"><span class="cr-dash" aria-label="Nothing ordered">-</span></div>`;
  const thumb = item.thumbUrl
    ? `<img src="${escapeHtml(item.thumbUrl)}" alt="" width="44" height="44" loading="lazy" decoding="async">`
    : '<span class="cr-thumb-placeholder">&#127860;</span>';
  return `<div class="cr-meal" data-label="${label}"><span class="cr-thumb">${thumb}</span><span class="cr-meal-name">${escapeHtml(item.name)}</span></div>`;
}

function statusCell(order) {
  const next = NEXT_STEP[order.status];
  const advance = next
    ? `<button type="button" class="cr-advance" data-action="advance" data-id="${order.id}" data-next="${next[0]}">${next[1]}</button>`
    : '<button type="button" class="cr-advance" disabled>Completed &#10003;</button>';
  const options = STATUSES.map(
    ([value, label]) => `<option value="${value}"${value === order.status ? ' selected' : ''}>${label}</option>`
  ).join('');

  return `<div class="cr-status">
    <span class="cr-pill st-${order.status}">${STATUS_LABEL[order.status]}</span>
    ${advance}
    <select class="cr-status-select" data-action="set" data-id="${order.id}" aria-label="Set status for seat ${escapeHtml(order.seatId)}">${options}</select>
    <button type="button" class="cr-release" data-action="release" data-id="${order.id}">Release seat</button>
  </div>`;
}

function rowInner(order) {
  const conditions = order.conditions.length
    ? order.conditions.map((condition) => `<span class="cr-chip">${escapeHtml(condition.label)}</span>`).join('')
    : '<span class="cr-dash" aria-label="No conditions">-</span>';
  const who = [order.passengerName, placedTime(order)].filter(Boolean).map(escapeHtml).join(' &middot; ');

  return `<div class="cr-seat">
      <div class="cr-seat-id">${escapeHtml(order.seatId)}</div>
      <span class="panel-class ${CLASS_TAG[order.classType]}">${escapeHtml(order.classType)}</span>
      <div class="cr-pax">${who}</div>
    </div>
    <div class="cr-cond" data-label="Health conditions">${conditions}</div>
    <div class="cr-meals">${CATEGORIES.map((category) => mealCell(category, order)).join('')}</div>
    ${statusCell(order)}`;
}

// Everything that changes what a row shows; if it is unchanged the row's DOM is left alone.
function signature(order) {
  return JSON.stringify([order.status, order.passengerName, order.classType, order.items, order.conditions, order.updatedAt]);
}

function matchesFilters(order) {
  if (filters.search && !order.seatId.toLowerCase().includes(filters.search.toLowerCase())) return false;
  if (filters.classType && order.classType !== filters.classType) return false;
  if (filters.status && order.status !== filters.status) return false;
  if (filters.condition && !order.conditions.some((condition) => condition.id === filters.condition)) return false;
  return true;
}

function bySeat(a, b) {
  return a.row - b.row || a.letter.localeCompare(b.letter);
}

function visibleOrders() {
  const list = [...orders.values()].filter(matchesFilters).sort(bySeat);
  return filters.descending ? list.reverse() : list;
}

function renderChips() {
  const counts = Object.fromEntries(STATUSES.map(([status]) => [status, 0]));
  for (const order of orders.values()) counts[order.status] += 1;

  const chip = (value, label, count) =>
    `<button type="button" class="cr-chip-btn${filters.status === value ? ' is-active' : ''} ${value ? `st-${value}` : ''}" data-status-filter="${value}">${label} <b>${count}</b></button>`;
  $('statusChips').innerHTML =
    chip('', 'All', orders.size) + STATUSES.map(([status, label]) => chip(status, label, counts[status])).join('');
}

function renderEmptyState(visibleCount) {
  const empty = $('emptyState');
  if (visibleCount) {
    empty.hidden = true;
    return;
  }
  const filtered = filters.search || filters.classType || filters.condition || filters.status;
  empty.textContent = filtered
    ? 'No orders match these filters.'
    : "No orders yet. They'll appear here the moment passengers place them.";
  empty.hidden = false;
}

// Keeps existing row elements, updates only changed ones, and reorders — so
// meal thumbnails don't reload on every live event.
function render() {
  const list = $('orderList');
  const visible = visibleOrders();
  const keep = new Set(visible.map((order) => order.id));

  for (const [id, element] of rows) {
    if (!keep.has(id)) {
      element.remove();
      rows.delete(id);
    }
  }

  let previous = null;
  for (const order of visible) {
    let element = rows.get(order.id);
    const sig = signature(order);

    if (!element) {
      element = document.createElement('article');
      element.className = 'cr-row';
      element.dataset.orderId = order.id;
      element.dataset.sig = sig;
      element.innerHTML = rowInner(order);
      rows.set(order.id, element);
      if (pendingFlash.has(order.id)) element.classList.add('is-flash');
    } else if (element.dataset.sig !== sig) {
      element.dataset.sig = sig;
      element.innerHTML = rowInner(order);
      if (pendingFlash.has(order.id)) {
        element.classList.remove('is-flash');
        void element.offsetWidth; // restart the highlight animation
        element.classList.add('is-flash');
      }
    }
    element.dataset.status = order.status;

    const expected = previous ? previous.nextSibling : list.firstChild;
    if (element !== expected) list.insertBefore(element, expected);
    previous = element;
  }

  pendingFlash.clear();
  renderChips();
  renderEmptyState(visible.length);
  $('clearBtn').hidden = !(filters.search || filters.classType || filters.condition || filters.status);
  $('sortBtn').innerHTML = `Seat ${filters.descending ? '&darr;' : '&uarr;'}`;
  $('lastUpdated').textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

let bannerTimer = null;
function showBanner(text) {
  const banner = $('banner');
  banner.textContent = text;
  banner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (banner.hidden = true), 6000);
}

function handleError(err) {
  if (err instanceof ApiError && err.status === 401) {
    logoutCrew();
    window.location.replace('index.html');
    return;
  }
  showBanner(err instanceof ApiError ? err.message : "Can't reach the server. Check the Wi-Fi connection.");
}

function applyOrder(order, { flash }) {
  orders.set(order.id, order);
  if (flash) pendingFlash.add(order.id);
  render();
}

async function loadOrders() {
  try {
    const { orders: fresh } = await listOrders();
    orders.clear();
    for (const order of fresh) orders.set(order.id, order);
    render();
  } catch (err) {
    handleError(err);
  }
}

async function changeStatus(orderId, status) {
  const row = rows.get(orderId);
  if (row) row.classList.add('is-busy');
  try {
    const { order } = await setOrderStatus(orderId, status);
    applyOrder(order, { flash: false });
  } catch (err) {
    handleError(err);
    render(); // snap any dropdown back to the real status
  } finally {
    const current = rows.get(orderId);
    if (current) current.classList.remove('is-busy');
  }
}

async function onRelease(orderId) {
  const order = orders.get(orderId);
  if (!order) return;
  const ok = window.confirm(`Release seat ${order.seatId}? The passenger's order will be deleted and the seat can order again.`);
  if (!ok) return;
  try {
    await releaseOrder(orderId);
    orders.delete(orderId);
    render();
  } catch (err) {
    handleError(err);
  }
}

// ---------------------------------------------------------------------------
// Live updates
// ---------------------------------------------------------------------------

function setLive(isLive) {
  const el = $('liveIndicator');
  el.textContent = isLive ? 'Live' : 'Reconnecting…';
  el.classList.toggle('is-live', isLive);
}

function connectSocket() {
  if (typeof window.io !== 'function') {
    $('liveIndicator').textContent = 'Offline';
    return;
  }
  const socket = window.io({ auth: { token: getCrewToken() } });

  // Events are only pushed while connected, so every (re)connect reloads the full
  // board instead of trusting that nothing was missed.
  socket.on('connect', () => {
    setLive(true);
    loadOrders();
  });
  socket.on('disconnect', () => setLive(false));
  socket.on('order:upserted', (order) => applyOrder(order, { flash: true }));
  socket.on('order:deleted', ({ id }) => {
    orders.delete(id);
    render();
  });
}

// ---------------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------------

function bindEvents() {
  const list = $('orderList');

  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    const id = Number(button.dataset.id);
    if (button.dataset.action === 'advance') changeStatus(id, button.dataset.next);
    if (button.dataset.action === 'release') onRelease(id);
  });

  list.addEventListener('change', (event) => {
    const select = event.target.closest('select[data-action="set"]');
    if (select) changeStatus(Number(select.dataset.id), select.value);
  });

  $('statusChips').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-status-filter]');
    if (!chip) return;
    filters.status = chip.dataset.statusFilter;
    render();
  });

  $('searchInput').addEventListener('input', (event) => {
    filters.search = event.target.value.trim();
    render();
  });
  $('classFilter').addEventListener('change', (event) => {
    filters.classType = event.target.value;
    render();
  });
  $('conditionFilter').addEventListener('change', (event) => {
    filters.condition = event.target.value;
    render();
  });
  $('sortBtn').addEventListener('click', () => {
    filters.descending = !filters.descending;
    render();
  });
  $('clearBtn').addEventListener('click', () => {
    Object.assign(filters, { search: '', classType: '', condition: '', status: '' });
    $('searchInput').value = '';
    $('classFilter').value = '';
    $('conditionFilter').value = '';
    render();
  });
}

async function fillConditionFilter() {
  try {
    const { conditions } = await getHealthConditions();
    $('conditionFilter').insertAdjacentHTML(
      'beforeend',
      conditions.map((condition) => `<option value="${escapeHtml(condition.id)}">${escapeHtml(condition.label)}</option>`).join('')
    );
  } catch (err) {
    /* the filter just stays at "Any condition" */
  }
}

async function init() {
  if (!(await verifyCrewSession())) {
    window.location.replace('index.html');
    return;
  }
  mountCrewNav('orders');
  bindEvents();
  fillConditionFilter();
  render();
  await loadOrders();
  connectSocket();
}

init();
