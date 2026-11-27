import { loginCrew } from './crewAuth.js';

const modal = document.getElementById('passkeyModal');
const input = document.getElementById('passkeyInput');
const errorEl = document.getElementById('passkeyError');
const submitBtn = document.getElementById('passkeySubmit');

function openModal() {
  errorEl.hidden = true;
  input.value = '';
  modal.hidden = false;
  input.focus();
}

function closeModal() {
  modal.hidden = true;
}

async function trySubmit() {
  submitBtn.disabled = true;
  const result = await loginCrew(input.value);
  submitBtn.disabled = false;
  if (result.ok) {
    window.location.href = 'fleet.html';
    return;
  }
  errorEl.textContent = result.message;
  errorEl.hidden = false;
}

document.getElementById('customerCard').addEventListener('click', () => {
  window.location.href = 'a350.html';
});

document.getElementById('crewCard').addEventListener('click', openModal);
document.getElementById('passkeyCancel').addEventListener('click', closeModal);
submitBtn.addEventListener('click', trySubmit);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') trySubmit();
});
