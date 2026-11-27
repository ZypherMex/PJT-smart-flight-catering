import { escapeHtml } from './util.js';
import { verifyCrewSession, crewHeaders, logoutCrew } from './crewAuth.js';
import { mountCrewNav } from './crewNav.js';

const $ = (id) => document.getElementById(id);

let baseUrl = null; // e.g. http://192.168.1.100:3000  (no trailing slash)
let toastTimer = null;

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3000);
}

const orderUrl = () => `${baseUrl}/order.html`;

function showCode() {
  const url = orderUrl();
  const encoded = encodeURIComponent(url);
  $('qrBox').innerHTML = `<img src="/api/qr.svg?url=${encoded}" alt="QR code that opens ${escapeHtml(url)}" width="320" height="320">`;
  $('qrLink').textContent = url;
  $('downloadBtn').href = `/api/qr.png?url=${encoded}&download=1`;
  $('openBtn').href = url;
}

function selectAddress(url) {
  baseUrl = url.replace(/\/+$/, '');
  showCode();
}

async function loadAddresses() {
  const res = await fetch('/api/server-info', { headers: crewHeaders() });
  if (res.status === 401) {
    logoutCrew();
    window.location.replace('index.html');
    return null;
  }
  return (await res.json()).urls;
}

function fillSelect(urls) {
  const select = $('addressSelect');
  if (!urls.length) {
    select.innerHTML = '<option value="">No network found</option>';
    select.disabled = true;
    $('qrBox').innerHTML = '<div class="qr-loading">This computer is not connected to a network. Connect it to the Wi-Fi passengers will use, or type an address below.</div>';
    return;
  }
  select.innerHTML = urls
    .map((entry) => `<option value="${escapeHtml(entry.url)}">${escapeHtml(entry.url)}  —  ${escapeHtml(entry.interface)}${entry.recommended ? '  (suggested)' : ''}</option>`)
    .join('');
  select.addEventListener('change', () => selectAddress(select.value));
  selectAddress(urls[0].url);
}

function useCustomAddress() {
  const input = $('customUrl');
  const error = $('customError');
  const value = input.value.trim();
  if (!/^https?:\/\/[^\s/]+(:\d+)?\/?$/i.test(value)) {
    error.textContent = 'Enter an address like http://192.168.1.100:3000';
    error.hidden = false;
    return;
  }
  error.hidden = true;
  selectAddress(value);
  toast('Using your address');
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(orderUrl());
    toast('Link copied');
  } catch (err) {
    // Clipboard access needs a secure page; on plain http the link is shown on screen to copy by hand.
    toast('Copy not available here. Select the link shown under the code.');
  }
}

async function init() {
  if (!(await verifyCrewSession())) {
    window.location.replace('index.html');
    return;
  }
  mountCrewNav('qr');

  $('printBtn').addEventListener('click', () => window.print());
  $('copyBtn').addEventListener('click', copyLink);
  $('useCustom').addEventListener('click', useCustomAddress);
  $('customUrl').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') useCustomAddress();
  });

  try {
    const urls = await loadAddresses();
    if (urls) fillSelect(urls);
  } catch (err) {
    $('qrBox').innerHTML = '<div class="qr-loading">Could not reach the server.</div>';
  }
}

init();
