import "../load-env.js";
import { createPool } from "./pool.js";
import { hashPassword } from "../http/auth.js";

const applicantId = "user-applicant-1";
const secondApplicantId = "user-applicant-2";
const reviewerId = "user-reviewer-1";

async function main() {
  const pool = createPool();
  const passwordHash = hashPassword("password123");

  await pool.query(
    `insert into users (id, name, email, password_hash, role)
     values
       ($1, 'Amina Banda', 'alice@example.com', $4, 'APPLICANT'),
       ($2, 'Noah Phiri', 'ben@example.com', $4, 'APPLICANT'),
       ($3, 'Chanda Mwila', 'reviewer@example.com', $4, 'REVIEWER')
     on conflict (id) do update
       set name = excluded.name,
           email = excluded.email,
           password_hash = excluded.password_hash,
           role = excluded.role`,
    [applicantId, secondApplicantId, reviewerId, passwordHash]
  );

  await pool.query(
    `insert into applications (id, owner_id, title, category, description, amount_cents, status)
     values
       ('app-draft-1', $1, 'Market stall trading permit', 'BUSINESS_PERMIT', 'Requesting a trading permit for a vegetable stall at the civic market.', 25000, 'DRAFT'),
       ('app-submitted-1', $1, 'Drainage repair near Kamwala clinic', 'PUBLIC_WORKS', 'Storm water is collecting near the clinic entrance and blocking pedestrian access during heavy rain.', 450000, 'SUBMITTED'),
       ('app-review-1', $2, 'Youth skills training grant', 'COMMUNITY_GRANT', 'Community group application for funding to run a six-week youth tailoring and digital skills programme.', 1250000, 'UNDER_REVIEW'),
       ('app-returned-1', $1, 'Outdoor kiosk renovation permit', 'BUILDING_PERMIT', 'Request to renovate a small outdoor kiosk at the civic market. The first submission is missing the site sketch requested by planning.', 375000, 'RETURNED')
     on conflict (id) do update
       set title = excluded.title,
           category = excluded.category,
           description = excluded.description,
           amount_cents = excluded.amount_cents`,
    [applicantId, secondApplicantId]
  );

  await pool.query(
    `insert into audit_logs (application_id, actor_id, old_status, new_status, comment)
     select 'app-submitted-1', $1, 'DRAFT', 'SUBMITTED', null
     where not exists (
       select 1 from audit_logs
       where application_id = 'app-submitted-1'
         and old_status = 'DRAFT'
         and new_status = 'SUBMITTED'
     )`,
    [applicantId]
  );

  await pool.query(
    `insert into audit_logs (application_id, actor_id, old_status, new_status, comment)
     select 'app-review-1', $1, 'DRAFT', 'SUBMITTED', null
     where not exists (
       select 1 from audit_logs
       where application_id = 'app-review-1'
         and old_status = 'DRAFT'
         and new_status = 'SUBMITTED'
     )`,
    [secondApplicantId]
  );

  await pool.query(
    `insert into audit_logs (application_id, actor_id, old_status, new_status, comment)
     select 'app-review-1', $1, 'SUBMITTED', 'UNDER_REVIEW', null
     where not exists (
       select 1 from audit_logs
       where application_id = 'app-review-1'
         and old_status = 'SUBMITTED'
         and new_status = 'UNDER_REVIEW'
     )`,
    [reviewerId]
  );

  await pool.query(
    `insert into audit_logs (application_id, actor_id, old_status, new_status, comment)
     select 'app-returned-1', $1, 'DRAFT', 'SUBMITTED', null
     where not exists (
       select 1 from audit_logs
       where application_id = 'app-returned-1'
         and old_status = 'DRAFT'
         and new_status = 'SUBMITTED'
     )`,
    [applicantId]
  );

  await pool.query(
    `insert into audit_logs (application_id, actor_id, old_status, new_status, comment)
     select 'app-returned-1', $1, 'SUBMITTED', 'UNDER_REVIEW', null
     where not exists (
       select 1 from audit_logs
       where application_id = 'app-returned-1'
         and old_status = 'SUBMITTED'
         and new_status = 'UNDER_REVIEW'
     )`,
    [reviewerId]
  );

  await pool.query(
    `insert into audit_logs (application_id, actor_id, old_status, new_status, comment)
     select 'app-returned-1', $1, 'UNDER_REVIEW', 'RETURNED', 'Please attach a simple site sketch and confirm the kiosk boundary measurements.'
     where not exists (
       select 1 from audit_logs
       where application_id = 'app-returned-1'
         and old_status = 'UNDER_REVIEW'
         and new_status = 'RETURNED'
     )`,
    [reviewerId]
  );

  await pool.query(
    `insert into application_revisions (
       application_id,
       revision_number,
       title,
       category,
       description,
       amount_cents,
       submitted_by
     )
     select id, 1, title, category, description, amount_cents, owner_id
     from applications
     where id in ('app-submitted-1', 'app-review-1', 'app-returned-1')
     on conflict (application_id, revision_number) do nothing`
  );

  console.log("Seeded civic service users and request examples.");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
