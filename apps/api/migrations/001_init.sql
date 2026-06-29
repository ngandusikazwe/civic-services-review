create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('APPLICANT', 'REVIEWER')),
  created_at timestamptz not null default now()
);

create table if not exists applications (
  id text primary key,
  owner_id text not null references users(id),
  title text not null check (char_length(title) between 3 and 120),
  category text not null check (category in ('BUSINESS_PERMIT', 'BUILDING_PERMIT', 'COMMUNITY_GRANT', 'PUBLIC_WORKS', 'GENERAL_SERVICE')),
  description text not null check (char_length(description) between 10 and 2000),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  status text not null check (status in ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  application_id text not null references applications(id) on delete cascade,
  actor_id text not null references users(id),
  old_status text not null check (old_status in ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'REJECTED')),
  new_status text not null check (new_status in ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'REJECTED')),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists application_revisions (
  id bigserial primary key,
  application_id text not null references applications(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  title text not null check (char_length(title) between 3 and 120),
  category text not null check (category in ('BUSINESS_PERMIT', 'BUILDING_PERMIT', 'COMMUNITY_GRANT', 'PUBLIC_WORKS', 'GENERAL_SERVICE')),
  description text not null check (char_length(description) between 10 and 2000),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  submitted_by text not null references users(id),
  submitted_at timestamptz not null default now(),
  unique (application_id, revision_number)
);

create index if not exists idx_applications_owner_id on applications(owner_id);
create index if not exists idx_applications_status on applications(status);
create index if not exists idx_audit_logs_application_id on audit_logs(application_id);
create index if not exists idx_application_revisions_application_id on application_revisions(application_id);
