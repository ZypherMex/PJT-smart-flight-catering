import { logoutCrew } from './crewAuth.js';

// One place that defines the crew-only navigation, so every crew page shows the
// same links. Later pages (Admin, QR) are added to this list when they exist.
const CREW_LINKS = [
  { key: 'fleet', label: 'Fleet', href: 'fleet.html' },
  { key: 'seatmap', label: 'Seat Map', href: 'a350.html?mode=crew' },
  { key: 'orders', label: 'Orders', href: 'crew.html' },
  { key: 'admin', label: 'Admin', href: 'admin.html' },
  { key: 'qr', label: 'QR', href: 'qr.html' },
  { key: 'dining', label: 'Dining', href: 'menu.html' },
];

export function mountCrewNav(activeKey) {
  const nav = document.querySelector('.topbar-nav');
  if (!nav) return;

  nav.innerHTML =
    CREW_LINKS.map(
      (link) => `<a href="${link.href}"${link.key === activeKey ? ' class="active"' : ''}>${link.label}</a>`
    ).join('') + '<a href="index.html" id="crewSignOut">Sign out</a>';

  document.getElementById('crewSignOut').addEventListener('click', () => logoutCrew());
}
