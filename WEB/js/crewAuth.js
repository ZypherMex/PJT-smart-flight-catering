// Cabin-crew session handling. The passkey is checked by the server, which
// returns a short-lived token; this module stores it and attaches it to
// crew-only API calls. Nothing secret is stored in the page itself.

const TOKEN_KEY = 'crewToken';

export function getCrewToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function crewHeaders() {
  const token = getCrewToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function logoutCrew() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function loginCrew(passkey) {
  try {
    const res = await fetch('/api/crew/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: body.error || 'Could not sign in. Try again.' };
    localStorage.setItem(TOKEN_KEY, body.token);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: 'Could not reach the server.' };
  }
}

// True only if a token exists AND the server still accepts it (it is lost when
// the server restarts or after 12 hours).
export async function verifyCrewSession() {
  if (!getCrewToken()) return false;
  try {
    const res = await fetch('/api/crew/session', { headers: crewHeaders() });
    if (res.status === 401) logoutCrew();
    return res.ok;
  } catch (err) {
    return false;
  }
}
