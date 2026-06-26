import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Categoria = {
  id: string;
  nome: string;
  icone: string;
  cor: string;
};

export type Conta = {
  id: string;
  user_id: string;
  categoria_id: string | null;
  nome: string;
  valor: number;
  vencimento: string;
  status: "pendente" | "paga" | "atrasada" | "quitada";
  observacoes: string | null;
  tipo: "avulsa" | "recorrente";
  recorrencia: "mensal" | "bimestral" | "trimestral" | "semestral" | "anual" | "personalizada" | null;
  meses_personalizados: number[] | null;
  conta_pai_id: string | null;
  pago_em: string | null;
  created_at: string;
  categoria?: Categoria | null;
};

export function useCategorias() {
  return useQuery({
    queryKey: ["categorias"],
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Categoria[];
    },
  });
}

export function useContas() {
  return useQuery({
    queryKey: ["contas"],
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      // Atualiza atrasadas antes de buscar
      const today = new Date().toISOString().slice(0, 10);
      await supabase
        .from("contas")
        .update({ status: "atrasada" })
        .lt("vencimento", today)
        .eq("status", "pendente");

      const { data, error } = await supabase
        .from("contas")
        .select("*, categoria:categorias(*)")
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return data as Conta[];
    },
  });
}
