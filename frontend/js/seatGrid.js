// Renders the landscape seat map (rows left-to-right nose-to-tail, seat
// letters stacked vertically within a row) from the server's grid config,
// and reports clicks back to app.js via onSeatClick.

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// Some rows (e.g. the tapered final economy row near the tail) have fewer
// seat-letter groups, or shorter groups, than the rest of their cabin. Without
// padding, those rows render shorter and every seat below the shortfall drifts
// out of alignment with the same letter in neighboring columns. The template
// is the row shape with the most groups/seats in the cabin; every other row
// is padded out to match it with invisible placeholders that occupy the same
// slot but render nothing.
function tallestRowShape(cabin) {
  return cabin.rows.reduce((best, row) => {
    const bestCount = best.groups.reduce((n, g) => n + g.length, 0);
    const rowCount = row.groups.reduce((n, g) => n + g.length, 0);
    return rowCount > bestCount ? row : best;
  }, cabin.rows[0]).groups;
}

function padRowToTemplate(template, groups) {
  return template.map((templateGroup, i) => {
    const actualGroup = groups[i] || [];
    return templateGroup.map((_, j) => (j < actualGroup.length ? actualGroup[j] : null));
  });
}

function renderRow(cabin, rowConfig, template, prefsBySeatId) {
  const paddedGroups = padRowToTemplate(template, rowConfig.groups);
  let colHtml = '<div class="seats-col">';
  paddedGroups.forEach((group, i) => {
    group.forEach((letter) => {
      if (letter === null) {
        colHtml += `<div class="seat-placeholder cabin-${cabin.key}" aria-hidden="true"></div>`;
        return;
      }
      const seatId = `${rowConfig.row}${letter}`;
      const hasPrefs = prefsBySeatId.get(seatId) ? ' has-prefs' : '';
      colHtml += `<button type="button" class="seat cabin-${cabin.key}${hasPrefs}" data-seat="${seatId}" data-cabin="${cabin.key}" title="${seatId} — ${cabin.name} Class">${letter}</button>`;
    });
    if (i < paddedGroups.length - 1) colHtml += '<div class="vaisle"></div>';
  });
  colHtml += '</div>';
  return `<div class="row-col"><div class="row-num">${rowConfig.row}</div>${colHtml}</div>`;
}

function cabinSeatCount(cabin) {
  return cabin.rows.reduce((total, row) => total + row.groups.reduce((n, g) => n + g.length, 0), 0);
}

function renderCabin(cabin, prefsBySeatId) {
  const template = tallestRowShape(cabin);
  const rowsHtml = cabin.rows.map((row) => renderRow(cabin, row, template, prefsBySeatId)).join('');
  return `<section class="cabin-block cabin-${cabin.key}-section">
    <div class="cabin-header"><h2>${cabin.name} Class</h2><span class="seat-count">${cabinSeatCount(cabin)} seats &middot; rows ${cabin.rowStart}-${cabin.rowEnd}</span></div>
    <div class="rows-strip">${rowsHtml}</div>
  </section>`;
}

// The seat map is wider than most screens at full size (312 seats across
// 3 cabins). Rather than let it scroll, it's rendered at natural size and
// then scaled down (CSS transform) to exactly fit the viewport's width, so
// the whole plane is always visible with no scrollbar. Never scales up —
// a map that's already narrower than its container renders at 1:1.
function fitSeatMapToViewport() {
  const viewport = document.querySelector('.seatmap-viewport');
  const scaleEl = document.getElementById('seatmap');
  if (!viewport || !scaleEl) return;
  scaleEl.style.transform = 'scale(1)';
  const availableWidth = viewport.clientWidth;
  const naturalWidth = scaleEl.scrollWidth;
  const scale = Math.min(1, availableWidth / naturalWidth);
  scaleEl.style.transform = `scale(${scale})`;
  viewport.style.height = `${scaleEl.getBoundingClientRect().height}px`;
}

export function renderSeatMap(gridConfig, seats, onSeatClick) {
  const prefsBySeatId = new Map(seats.map((s) => [s.seatId, !!s.hasPreferences]));
  const container = document.getElementById('seatmap');

  const html = gridConfig.cabins
    .map((cabin, idx) => renderCabin(cabin, prefsBySeatId) + (idx < gridConfig.cabins.length - 1 ? '<div class="cabin-gap"></div>' : ''))
    .join('');
  container.innerHTML = `<div class="plane-chart">${html}</div>`;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.seat');
    if (!btn) return;
    onSeatClick(btn.getAttribute('data-seat'), btn.getAttribute('data-cabin'));
  });

  fitSeatMapToViewport();
  window.addEventListener('resize', fitSeatMapToViewport);
}

export function highlightSelectedSeat(seatId) {
  document.querySelectorAll('.seat').forEach((btn) => {
    btn.classList.toggle('selected', btn.getAttribute('data-seat') === seatId);
  });
}

export function setSeatHasPrefs(seatId, hasPrefs) {
  const btn = document.querySelector(`.seat[data-seat="${escapeAttr(seatId)}"]`);
  if (btn) btn.classList.toggle('has-prefs', hasPrefs);
}
