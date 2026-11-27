// Fetch wrappers for the passenger ordering portal. A passenger has no login;
// the device that placed an order holds a secret token (sent as x-order-token)
// that proves the order is theirs.

export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.error) || `Request failed (${status})`);
    this.status = status;
    this.body = body || {};
  }
}

async function request(method, url, { body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['x-order-token'] = token;

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
}

export function getHealthConditions() {
  return request('GET', '/api/health-conditions');
}

export function getSeatInfo(seatId) {
  return request('GET', `/api/seats/${encodeURIComponent(seatId)}`);
}

export function getPortalMenu({ seat, haul, conditions, token }) {
  const query = new URLSearchParams({ seat, haul, conditions: conditions.join(',') });
  return request('GET', `/api/portal/menu?${query}`, { token });
}

export function placeOrder(body, token) {
  return request('POST', '/api/orders', { body, token });
}

export function getMyOrder(seatId, token) {
  return request('GET', `/api/orders/seat/${encodeURIComponent(seatId)}`, { token });
}
