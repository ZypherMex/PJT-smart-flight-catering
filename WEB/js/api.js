// Thin fetch() wrappers around the backend's /api/* endpoints.

import { crewHeaders } from './crewAuth.js';

// The crew token (if there is one) is always sent: the seat list and a seat's
// saved conditions return more to a signed-in crew member than to the public.
async function getJson(url) {
  const res = await fetch(url, { headers: crewHeaders() });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

export function getFleet() {
  return getJson('/api/fleet');
}

export function getGridConfig() {
  return getJson('/api/seat-grid-config');
}

export function getAllSeats() {
  return getJson('/api/seats');
}

// Crew only.
export function getSeatPreferences(seatId) {
  return getJson(`/api/seats/${encodeURIComponent(seatId)}/preferences`);
}

// Crew only.
export async function randomizeAllPreferences(haul, time) {
  const res = await fetch('/api/seats/randomize-preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...crewHeaders() },
    body: JSON.stringify({ haul, time }),
  });
  if (!res.ok) throw new Error(`Randomize preferences failed: ${res.status}`);
  return res.json();
}
