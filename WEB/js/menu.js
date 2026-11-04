import { getMenu } from './menuApi.js';

const ICON_GLYPHS = {
  dip: '🫓', chicken: '🍗', dumpling: '🥟', dessert: '🍮', chocolate: '🍫',
  champagne: '🍾', wine: '🍷', egg: '🍳', tofu: '🧈', waffle: '🧇',
  caviar: '🥄', soup: '🥣', antipasti: '🍖', salad: '🥗', beef: '🥩',
  fish: '🐟', tart: '🥧', fruit: '🍉', cheese: '🧀', noodles: '🍜',
  pie: '🥧', sandwich: '🥪', yoghurt: '🥛', crepe: '🥞', bread: '🍞',
  pizza: '🍕', rice: '🍚', cocktail: '🍹',
};

function glyphFor(icon) {
  return ICON_GLYPHS[icon] || '🍽️';
}

const DIETARY_LABELS = { vegetarian: 'Vegetarian', healthier: 'Healthier Meal' };

function renderDishCard(item) {
  const photo = item.imageUrl
    ? `<img src="${item.imageUrl}" alt="${item.name}">`
    : `<div class="dish-photo-placeholder icon-${item.icon}"><span>${glyphFor(item.icon)}</span></div>`;

  const badge = item.dietaryTag
    ? `<span class="badge dish-badge">${DIETARY_LABELS[item.dietaryTag] || item.dietaryTag}</span>`
    : '';

  return `<div class="dish-card">
    <div class="dish-photo">${photo}</div>
    <div class="dish-body">
      <div class="dish-name">${item.name}${badge}</div>
      ${item.description ? `<p class="dish-desc">${item.description}</p>` : ''}
    </div>
  </div>`;
}

function renderSection(section) {
  return `<section class="menu-section">
    <h2 class="menu-section-title">${section.sectionName}</h2>
    <div class="dish-row-wrap">
      <button type="button" class="dish-scroll-btn dish-scroll-prev" aria-label="Scroll left">&#8249;</button>
      <div class="dish-row">${section.items.map(renderDishCard).join('')}</div>
      <button type="button" class="dish-scroll-btn dish-scroll-next" aria-label="Scroll right">&#8250;</button>
    </div>
  </section>`;
}

function wireScrollButtons(container) {
  container.querySelectorAll('.dish-row-wrap').forEach((wrap) => {
    const row = wrap.querySelector('.dish-row');
    wrap.querySelector('.dish-scroll-prev').addEventListener('click', () => {
      row.scrollBy({ left: -260, behavior: 'smooth' });
    });
    wrap.querySelector('.dish-scroll-next').addEventListener('click', () => {
      row.scrollBy({ left: 260, behavior: 'smooth' });
    });
  });
}

const state = { classType: 'First', haulLength: 'shortHaul' };

async function render() {
  const container = document.getElementById('menuContent');
  container.innerHTML = '<div class="panel-placeholder">Loading menu&hellip;</div>';
  try {
    const { sections } = await getMenu(state.classType, state.haulLength);
    if (!sections.length) {
      container.innerHTML = '<div class="panel-placeholder">No menu content available for this combination yet.</div>';
      return;
    }
    container.innerHTML = sections.map(renderSection).join('');
    wireScrollButtons(container);
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="panel-placeholder">Failed to load menu. Is the server running?</div>';
  }
}

function wireTabs() {
  document.querySelectorAll('[data-class-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.classType = btn.getAttribute('data-class-type');
      document.querySelectorAll('[data-class-type]').forEach((b) => b.classList.toggle('active', b === btn));
      render();
    });
  });
  document.querySelectorAll('[data-haul-length]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.haulLength = btn.getAttribute('data-haul-length');
      document.querySelectorAll('[data-haul-length]').forEach((b) => b.classList.toggle('active', b === btn));
      render();
    });
  });
}

wireTabs();
render();
