// Fetch wrapper for the menu showcase endpoint.

export async function getMenu(classType, haulLength) {
  const res = await fetch(`/api/menu/${encodeURIComponent(classType)}/${encodeURIComponent(haulLength)}`);
  if (!res.ok) throw new Error(`GET menu ${classType}/${haulLength} failed: ${res.status}`);
  return res.json();
}
