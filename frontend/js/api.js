// Thin fetch() wrappers around the backend's /api/* endpoints.

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

export function getGridConfig() {
  return getJson('/api/seat-grid-config');
}

export function getAllSeats() {
  return getJson('/api/seats');
}

export function getDiningMatrix() {
  return getJson('/api/dining-matrix');
}

export function getSeatPreferences(seatId) {
  return getJson(`/api/seats/${encodeURIComponent(seatId)}/preferences`);
}

export async function putSeatPreferences(seatId, body) {
  const res = await fetch(`/api/seats/${encodeURIComponent(seatId)}/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT preferences for ${seatId} failed: ${res.status}`);
  return res.json();
}
