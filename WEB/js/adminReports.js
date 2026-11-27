import { escapeHtml } from './util.js';
import { adminApi } from './adminApi.js';
import { errorText, toast, CLASS_LABELS, HAUL_LABELS, CATEGORY_LABELS } from './adminUi.js';
import { getCrewToken } from './crewAuth.js';

const STATUS_LABELS = { pending: 'Pending', preparing: 'Preparing', prepared: 'Prepared', delivered: 'Delivered', completed: 'Completed' };
const STATE_TEXT = {
  ok: '',
  low: '&#9650; Low stock',
  soldout: '&#10005; Sold out',
  unavailable: '&#10074;&#10074; Switched off',
};
const $ = (id) => document.getElementById(id);

let classType = '';
let hasRendered = false;
let refreshTimer = null;

// ---------------------------------------------------------------------------
// Small formatting helpers
// ---------------------------------------------------------------------------

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function tableView(headers, rows) {
  if (!rows.length) return '';
  return `<details class="rp-tableview"><summary>Table view</summary>
    <table class="rp-table"><thead><tr>${headers.map((h, i) => `<th${i ? ' class="rp-num"' : ''}>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((cell, i) => `<td${i ? ' class="rp-num"' : ''}>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>
  </details>`;
}

function card(title, subtitle, body, table, { wide = false } = {}) {
  return `<section class="rp-card${wide ? ' rp-wide' : ''}">
    <h3>${escapeHtml(title)}</h3>
    ${subtitle ? `<p class="rp-sub">${escapeHtml(subtitle)}</p>` : ''}
    ${body}
    ${table || ''}
  </section>`;
}

const emptyNote = (text) => `<p class="rp-empty">${escapeHtml(text)}</p>`;

// ---------------------------------------------------------------------------
// Charts. Single series -> one colour, value at the bar tip, no legend; the
// table view carries every number for anyone who can't or won't read the bars.
// ---------------------------------------------------------------------------

function barChart(rows, noun) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (!total) return emptyNote('Nothing ordered yet.');
  const max = Math.max(...rows.map((row) => row.value));

  return `<div class="rp-bars" role="list">${rows
    .map((row) => {
      const width = max ? (row.value / max) * 100 : 0;
      const tip = `${row.label}: ${plural(row.value, noun, `${noun}s`)} (${pct(row.value, total)}%)`;
      return `<div class="rp-bar-row" role="listitem" tabindex="0" data-tip="${escapeHtml(tip)}">
        <div class="rp-bar-label">${escapeHtml(row.label)}${row.sub ? `<small>${escapeHtml(row.sub)}</small>` : ''}</div>
        <div class="rp-bar-area">
          ${row.value ? `<span class="rp-bar" style="width:${width.toFixed(1)}%"></span>` : ''}
          <span class="rp-bar-value${row.value ? '' : ' is-zero'}">${row.value}</span>
        </div>
      </div>`;
    })
    .join('')}</div>`;
}

// Orders per hour of the (browser-local) day, over the span that has orders.
function hourChart(placedAt) {
  if (!placedAt.length) return { body: emptyNote('No orders yet.'), rows: [] };
  const counts = new Map();
  for (const iso of placedAt) {
    const hour = new Date(iso).getHours();
    counts.set(hour, (counts.get(hour) || 0) + 1);
  }
  const hours = [...counts.keys()];
  const first = Math.min(...hours);
  const last = Math.max(...hours);
  const range = [];
  for (let h = first; h <= last; h += 1) range.push({ hour: h, count: counts.get(h) || 0 });
  const max = Math.max(...range.map((entry) => entry.count));

  const body = `<div class="rp-cols" role="list">${range
    .map((entry) => {
      const label = `${String(entry.hour).padStart(2, '0')}:00`;
      const tip = `${label}: ${plural(entry.count, 'order', 'orders')}`;
      return `<div class="rp-col-wrap" role="listitem" tabindex="0" data-tip="${escapeHtml(tip)}">
        <span class="rp-col-value${entry.count ? '' : ' is-zero'}">${entry.count}</span>
        <div class="rp-col-slot">${entry.count ? `<span class="rp-col" style="height:${((entry.count / max) * 100).toFixed(1)}%"></span>` : ''}</div>
        <span class="rp-col-label">${label}</span>
      </div>`;
    })
    .join('')}</div>`;
  return { body, rows: range.map((entry) => [`${String(entry.hour).padStart(2, '0')}:00`, entry.count]) };
}

// A fill that is the status colour, always paired with an icon + word so colour is never alone.
function meterList(items) {
  if (!items.length) return emptyNote('Every dish has unlimited stock and is switched on.');
  return `<div class="rp-meters">${items
    .map((item) => {
      const filled = item.stock === null ? 0 : item.usedPercent;
      const figure = item.stock === null ? 'No stock limit' : `${item.used} of ${item.stock} ordered`;
      const sub = `${CLASS_LABELS[item.classType]} · ${HAUL_LABELS[item.haulLength]} · ${CATEGORY_LABELS[item.category] || item.category}`;
      const tip = `${item.name} (${sub}): ${figure}`;
      return `<div class="rp-meter-row" tabindex="0" data-tip="${escapeHtml(tip)}">
        <div class="rp-meter-name">${escapeHtml(item.name)}<small>${escapeHtml(sub)}</small></div>
        <div class="rp-meter" role="img" aria-label="${escapeHtml(figure)}"><span class="rp-fill rp-fill-${item.state}" style="width:${filled}%"></span></div>
        <div class="rp-meter-figure">${escapeHtml(figure)}${STATE_TEXT[item.state] ? `<b class="rp-state rp-state-${item.state}">${STATE_TEXT[item.state]}</b>` : ''}</div>
      </div>`;
    })
    .join('')}</div>`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function tile(label, value, note) {
  return `<div class="rp-tile"><div class="rp-label">${escapeHtml(label)}</div><div class="rp-value">${escapeHtml(String(value))}</div>${note ? `<div class="rp-note">${escapeHtml(note)}</div>` : ''}</div>`;
}

function render(data) {
  const { totals } = data;
  const completed = data.byStatus.find((entry) => entry.key === 'completed').count;
  const attention = data.inventory.filter((item) => item.state === 'soldout' || item.state === 'unavailable').length;
  const scopeLabel = data.classType ? `${CLASS_LABELS[data.classType]} class` : 'All cabin classes';

  const statusRows = data.byStatus.map((entry) => ({ label: STATUS_LABELS[entry.key], value: entry.count }));
  const classRows = data.byClass.map((entry) => ({ label: CLASS_LABELS[entry.key], value: entry.count }));
  const categoryRows = data.byCategory.map((entry) => ({ label: CATEGORY_LABELS[entry.key], value: entry.count }));
  const dishRows = data.topMeals.map((meal) => ({
    label: meal.name,
    sub: `${CLASS_LABELS[meal.classType]} · ${HAUL_LABELS[meal.haulLength]} · ${CATEGORY_LABELS[meal.category] || meal.category}`,
    value: meal.count,
  }));
  const conditionRows = data.conditions.map((entry) => ({ label: entry.label, value: entry.count }));
  const hours = hourChart(data.placedAt);

  $('rpBody').innerHTML = `
    <div class="rp-kpis">
      <div class="rp-hero"><div class="rp-label">Total orders</div><div class="rp-hero-value">${totals.orders}</div><div class="rp-note">${escapeHtml(scopeLabel)}</div></div>
      ${tile('Meals ordered', totals.items, totals.orders ? `${(totals.items / totals.orders).toFixed(1)} per order` : '')}
      ${tile('Completed', totals.orders ? `${pct(completed, totals.orders)}%` : '0%', `${completed} of ${totals.orders}`)}
      ${tile('Declaring a health condition', totals.withConditions, totals.orders ? `${pct(totals.withConditions, totals.orders)}% of orders` : '')}
      ${tile('Dishes sold out or off', attention, attention ? 'See stock & availability' : 'All dishes available')}
    </div>

    <div class="rp-grid">
      ${card('Orders by status', 'Where every order is right now', barChart(statusRows, 'order'), tableView(['Status', 'Orders'], statusRows.map((r) => [r.label, r.value])))}
      ${card('Orders by cabin class', '', barChart(classRows, 'order'), tableView(['Cabin class', 'Orders'], classRows.map((r) => [r.label, r.value])))}
      ${card('Meals ordered by category', 'Demand across the five meal categories', barChart(categoryRows, 'meal'), tableView(['Category', 'Meals ordered'], categoryRows.map((r) => [r.label, r.value])))}
      ${card('Orders by hour', 'When passengers ordered (your local time)', hours.body, tableView(['Hour', 'Orders'], hours.rows))}
      ${card('Most ordered dishes', 'Top 10', barChart(dishRows, 'order'), tableView(['Dish', 'Cabin · flight · category', 'Orders'], dishRows.map((r) => [r.label, r.sub, r.value])), { wide: true })}
      ${card('Health conditions declared', 'How many orders include each condition', barChart(conditionRows, 'order'), tableView(['Condition', 'Orders'], conditionRows.map((r) => [r.label, r.value])), { wide: true })}
      ${card(
        'Stock & availability',
        'Dishes with a stock limit, or switched off. The bar shows how much of the stock has been ordered.',
        meterList(data.inventory),
        tableView(['Dish', 'Cabin · flight · category', 'Ordered', 'Stock', 'Remaining', 'State'], data.inventory.map((i) => [i.name, `${CLASS_LABELS[i.classType]} · ${HAUL_LABELS[i.haulLength]} · ${CATEGORY_LABELS[i.category] || i.category}`, i.used, i.stock === null ? 'Unlimited' : i.stock, i.remaining === null ? 'Unlimited' : i.remaining, i.state])),
        { wide: true }
      )}
    </div>`;

  $('rpUpdated').textContent = `Updated ${new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  hasRendered = true;
}

async function load() {
  const body = $('rpBody');
  body.classList.add('is-loading'); // keep the old picture on screen (dimmed) instead of flashing a skeleton
  try {
    render(await adminApi.summary(classType));
  } catch (err) {
    if (hasRendered) toast(errorText(err), 'error');
    else body.innerHTML = `<div class="ad-empty">${escapeHtml(errorText(err))}</div>`;
  } finally {
    body.classList.remove('is-loading');
  }
}

export function refreshReports() {
  if (!hasRendered) return;
  load();
}

// ---------------------------------------------------------------------------
// Tooltip (enhances; every number is also in the table view)
// ---------------------------------------------------------------------------

function initTooltip() {
  const tip = $('rpTip');
  const show = (target) => {
    const rect = target.getBoundingClientRect();
    tip.textContent = target.dataset.tip;
    tip.hidden = false;
    const width = tip.offsetWidth;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, rect.top - tip.offsetHeight - 8)}px`;
  };
  const hide = () => (tip.hidden = true);
  const root = $('rpBody');
  root.addEventListener('pointerover', (e) => { const t = e.target.closest('[data-tip]'); if (t) show(t); });
  root.addEventListener('pointerout', (e) => { if (e.target.closest('[data-tip]')) hide(); });
  root.addEventListener('focusin', (e) => { const t = e.target.closest('[data-tip]'); if (t) show(t); });
  root.addEventListener('focusout', hide);
  window.addEventListener('scroll', hide, { passive: true });
}

// ---------------------------------------------------------------------------
// Live refresh + exports
// ---------------------------------------------------------------------------

function connectLive() {
  if (typeof window.io !== 'function') return;
  const socket = window.io({ auth: { token: getCrewToken() } });
  const soon = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (!$('tab-reports').hidden) load();
    }, 1500);
  };
  socket.on('order:upserted', soon);
  socket.on('order:deleted', soon);
  socket.on('menu:changed', soon);
  socket.on('connect', soon);
}

async function runExport(button, work, label) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Preparing…';
  try {
    const filename = await work(classType);
    toast(`Downloaded ${filename}`);
  } catch (err) {
    toast(`${label} failed: ${errorText(err)}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

export async function initReports() {
  $('rpClass').addEventListener('change', (event) => {
    classType = event.target.value;
    load();
  });
  $('rpRefresh').addEventListener('click', load);
  $('rpExcel').addEventListener('click', (e) => runExport(e.currentTarget, adminApi.downloadExcel, 'Excel export'));
  $('rpPdf').addEventListener('click', (e) => runExport(e.currentTarget, adminApi.downloadPdf, 'PDF export'));

  initTooltip();
  connectLive();
  await load();
}
