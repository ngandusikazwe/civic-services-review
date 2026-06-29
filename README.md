# Civic Services Review

A full-stack implementation of Assignment B from the Full-Stack Developer assessment.

The product scenario is a local-government service request portal. A citizen or business
submits a civic request, such as a business permit, building permit, public-works repair,
community grant, or general service case. A case officer reviews submitted requests,
returns incomplete requests for changes, rejects requests with reasons, or approves them.
Every status change is preserved in an audit trail.

For the optional stretch goal, the app implements a revision round-trip. I
intentionally model returned work with a distinct `RETURNED` status, even though
the base workflow diagram loops returned work back to `DRAFT`, because this makes
reviewer feedback visible, filterable, and auditable before the citizen
resubmits the request.

## Live URL

Pending deployment. Replace this line with the hosted URL before submitting.

Demo accounts:

| Role | Email | Password |
| --- | --- | --- |
| Citizen requester | `alice@example.com` | `password123` |
| Citizen requester | `ben@example.com` | `password123` |
| Case officer | `reviewer@example.com` | `password123` |

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL
- Tests: Vitest, Supertest
- Local setup: Docker Compose for Postgres/API, Vite for frontend

## Local Setup

```bash
cp .env.example .env
npm exec --yes pnpm@10.23.0 -- install
docker compose up -d postgres
npm exec --yes pnpm@10.23.0 -- db:migrate
npm exec --yes pnpm@10.23.0 -- db:seed
npm exec --yes pnpm@10.23.0 -- dev
```

The API runs on `http://localhost:4000`.
The frontend runs on `http://localhost:5173`.

To run the API with Docker:

```bash
docker compose up --build api
```

Then run the frontend separately:

```bash
npm exec --yes pnpm@10.23.0 -- dev:web
```

## Production Deployment

The API Docker image builds both the backend and the React frontend. In production,
the Express server serves the compiled frontend and the REST API from the same
origin, so a deployment can run as one web service plus PostgreSQL.

Required environment variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `WEB_ORIGIN`
- `WEB_DIST_PATH` is already set in the Docker image.

## Tests

```bash
npm exec --yes pnpm@10.23.0 -- test
```

The test suite includes:

- Unit tests for legal and illegal state-machine transitions.
- A Supertest API test proving that a citizen requester receives `403` when calling a case-officer-only approval endpoint.
- A positive API test proving case-officer approval writes the audit log.
- A revision round-trip API test covering return for changes, edit, resubmit, and revision history.

## Data Model

### `users`

Stores seeded demo users with a real role field:

- `APPLICANT`
- `REVIEWER`

Passwords are hashed with Node's `crypto.scryptSync`. This is intentionally simple demo auth, but authorization checks are enforced server-side.

### `applications`

Stores the civic service request object:

- owner
- title
- category
- description
- estimated value
- status
- timestamps

Supported statuses:

- `DRAFT`
- `SUBMITTED`
- `UNDER_REVIEW`
- `RETURNED`
- `APPROVED`
- `REJECTED`

`RETURNED` is the only intentional extension to the base assessment diagram. It
represents the stretch-goal return-for-changes cycle as a first-class state
between reviewer feedback and citizen resubmission.

Supported request categories:

- `BUSINESS_PERMIT`
- `BUILDING_PERMIT`
- `COMMUNITY_GRANT`
- `PUBLIC_WORKS`
- `GENERAL_SERVICE`

### `audit_logs`

Stores every workflow transition:

- application
- actor
- old status
- new status
- comment
- timestamp

### `application_revisions`

Stores an immutable snapshot each time a citizen submits or resubmits a request:

- revision number
- submitted request fields
- submitter
- submitted timestamp

## Workflow Rules

The workflow rules live in `packages/workflow/src/index.ts` so both the API and tests depend on one implementation.
The base assessment diagram shows return-for-changes looping back to `DRAFT`; this implementation uses an explicit `RETURNED`
state for the optional revision round-trip stretch goal, then resubmits back to `SUBMITTED`.

Rules enforced:

- Only the owning citizen requester can submit a `DRAFT` or resubmit a `RETURNED` request.
- Only the owning citizen requester can edit a `DRAFT` or `RETURNED` request.
- Citizens cannot edit after submission unless a case officer returns the request to `RETURNED`.
- Only case officers can move requests out of `SUBMITTED` or `UNDER_REVIEW`.
- `REJECT` and `RETURN_CHANGES` require a comment.
- `APPROVED` and `REJECTED` are terminal states.
- Each successful transition writes an audit log entry.
- Each submit or resubmit records an immutable revision snapshot.

The PostgreSQL repository applies transitions inside a transaction and checks the expected old status while the row is locked, so stale concurrent transitions are rejected.

## API Shape

- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/applications`
- `POST /api/applications`
- `GET /api/applications/:id`
- `PATCH /api/applications/:id`
- `POST /api/applications/:id/submit`
- `POST /api/applications/:id/transitions`

All mutations except login require a bearer token. Citizen visibility is limited to owned requests; case officers can see the queue.

## Trade-offs

- I used a small signed token implementation instead of production-grade sessions or OAuth because the assessment asks for real role enforcement, not production auth infrastructure.
- The backend uses SQL directly through `pg` rather than an ORM. This keeps the data model transparent and makes the transactional workflow update easy to audit.
- File attachments were omitted so the core workflow, authorization, audit trail, and tests stayed solid.
- The optional stretch goal implemented is the revision round-trip. I chose an explicit `RETURNED` status instead of overloading `DRAFT` so returned work is easy to filter, explain, and audit before resubmission.

With more time, I would add pagination/search to the case-officer queue, in-app notifications for status changes, production deployment hardening, and database-backed token/session invalidation.

## AI Usage

OpenAI Codex and ChatGPT were used for scaffolding, code review, test planning, debugging, and README drafting. I verified the workflow rules, authorization behavior, data model, error handling, and tests directly before submission.
