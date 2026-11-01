-- ============================================================================
-- Dashboard do evento — base de DEMONSTRAÇÃO (schema cm, dados fictícios)
-- Login, papéis e cadastros do painel. Os números do dashboard vêm da Edge Function
-- dashboard-data em modo demo (DEMO_MODE=true), sem BigQuery.
-- ============================================================================
create schema if not exists cm;
grant usage on schema cm to anon, authenticated, service_role;

do $$ begin
  create type cm.app_role as enum ('admin', 'client', 'financeiro');
exception when duplicate_object then null; end $$;

create table if not exists cm.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  bq_project text default '',
  dataset text default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cm.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login timestamptz,
  client_id uuid references cm.clients(id) on delete set null
);

create table if not exists cm.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role cm.app_role not null default 'client',
  unique (user_id, role)
);

create table if not exists cm.client_whatsapp_numbers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references cm.clients(id) on delete cascade,
  phone_number text not null,
  label text default '',
  created_at timestamptz not null default now()
);

create table if not exists cm.integracao_tokens (
  servico text primary key,
  refresh_token text not null,
  atualizado_em timestamptz not null default now()
);

create table if not exists cm.sync_execucoes (
  id bigserial primary key,
  servico text not null,
  iniciado_em timestamptz not null default now(),
  terminado_em timestamptz,
  status text not null default 'em_andamento',
  linhas jsonb,
  erro text
);

create table if not exists cm.emails_autorizados (
  email text primary key,
  observacao text,
  criado_em timestamptz not null default now()
);

grant select, insert, update, delete on all tables in schema cm to authenticated, service_role;
grant usage, select on all sequences in schema cm to authenticated, service_role;
alter default privileges in schema cm grant select, insert, update, delete on tables to authenticated, service_role;

alter table cm.clients enable row level security;
alter table cm.profiles enable row level security;
alter table cm.user_roles enable row level security;
alter table cm.client_whatsapp_numbers enable row level security;
alter table cm.integracao_tokens enable row level security;
alter table cm.sync_execucoes enable row level security;
alter table cm.emails_autorizados enable row level security;

create or replace function cm.has_role(_user_id uuid, _role cm.app_role)
returns boolean language sql stable security definer set search_path = cm as $$
  select exists (select 1 from cm.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function cm.update_last_login(_user_id uuid)
returns void language sql security definer set search_path = cm as $$
  update cm.profiles set last_login = now() where id = _user_id;
$$;
revoke execute on function cm.has_role(uuid, cm.app_role), cm.update_last_login(uuid) from public, anon;
grant execute on function cm.has_role(uuid, cm.app_role), cm.update_last_login(uuid) to authenticated, service_role;

drop policy if exists "Users can view own profile" on cm.profiles;
drop policy if exists "Users can update own profile" on cm.profiles;
drop policy if exists "Admins can insert profiles" on cm.profiles;
drop policy if exists "Admins can delete profiles" on cm.profiles;
drop policy if exists "Users can view own roles" on cm.user_roles;
drop policy if exists "Admins can manage roles" on cm.user_roles;
drop policy if exists "Admins manage clients" on cm.clients;
drop policy if exists "Admins manage whatsapp numbers" on cm.client_whatsapp_numbers;
create policy "Users can view own profile" on cm.profiles for select to authenticated
  using (id = auth.uid() or cm.has_role(auth.uid(), 'admin'));
create policy "Users can update own profile" on cm.profiles for update to authenticated
  using (id = auth.uid() or cm.has_role(auth.uid(), 'admin'));
create policy "Admins can insert profiles" on cm.profiles for insert to authenticated
  with check (cm.has_role(auth.uid(), 'admin') or id = auth.uid());
create policy "Admins can delete profiles" on cm.profiles for delete to authenticated
  using (cm.has_role(auth.uid(), 'admin'));
create policy "Users can view own roles" on cm.user_roles for select to authenticated
  using (user_id = auth.uid() or cm.has_role(auth.uid(), 'admin'));
create policy "Admins can manage roles" on cm.user_roles for all to authenticated
  using (cm.has_role(auth.uid(), 'admin'));
create policy "Admins manage clients" on cm.clients for all to authenticated
  using (cm.has_role(auth.uid(), 'admin')) with check (cm.has_role(auth.uid(), 'admin'));
create policy "Admins manage whatsapp numbers" on cm.client_whatsapp_numbers for all to authenticated
  using (cm.has_role(auth.uid(), 'admin')) with check (cm.has_role(auth.uid(), 'admin'));

-- Login compartilhado: os gatilhos só agem em contas do app (raw_user_meta_data.app = 'cm')
create or replace function cm.handle_new_user()
returns trigger language plpgsql security definer set search_path = cm as $$
begin
  insert into cm.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  insert into cm.user_roles (user_id, role) values (new.id, 'client') on conflict do nothing;
  return new;
end $$;

create or replace function cm.bloqueia_email_nao_autorizado()
returns trigger language plpgsql security definer set search_path = cm as $$
begin
  if not exists (select 1 from cm.emails_autorizados where email = lower(new.email)) then
    raise exception 'email_nao_autorizado'
      using hint = 'Este e-mail não tem acesso ao painel. Fale com a administração.';
  end if;
  return new;
end $$;
revoke execute on function cm.bloqueia_email_nao_autorizado() from public, anon, authenticated;
revoke execute on function cm.handle_new_user() from public, anon, authenticated;

drop trigger if exists cm_bloqueia_email_nao_autorizado on auth.users;
create trigger cm_bloqueia_email_nao_autorizado before insert on auth.users
  for each row when (new.raw_user_meta_data->>'app' = 'cm') execute function cm.bloqueia_email_nao_autorizado();
drop trigger if exists cm_on_auth_user_created on auth.users;
create trigger cm_on_auth_user_created after insert on auth.users
  for each row when (new.raw_user_meta_data->>'app' = 'cm') execute function cm.handle_new_user();

insert into cm.clients (name, slug, bq_project, dataset)
values ('Coral Moment', 'coral-moment', 'demo', 'demo')
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
