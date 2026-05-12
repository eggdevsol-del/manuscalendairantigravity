const sqlite3 = require('better-sqlite3');
const db = sqlite3('local.db');
const rows = db.prepare("SELECT id, messageType, metadata FROM messages WHERE messageType IN ('appointment_request', 'system') ORDER BY id DESC LIMIT 10").all();
console.log(JSON.stringify(rows, null, 2));
