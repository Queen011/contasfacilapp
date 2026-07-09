
CREATE TABLE public.perfis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '👤',
  cor TEXT NOT NULL DEFAULT '#10b981',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfis TO authenticated;
GRANT ALL ON public.perfis TO service_role;

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

CREATE POLICY perfis_select_own ON public.perfis FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY perfis_insert_own ON public.perfis FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY perfis_update_own ON public.perfis FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY perfis_delete_own ON public.perfis FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX perfis_user_id_idx ON public.perfis(user_id);

ALTER TABLE public.contas ADD COLUMN perfil_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL;
CREATE INDEX contas_perfil_id_idx ON public.contas(perfil_id);
