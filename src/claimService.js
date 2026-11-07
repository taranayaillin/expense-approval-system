const db = require('./db');
const { HttpError } = require('./errors');

const categories = new Set(['Travel', 'Meals', 'Office Supplies', 'Software', 'Other']);

function getUser(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getClaim(id) {
  return db.prepare('SELECT * FROM claims WHERE id = ?').get(id);
}

function getClaimTotal(claimId) {
  return db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM claim_line_items WHERE claim_id = ?').get(claimId).total;
}

function validateLineItems(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    throw new HttpError(400, 'At least one line item is required');
  }

  lineItems.forEach((item, index) => {
    if (!item.expenseDate || !item.category || !item.description) {
      throw new HttpError(400, `Line item ${index + 1} requires expenseDate, category, and description`);
    }
    if (!categories.has(item.category)) {
      throw new HttpError(400, `Invalid category on line item ${index + 1}`);
    }
    if (!Number.isFinite(Number(item.amount)) || Number(item.amount) < 0) {
      throw new HttpError(400, `Invalid amount on line item ${index + 1}`);
    }
    if (item.category === 'Meals' && Number(item.amount) > 50 && !String(item.note || '').trim()) {
      throw new HttpError(400, `A note is required for Meals over 50 on line item ${index + 1}`);
    }
  });
}

function audit(claimId, userId, action, previousStatus, newStatus, comment = null) {
  db.prepare(`INSERT INTO audit_trails
    (claim_id, user_id, action, previous_status, new_status, comment)
    VALUES (?, ?, ?, ?, ?, ?)`).run(claimId, userId, action, previousStatus, newStatus, comment);
}

function createClaim({ submittedBy, title, currency = 'USD', lineItems }) {
  validateLineItems(lineItems);
  const user = getUser(submittedBy);
  if (!user) throw new HttpError(404, 'Submitting user not found');
  if (!String(title || '').trim()) throw new HttpError(400, 'Claim title is required');

  const create = db.transaction(() => {
    const result = db.prepare(`INSERT INTO claims (submitted_by, title, currency, status)
      VALUES (?, ?, ?, 'Draft')`).run(submittedBy, title.trim(), currency);
    const claimId = result.lastInsertRowid;
    const insertItem = db.prepare(`INSERT INTO claim_line_items
      (claim_id, expense_date, category, description, amount, currency, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);

    lineItems.forEach(item => insertItem.run(
      claimId, item.expenseDate, item.category, item.description.trim(), Number(item.amount), item.currency || currency, item.note?.trim() || null
    ));
    audit(claimId, submittedBy, 'Claim created', null, 'Draft', 'Claim draft created');
    return claimId;
  });

  return getClaimDetails(create());
}

function updateDraft(claimId, userId, { title, currency = 'USD', lineItems }) {
  const claim = getClaim(claimId);
  if (!claim) throw new HttpError(404, 'Claim not found');
  if (claim.status !== 'Draft') throw new HttpError(409, 'Only draft claims can be edited');
  if (claim.submitted_by !== userId) throw new HttpError(403, 'Only the claimant can edit this claim');
  validateLineItems(lineItems);
  if (!String(title || '').trim()) throw new HttpError(400, 'Claim title is required');

  db.transaction(() => {
    db.prepare(`UPDATE claims SET title = ?, currency = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(title.trim(), currency, claimId);
    db.prepare('DELETE FROM claim_line_items WHERE claim_id = ?').run(claimId);
    const insertItem = db.prepare(`INSERT INTO claim_line_items
      (claim_id, expense_date, category, description, amount, currency, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    lineItems.forEach(item => insertItem.run(
      claimId, item.expenseDate, item.category, item.description.trim(), Number(item.amount), item.currency || currency, item.note?.trim() || null
    ));
    audit(claimId, userId, 'Draft updated', 'Draft', 'Draft', 'Claim draft updated');
  })();
  return getClaimDetails(claimId);
}

function submitClaim(claimId, userId) {
  const claim = getClaim(claimId);
  if (!claim) throw new HttpError(404, 'Claim not found');
  if (!['Draft', 'Rejected'].includes(claim.status)) {
    throw new HttpError(409, 'Only draft or rejected claims can be submitted');
  }
  if (claim.submitted_by !== userId) throw new HttpError(403, 'Only the claimant can submit this claim');

  const items = db.prepare('SELECT * FROM claim_line_items WHERE claim_id = ?').all(claimId);
  validateLineItems(items.map(item => ({
    expenseDate: item.expense_date, category: item.category, description: item.description,
    amount: item.amount, currency: item.currency, note: item.note
  })));

  db.transaction(() => {
    const previousStatus = claim.status;
    db.prepare(`UPDATE claims SET status = 'Submitted', updated_at = datetime('now') WHERE id = ?`).run(claimId);
    audit(claimId, userId, 'Claim submitted', previousStatus, 'Submitted', 'Submitted for approval');
  })();
  return getClaimDetails(claimId);
}

function approveOrRejectClaim(claimId, userId, decision, comment) {
  const normalizedDecision = decision === 'Approved' || decision === 'Rejected' ? decision : null;
  if (!normalizedDecision) throw new HttpError(400, 'Decision must be Approved or Rejected');

  const claim = getClaim(claimId);
  const user = getUser(userId);
  if (!claim) throw new HttpError(404, 'Claim not found');
  if (!user) throw new HttpError(404, 'Approving user not found');
  if (claim.status !== 'Submitted') throw new HttpError(409, 'Only submitted claims can be decided');
  if (claim.submitted_by === userId) throw new HttpError(403, 'Users cannot approve their own claims');

  const total = getClaimTotal(claimId);
  const managerApproval = db.prepare("SELECT * FROM approvals WHERE claim_id = ? AND level = 'Manager'").get(claimId);
  const financeApproval = db.prepare("SELECT * FROM approvals WHERE claim_id = ? AND level = 'Finance'").get(claimId);
  let level;

  if (normalizedDecision === 'Rejected') {
    if (!['Manager', 'Finance'].includes(user.role)) throw new HttpError(403, 'Only Manager or Finance users may reject claims');
    level = user.role;
  } else if (user.role === 'Manager' && !managerApproval) {
    level = 'Manager';
  } else if (total > 1000 && managerApproval && !financeApproval && user.role === 'Finance') {
    level = 'Finance';
  } else if (total <= 1000 && managerApproval && user.role === 'Finance') {
    throw new HttpError(409, 'Claims at or below 1000 require only Manager approval');
  } else {
    throw new HttpError(409, total > 1000 && !managerApproval
      ? 'Manager approval is required before Finance approval'
      : 'This user has no valid pending approval for this claim');
  }

  db.transaction(() => {
    db.prepare(`INSERT INTO approvals (claim_id, user_id, level, decision, comment)
      VALUES (?, ?, ?, ?, ?)`).run(claimId, userId, level, normalizedDecision, comment || null);

    let newStatus;
    if (normalizedDecision === 'Rejected') newStatus = 'Rejected';
    else if (total > 1000 && level === 'Manager') newStatus = 'Submitted';
    else newStatus = 'Approved';

    if (newStatus !== claim.status) {
      db.prepare(`UPDATE claims SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(newStatus, claimId);
      audit(claimId, userId, normalizedDecision === 'Rejected' ? 'Claim rejected' : `${level} approval`, claim.status, newStatus, comment || null);
    } else {
      audit(claimId, userId, `${level} approval`, claim.status, newStatus, comment || null);
    }
  })();

  return getClaimDetails(claimId);
}

function markPaid(claimId, userId, comment) {
  const claim = getClaim(claimId);
  const user = getUser(userId);
  if (!claim) throw new HttpError(404, 'Claim not found');
  if (!user) throw new HttpError(404, 'User not found');
  if (claim.status !== 'Approved') throw new HttpError(409, 'Only approved claims can be paid');

  db.transaction(() => {
    db.prepare(`UPDATE claims SET status = 'Paid', updated_at = datetime('now') WHERE id = ?`).run(claimId);
    audit(claimId, userId, 'Claim paid', 'Approved', 'Paid', comment || null);
  })();
  return getClaimDetails(claimId);
}

function getClaimDetails(claimId) {
  const claim = getClaim(claimId);
  if (!claim) return null;
  return {
    ...claim,
    lineItems: db.prepare('SELECT * FROM claim_line_items WHERE claim_id = ? ORDER BY id').all(claimId),
    total: getClaimTotal(claimId),
    approvals: db.prepare('SELECT * FROM approvals WHERE claim_id = ? ORDER BY id').all(claimId),
    auditTrail: db.prepare('SELECT * FROM audit_trails WHERE claim_id = ? ORDER BY id').all(claimId)
  };
}

function listClaims() {
  return db.prepare('SELECT * FROM claims ORDER BY id DESC').all().map(claim => getClaimDetails(claim.id));
}

module.exports = { createClaim, updateDraft, submitClaim, approveOrRejectClaim, markPaid, getClaimDetails, listClaims, getClaimTotal, getUser };
