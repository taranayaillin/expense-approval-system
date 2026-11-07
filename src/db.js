const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'expense.db');
fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });

const db = new Database(databasePath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('Employee', 'Manager', 'Finance'))
);

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submitted_by INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Paid')),
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS claim_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Travel', 'Meals', 'Office Supplies', 'Software', 'Other')),
  description TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  level TEXT NOT NULL CHECK (level IN ('Manager', 'Finance')),
  decision TEXT NOT NULL CHECK (decision IN ('Approved', 'Rejected')),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(claim_id, level)
);

CREATE TABLE IF NOT EXISTS audit_trails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_claim_line_items_claim ON claim_line_items(claim_id);
CREATE INDEX IF NOT EXISTS idx_approvals_claim ON approvals(claim_id);
CREATE INDEX IF NOT EXISTS idx_audit_claim ON audit_trails(claim_id);
`;

db.exec(schema);

module.exports = db;
