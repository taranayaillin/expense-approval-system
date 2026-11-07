const express = require('express');
const db = require('./db');
const claims = require('./claimService');
const { HttpError } = require('./errors');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.get('/users', (req, res) => res.json(db.prepare('SELECT id, name, email, role FROM users ORDER BY id').all()));
router.post('/users', (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email || !['Employee', 'Manager', 'Finance'].includes(role)) {
    throw new HttpError(400, 'name, email, and a valid role are required');
  }
  const result = db.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)').run(name.trim(), email.trim(), role);
  res.status(201).json({ id: result.lastInsertRowid, name, email, role });
});

router.get('/claims/export/csv', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, u.name AS employee_name, c.currency, c.status, c.created_at,
           COALESCE(SUM(li.amount), 0) AS total_amount
    FROM claims c
    JOIN users u ON u.id = c.submitted_by
    LEFT JOIN claim_line_items li ON li.claim_id = c.id
    WHERE c.status IN ('Approved', 'Paid')
    GROUP BY c.id, u.name, c.currency, c.status, c.created_at
    ORDER BY c.created_at DESC, c.id DESC
  `).all();

  const csvValue = value => {
    const text = String(value ?? '');
    const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  };
  const header = ['Claim ID', 'Employee Name', 'Total Amount', 'Currency', 'Status', 'Submission Date'];
  const csv = [header, ...rows.map(row => [
    row.id, row.employee_name, Number(row.total_amount).toFixed(2), row.currency, row.status, row.created_at
  ])].map(row => row.map(csvValue).join(',')).join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="approved-paid-claims.csv"');
  res.send(`\ufeff${csv}\r\n`);
});
router.get('/claims', (req, res) => res.json(claims.listClaims()));
router.get('/claims/:id', (req, res) => {
  const claim = claims.getClaimDetails(Number(req.params.id));
  if (!claim) throw new HttpError(404, 'Claim not found');
  res.json(claim);
});
router.post('/claims', (req, res) => res.status(201).json(claims.createClaim(req.body)));
router.put('/claims/:id', (req, res) => res.json(claims.updateDraft(
  Number(req.params.id), Number(req.body.userId), req.body
)));
router.post('/claims/:id/submit', (req, res) => res.json(claims.submitClaim(Number(req.params.id), Number(req.body.userId))));
router.post('/claims/:id/decision', (req, res) => res.json(claims.approveOrRejectClaim(
  Number(req.params.id), Number(req.body.userId), req.body.decision, req.body.comment
)));
router.post('/claims/:id/pay', (req, res) => res.json(claims.markPaid(Number(req.params.id), Number(req.body.userId), req.body.comment)));

module.exports = router;
