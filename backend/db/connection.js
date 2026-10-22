const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', '..', 'database', 'catering.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

module.exports = db;
