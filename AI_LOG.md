# AI Development Log

## Tools Used

- **Copilot Chat** was used as the primary pair-programming tool in this workspace.
- VS Code file tools were used to inspect and edit source files.
- Node.js commands were used to install dependencies, run tests, start servers, and call API endpoints.
- Vite was used to compile and serve the React frontend.
- SQLite and the Node test runner were used to verify backend behavior.

## Key Prompts Used

1. **Backend foundation:** "Read AGENT.md. Build a Node.js and Express backend with an SQLite database. Include claims, line items, and audit trails, and enforce the server-side business rules."
2. **Frontend implementation:** "Build a React frontend with Tailwind CSS connecting to http://localhost:3000, including role switching, employee claim editing, approval queues, finance payment actions, and audit trails."
3. **Backend integration repair:** "Add draft editing and resubmission support, because the employee workflow requires them, and enable browser access from http://localhost:5173."
4. **Validation:** "Run the backend tests and frontend production build, then verify that the API and Vite servers respond locally."
5. **Assessment documentation:** "Generate AI_LOG.md, DESIGN.md, and TESTING.md according to the project guidelines, and reduce README setup to five steps or fewer."

## AI Output Verification and Corrections

- The initial SQLite schema contained malformed `NOT NOT NULL` declarations. These were identified during local review and corrected to `NOT NULL` in `src/db.js`.
- The first dependency versions did not provide a `better-sqlite3` binary for the installed Node version. The dependency was upgraded to `better-sqlite3` 13.0.3 and verified with `npm install` and backend tests.
- Backend services returned database row field names such as `expense_date`, while the frontend design uses JavaScript-friendly fields such as `expenseDate`. The JSON contracts were reviewed and the frontend adapter was aligned to the actual API response.
- Test cleanup initially attempted to remove the shared `data` directory while SQLite could still hold its files. Cleanup was corrected to remove only the isolated `test.db`, `test.db-shm`, and `test.db-wal` files.
- A strict Tailwind/React source review removed invalid JSX `class` attributes and confirmed that JSX uses `className`.
- The frontend was separated into `frontend/src` because `src` already belongs to the backend. The location still follows the requested React source structure and connects to the API documented in `AGENT.md`.

## Manual Code Review

The following areas were reviewed and tested by hand rather than accepted solely from generated output:

- SQLite schema names, foreign keys, constraints, indexes, and status values.
- Claim creation payloads and line-item validation.
- Manager-before-Finance approval ordering and duplicate approval handling.
- Self-approval checks against `submitted_by`.
- Meal validation for amounts strictly greater than 50.
- Audit records for creation, submission, approval, rejection, and payment.
- Express error responses and CORS configuration for the Vite origin.
- Role switcher behavior and API user-role mapping in the React UI.
- Responsive layout, queue selection, comments, and claim detail presentation.
- Production frontend build output and the API health endpoint.

Generated code was run, compiled, or checked with Node, Vite, VS Code diagnostics, and the backend test runner. Where generated output was incomplete or platform-specific, it was corrected and rerun locally.
