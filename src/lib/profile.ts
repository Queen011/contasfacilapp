import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  nome: string | null;
};

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      // Auto-cria se não existir (usuário antigo)
      if (!data) {
        const { data: created } = await supabase
          .from("profiles")
          .insert({ id: userId })
          .select("id, nome")
          .single();
        return (created ?? { id: userId, nome: null }) as Profile;
      }
      return data as Profile;
    },
  });
}

export function useUpdateNome(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      if (!userId) throw new Error("sem usuário");
      const nomeTrim = nome.trim() || null;
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, nome: nomeTrim, updated_at: new Date().toISOString() });
      if (error) throw error;
      return nomeTrim;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });
}
