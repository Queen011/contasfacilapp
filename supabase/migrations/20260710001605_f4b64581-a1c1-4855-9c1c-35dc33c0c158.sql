
CREATE TABLE public.ia_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ia_threads_user_updated_idx ON public.ia_threads (user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_threads TO authenticated;
GRANT ALL ON public.ia_threads TO service_role;
ALTER TABLE public.ia_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads" ON public.ia_threads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.ia_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.ia_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ia_messages_thread_created_idx ON public.ia_messages (thread_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_messages TO authenticated;
GRANT ALL ON public.ia_messages TO service_role;
ALTER TABLE public.ia_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON public.ia_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_ia_thread() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.ia_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ia_messages_touch_thread
AFTER INSERT ON public.ia_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_ia_thread();
