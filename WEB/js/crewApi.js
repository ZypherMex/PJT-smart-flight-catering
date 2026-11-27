// Crew-only calls: every request carries the crew token from the passkey login.
import { crewHeaders } from './crewAuth.js';
import { ApiError } from './orderApi.js';

async function request(method, url, body) {
  const headers = { ...crewHeaders() };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
}

export function listOrders() {
  return request('GET', '/api/orders');
}

export function setOrderStatus(orderId, status) {
  return request('PATCH', `/api/orders/${orderId}/status`, { status });
}

export function releaseOrder(orderId) {
  return request('DELETE', `/api/orders/${orderId}`);
}
