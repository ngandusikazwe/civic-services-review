# Submission Audit

Assessment: Full-Stack Developer, Assignment B - Submission & Approval Workflow

Repository: https://github.com/ngandusikazwe/civic-services-review

Live app: https://civic-services-review.onrender.com

Health check: https://civic-services-review.onrender.com/api/health

## Verdict

Ready to submit.

The implementation satisfies the required Assignment B scope: a two-sided React and
Node/PostgreSQL application with real role enforcement, a backend-enforced workflow,
audit logging, tests, migrations, seeded users, a README, a public Git repository,
and a hosted Render deployment.

## Demo Accounts

| Role | Email | Password |
| --- | --- | --- |
| Citizen requester | `alice@example.com` | `password123` |
| Citizen requester | `ben@example.com` | `password123` |
| Case officer | `reviewer@example.com` | `password123` |

## Requirement Checklist

| Requirement | Status | Evidence |
| --- | --- | --- |
| Choose one assignment | Done | Implements Assignment B only. |
| React TypeScript frontend | Done | `apps/web`. |
| Node/Express TypeScript backend | Done | `apps/api`. |
| PostgreSQL persistence | Done | `docker-compose.yml`, migrations in `apps/api/migrations`. |
| Seeded users with roles | Done | `apps/api/src/db/seed.ts`. |
| Applicant create/edit/submit/list | Done | Applicant workspace and API endpoints. |
| Reviewer queue/filter/detail/actions | Done | Reviewer workspace with status filters and decision actions. |
| Backend-enforced workflow | Done | `packages/workflow/src/index.ts`; API calls this package. |
| Illegal transitions rejected | Done | Unit tests cover legal and illegal transitions. |
| Reject/return require comments | Done | Workflow tests and API validation. |
| Every transition audited | Done | `audit_logs` table and detail-page audit trail. |
| Authorization enforced server-side | Done | API test proves applicant receives `403` on reviewer-only approval. |
| Structured error responses | Done | `apps/api/src/http/errors.ts` and error handler. |
| Migrations included | Done | `001_init.sql`, `002_civic_categories.sql`, `003_revision_history.sql`. |
| Tests required | Done | `pnpm test` passes. |
| Hosted deployment | Done | Render URL above. |
| Git repository | Done | Public GitHub repo above. |
| README | Done | Includes run steps, data model, trade-offs, AI usage, credentials, live URL. |
| Optional stretch goal | Done | Revision round-trip with visible revision history. |

## Verification Performed

Latest local test command:

```bash
npm exec --yes --package=pnpm@10.23.0 -- pnpm test
```

Result:

- `packages/workflow`: 11 tests passed.
- `apps/api`: 3 tests passed.
- `apps/web`: no test files configured; command exits successfully with `--passWithNoTests`.

Live smoke checks:

```bash
curl https://civic-services-review.onrender.com/api/health
```

Result:

```json
{"ok":true}
```

Reviewer login was also smoke-tested against the live deployment with
`reviewer@example.com` / `password123`; the API returned a reviewer user and a token.

Fresh clone verification was previously performed from GitHub:

- `pnpm install --frozen-lockfile`
- `pnpm build`
- `pnpm test`

All passed.

## Key Design Decisions

- Single sign-in screen is intentional. The UI routes users to the correct workspace
  after authentication, while the backend enforces all role checks.
- Workflow logic lives in a shared package so the API and tests use the same rules.
- Returned work uses a distinct `RETURNED` status to support the revision round-trip
  stretch goal and keep reviewer feedback visible before resubmission.
- The production Docker image builds both the API and React frontend, then serves
  both from one Render web service.

## Known Caveats

- Render free-tier services can sleep after inactivity, so the first request may take
  longer while the service wakes up.
- File attachments were intentionally omitted to keep the core workflow, audit trail,
  authorization, and tests solid.
- Web component tests were not added; current test coverage focuses on workflow rules
  and API authorization, which are the highest-risk assessment areas.

## Submission Links

- Repository: https://github.com/ngandusikazwe/civic-services-review
- Live app: https://civic-services-review.onrender.com
- Health check: https://civic-services-review.onrender.com/api/health
