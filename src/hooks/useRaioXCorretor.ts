import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { leadSaude } from "@/lib/leadSaude";
import {
  addDias,
  calcJanela,
  calcJanelaAnterior,
  hojeBRT,
  mesDeslocado,
  type Janela,
  type PeriodoOpt,
} from "@/lib/periodoFiltro";

/**
 * useRaioXCorretor — a VIDA COMPLETA de um corretor numa consulta só.
 *
 * Uma tela por corretor: leads (com custo), visitas, negócios, presença/roleta
 * e uso do CRM, no período escolhido, comparado com o período anterior
 * equivalente, mais a evolução do ano corrente mês a mês.
 *
 * Réguas reaproveitadas (fonte única, nada de definição nova aqui):
 *  · saúde/estagnação  → leadSaude (espelho de public.lead_saude_status)
 *  · visitas           → baldes exclusivos por status (cancelada e backfill fora)
 *  · negócio em aberto → ETAPA do pipeline (Documentação/Em Negociação/Contrato)
 *  · venda e VGV       → view v_fato_venda (conta_como_venda + vgv_rateado)
 *  · empreendimento    → empreendimentos_canonicos + empreendimento_aliases
 *  · presença/roleta   → roleta_presencas + roleta_credenciamentos (profiles.id)
 *  · custo do lead     → CPL médio do período (spend ÷ leads do Meta) × recebidos
 *
 * ATENÇÃO aos dois "ids" do corretor: pipeline/negócios/tarefas usam o auth
 * user_id; presença e roleta usam profiles.id. O hook resolve os dois.
 */

const TERMINAIS = new Set(["venda", "caiu", "descarte", "convertido"]);
const A_REALIZAR = new Set(["marcada", "confirmada", "reagendada"]);
const JANELAS_NOTURNAS = new Set(["noturna", "madrugada"]);

export interface CorretorIdentidade {
  user_id: string;
  profile_id: string | null;
  nome: string;
  avatar_url: string | null;
  cargo: string | null;
  gerente_nome: string | null;
  desde: string | null;
}

export interface BlocoLeads {
  recebidos: number;
  descartados: number;
  /** Descartado no período E recebido no período — queimou lead do próprio mês. */
  descartados_do_periodo: number;
  /** Descartado no período mas recebido antes — limpeza de carteira velha. */
  descartados_antigos: number;
  estagnados: number;
  ativos: number;
  cpl_medio: number;
  custo_total: number;
  /**
   * De onde veio o CPL: 'periodo' = investimento sincronizado dentro da janela;
   * 'referencia' = não havia investimento na janela, então usamos a média das
   * campanhas do último mês com dado (fica escrito na tela); 'sem_dado' = não
   * há investimento sincronizado em lugar nenhum.
   */
  cpl_fonte: "periodo" | "referencia" | "sem_dado";
  /** Mês da média de referência, ex.: "jul/26". Só quando fonte = 'referencia'. */
  cpl_referencia_label: string | null;
}

export interface BlocoVisitas {
  criadas: number;
  realizadas: number;
  no_show: number;
  a_realizar: number;
  taxa_comparecimento: number;
  taxa_lead_visita: number;
}

/**
 * Negócio segue a FONTE ÚNICA acertada na Base Única (fase 1, 16/08):
 *  · a etapa do negócio é a ETAPA DO PIPELINE (Documentação → Em Negociação →
 *    Contrato → Ganho), não `negocios.fase`;
 *  · venda é o predicado travado da view `v_fato_venda` (conta_como_venda),
 *    e o VGV é o `vgv_rateado`, que já divide parceria em vez de dobrar.
 * Nada aqui lê `negocios.status` ou soma `vgv_final` na mão.
 */
export interface BlocoNegocios {
  /** Leads que ENTRARAM na zona comercial no período (viraram negócio). */
  criados: number;
  /** Em aberto agora na zona comercial (soma das três etapas abaixo). */
  ativos: number;
  em_documentacao: number;
  em_negociacao: number;
  em_contrato: number;
  vendas: number;
  vgv: number;
  ticket_medio: number;
  taxa_visita_venda: number;
  taxa_lead_venda: number;
  custo_por_venda: number;
  /** Quantas das vendas do período foram em parceria (VGV entra rateado). */
  vendas_em_parceria: number;
}

export interface BlocoPresenca {
  manha: number;
  tarde: number;
  noturna: number;
  total: number;
  faltas: number;
  /** Credenciamentos na roleta, separados por janela. 'dia_todo' conta nas duas
   *  janelas diurnas (é manhã E tarde); 'madrugada' entra na noturna. */
  roleta_manha: number;
  roleta_tarde: number;
  roleta_noturna: number;
  dias_com_presenca: number;
}

export interface BlocoCrm {
  atividades: number;
  leads_tocados: number;
  atividades_por_lead: number;
  lembretes_criados: number;
  lembretes_concluidos: number;
  lembretes_atrasados: number;
  pct_lembretes_cumpridos: number;
  pct_atrasados: number;
  pct_estagnados: number;
  adiamentos: number;
  leads_sem_atividade: number;
}

export interface LinhaEmpreendimento {
  nome: string;
  visitas: number;
  realizadas: number;
  no_show: number;
  comparecimento: number;
  vendas: number;
  vgv: number;
  /**
   * false = o texto da visita/negócio não bate com nenhum empreendimento
   * canônico nem com apelido cadastrado. Essa linha é o balde "Não
   * identificado" e NUNCA entra no cálculo de melhor conversão.
   */
  resolvido: boolean;
}

export interface LinhaOrigem {
  origem: string;
  vendas: number;
  vgv: number;
}

export interface MesEvolucao {
  mes: string;
  label: string;
  leads: number;
  visitas_realizadas: number;
  vendas: number;
  vgv: number;
}

export interface Fatia {
  leads: BlocoLeads;
  visitas: BlocoVisitas;
  negocios: BlocoNegocios;
  presenca: BlocoPresenca;
  crm: BlocoCrm;
}

export interface RaioXCorretorFull extends Fatia {
  corretor: CorretorIdentidade;
  janela: Janela;
  janelaAnterior: Janela;
  anterior: Fatia;
  empreendimentos: LinhaEmpreendimento[];
  origensVenda: LinhaOrigem[];
  evolucao: MesEvolucao[];
  cobertura_custo: number;
}

// ── util ─────────────────────────────────────────────────────────────────────

async function fetchAll<T>(builder: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await builder(from, from + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) break;
    from += size;
  }
  return out;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const dentro = (d: string | null | undefined, j: Janela) => !!d && d >= j.start && d < j.end;
/** Timestamps vêm como ISO completo; a comparação de data usa só os 10 primeiros chars. */
const dia = (ts: string | null | undefined) => (ts ? ts.slice(0, 10) : null);

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function labelMes(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES_CURTOS[m - 1]}/${String(y).slice(2)}`;
}

// ── linhas cruas que o hook carrega uma vez e fatia por janela ───────────────

interface LeadRow { id: string; distribuido_em: string | null; origem: string | null }
/** Linha de venda oficial (view v_fato_venda) — já rateada por parceria. */
interface VendaRow {
  negocio_id: string;
  data_assinatura: string | null;
  empreendimento: string | null;
  empreendimento_canonico_id: string | null;
  pipeline_lead_id: string | null;
  vgv_rateado: number | null;
  em_parceria: boolean | null;
}
interface VisitaRow {
  data_visita: string | null; status: string | null; origem: string | null;
  empreendimento: string | null; empreendimento_canonico_id: string | null;
}

/** Espelho de public.norm_empreendimento: minúsculas, sem acento, sem espaço nas bordas. */
function normEmp(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Origem crua do lead vira rótulo de gente ("meta_ads" → "Meta Ads"). */
const ROTULO_ORIGEM: Record<string, string> = {
  meta_ads: "Meta Ads",
  meta_backfill: "Meta Ads (importado)",
  facebook: "Facebook",
  fb: "Facebook",
  instagram: "Instagram",
  ig: "Instagram",
  imovelweb: "ImovelWeb",
  zap: "Zap Imóveis",
  vivareal: "Viva Real",
  indicacao: "Indicação",
  site: "Site",
  jetimob: "Jetimob",
  whatsapp: "WhatsApp",
  "oferta ativa": "Oferta Ativa",
  "nao informado": "Não informada",
};
function rotuloOrigem(bruta: string | null | undefined): string {
  const raw = (bruta ?? "").trim();
  if (!raw) return "Não informada";
  const k = normEmp(raw);
  if (ROTULO_ORIGEM[k]) return ROTULO_ORIGEM[k];
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
interface PresencaRow { data: string; turno: string; status: string }
interface CredRow { data: string; janela: string; status: string | null }
interface AtividadeRow { created_at: string | null; pipeline_lead_id: string | null }
interface TarefaRow {
  created_at: string | null; concluida_em: string | null; vence_em: string | null;
  status: string | null; adiamentos_count: number | null;
}
interface SpendRow { date_start: string; spend: number | null; leads: number | null }

interface Cru {
  leads: LeadRow[];
  visitas: VisitaRow[];
  vendas: VendaRow[];
  /** dia do descarte → ids dos leads descartados naquele dia (dedup por lead). */
  descartesPorDia: Map<string, string[]>;
  /** dia da entrada na zona comercial → quantos leads entraram (dedup por lead). */
  zonaPorDia: Map<string, number>;
  presencas: PresencaRow[];
  credenciamentos: CredRow[];
  atividades: AtividadeRow[];
  tarefas: TarefaRow[];
  spend: SpendRow[];
  /** snapshot atual (não depende de janela) */
  ativos: number;
  estagnados: number;
  emDocumentacao: number;
  emNegociacao: number;
  emContrato: number;
  leadsSemAtividade: number;
}

// ── recorte de uma janela ────────────────────────────────────────────────────

function fatiar(cru: Cru, j: Janela, snapshot: boolean): Fatia {
  const recebidosIds = new Set(
    cru.leads.filter((l) => dentro(l.distribuido_em?.slice(0, 10), j)).map((l) => l.id),
  );
  const recebidos = recebidosIds.size;

  // Descarte separado por origem do lead: queimar lead do próprio mês é uma
  // coisa, limpar carteira velha é outra bem diferente.
  let descartados_do_periodo = 0;
  let descartados_antigos = 0;
  cru.descartesPorDia.forEach((ids, d) => {
    if (!dentro(d, j)) return;
    for (const id of ids) {
      if (recebidosIds.has(id)) descartados_do_periodo++;
      else descartados_antigos++;
    }
  });
  const descartados = descartados_do_periodo + descartados_antigos;

  // Custo: CPL médio do período (gasto do Meta ÷ leads do Meta) × leads recebidos.
  let spendTotal = 0;
  let leadsMeta = 0;
  for (const s of cru.spend) {
    if (!dentro(s.date_start, j)) continue;
    spendTotal += Number(s.spend ?? 0);
    leadsMeta += Number(s.leads ?? 0);
  }
  const cpl_medio = leadsMeta > 0 ? spendTotal / leadsMeta : 0;

  const leads: BlocoLeads = {
    recebidos,
    descartados,
    descartados_do_periodo,
    descartados_antigos,
    estagnados: snapshot ? cru.estagnados : 0,
    ativos: snapshot ? cru.ativos : 0,
    cpl_medio,
    custo_total: cpl_medio * recebidos,
    cpl_fonte: cpl_medio > 0 ? "periodo" : "sem_dado",
    cpl_referencia_label: null,
  };

  // Visitas — baldes mutuamente exclusivos, cancelada e backfill fora.
  let realizadas = 0, no_show = 0, a_realizar = 0;
  for (const v of cru.visitas) {
    if (!dentro(v.data_visita, j)) continue;
    if ((v.origem ?? "").startsWith("backfill_")) continue;
    const st = (v.status ?? "").toLowerCase();
    if (!st || st === "cancelada") continue;
    if (st === "realizada") realizadas++;
    else if (st === "no_show") no_show++;
    else if (A_REALIZAR.has(st)) a_realizar++;
  }
  const criadas = realizadas + no_show + a_realizar;
  const visitas: BlocoVisitas = {
    criadas, realizadas, no_show, a_realizar,
    taxa_comparecimento: pct(realizadas, realizadas + no_show),
    taxa_lead_visita: pct(criadas, recebidos),
  };

  // Negócios — etapa do pipeline (aberto) + v_fato_venda (fechado).
  let criados = 0;
  cru.zonaPorDia.forEach((n, d) => { if (dentro(d, j)) criados += n; });

  let vendas = 0, vgv = 0, vendas_em_parceria = 0;
  for (const v of cru.vendas) {
    if (!dentro(v.data_assinatura, j)) continue;
    vendas++;
    vgv += Number(v.vgv_rateado ?? 0);
    if (v.em_parceria) vendas_em_parceria++;
  }
  const negocios: BlocoNegocios = {
    criados,
    ativos: snapshot ? cru.emDocumentacao + cru.emNegociacao + cru.emContrato : 0,
    em_documentacao: snapshot ? cru.emDocumentacao : 0,
    em_negociacao: snapshot ? cru.emNegociacao : 0,
    em_contrato: snapshot ? cru.emContrato : 0,
    vendas,
    vgv,
    ticket_medio: vendas > 0 ? vgv / vendas : 0,
    taxa_visita_venda: pct(vendas, realizadas),
    taxa_lead_venda: pct(vendas, recebidos),
    custo_por_venda: vendas > 0 ? (cpl_medio * recebidos) / vendas : 0,
    vendas_em_parceria,
  };

  // Presença e roleta
  const presenca: BlocoPresenca = {
    manha: 0, tarde: 0, noturna: 0, total: 0, faltas: 0,
    roleta_manha: 0, roleta_tarde: 0, roleta_noturna: 0, dias_com_presenca: 0,
  };
  const diasPresentes = new Set<string>();
  for (const p of cru.presencas) {
    if (!dentro(p.data, j)) continue;
    if (p.status === "falta") { presenca.faltas++; continue; }
    if (p.turno === "manha") presenca.manha++;
    else if (p.turno === "tarde") presenca.tarde++;
    else if (p.turno === "noturna") presenca.noturna++;
    presenca.total++;
    diasPresentes.add(p.data);
  }
  presenca.dias_com_presenca = diasPresentes.size;
  for (const c of cru.credenciamentos) {
    if (!dentro(c.data, j)) continue;
    if ((c.status ?? "") === "cancelado") continue;
    if (JANELAS_NOTURNAS.has(c.janela)) { presenca.roleta_noturna++; continue; }
    if (c.janela === "dia_todo") { presenca.roleta_manha++; presenca.roleta_tarde++; continue; }
    if (c.janela === "tarde") presenca.roleta_tarde++;
    else presenca.roleta_manha++;
  }

  // Uso do CRM
  const tocados = new Set<string>();
  let atividades = 0;
  for (const a of cru.atividades) {
    if (!dentro(dia(a.created_at), j)) continue;
    atividades++;
    if (a.pipeline_lead_id) tocados.add(a.pipeline_lead_id);
  }
  let lembretes_criados = 0, lembretes_concluidos = 0, adiamentos = 0;
  for (const t of cru.tarefas) {
    if (dentro(dia(t.created_at), j)) {
      lembretes_criados++;
      adiamentos += Number(t.adiamentos_count ?? 0);
    }
    if (t.status === "concluida" && dentro(dia(t.concluida_em), j)) lembretes_concluidos++;
  }
  const hoje = hojeBRT();
  const lembretes_atrasados = snapshot
    ? cru.tarefas.filter((t) => t.status === "pendente" && !!t.vence_em && dia(t.vence_em)! < hoje).length
    : 0;
  const pendentes = snapshot
    ? cru.tarefas.filter((t) => t.status === "pendente").length
    : 0;

  const crm: BlocoCrm = {
    atividades,
    leads_tocados: tocados.size,
    atividades_por_lead: tocados.size > 0 ? Math.round((atividades / tocados.size) * 10) / 10 : 0,
    lembretes_criados,
    lembretes_concluidos,
    lembretes_atrasados,
    pct_lembretes_cumpridos: pct(lembretes_concluidos, lembretes_criados),
    pct_atrasados: pct(lembretes_atrasados, pendentes),
    pct_estagnados: snapshot ? pct(cru.estagnados, cru.ativos) : 0,
    adiamentos,
    leads_sem_atividade: snapshot ? cru.leadsSemAtividade : 0,
  };

  return { leads, visitas, negocios, presenca, crm };
}

// ── hook ─────────────────────────────────────────────────────────────────────

export function useRaioXCorretor(
  userId: string | null | undefined,
  opt: PeriodoOpt,
  custom?: { inicio: string; fim: string },
) {
  const janela = calcJanela(opt, custom);
  const janelaAnterior = calcJanelaAnterior(opt, janela);

  return useQuery({
    queryKey: ["raio-x-corretor", userId, janela.start, janela.end],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<RaioXCorretorFull> => {
      const uid = userId as string;
      const hoje = hojeBRT();

      // Janela de carga: cobre o período, o período anterior e os 12 meses da
      // evolução — uma leitura só, recortada depois em memória.
      // Cobre o período, o anterior e o ano corrente inteiro (a evolução é anual).
      const evoStart = [mesDeslocado(hoje, -11), `${hoje.slice(0, 4)}-01-01`].sort()[0];
      const de = [janela.start, janelaAnterior.start, evoStart].sort()[0];
      const ate = [janela.end, addDias(hoje, 1)].sort().slice(-1)[0];

      // 1) Identidade.
      //    ATENÇÃO: creci, email e telefone têm grant de coluna negado para
      //    'authenticated' (proteção de dado pessoal). Pedir qualquer um deles
      //    derruba a consulta INTEIRA com "permission denied for table profiles",
      //    e o relatório fica sem nome. Não reintroduzir esses campos aqui.
      const { data: perfil, error: erroPerfil } = await supabase
        .from("profiles")
        .select("id, user_id, nome, avatar_url, cargo, created_at")
        .eq("user_id", uid)
        .maybeSingle();
      if (erroPerfil) throw erroPerfil;
      const profileId = (perfil as any)?.id ?? null;

      const { data: tm } = await supabase
        .from("team_members")
        .select("gerente_id")
        .eq("user_id", uid)
        .eq("status", "ativo")
        .maybeSingle();
      let gerenteNome: string | null = null;
      if ((tm as any)?.gerente_id) {
        const { data: g } = await supabase
          .from("profiles").select("nome").eq("user_id", (tm as any).gerente_id).maybeSingle();
        gerenteNome = (g as any)?.nome ?? null;
      }

      const corretor: CorretorIdentidade = {
        user_id: uid,
        profile_id: profileId,
        nome: (perfil as any)?.nome ?? "Corretor",
        avatar_url: (perfil as any)?.avatar_url ?? null,
        cargo: (perfil as any)?.cargo ?? null,
        gerente_nome: gerenteNome,
        desde: dia((perfil as any)?.created_at),
      };

      // 2) Etapas primeiro (define os baldes do histórico).
      const { data: stagesRows } = await supabase.from("pipeline_stages").select("id, tipo");
      const tipoDeStage = new Map<string, string>();
      (stagesRows ?? []).forEach((s: any) => tipoDeStage.set(s.id, s.tipo));
      const B_DESCARTE = new Set(["descarte"]);
      const B_ZONA = new Set(["documentacao", "proposta", "contrato_gerado"]);
      const bucketIds = (stagesRows ?? [])
        .filter((s: any) => B_DESCARTE.has(s.tipo) || B_ZONA.has(s.tipo))
        .map((s: any) => s.id);

      // PERFORMANCE: TODAS as buscas em PARALELO (antes eram ~10 em fila → lentidão).
      const [ativosRows, leadsRows, hist, visitas, vendas, atividades, tarefas, spend, presencas, credenciamentos] = await Promise.all([
        fetchAll<any>((f, t) => supabase.from("pipeline_leads")
          .select("id, ultimo_toque_at, distribuido_em, aceito_em, created_at, estagnacao_carencia_ate, pipeline_stages!inner(tipo)")
          .eq("corretor_id", uid).eq("arquivado", false).range(f, t)),
        fetchAll<LeadRow>((f, t) => supabase.from("pipeline_leads")
          .select("id, distribuido_em, origem")
          .eq("corretor_id", uid).gte("distribuido_em", de).lt("distribuido_em", ate).range(f, t)),
        bucketIds.length > 0
          ? fetchAll<any>((f, t) => supabase.from("pipeline_historico")
              .select("pipeline_lead_id, stage_novo_id, created_at, pipeline_leads!inner(corretor_id)")
              .eq("pipeline_leads.corretor_id", uid).in("stage_novo_id", bucketIds)
              .gte("created_at", de).lt("created_at", ate).range(f, t))
          : Promise.resolve([] as any[]),
        fetchAll<VisitaRow>((f, t) => supabase.from("visitas")
          .select("data_visita, status, origem, empreendimento, empreendimento_canonico_id")
          .eq("corretor_id", uid).gte("data_visita", de).lt("data_visita", ate).range(f, t)),
        fetchAll<VendaRow>((f, t) => supabase.from("v_fato_venda")
          .select("negocio_id, data_assinatura, empreendimento, empreendimento_canonico_id, pipeline_lead_id, vgv_rateado, em_parceria")
          .eq("corretor_auth_id", uid).eq("conta_como_venda", true)
          .gte("data_assinatura", de).lt("data_assinatura", ate).range(f, t)),
        fetchAll<AtividadeRow>((f, t) => supabase.from("pipeline_atividades")
          .select("created_at, pipeline_lead_id")
          .eq("created_by", uid).gte("created_at", de).lt("created_at", ate).range(f, t)),
        fetchAll<TarefaRow>((f, t) => supabase.from("pipeline_tarefas")
          .select("created_at, concluida_em, vence_em, status, adiamentos_count")
          .eq("responsavel_id", uid).gte("created_at", de).range(f, t)),
        fetchAll<SpendRow>((f, t) => supabase.from("marketing_entries_ad")
          .select("date_start, spend, leads")
          .gte("date_start", de).lt("date_start", ate).range(f, t)),
        profileId
          ? fetchAll<PresencaRow>((f, t) => supabase.from("roleta_presencas")
              .select("data, turno, status").eq("corretor_id", profileId).gte("data", de).lt("data", ate).range(f, t))
          : Promise.resolve([] as PresencaRow[]),
        profileId
          ? fetchAll<CredRow>((f, t) => supabase.from("roleta_credenciamentos")
              .select("data, janela, status").eq("corretor_id", profileId).gte("data", de).lt("data", ate).range(f, t))
          : Promise.resolve([] as CredRow[]),
      ]);

      // Snapshot pela etapa (fonte única): pipeline ativo · estagnados · negócio aberto por etapa.
      let ativos = 0, estagnados = 0, emDocumentacao = 0, emNegociacao = 0, emContrato = 0;
      const idsAtivos: string[] = [];
      for (const l of ativosRows) {
        const tipo = l.pipeline_stages?.tipo ?? "";
        if (TERMINAIS.has(tipo)) continue;
        if (tipo === "documentacao") { emDocumentacao++; continue; }
        if (tipo === "proposta") { emNegociacao++; continue; }
        if (tipo === "contrato_gerado") { emContrato++; continue; }
        ativos++;
        idsAtivos.push(l.id);
        const s = leadSaude({
          ultimo_toque_at: l.ultimo_toque_at, distribuido_em: l.distribuido_em,
          aceito_em: l.aceito_em, created_at: l.created_at, stage_tipo: tipo,
          estagnacao_carencia_ate: l.estagnacao_carencia_ate,
        });
        if (s === "estagnado") estagnados++;
      }

      // Movimento de etapa no período (descarte · entrada na zona comercial), dedup por lead.
      const descartesPorDia = new Map<string, string[]>();
      const zonaPorDia = new Map<string, number>();
      {
        const vDesc = new Set<string>(), vZona = new Set<string>();
        for (const h of hist) {
          const tipo = tipoDeStage.get(h.stage_novo_id) ?? "";
          const d = dia(h.created_at);
          if (!d) continue;
          if (B_DESCARTE.has(tipo) && !vDesc.has(h.pipeline_lead_id)) {
            vDesc.add(h.pipeline_lead_id);
            const lista = descartesPorDia.get(d) ?? [];
            lista.push(h.pipeline_lead_id);
            descartesPorDia.set(d, lista);
          }
          if (B_ZONA.has(tipo) && !vZona.has(h.pipeline_lead_id)) {
            vZona.add(h.pipeline_lead_id);
            zonaPorDia.set(d, (zonaPorDia.get(d) ?? 0) + 1);
          }
        }
      }

      // Leads ativos que nunca receberam atividade registrada.
      const tocadosGeral = new Set(atividades.map((a) => a.pipeline_lead_id).filter(Boolean) as string[]);
      const leadsSemAtividade = idsAtivos.filter((id) => !tocadosGeral.has(id)).length;

      const cru: Cru = {
        leads: leadsRows, visitas, vendas, descartesPorDia, zonaPorDia,
        presencas, credenciamentos, atividades, tarefas, spend,
        ativos, estagnados, emDocumentacao, emNegociacao, emContrato, leadsSemAtividade,
      };

      const atual = fatiar(cru, janela, true);
      const anterior = fatiar(cru, janelaAnterior, false);

      // CPL de referência: quando a janela não tem investimento sincronizado
      // (o sync do Meta pode estar atrasado), usamos a média das campanhas do
      // ÚLTIMO mês que tem dado, deixando escrito de qual mês veio.
      if (atual.leads.cpl_fonte === "sem_dado" || anterior.leads.cpl_fonte === "sem_dado") {
        const { data: ultimo } = await supabase
          .from("marketing_entries_ad")
          .select("date_start")
          .gt("leads", 0)
          .order("date_start", { ascending: false })
          .limit(1)
          .maybeSingle();
        const d = (ultimo as any)?.date_start as string | undefined;
        if (d) {
          const ini = `${d.slice(0, 8)}01`;
          const fim = mesDeslocado(ini, 1);
          const rows = await fetchAll<SpendRow>((f, t) =>
            supabase.from("marketing_entries_ad")
              .select("date_start, spend, leads")
              .gte("date_start", ini).lt("date_start", fim).range(f, t));
          let s = 0, l = 0;
          for (const r of rows) { s += Number(r.spend ?? 0); l += Number(r.leads ?? 0); }
          if (l > 0) {
            const ref = s / l;
            const rotulo = labelMes(ini);
            for (const f of [atual, anterior]) {
              if (f.leads.cpl_fonte !== "sem_dado") continue;
              f.leads.cpl_medio = ref;
              f.leads.custo_total = ref * f.leads.recebidos;
              f.leads.cpl_fonte = "referencia";
              f.leads.cpl_referencia_label = rotulo;
              f.negocios.custo_por_venda = f.negocios.vendas > 0
                ? f.leads.custo_total / f.negocios.vendas : 0;
            }
          }
        }
      }

      // Conversão por empreendimento (visitas + vendas na mesma linha).
      // Vendas dentro da janela — base da tabela por empreendimento e da origem.
      const vendidos = vendas.filter((v) => dentro(v.data_assinatura, janela));

      // EMPREENDIMENTO É SEMPRE O CANÔNICO.
      // O campo livre de visitas/negócios guarda de tudo: nome de campanha
      // ("Casa Tua - Junho 2026", "Shift - Qualificado v7"), nome do produto e
      // lixo. Campanha NÃO é empreendimento, então o texto livre só vira linha
      // depois de resolver para um canônico, nesta ordem:
      //   1) empreendimento_canonico_id gravado na linha;
      //   2) empreendimento_aliases (a própria tabela do CRM que liga campanha,
      //      formulário e texto solto ao empreendimento certo);
      //   3) igualdade com o nome canônico já normalizado.
      // O que não resolve vai para um balde único "Não identificado", nunca com
      // o nome da campanha no lugar do empreendimento.
      const nomeCanonico = new Map<string, string>();
      const canonPorNome = new Map<string, string>();
      const aliasParaId = new Map<string, string>();
      const [{ data: canon }, { data: aliases }] = await Promise.all([
        supabase.from("empreendimentos_canonicos").select("id, nome"),
        supabase.from("empreendimento_aliases").select("alias_norm, empreendimento_id"),
      ]);
      (canon ?? []).forEach((c: any) => {
        nomeCanonico.set(c.id, c.nome);
        canonPorNome.set(normEmp(c.nome), c.id);
      });
      (aliases ?? []).forEach((a: any) => aliasParaId.set(a.alias_norm, a.empreendimento_id));

      const NAO_IDENTIFICADO = "Não identificado";
      const resolverEmp = (canonId: string | null, livre: string | null): { nome: string; resolvido: boolean } => {
        if (canonId && nomeCanonico.has(canonId)) return { nome: nomeCanonico.get(canonId)!, resolvido: true };
        const txt = (livre ?? "").trim();
        if (txt) {
          const n = normEmp(txt);
          const viaAlias = aliasParaId.get(n);
          if (viaAlias && nomeCanonico.has(viaAlias)) return { nome: nomeCanonico.get(viaAlias)!, resolvido: true };
          const viaNome = canonPorNome.get(n);
          if (viaNome) return { nome: nomeCanonico.get(viaNome)!, resolvido: true };
        }
        return { nome: NAO_IDENTIFICADO, resolvido: false };
      };

      const emp = new Map<string, LinhaEmpreendimento>();
      const linha = (r: { nome: string; resolvido: boolean }) => {
        if (!emp.has(r.nome)) {
          emp.set(r.nome, {
            nome: r.nome, visitas: 0, realizadas: 0, no_show: 0,
            comparecimento: 0, vendas: 0, vgv: 0, resolvido: r.resolvido,
          });
        }
        return emp.get(r.nome)!;
      };
      for (const v of visitas) {
        if (!dentro(v.data_visita, janela)) continue;
        if ((v.origem ?? "").startsWith("backfill_")) continue;
        const st = (v.status ?? "").toLowerCase();
        if (!st || st === "cancelada") continue;
        const l = linha(resolverEmp(v.empreendimento_canonico_id, v.empreendimento));
        l.visitas++;
        if (st === "realizada") l.realizadas++;
        else if (st === "no_show") l.no_show++;
      }
      for (const n of vendidos) {
        const l = linha(resolverEmp(n.empreendimento_canonico_id, n.empreendimento));
        l.vendas++;
        l.vgv += Number(n.vgv_rateado ?? 0);
      }
      const empreendimentos = [...emp.values()]
        .map((l) => ({ ...l, comparecimento: pct(l.realizadas, l.realizadas + l.no_show) }))
        // "Não identificado" sempre por último, nunca disputando o topo.
        .sort((a, b) =>
          Number(b.resolvido) - Number(a.resolvido) ||
          b.vendas - a.vendas || b.realizadas - a.realizadas || b.visitas - a.visitas);

      // Origem das vendas: a origem de verdade está no LEAD que virou o negócio
      // (meta_ads, indicação, ImovelWeb…). `negocios.origem` guarda só COMO o
      // negócio nasceu no CRM ("pipeline_convertido"), que não serve aqui.
      const leadIdsVenda = [...new Set(vendidos.map((n) => n.pipeline_lead_id).filter(Boolean) as string[])];
      const origemDoLead = new Map<string, string>();
      if (leadIdsVenda.length > 0) {
        const { data: leadsVenda } = await supabase
          .from("pipeline_leads").select("id, origem").in("id", leadIdsVenda);
        (leadsVenda ?? []).forEach((l: any) => origemDoLead.set(l.id, l.origem));
      }
      const org = new Map<string, LinhaOrigem>();
      for (const n of vendidos) {
        const bruta = (n.pipeline_lead_id && origemDoLead.get(n.pipeline_lead_id)) || null;
        const k = rotuloOrigem(bruta);
        if (!org.has(k)) org.set(k, { origem: k, vendas: 0, vgv: 0 });
        const o = org.get(k)!;
        o.vendas++;
        o.vgv += Number(n.vgv_rateado ?? 0);
      }
      const origensVenda = [...org.values()].sort((a, b) => b.vendas - a.vendas || b.vgv - a.vgv);

      // Evolução do ANO CORRENTE, mês a mês (janeiro até o mês de hoje).
      // Meses futuros ficam de fora: barra vazia não informa nada.
      const evolucao: MesEvolucao[] = [];
      const anoAtual = hoje.slice(0, 4);
      const mesAtual = Number(hoje.slice(5, 7));
      for (let m = 1; m <= mesAtual; m++) {
        const ini = `${anoAtual}-${String(m).padStart(2, "0")}-01`;
        const jm: Janela = { start: ini, end: mesDeslocado(ini, 1) };
        const vendasMes = vendas.filter((v) => dentro(v.data_assinatura, jm));
        evolucao.push({
          mes: ini.slice(0, 7),
          label: labelMes(ini),
          leads: leadsRows.filter((l) => dentro(l.distribuido_em?.slice(0, 10), jm)).length,
          visitas_realizadas: visitas.filter(
            (v) => dentro(v.data_visita, jm) && (v.status ?? "").toLowerCase() === "realizada"
              && !(v.origem ?? "").startsWith("backfill_")).length,
          vendas: vendasMes.length,
          vgv: vendasMes.reduce((s, v) => s + Number(v.vgv_rateado ?? 0), 0),
        });
      }

      const cobertura_custo = atual.leads.cpl_fonte === "periodo" ? 100 : 0;

      return {
        corretor,
        janela,
        janelaAnterior,
        anterior,
        empreendimentos,
        origensVenda,
        evolucao,
        cobertura_custo,
        ...atual,
      };
    },
  });
}

/** Lista de corretores que o usuário logado enxerga (RLS decide o escopo). */
export function useCorretoresDoEscopo() {
  return useQuery({
    queryKey: ["raio-x-corretores-escopo"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ user_id: string; nome: string; avatar_url: string | null }[]> => {
      const { data: tm } = await supabase
        .from("team_members").select("user_id").eq("status", "ativo");
      const ids = [...new Set((tm ?? []).map((r: any) => r.user_id).filter(Boolean))];
      if (ids.length === 0) return [];
      const { data: perfis } = await supabase
        .from("profiles").select("user_id, nome, avatar_url").in("user_id", ids).eq("ativo", true);
      return (perfis ?? [])
        .map((p: any) => ({ user_id: p.user_id, nome: p.nome ?? "Corretor", avatar_url: p.avatar_url ?? null }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });
}
