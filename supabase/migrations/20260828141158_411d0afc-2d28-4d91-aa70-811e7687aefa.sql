CREATE TABLE IF NOT EXISTS public.emails_autorizados (
  email TEXT PRIMARY KEY,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.emails_autorizados ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.emails_autorizados TO service_role;

INSERT INTO public.emails_autorizados (email, observacao)
SELECT lower(email), 'conta pré-existente em 28/08/2026'
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bloqueia_email_nao_autorizado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.emails_autorizados
    WHERE email = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'email_nao_autorizado'
      USING HINT = 'Este e-mail não tem acesso ao painel. Fale com a administração.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bloqueia_email_nao_autorizado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bloqueia_email_nao_autorizado ON auth.users;
CREATE TRIGGER trg_bloqueia_email_nao_autorizado
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bloqueia_email_nao_autorizado();