import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * useNegociosBoard — PREVIEW (read-only) do novo Workspace de Negócios.
 * Lê os dados REAIS de `negocios` + `pipeline_leads` (pós-visita) sem escrever
 * nada. Serve pra ver o desenho na prática antes de construir de verdade.
 * Fonte única: o negócio é a extensão do lead; aqui só lemos e agrupamos.
 */

export type NegFase = "em_negociacao" | "contrato" | "ganho";
export type NegSub = "proposta" | "documentacao" | "aprovacao_credito" | "reserva";

export interface NegocioCard {
  id: string;
  cliente: string;
  empreendimento: string;
  corretor: string;
  corretorId: string | null;
  fase: NegFase;
  sub: NegSub | null;
  vgv: number | null;
  vgvFinal: number | null;
  dias: number;
  tone: "" | "warn" | "bad";
  ceo: boolean;
  dataAssinatura: string | null;
  meu: boolean;
}

export interface ProntoVirar {
  id: string;
  nome: string;
  empreendimento: string;
  corretor: string;
  corretorId: string | null;
  sinal: "quente" | "interesse";
  dias: number;
  meu: boolean;
}

export interface NegociosBoard {
  negocios: NegocioCard[];
  prontos: ProntoVirar[];
}

const MS_DAY = 86_400_000;
function diasDe(iso?: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / MS_DAY));
}

function subDe(n: { negociacao_situacao?: string | null; documentacao_situacao?: string | null; proposta_situacao?: string | null }): NegSub {
  const doc = (n.documentacao_situacao || "").toLowerCase();
  const neg = (n.negociacao_situacao || "").toLowerCase();
  if (doc.includes("credit") || neg.includes("credit") || neg.includes("aprova")) return "aprovacao_credito";
  if (neg.includes("reserv")) return "reserva";
  if (doc && !doc.includes("pend")) return "documentacao";
  return "proposta";
}

function toneDe(fase: NegFase, dias: number): "" | "warn" | "bad" {
  if (fase === "ganho") return "";
  if (dias >= 14) return "bad";
  if (dias >= 7) return "warn";
  return "";
}

export function useNegociosBoard() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["negocios-board", user?.id],
    staleTime: 30_000,
    queryFn: async (): Promise<NegociosBoard> => {
      // perfil do usuário atual → corretor_id "meu"
      let meuCorretorId: string | null = null;
      if (user?.id) {
        const { data: prof } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
        meuCorretorId = (prof?.id as string | undefined) ?? null;
      }

      // negócios ativos nas fases de negócio
      const { data: negRaw } = await supabase
        .from("negocios")
        .select("id, nome_cliente, empreendimento, corretor_id, fase, status, vgv_estimado, vgv_final, negociacao_situacao, documentacao_situacao, proposta_situacao, data_assinatura, requer_aprovacao_ceo, updated_at")
        .in("fase", ["em_negociacao", "contrato", "ganho"])
        .neq("status", "arquivado")
        .limit(500);
      const negs = (negRaw ?? []) as unknown as Record<string, unknown>[];

      // nomes dos corretores
      const corretorIds = [...new Set(negs.map((n) => n.corretor_id).filter(Boolean) as string[])];
      const nomeDe = new Map<string, string>();
      if (corretorIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", corretorIds);
        for (const p of (profs ?? []) as { id: string; nome: string }[]) nomeDe.set(p.id, p.nome);
      }

      const negocios: NegocioCard[] = negs.map((n) => {
        const fase = String(n.fase) as NegFase;
        const status = String(n.status ?? "");
        const dias = diasDe(n.updated_at as string);
        const vgv = (n.vgv_estimado as number) ?? null;
        const vgvFinal = (n.vgv_final as number) ?? null;
        return {
          id: String(n.id),
          cliente: String(n.nome_cliente ?? "Sem nome"),
          empreendimento: String(n.empreendimento ?? "—"),
          corretor: (n.corretor_id && nomeDe.get(String(n.corretor_id))) || "—",
          corretorId: (n.corretor_id as string) ?? null,
          fase,
          sub: fase === "em_negociacao" ? subDe(n as never) : null,
          vgv: fase === "ganho" ? (vgvFinal ?? vgv) : vgv,
          vgvFinal,
          dias,
          tone: status === "perdido" ? "bad" : toneDe(fase, dias),
          ceo: !!n.requer_aprovacao_ceo,
          dataAssinatura: (n.data_assinatura as string) ?? null,
          meu: !!meuCorretorId && n.corretor_id === meuCorretorId,
        };
      });

      // prontos pra virar negócio: leads em Pós-Visita
      const { data: posRaw } = await supabase
        .from("pipeline_leads")
        .select("id, nome, empreendimento, temperatura, corretor_id, ultimo_toque_at, updated_at, pipeline_stages!inner(tipo)")
        .eq("pipeline_stages.tipo", "pos_visita")
        .eq("arquivado", false)
        .order("updated_at", { ascending: false })
        .limit(12);
      const prontos: ProntoVirar[] = ((posRaw ?? []) as unknown as Record<string, unknown>[]).map((l) => {
        const temp = String(l.temperatura ?? "").toLowerCase();
        return {
          id: String(l.id),
          nome: String(l.nome ?? "Lead"),
          empreendimento: String(l.empreendimento ?? "—"),
          corretor: "—",
          corretorId: (l.corretor_id as string) ?? null,
          sinal: temp.includes("quente") ? "quente" : "interesse",
          dias: diasDe((l.ultimo_toque_at as string) ?? (l.updated_at as string)),
          meu: !!meuCorretorId && l.corretor_id === meuCorretorId,
        };
      });

      return { negocios, prontos };
    },
  });
}
