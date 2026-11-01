
CREATE TABLE public.client_whatsapp_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  label text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.client_whatsapp_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select whatsapp numbers" ON public.client_whatsapp_numbers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert whatsapp numbers" ON public.client_whatsapp_numbers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update whatsapp numbers" ON public.client_whatsapp_numbers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete whatsapp numbers" ON public.client_whatsapp_numbers
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
