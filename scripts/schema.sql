drop table if exists usage_events cascade;
drop table if exists runbooks cascade;
drop table if exists runbook_drafts cascade;
drop table if exists incidents cascade;
drop table if exists workspaces cascade;
drop type if exists incident_source cascade;
drop type if exists incident_severity cascade;
drop type if exists runbook_status cascade;

create type incident_source as enum ('slack', 'grafana', 'sentry', 'generic', 'manual');
create type incident_severity as enum ('low', 'medium', 'high', 'critical');
create type runbook_status as enum ('draft', 'approved', 'rejected');

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  slack_team_id text unique not null,
  slack_team_name text not null,
  bot_token text not null,
  webhook_secret text unique not null default encode(gen_random_bytes(24), 'hex'),
  installer_email text,
  installer_user_id text,
  incident_channel_id text,
  incident_channel_name text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create table incidents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  source incident_source not null,
  severity incident_severity not null default 'medium',
  external_id text,
  channel text,
  title text not null,
  body text not null,
  extracted_json jsonb,
  dedup_key text,
  screenshot_captions text[],
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function incidents_search_vector_fn() returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(new.body, '')), 'B')
    || setweight(to_tsvector('english', coalesce(array_to_string(new.screenshot_captions, ' '), '')), 'C');
  return new;
end
$$ language plpgsql;

create trigger incidents_search_vector_trigger
before insert or update on incidents
for each row execute function incidents_search_vector_fn();

create index incidents_search_idx on incidents using gin(search_vector);
create index incidents_workspace_idx on incidents(workspace_id, created_at desc);
create index incidents_dedup_idx on incidents(workspace_id, dedup_key) where dedup_key is not null;

create table runbook_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  content_md text not null,
  source_incident_ids uuid[] not null,
  status runbook_status not null default 'draft',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table runbooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  content_md text not null,
  source_incident_ids uuid[] not null,
  approved_by text not null,
  approved_at timestamptz not null default now()
);

create table usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  role text not null,
  model text not null,
  tokens_in int not null,
  tokens_out int not null,
  cost_cents numeric(10, 4) not null,
  created_at timestamptz not null default now()
);

create index usage_workspace_idx on usage_events(workspace_id, created_at desc);

/* Grant access to Supabase roles that the sb_secret and sb_publishable keys map to. */
grant usage on schema public to postgres, service_role, authenticated, anon;
grant all privileges on all tables in schema public to postgres, service_role;
grant all privileges on all sequences in schema public to postgres, service_role;
grant all privileges on all functions in schema public to postgres, service_role;

/* Future tables in this schema get the same grants automatically. */
alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant all on sequences to postgres, service_role;
alter default privileges in schema public grant all on functions to postgres, service_role;
