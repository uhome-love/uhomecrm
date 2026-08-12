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
/** O "passo" comercial = a coluna do kanban (fluxo real Uhome: docs antes da proposta). */
export type NegPasso = "documentacao" | "proposta" | "contrato" | "ganho";

/** Deriva o passo a partir da etapa + sub-status REAL do flag_status do lead. */
export function passoDe(fase: NegFase, statusNeg: string, statusContrato: string): NegPasso {
  if (fase === "ganho") return "ganho";
  if (fase === "contrato") return "contrato";
  // em_negociacao: documentação vem antes; aprovação é DENTRO da proposta.
  if (/documentacao/.test(statusNeg)) return "documentacao";
  return "proposta";
}

/** Micro-status legível pro card (mostra onde está dentro do passo — inclui aprovação). */
const DETALHE: Record<string, string> = {
  proposta_solicitada: "proposta solicitada",
  proposta_enviada: "proposta enviada",
  proposta_aprovada: "✓ aprovada",
  documentacao_enviada: "docs enviados",
  aprovacao_bancaria: "aguardando banco",
  aprovacao_proprietario: "aguardando construtora",
  em_confeccao: "gerando contrato",
  gerado: "contrato gerado",
  leitura_contrato: "em leitura",
  em_leitura: "em leitura",
};
export function detalheDe(statusNeg: string, statusContrato: string): string {
  return DETALHE[statusNeg] || DETALHE[statusContrato] || "";
}

export interface NegocioCard {
  id: string;
  pipelineLeadId: string | null;
  cliente: string;
  empreendimento: string;
  corretor: string;
  corretorId: string | null;
  fase: NegFase;
  sub: NegSub | null;
  passo: NegPasso;
  /** micro-status legível (proposta enviada / aguardando banco / em leitura…) */
  detalhe: string;
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
      // ── Lote 1 (independentes, em paralelo): meu perfil + negócios + pós-visita ──
      const [profMeuRes, negRes, posRes] = await Promise.all([
        user?.id
          ? supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null as { id?: string } | null }),
        supabase
          .from("negocios")
          .select("id, pipeline_lead_id, nome_cliente, empreendimento, corretor_id, fase, status, vgv_estimado, vgv_final, negociacao_situacao, documentacao_situacao, proposta_situacao, data_assinatura, requer_aprovacao_ceo, updated_at")
          .in("fase", ["em_negociacao", "contrato", "ganho"])
          .neq("status", "arquivado")
          .limit(500),
        supabase
          .from("pipeline_leads")
          .select("id, nome, empreendimento, temperatura, corretor_id, ultimo_toque_at, updated_at, pipeline_stages!inner(tipo)")
          .eq("pipeline_stages.tipo", "pos_visita")
          .eq("arquivado", false)
          .order("updated_at", { ascending: false })
          .limit(12),
      ]);
      const meuCorretorId = (profMeuRes.data?.id as string | undefined) ?? null;
      const negs = (negRes.data ?? []) as unknown as Record<string, unknown>[];
      const posRaw = (posRes.data ?? []) as unknown as Record<string, unknown>[];

      // ids p/ nomes (negócios + pós-visita) e flags (só negócios)
      const corretorIds = [...new Set([...negs.map((n) => n.corretor_id), ...posRaw.map((l) => l.corretor_id)].filter(Boolean) as string[])];
      const leadIds = [...new Set(negs.map((n) => n.pipeline_lead_id).filter(Boolean) as string[])];

      // ── Lote 2 (dependem do lote 1, em paralelo): nomes de corretores + flags ──
      const [profsRes, flagsRes] = await Promise.all([
        corretorIds.length
          ? supabase.from("profiles").select("id, nome").in("id", corretorIds)
          : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
        leadIds.length
          ? supabase.from("pipeline_leads").select("id, flag_status").in("id", leadIds)
          : Promise.resolve({ data: [] as { id: string; flag_status: Record<string, unknown> | null }[] }),
      ]);
      const nomeDe = new Map<string, string>();
      for (const p of (profsRes.data ?? []) as { id: string; nome: string }[]) nomeDe.set(p.id, p.nome);
      const flagDe = new Map<string, { neg: string; contrato: string }>();
      for (const l of (flagsRes.data ?? []) as { id: string; flag_status: Record<string, unknown> | null }[]) {
        const f = l.flag_status || {};
        flagDe.set(l.id, { neg: String(f.status_negociacao ?? ""), contrato: String(f.status_contrato ?? "") });
      }

      const negocios: NegocioCard[] = negs.map((n) => {
        const fase = String(n.fase) as NegFase;
        const status = String(n.status ?? "");
        const dias = diasDe(n.updated_at as string);
        const vgv = (n.vgv_estimado as number) ?? null;
        const vgvFinal = (n.vgv_final as number) ?? null;
        const flag = (n.pipeline_lead_id && flagDe.get(String(n.pipeline_lead_id))) || { neg: "", contrato: "" };
        return {
          id: String(n.id),
          pipelineLeadId: (n.pipeline_lead_id as string) ?? null,
          cliente: String(n.nome_cliente ?? "Sem nome"),
          empreendimento: String(n.empreendimento ?? "—"),
          corretor: (n.corretor_id && nomeDe.get(String(n.corretor_id))) || "—",
          corretorId: (n.corretor_id as string) ?? null,
          fase,
          sub: fase === "em_negociacao" ? subDe(n as never) : null,
          passo: passoDe(fase, flag.neg, flag.contrato),
          detalhe: detalheDe(flag.neg, flag.contrato),
          vgv: fase === "ganho" ? (vgvFinal ?? vgv) : vgv,
          vgvFinal,
          dias,
          tone: status === "perdido" ? "bad" : toneDe(fase, dias),
          ceo: !!n.requer_aprovacao_ceo,
          dataAssinatura: (n.data_assinatura as string) ?? null,
          meu: !!meuCorretorId && n.corretor_id === meuCorretorId,
        };
      });

      // prontos pra virar negócio: leads em Pós-Visita (posRaw veio no lote 1)
      const prontos: ProntoVirar[] = posRaw.map((l) => {
        const temp = String(l.temperatura ?? "").toLowerCase();
        return {
          id: String(l.id),
          nome: String(l.nome ?? "Lead"),
          empreendimento: String(l.empreendimento ?? "—"),
          corretor: (l.corretor_id && nomeDe.get(String(l.corretor_id))) || "—",
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
