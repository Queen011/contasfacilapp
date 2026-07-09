import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Perfil = {
  id: string;
  user_id: string;
  nome: string;
  emoji: string;
  cor: string;
  created_at: string;
};

const ACTIVE_KEY = "contasfacil.perfil_ativo";

export function usePerfis() {
  return useQuery({
    queryKey: ["perfis"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Perfil[];
    },
  });
}

export function useCreatePerfil(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nome: string; emoji?: string; cor?: string }) => {
      if (!userId) throw new Error("sem usuário");
      const { data, error } = await supabase
        .from("perfis")
        .insert({
          user_id: userId,
          nome: input.nome.trim(),
          emoji: input.emoji || "👤",
          cor: input.cor || "#10b981",
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as Perfil;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["perfis"] }),
  });
}

export function useDeletePerfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("perfis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["perfis"] }),
  });
}

export function useUpdatePerfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; nome?: string; emoji?: string; cor?: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("perfis").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["perfis"] }),
  });
}

/**
 * Perfil ativo salvo no localStorage. Todos os perfis vêem os mesmos dados;
 * o perfil ativo só é usado para marcar quem cadastrou a conta.
 */
export function useActivePerfilId(): [string | null, (id: string | null) => void] {
  const [id, setId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACTIVE_KEY);
  });

  useEffect(() => {
    const onStorage = () => setId(localStorage.getItem(ACTIVE_KEY));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const set = useCallback((next: string | null) => {
    if (next) localStorage.setItem(ACTIVE_KEY, next);
    else localStorage.removeItem(ACTIVE_KEY);
    setId(next);
    // Notifica outros hooks no mesmo tab
    window.dispatchEvent(new StorageEvent("storage", { key: ACTIVE_KEY, newValue: next }));
  }, []);

  return [id, set];
}
