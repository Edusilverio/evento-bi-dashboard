CREATE TABLE IF NOT EXISTS public.sync_execucoes (
  id BIGSERIAL PRIMARY KEY,
  servico TEXT NOT NULL,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  terminado_em TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  linhas JSONB,
  erro TEXT
);

GRANT ALL ON public.sync_execucoes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sync_execucoes_id_seq TO service_role;

ALTER TABLE public.sync_execucoes ENABLE ROW LEVEL SECURITY;