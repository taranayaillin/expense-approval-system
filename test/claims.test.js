const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.DATABASE_PATH = path.join(__dirname, '..', 'data', 'test.db');
const db = require('../src/db');
const service = require('../src/claimService');

function resetDatabase() {
  db.exec(`DELETE FROM audit_trails;
    DELETE FROM approvals;
    DELETE FROM claim_line_items;
    DELETE FROM claims;
    DELETE FROM users;
    INSERT INTO users (id, name, email, role) VALUES
      (1, 'Alex Employee', 'alex@example.com', 'Employee'),
      (2, 'Morgan Manager', 'morgan@example.com', 'Manager'),
      (3, 'Taylor Finance', 'taylor@example.com', 'Finance');`);
}

test.beforeEach(resetDatabase);
test.after(() => {
  db.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(`${process.env.DATABASE_PATH}${suffix}`, { force: true });
  }
});

test('meal over 50 requires a note', () => {
  assert.throws(() => service.createClaim({
    submittedBy: 1,
    title: 'Dinner',
    lineItems: [{ expenseDate: '2026-11-07', category: 'Meals', description: 'Dinner', amount: 75 }]
  }), /note is required/i);
});

test('claim over 1000 waits for Manager then Finance approval', () => {
  const claim = service.createClaim({
    submittedBy: 1,
    title: 'Conference',
    lineItems: [{ expenseDate: '2026-11-07', category: 'Travel', description: 'Flights', amount: 1200 }]
  });
  service.submitClaim(claim.id, 1);
  service.approveOrRejectClaim(claim.id, 2, 'Approved', 'Manager review');
  assert.equal(service.getClaimDetails(claim.id).status, 'Submitted');
  assert.throws(() => service.approveOrRejectClaim(claim.id, 2, 'Approved', 'Duplicate'), /valid pending approval/i);
  service.approveOrRejectClaim(claim.id, 3, 'Approved', 'Finance review');
  assert.equal(service.getClaimDetails(claim.id).status, 'Approved');
});

test('claimant cannot approve their own claim', () => {
  const claim = service.createClaim({
    submittedBy: 1,
    title: 'Supplies',
    lineItems: [{ expenseDate: '2026-11-07', category: 'Office Supplies', description: 'Paper', amount: 40 }]
  });
  service.submitClaim(claim.id, 1);
  assert.throws(() => service.approveOrRejectClaim(claim.id, 1, 'Approved', 'Self'), /own claims/i);
});

test('submissions and decisions create audit records', () => {
  const claim = service.createClaim({
    submittedBy: 1,
    title: 'Laptop accessory',
    lineItems: [{ expenseDate: '2026-11-07', category: 'Software', description: 'License', amount: 100 }]
  });
  service.submitClaim(claim.id, 1);
  service.approveOrRejectClaim(claim.id, 2, 'Approved', 'Approved');
  const audit = db.prepare('SELECT * FROM audit_trails WHERE claim_id = ? ORDER BY id').all(claim.id);
  assert.ok(audit.some(row => row.action === 'Claim submitted'));
  assert.ok(audit.some(row => row.action === 'Manager approval'));
  assert.ok(audit.every(row => row.user_id && row.created_at));
});
