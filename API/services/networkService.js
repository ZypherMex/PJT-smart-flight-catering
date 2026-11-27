const os = require('os');

// Adapters that exist only inside this computer (VMs, containers, WSL) can't be
// reached from a passenger's phone, so they are ranked last.
const VIRTUAL = /vethernet|virtual|vmware|vbox|hyper-v|wsl|docker|loopback|bluetooth|tailscale|zerotier/i;
const WIFI = /wi-?fi|wlan|wireless/i;

function isPrivate(address) {
  return /^10\./.test(address) || /^192\.168\./.test(address) || /^172\.(1[6-9]|2\d|3[01])\./.test(address);
}

function score({ interface: name, address }) {
  let points = 0;
  if (isPrivate(address)) points += 4;
  if (WIFI.test(name)) points += 2;
  if (VIRTUAL.test(name)) points -= 6;
  return points;
}

// Every IPv4 address another device could try, best guess first.
function getLanAddresses() {
  const found = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const entry of list || []) {
      // 169.254.x.x is a "no network found" self-assigned address, never useful.
      if (entry.family !== 'IPv4' || entry.internal || entry.address.startsWith('169.254.')) continue;
      found.push({ interface: name, address: entry.address });
    }
  }
  return found.sort((a, b) => score(b) - score(a));
}

// PUBLIC_URL (from .env) wins when set — for a hostname, a fixed router address,
// or a machine with several networks where auto-detection would guess wrong.
function getAccessUrls(port) {
  const urls = getLanAddresses().map(({ interface: name, address }) => ({
    interface: name,
    address,
    url: `http://${address}:${port}`,
  }));
  if (process.env.PUBLIC_URL) {
    urls.unshift({ interface: 'PUBLIC_URL setting', address: null, url: process.env.PUBLIC_URL.replace(/\/+$/, '') });
  }
  return urls.map((entry, index) => ({ ...entry, recommended: index === 0 }));
}

module.exports = { getAccessUrls };
