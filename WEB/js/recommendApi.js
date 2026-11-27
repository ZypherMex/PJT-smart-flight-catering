// AI meal suggestion. The passenger's declared conditions travel in the request
// (the server never looks up another seat's stored health data).
import { ApiError } from './orderApi.js';

export async function recommendMeal({ seatNumber, haulType, conditions, selectedMeals }) {
  const res = await fetch('/api/meal/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seatNumber, haulType, conditions, selectedMeals }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
}
