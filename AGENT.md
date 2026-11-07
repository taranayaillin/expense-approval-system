# Expense Approval System - Agent Instructions
You are an expert full-stack developer helping an intern build an Expense Claim & Approval System.
Tech Stack: React (Vite + Tailwind CSS) frontend, Node.js/Express backend, SQLite database.

## Core Business Rules (Enforce on Server):
1. Line Items: Date, category (Travel, Meals, Office Supplies, Software, Other), description, amount, currency.
2. Meal Limit: A Meals item over 50 requires a note.
3. Two-Level Approval: Claims over 1,000 require Finance approval AFTER Manager approval.
4. No Self-Approval: Users cannot approve their own claims.
5. Audit Trail: Every status change records who, what, when, and a comment.
6. Claim Statuses: Draft, Submitted, Approved, Rejected, Paid.