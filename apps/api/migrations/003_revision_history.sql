alter table applications
  drop constraint if exists applications_status_check;

alter table applications
  add constraint applications_status_check
  check (status in (
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'RETURNED',
    'APPROVED',
    'REJECTED'
  ));

alter table audit_logs
  drop constraint if exists audit_logs_old_status_check;

alter table audit_logs
  add constraint audit_logs_old_status_check
  check (old_status in (
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'RETURNED',
    'APPROVED',
    'REJECTED'
  ));

alter table audit_logs
  drop constraint if exists audit_logs_new_status_check;

alter table audit_logs
  add constraint audit_logs_new_status_check
  check (new_status in (
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'RETURNED',
    'APPROVED',
    'REJECTED'
  ));

create table if not exists application_revisions (
  id bigserial primary key,
  application_id text not null references applications(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  title text not null check (char_length(title) between 3 and 120),
  category text not null check (category in (
    'BUSINESS_PERMIT',
    'BUILDING_PERMIT',
    'COMMUNITY_GRANT',
    'PUBLIC_WORKS',
    'GENERAL_SERVICE'
  )),
  description text not null check (char_length(description) between 10 and 2000),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  submitted_by text not null references users(id),
  submitted_at timestamptz not null default now(),
  unique (application_id, revision_number)
);

create index if not exists idx_application_revisions_application_id
  on application_revisions(application_id);

insert into application_revisions (
  application_id,
  revision_number,
  title,
  category,
  description,
  amount_cents,
  submitted_by,
  submitted_at
)
select
  a.id,
  1,
  a.title,
  a.category,
  a.description,
  a.amount_cents,
  a.owner_id,
  coalesce(
    (
      select min(l.created_at)
      from audit_logs l
      where l.application_id = a.id
        and l.old_status = 'DRAFT'
        and l.new_status = 'SUBMITTED'
    ),
    a.updated_at
  )
from applications a
where a.status in ('SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'REJECTED')
on conflict (application_id, revision_number) do nothing;
