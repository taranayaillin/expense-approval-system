# Testing

## Backend Unit and Business-Rule Tests

The backend tests use Node's built-in test runner and an isolated SQLite database.

From the project root:

```powershell
npm install
npm test
```

The suite is in `test/claims.test.js`. It resets Employee, Manager, and Finance users before each test, then exercises the service layer against SQLite.

## Frontend Production Test

Build and compile the React application:

```powershell
cd frontend
npm install
npm run build
```

The build must complete without JSX or Tailwind compilation errors and produce output in `frontend/dist`.

## Manual E2E Test

Automated browser-test tooling is not currently installed in this project. Use the following manual E2E procedure in two terminal windows.

### Start the servers

Terminal 1, from the project root:

```powershell
npm start
```

Terminal 2:

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173`.

### Employee flow

1. Select **Employee**.
2. Create a draft claim with one Travel line item.
3. Save the draft and confirm it appears in the drafts panel.
4. Edit the claim title or a line item.
5. Submit the claim and confirm its status changes to Submitted.
6. Confirm the submitted claim appears in claim history and its audit trail.

### Manager flow

1. Switch to **Manager**.
2. Confirm the submitted claim appears in the approval queue.
3. Enter a comment and approve the claim.
4. Confirm a claim of 1000 or less reaches Approved.
5. Confirm an amount above 1000 remains Submitted after Manager approval and awaits Finance.

### Finance flow

1. Switch to **Finance**.
2. Confirm only claims above 1000 with Manager approval appear as pending Finance claims.
3. Approve the claim and confirm it reaches Approved.
4. Mark the approved claim Paid and confirm its status changes.
5. Open **Audit Trail** and confirm the timeline includes the actor, action, timestamp, status transition, and comments.

## Edge Cases

### Meal limit over 50

- A Meals item with an amount of exactly 50 is permitted without a note.
- A Meals item over 50 requires a non-empty note.
- The request must be rejected before the claim is created with its line items.

Covered in the backend suite: `meal over 50 requires a note`.

### Two-level approval over 1000

- Claims over 1000 remain Submitted after Manager approval.
- Finance cannot approve before the Manager approval exists.
- Finance approval changes the claim to Approved.

Covered in: `claim over 1000 waits for Manager then Finance approval`.

### Self-approval prevention

- The claimant's user ID must not equal the approving user's ID.
- A self-approval attempt is rejected before approval or audit writes occur.

Covered in: `claimant cannot approve their own claim`.

### CSV export coverage

- The Finance dashboard exposes **Export to CSV**.
- `GET /api/claims/export/csv` returns `text/csv` with an attachment filename.
- The response contains `Claim ID`, `Employee Name`, `Total Amount`, `Currency`, `Status`, and `Submission Date` columns.
- Only Approved and Paid claims are included by the server query.
- Verified locally: the endpoint returned HTTP 200 and the expected headers with an empty approved/paid claim set.

### Additional coverage

- A manager cannot repeatedly approve the same claim, covered by `claim over 1000 waits for Manager then Finance approval`.
- Submitted claims and Manager approvals create audit records, covered by `submissions and decisions create audit records`.
- Audit records contain a user, action, timestamp, and status data, covered by `submissions and decisions create audit records`.
- Rejected claim resubmission, Approved-to-Paid transitions, and rejection audit entries are implemented and should be included in the manual E2E pass, but are not separately asserted by the current automated unit suite.

## Coverage Summary

At the time of this documentation:

- Backend tests: **4 passing tests, 0 failing tests**.
- Core business rules covered: meal notes, Manager/Finance sequence, self-approval, and audit creation.
- Frontend build coverage: Vite production compilation.
- Automated browser/E2E coverage: **Not yet configured**. Browser testing currently uses the manual procedure above.
- Primary untested UI automation gap: Playwright or Cypress workflows for role switching, form submission, approval actions, payment, and timeline rendering.

Recommended future command after adding Playwright:

```powershell
cd frontend
npm run test:e2e
```
