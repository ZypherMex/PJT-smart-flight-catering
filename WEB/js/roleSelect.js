// Demo-only gate: this passkey lives entirely in frontend JS and only sets a
// sessionStorage flag. There is no backend session/auth — it keeps curious
// customers out of the crew view, nothing more. Do not treat this as real security.
const CREW_PASSKEY = '123490';

const modal = document.getElementById('passkeyModal');
const input = document.getElementById('passkeyInput');
const errorEl = document.getElementById('passkeyError');

function openModal() {
  errorEl.hidden = true;
  input.value = '';
  modal.hidden = false;
  input.focus();
}

function closeModal() {
  modal.hidden = true;
}

function trySubmit() {
  if (input.value === CREW_PASSKEY) {
    sessionStorage.setItem('crewUnlocked', '1');
    window.location.href = 'fleet.html';
    return;
  }
  errorEl.hidden = false;
}

document.getElementById('customerCard').addEventListener('click', () => {
  window.location.href = 'a350.html';
});

document.getElementById('crewCard').addEventListener('click', openModal);
document.getElementById('passkeyCancel').addEventListener('click', closeModal);
document.getElementById('passkeySubmit').addEventListener('click', trySubmit);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') trySubmit();
});
