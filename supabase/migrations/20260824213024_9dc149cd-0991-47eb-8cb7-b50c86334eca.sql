create table if not exists public.integracao_tokens (
  servico       text primary key,
  refresh_token text not null,
  atualizado_em timestamptz not null default now()
);

grant all on public.integracao_tokens to service_role;

alter table public.integracao_tokens enable row level security;