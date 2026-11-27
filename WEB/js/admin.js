import { verifyCrewSession } from './crewAuth.js';
import { mountCrewNav } from './crewNav.js';
import { adminApi } from './adminApi.js';
import { shared, initModalDismissal, errorText, toast } from './adminUi.js';
import { initMeals } from './adminMeals.js';
import { initConditions } from './adminConditions.js';
import { initReports, refreshReports } from './adminReports.js';

const loaded = { meals: false, rules: false, reports: false };

async function showTab(name) {
  document.querySelectorAll('.ad-tab').forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  document.getElementById('tab-meals').hidden = name !== 'meals';
  document.getElementById('tab-rules').hidden = name !== 'rules';
  document.getElementById('tab-reports').hidden = name !== 'reports';
  history.replaceState(null, '', name === 'meals' ? 'admin.html' : `admin.html#${name}`);

  if (name === 'reports' && loaded.reports) refreshReports(); // numbers may have moved while it was hidden

  // Each tab loads its data the first time it is opened.
  if (loaded[name]) return;
  loaded[name] = true;
  const starters = { meals: initMeals, rules: initConditions, reports: initReports };
  await starters[name]();
}

async function init() {
  if (!(await verifyCrewSession())) {
    window.location.replace('index.html');
    return;
  }
  mountCrewNav('admin');
  initModalDismissal();

  try {
    shared.meta = await adminApi.meta();
  } catch (err) {
    toast(errorText(err), 'error');
    return;
  }

  document.querySelector('.ad-tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('.ad-tab');
    if (tab) showTab(tab.dataset.tab);
  });

  const hash = window.location.hash.slice(1);
  await showTab(['rules', 'reports'].includes(hash) ? hash : 'meals');
}

init();
