
-- Enums
CREATE TYPE public.conta_status AS ENUM ('pendente', 'paga', 'atrasada', 'quitada');
CREATE TYPE public.conta_tipo AS ENUM ('avulsa', 'recorrente');
CREATE TYPE public.conta_recorrencia AS ENUM ('mensal','bimestral','trimestral','semestral','anual','personalizada');

-- Categorias
CREATE TABLE public.categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  icone text NOT NULL DEFAULT 'Tag',
  cor text NOT NULL DEFAULT '#10b981',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias TO authenticated;
GRANT ALL ON public.categorias TO service_role;

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categorias_select_own" ON public.categorias FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "categorias_insert_own" ON public.categorias FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "categorias_update_own" ON public.categorias FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "categorias_delete_own" ON public.categorias FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Contas
CREATE TABLE public.contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria_id uuid REFERENCES public.categorias(id) ON DELETE SET NULL,
  nome text NOT NULL,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  vencimento date NOT NULL,
  status public.conta_status NOT NULL DEFAULT 'pendente',
  observacoes text,
  tipo public.conta_tipo NOT NULL DEFAULT 'avulsa',
  recorrencia public.conta_recorrencia,
  meses_personalizados int[],
  conta_pai_id uuid REFERENCES public.contas(id) ON DELETE SET NULL,
  pago_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contas_user_status ON public.contas(user_id, status);
CREATE INDEX idx_contas_user_venc ON public.contas(user_id, vencimento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas TO authenticated;
GRANT ALL ON public.contas TO service_role;

ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contas_select_own" ON public.contas FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "contas_insert_own" ON public.contas FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "contas_update_own" ON public.contas FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "contas_delete_own" ON public.contas FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Auto-cria categorias padrão quando um novo usuário se cadastra
CREATE OR REPLACE FUNCTION public.seed_categorias_padrao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categorias (user_id, nome, icone, cor) VALUES
    (NEW.id, 'Luz',       'Lightbulb', '#f59e0b'),
    (NEW.id, 'Internet',  'Wifi',      '#3b82f6'),
    (NEW.id, 'Água',      'Droplet',   '#06b6d4'),
    (NEW.id, 'Gás',       'Flame',     '#f97316'),
    (NEW.id, 'Cartão',    'CreditCard','#8b5cf6'),
    (NEW.id, 'Boleto',    'Receipt',   '#64748b'),
    (NEW.id, 'IPVA',      'Car',       '#10b981'),
    (NEW.id, 'MEI',       'FileText',  '#059669'),
    (NEW.id, 'Aluguel',   'Home',      '#a16207'),
    (NEW.id, 'Streaming', 'Tv',        '#ec4899'),
    (NEW.id, 'Outros',    'Tag',       '#0f766e');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_seed_categorias
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.seed_categorias_padrao();
