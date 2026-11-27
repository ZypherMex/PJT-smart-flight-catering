// Makes a safe, consistent copy of the database while the server is running:
//   npm run backup
// Copying DATABASE/catering.sqlite by hand can miss the newest orders (SQLite
// keeps recent writes in a side file), so use this instead.

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..', '..');
const SOURCE = path.join(ROOT, 'DATABASE', 'catering.sqlite');
const BACKUP_DIR = path.join(ROOT, 'DATABASE', 'backups');

function pad(n) {
  return String(n).padStart(2, '0');
}

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`No database found at ${SOURCE}. Start the server once first.`);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const now = new Date();
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const destination = path.join(BACKUP_DIR, `catering-${stamp}.sqlite`);

  const db = new Database(SOURCE, { readonly: true });
  try {
    await db.backup(destination);
  } finally {
    db.close();
  }
  const kb = Math.round(fs.statSync(destination).size / 1024);
  console.log(`Backup saved: ${destination} (${kb} KB)`);
  console.log('To restore: stop the server, then copy that file over DATABASE/catering.sqlite (and delete any catering.sqlite-wal / -shm files next to it).');
}

main().catch((err) => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
