import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { leadSaude, type LeadSaude } from "@/lib/leadSaude";

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
  proposta_negociacao: "em negociação",
  proposta_aprovada: "✓ aprovada",
  documentacao_pendente: "docs pendentes",
  documentacao_analise: "em análise",
  documentacao_enviada: "docs enviados",
  assinado: "✓ assinado",
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
  corretorUserId: string | null;
  corretorAvatar: string | null;
  fase: NegFase;
  sub: NegSub | null;
  passo: NegPasso;
  /** micro-status legível (proposta enviada / aguardando banco / em leitura…) */
  detalhe: string;
  vgv: number | null;
  vgvFinal: number | null;
  dias: number;
  tone: "" | "warn" | "bad";
  /** saúde por toque (mesma do card de leads): verde/ambar/vermelho/estagnado/terminal */
  saude: LeadSaude;
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
  corretorUserId: string | null;
  corretorAvatar: string | null;
  saude: LeadSaude;
  sinal: "quente" | "interesse";
  dias: number;
  meu: boolean;
  /** Lead está na Pós-Visita mas NÃO tem visita realizada registrada na agenda (resíduo legado). */
  semVisita: boolean;
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

// Etapa (tipo) do LEAD → coluna do board. A ETAPA DO LEAD é a fonte única da verdade.
// Ganho vem da tabela negocios (fase=ganho) — número de vendas reais.
const STAGE_TIPO_PASSO: Record<string, NegPasso> = {
  documentacao: "documentacao",  // etapa "Documentação"
  proposta: "proposta",          // etapa "Em Negociação"
  contrato_gerado: "contrato",   // etapa "Contrato"
};
const relTipo = (st: any): string => (Array.isArray(st) ? st[0]?.tipo : st?.tipo) ?? "";

export function useNegociosBoard(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["negocios-board", user?.id],
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<NegociosBoard> => {
      // ── Lote 1: perfil + LEADS comerciais (fonte da verdade) + negócios GANHOS ──
      const [profMeuRes, leadsRes, ganhoRes] = await Promise.all([
        user?.id
          ? supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null as { id?: string } | null }),
        supabase
          .from("pipeline_leads")
          .select("id, nome, empreendimento, temperatura, corretor_id, ultimo_toque_at, distribuido_em, aceito_em, created_at, updated_at, stage_changed_at, negocio_id, flag_status, pipeline_stages!inner(tipo)")
          .in("pipeline_stages.tipo", ["pos_visita", "documentacao", "proposta", "contrato_gerado"])
          .eq("arquivado", false)
          .limit(800),
        supabase
          .from("negocios")
          .select("id, pipeline_lead_id, nome_cliente, empreendimento, corretor_id, vgv_estimado, vgv_final, data_assinatura, requer_aprovacao_ceo, updated_at")
          .eq("fase", "ganho")
          .eq("status", "ativo")
          .limit(500),
      ]);
      const meuCorretorId = (profMeuRes.data?.id as string | undefined) ?? null;
      const leads = (leadsRes.data ?? []) as any[];
      const ganhos = (ganhoRes.data ?? []) as any[];

      const emAndamento = leads.filter((l) => STAGE_TIPO_PASSO[relTipo(l.pipeline_stages)]);
      const negocioIds = [...new Set(emAndamento.map((l) => l.negocio_id).filter(Boolean) as string[])];

      // ── Lote 2: negócios (VGV dos em andamento) + perfis (nomes; tabela pequena) ──
      const [negRes, profsRes] = await Promise.all([
        negocioIds.length
          ? supabase.from("negocios").select("id, vgv_estimado, vgv_final, data_assinatura, requer_aprovacao_ceo, negociacao_situacao, documentacao_situacao, proposta_situacao").in("id", negocioIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("profiles").select("id, user_id, nome, avatar_url, avatar_gamificado_url"),
      ]);
      const negById = new Map<string, any>();
      for (const n of (negRes.data ?? []) as any[]) negById.set(String(n.id), n);
      // ATENÇÃO fonte dupla: LEAD.corretor_id = profiles.user_id; NEGOCIO.corretor_id = profiles.id.
      const nomeByUser = new Map<string, string>();
      const nomeById = new Map<string, string>();
      const avatarByUser = new Map<string, string>();
      const userByProfileId = new Map<string, string>(); // profile.id → user_id (p/ ganho)
      const avatarByProfileId = new Map<string, string>();
      for (const p of (profsRes.data ?? []) as { id: string; user_id: string | null; nome: string; avatar_url: string | null; avatar_gamificado_url: string | null }[]) {
        const av = p.avatar_gamificado_url || p.avatar_url || "";
        nomeById.set(p.id, p.nome);
        if (av) avatarByProfileId.set(p.id, av);
        if (p.user_id) {
          nomeByUser.set(p.user_id, p.nome);
          userByProfileId.set(p.id, p.user_id);
          if (av) avatarByUser.set(p.user_id, av);
        }
      }
      const meuUserId = user?.id ?? null;

      const flagDetalhe = (fs: any): string => {
        const f = fs || {};
        return detalheDe(String(f.status_negociacao ?? ""), String(f.status_contrato ?? ""));
      };

      // Cards EM ANDAMENTO (Proposta, Contrato) — coluna = ETAPA DO LEAD.
      const negocios: NegocioCard[] = emAndamento.map((l) => {
        const passo = STAGE_TIPO_PASSO[relTipo(l.pipeline_stages)];
        const neg = l.negocio_id ? negById.get(String(l.negocio_id)) : null;
        const vgv = neg ? ((neg.vgv_estimado as number) ?? null) : null;
        const dias = diasDe((l.stage_changed_at as string) ?? (l.updated_at as string));
        const fase: NegFase = passo === "contrato" ? "contrato" : "em_negociacao";
        return {
          id: (l.negocio_id as string) ?? String(l.id),
          pipelineLeadId: String(l.id),
          cliente: String(l.nome ?? "Sem nome"),
          empreendimento: String(l.empreendimento ?? "—"),
          corretor: (l.corretor_id && nomeByUser.get(String(l.corretor_id))) || "—",
          corretorId: (l.corretor_id as string) ?? null,
          corretorUserId: (l.corretor_id as string) ?? null,
          corretorAvatar: (l.corretor_id && avatarByUser.get(String(l.corretor_id))) || null,
          fase,
          sub: null,
          passo,
          detalhe: flagDetalhe(l.flag_status),
          vgv,
          vgvFinal: neg ? ((neg.vgv_final as number) ?? null) : null,
          dias,
          tone: toneDe(fase, dias),
          saude: leadSaude({ ultimo_toque_at: l.ultimo_toque_at, distribuido_em: l.distribuido_em, aceito_em: l.aceito_em, created_at: l.created_at, stage_tipo: relTipo(l.pipeline_stages) }),
          ceo: !!neg?.requer_aprovacao_ceo,
          dataAssinatura: neg?.data_assinatura ?? null,
          meu: !!meuUserId && l.corretor_id === meuUserId,
        };
      });

      // Cards de GANHO — fonte: negocios fase=ganho (vendas reais, os 96).
      for (const n of ganhos) {
        const vgvFinal = (n.vgv_final as number) ?? null;
        const vgv = (n.vgv_estimado as number) ?? null;
        negocios.push({
          id: String(n.id),
          pipelineLeadId: (n.pipeline_lead_id as string) ?? null,
          cliente: String(n.nome_cliente ?? "Sem nome"),
          empreendimento: String(n.empreendimento ?? "—"),
          corretor: (n.corretor_id && nomeById.get(String(n.corretor_id))) || "—",
          corretorId: (n.corretor_id as string) ?? null,
          corretorUserId: (n.corretor_id && userByProfileId.get(String(n.corretor_id))) || null,
          corretorAvatar: (n.corretor_id && avatarByProfileId.get(String(n.corretor_id))) || null,
          fase: "ganho",
          sub: null,
          passo: "ganho",
          detalhe: "",
          vgv: vgvFinal ?? vgv,
          vgvFinal,
          dias: diasDe(n.updated_at as string),
          tone: "",
          saude: "terminal", // ganho = venda concluída
          ceo: !!n.requer_aprovacao_ceo,
          dataAssinatura: (n.data_assinatura as string) ?? null,
          meu: !!meuCorretorId && n.corretor_id === meuCorretorId,
        });
      }

      // Pós-Visita: leads na etapa pos_visita (prontos pra virar negócio).
      const posVisitaLeads = leads.filter((l) => relTipo(l.pipeline_stages) === "pos_visita");

      // Quem realmente tem visita REALIZADA registrada na agenda (resto = resíduo legado).
      const comVisita = new Set<string>();
      if (posVisitaLeads.length) {
        const { data: vis } = await supabase
          .from("visitas")
          .select("pipeline_lead_id")
          .eq("status", "realizada")
          .in("pipeline_lead_id", posVisitaLeads.map((l) => String(l.id)));
        for (const v of (vis ?? []) as { pipeline_lead_id: string | null }[]) {
          if (v.pipeline_lead_id) comVisita.add(String(v.pipeline_lead_id));
        }
      }

      const prontos: ProntoVirar[] = posVisitaLeads
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .map((l) => {
          const temp = String(l.temperatura ?? "").toLowerCase();
          return {
            id: String(l.id),
            nome: String(l.nome ?? "Lead"),
            empreendimento: String(l.empreendimento ?? "—"),
            corretor: (l.corretor_id && nomeByUser.get(String(l.corretor_id))) || "—",
            corretorId: (l.corretor_id as string) ?? null,
            corretorUserId: (l.corretor_id as string) ?? null,
            corretorAvatar: (l.corretor_id && avatarByUser.get(String(l.corretor_id))) || null,
            saude: leadSaude({ ultimo_toque_at: l.ultimo_toque_at, distribuido_em: l.distribuido_em, aceito_em: l.aceito_em, created_at: l.created_at, stage_tipo: "pos_visita" }),
            sinal: temp.includes("quente") ? "quente" : "interesse",
            dias: diasDe((l.ultimo_toque_at as string) ?? (l.updated_at as string)),
            meu: !!meuUserId && l.corretor_id === meuUserId,
          };
        });

      return { negocios, prontos };
    },
  });
}
