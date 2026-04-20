/**
 * useCreateVitrine — hook único para criar vitrines.
 *
 * Centraliza a criação no Supabase do SITE (supabaseSite), garantindo
 * que o registro vive no mesmo banco que o link público (uhome.com.br/vitrine/:id)
 * consulta. Antes desta refatoração, vitrines eram criadas no banco do CRM
 * e o link nunca encontrava o registro — bug arquitetural central.
 *
 * Schema real da tabela vitrines no site (14 colunas):
 *   id, created_at, corretor_id, corretor_slug, lead_nome, lead_telefone,
 *   titulo, mensagem, imovel_codigos, visualizacoes,
 *   created_by, subtitulo, lead_id, cliques_whatsapp
 */

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabaseSite } from "@/lib/supabaseSite";
import { useAuth } from "@/hooks/useAuth";
import { getVitrinePublicUrl } from "@/lib/vitrineUrl";

export type CreateVitrineInput = {
  imovel_codigos: string[];
  titulo?: string;
  subtitulo?: string | null;
  mensagem?: string | null;
  lead_id?: string | null;
  lead_nome?: string | null;
  lead_telefone?: string | null;
  corretor_slug?: string | null;
};

export type CreateVitrineResult = {
  id: string;
  publicUrl: string;
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

      // Resolve o profile do corretor no banco do SITE.
      // Semântica dos dois campos (intencionalmente diferentes):
      //   - corretor_id  → FK para profiles.id NO SITE (identidade no domínio do site)
      //   - created_by   → auth.users.id DO CRM (auditoria de origem; é o que MinhasVitrines filtra)
      const { data: siteProfile, error: profileErr } = await supabaseSite
        .from("profiles")
        .select("id, slug_ref")
        .eq("uhomesales_id", user.id)
        .maybeSingle();

      if (profileErr || !siteProfile?.id) {
        console.error("[useCreateVitrine] profile lookup error:", profileErr, "user.id=", user.id);
        toast.error("Seu perfil ainda não está sincronizado com o site. Avise o admin.");
        throw new Error(profileErr?.message || "Profile do corretor não encontrado no site");
      }

      const payload = {
        created_by: user.id,             // CRM auth id (auditoria + filtro do MinhasVitrines)
        corretor_id: siteProfile.id,     // profiles.id do site (FK)
        imovel_codigos: input.imovel_codigos,
        titulo: input.titulo ?? "Seleção de imóveis",
        subtitulo: input.subtitulo ?? null,
        mensagem: input.mensagem ?? null,
        lead_id: input.lead_id ?? null,
        lead_nome: input.lead_nome ?? null,
        lead_telefone: input.lead_telefone ?? null,
        corretor_slug: input.corretor_slug ?? siteProfile.slug_ref ?? null,
      };

      const { data, error } = await supabaseSite
        .from("vitrines")
        .insert(payload)
        .select("id")
        .single();

      if (error || !data?.id) {
        console.error("[useCreateVitrine] insert error:", error);
        toast.error("Erro ao criar vitrine");
        throw new Error(error?.message || "Falha ao criar vitrine");
      }

      const publicUrl = getVitrinePublicUrl(data.id);

      try {
        await navigator.clipboard.writeText(publicUrl);
      } catch {
        // clipboard pode falhar (permissão/contexto inseguro) — não bloqueia
      }

      toast.success("Vitrine criada! Link copiado.");

      return { id: data.id, publicUrl };
    },
  });
}
