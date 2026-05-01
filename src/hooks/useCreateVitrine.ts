/**
 * useCreateVitrine — cria vitrines via edge function `vitrine-bridge`.
 *
 * Por que mudou:
 *   Antes inseríamos direto na tabela do site usando a anon key.
 *   Quando o profile não estava sincronizado, gravávamos com FKs NULL e a vitrine
 *   ficava "órfã" (não aparecia em Minhas Vitrines, sem corretor na página pública).
 *   Agora a edge function valida tudo server-side com service role e retorna erro
 *   claro quando o profile não existe.
 */

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type CreateVitrineInput = {
  imovel_codigos: string[];
  titulo?: string;
  subtitulo?: string | null;
  mensagem?: string | null;
  lead_id?: string | null;
  lead_nome?: string | null;
  lead_telefone?: string | null;
  pipeline_lead_id?: string | null;
  tipo?: string;
};

export type CreateVitrineResult = {
  id: string;
  publicUrl: string;
  imoveisCount: number;
  missingCodes: string[];
};

export function useCreateVitrine() {
  const { user } = useAuth();

  return useMutation<CreateVitrineResult, Error, CreateVitrineInput>({
    mutationFn: async (input) => {
      if (!user?.id) {
        const err = new Error("Você precisa estar logado");
        toast.error(err.message);
        throw err;
      }

      // Normalize: trim, dedupe, drop empties.
      const codigos = Array.from(
        new Set((input.imovel_codigos ?? []).map((c) => String(c ?? "").trim()).filter(Boolean)),
      );
      if (!codigos.length) {
        const err = new Error("Selecione pelo menos um imóvel");
        toast.error(err.message);
        throw err;
      }

      console.log("[useCreateVitrine] enviando", { count: codigos.length, codigos });

      const { data, error } = await supabase.functions.invoke("vitrine-bridge", {
        body: { action: "create_vitrine", payload: { ...input, imovel_codigos: codigos } },
      });

      if (error || !data?.ok) {
        const msg = data?.error || error?.message || "Falha ao criar vitrine";
        console.error("[useCreateVitrine] bridge error:", { data, error });
        toast.error(msg);
        throw new Error(msg);
      }

      const publicUrl: string = data.public_url;
      const missingCodes: string[] = data.missing_codes ?? [];
      const imoveisCount: number = data.imoveis_count ?? 0;

      try { await navigator.clipboard.writeText(publicUrl); } catch { /* clipboard pode falhar */ }

      if (imoveisCount === 0) {
        toast.error("Vitrine criada, mas nenhum imóvel foi reconhecido. Verifique a seleção.");
      } else if (missingCodes.length) {
        toast.warning(`Vitrine criada com ${imoveisCount} imóve${imoveisCount === 1 ? "l" : "is"}. ${missingCodes.length} não foi(ram) encontrado(s).`);
      } else {
        toast.success("Vitrine criada! Link copiado.");
      }

      return {
        id: data.id,
        publicUrl,
        imoveisCount,
        missingCodes,
      };
    },
  });
}
