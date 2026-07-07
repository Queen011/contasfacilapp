CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_new_user();

-- Cria perfis para usuários já existentes
INSERT INTO public.profiles (id)
SELECT id FROM auth.users
ON CONFLICT DO NOTHING;