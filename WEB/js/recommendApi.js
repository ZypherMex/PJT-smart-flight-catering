// Fetch wrappers for the seat page: seat lookup + AI meal recommendation.

export async function getSeat(seatId) {
  const res = await fetch(`/api/seats/${encodeURIComponent(seatId)}`);
  if (!res.ok) throw new Error(`GET seat ${seatId} failed: ${res.status}`);
  return res.json();
}

export async function recommendMeal({ seatNumber, haulType, selectedMeals }) {
  const res = await fetch('/api/meal/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seatNumber, haulType, selectedMeals }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Recommend meal failed: ${res.status}`);
  }
  return res.json();
}
