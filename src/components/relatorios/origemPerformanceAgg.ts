/**
 * Agregações do Relatório de Performance por Origem. Puro cálculo em memória
 * sobre as linhas devolvidas pela função read-only get_relatorio_origem_performance.
 * Nada aqui grava no banco.
 */
import {
  classificarQualidade,
  semRegistroContato,
  taxaQualificacao,
  type QualidadeGrupo,
} from "@/lib/leadQualidade";

export type OrigemPrimeiroContato = "whatsapp" | "atividade" | "mudanca_etapa" | null;

export interface LeadRow {
  lead_id: string;
  nome: string | null;
  created_at: string;
  origem: string | null;
  campanha: string | null;
  conjunto_anuncio: string | null;
  anuncio: string | null;
  plataforma: string | null;
  empreendimento: string | null;
  corretor_id: string | null;
  corretor_nome: string | null;
  stage_nome: string | null;
  stage_ordem: number | null;
  motivo_descarte: string | null;
  tipo_descarte: string | null;
  primeiro_contato_em: string | null;
  primeiro_contato_em_v1: string | null;
  origem_primeiro_contato: OrigemPrimeiroContato;
  tempo_ate_primeiro_contato_min: number | null;
  tem_visita_realizada: boolean;
  tem_venda: boolean;
  vgv: number | null;
  /** v3: teve_contato canônico (stage>=1 OR whatsapp OR atividade). Vem do RPC. */
  teve_contato_v3: boolean | null;
  num_tentativas: number;
  cadencia_total_passos: number;
  entrou_na_cadencia: boolean;
  contato_estabelecido: boolean;
  chegou_ao_fim_cadencia: boolean;
  saiu_da_cadencia_com_contato: boolean;
  abandonado_na_cadencia: boolean;
  tempo_em_sem_contato_dias: number | null;
}


export interface LeadRowX extends LeadRow {
  grupo: QualidadeGrupo;
  semRegistro: boolean;
}

export interface Resumo {
  chave: string;
  leads: number;
  qualificados: number;
  desqualificados: number;
  pendentes: number;
  neutros: number;
  semRegistro: number;
  taxaQualif: number | null;
  visitas: number;
  taxaVisita: number;
  vendas: number;
  vgv: number;
  tempoMedioMin: number | null;
  tempoMedianaMin: number | null;
  origWhatsapp: number;
  origAtividade: number;
  origMudancaEtapa: number;
  origSemRegistro: number;
}

export interface ResumoCriativo extends Resumo {
  dataPrimeiroLead: string | null;
  dataUltimoLead: string | null;
  semanas: SemanaCriativo[];
}

export interface SemanaCriativo {
  semana: string;
  leads: number;
  taxaQualif: number | null;
  taxaVisita: number;
}

export interface PersistResumo {
  chave: string;
  leadsNaCadencia: number;
  mediaTentativas: number | null;
  pctMenosDe3: number | null;
  pctCadenciaCompleta: number | null;
  pctSucessoPos: number | null;
  pctAbandonado: number | null;
  visitaContatoPrimeira: { total: number; visita: number; taxa: number | null };
  visitaFaixa12: { total: number; visita: number; taxa: number | null };
  visitaFaixa34: { total: number; visita: number; taxa: number | null };
  visitaFaixa57: { total: number; visita: number; taxa: number | null };
  visitaNuncaTrabalhado: { total: number; visita: number; taxa: number | null };
}

export interface DescarteMotivoRow {
  motivo: string;
  total: number;
  mediaTentativas: number | null;
  pctMenosDe3: number | null;
}

export interface DescarteConjuntoRow {
  conjunto: string;
  motivo: string;
  qtd: number;
  mediaTentativas: number | null;
}

export interface AuditoriaDiff {
  total: number;
  ambosNulos: number;
  soV2TemDado: number;
  soV1TemDado: number;
  iguais: number;
  v2AntesDeV1: number;
  medianaV1Min: number | null;
  medianaV2Min: number | null;
}

export function enrich(rows: LeadRow[]): LeadRowX[] {
  return rows.map((r) => {
    // v3 canônico: RPC já entrega teve_contato_v3. Fallback p/ v2 se RPC antigo.
    const teveContato =
      typeof r.teve_contato_v3 === "boolean"
        ? r.teve_contato_v3
        : !!r.primeiro_contato_em;
    const qualiInput = { ...r, teve_contato: teveContato };
    return {
      ...r,
      grupo: classificarQualidade(qualiInput),
      semRegistro: semRegistroContato(qualiInput),
    };
  });
}


function mediana(vals: number[]): number | null {
  if (vals.length === 0) return null;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const safeDiv = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const avg = (vals: number[]): number | null =>
  vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

export function computeResumo(chave: string, rows: LeadRowX[]): Resumo {
  const leads = rows.length;
  const qualificados = rows.filter((r) => r.grupo === "qualificado").length;
  const desqualificados = rows.filter((r) => r.grupo === "desqualificado").length;
  const pendentes = rows.filter((r) => r.grupo === "pendente").length;
  const neutros = rows.filter((r) => r.grupo === "neutro").length;
  const semRegistro = rows.filter((r) => r.semRegistro).length;
  const visitas = rows.filter((r) => r.tem_visita_realizada).length;
  const vendas = rows.filter((r) => r.tem_venda).length;
  const vgv = rows.reduce((a, r) => a + (r.vgv ?? 0), 0);
  const tempos = rows
    .filter((r) => !r.semRegistro && r.tempo_ate_primeiro_contato_min != null)
    .map((r) => r.tempo_ate_primeiro_contato_min as number);
  const tempoMedioMin = tempos.length
    ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
    : null;
  return {
    chave,
    leads, qualificados, desqualificados, pendentes, neutros, semRegistro,
    taxaQualif: taxaQualificacao(qualificados, desqualificados),
    visitas, taxaVisita: leads ? visitas / leads : 0,
    vendas, vgv, tempoMedioMin, tempoMedianaMin: mediana(tempos),
    origWhatsapp: rows.filter((r) => r.origem_primeiro_contato === "whatsapp").length,
    origAtividade: rows.filter((r) => r.origem_primeiro_contato === "atividade").length,
    origMudancaEtapa: rows.filter((r) => r.origem_primeiro_contato === "mudanca_etapa").length,
    origSemRegistro: rows.filter((r) => r.origem_primeiro_contato == null).length,
  };
}

function labelOf(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s.length ? s : "(sem origem)";
}

export function groupResumo(rows: LeadRowX[], keyFn: (r: LeadRowX) => string): Resumo[] {
  const map = new Map<string, LeadRowX[]>();
  for (const r of rows) {
    const k = keyFn(r);
    (map.get(k) ?? map.set(k, []).get(k)!).push(r);
  }
  return [...map.entries()]
    .map(([k, rs]) => computeResumo(k, rs))
    .sort((a, b) => b.leads - a.leads);
}

function semanaKey(iso: string): string {
  const d = new Date(iso);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function groupCriativos(rows: LeadRowX[]): ResumoCriativo[] {
  const map = new Map<string, LeadRowX[]>();
  for (const r of rows) {
    const k = labelOf(r.anuncio);
    (map.get(k) ?? map.set(k, []).get(k)!).push(r);
  }
  return [...map.entries()]
    .map(([k, rs]) => {
      const base = computeResumo(k, rs);
      const datas = rs.map((r) => r.created_at).sort();
      const wmap = new Map<string, LeadRowX[]>();
      for (const r of rs) {
        const wk = semanaKey(r.created_at);
        (wmap.get(wk) ?? wmap.set(wk, []).get(wk)!).push(r);
      }
      const semanas: SemanaCriativo[] = [...wmap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([wk, wr]) => {
          const w = computeResumo(wk, wr);
          return { semana: wk, leads: w.leads, taxaQualif: w.taxaQualif, taxaVisita: w.taxaVisita };
        });
      return {
        ...base,
        dataPrimeiroLead: datas[0] ?? null,
        dataUltimoLead: datas[datas.length - 1] ?? null,
        semanas,
      };
    })
    .sort((a, b) => b.leads - a.leads);
}

// —————————————————————————— Persistência da cadência
function faixaVisita(rows: LeadRowX[]) {
  const total = rows.length;
  const visita = rows.filter((r) => r.tem_visita_realizada).length;
  return { total, visita, taxa: safeDiv(visita, total) };
}

export function computePersistencia(chave: string, rows: LeadRowX[]): PersistResumo {
  const naCadencia = rows.filter((r) => r.entrou_na_cadencia);
  const total = naCadencia.length;
  const tentativas = naCadencia.map((r) => r.num_tentativas);
  const menor3 = naCadencia.filter((r) => r.num_tentativas < 3).length;
  const completa = naCadencia.filter((r) => r.chegou_ao_fim_cadencia).length;
  const sucesso = naCadencia.filter((r) => r.saiu_da_cadencia_com_contato).length;
  const abandonado = naCadencia.filter((r) => r.abandonado_na_cadencia).length;
  return {
    chave,
    leadsNaCadencia: total,
    mediaTentativas: avg(tentativas),
    pctMenosDe3: safeDiv(menor3, total),
    pctCadenciaCompleta: safeDiv(completa, total),
    pctSucessoPos: safeDiv(sucesso, total),
    pctAbandonado: safeDiv(abandonado, total),
    visitaContatoPrimeira: faixaVisita(rows.filter((r) => r.contato_estabelecido && !r.entrou_na_cadencia)),
    visitaFaixa12: faixaVisita(naCadencia.filter((r) => r.num_tentativas >= 1 && r.num_tentativas <= 2)),
    visitaFaixa34: faixaVisita(naCadencia.filter((r) => r.num_tentativas >= 3 && r.num_tentativas <= 4)),
    visitaFaixa57: faixaVisita(naCadencia.filter((r) => r.num_tentativas >= 5)),
    visitaNuncaTrabalhado: faixaVisita(rows.filter((r) => !r.contato_estabelecido && !r.entrou_na_cadencia)),
  };
}

export function groupPersistencia(rows: LeadRowX[], keyFn: (r: LeadRowX) => string): PersistResumo[] {
  const map = new Map<string, LeadRowX[]>();
  for (const r of rows) {
    const k = keyFn(r);
    (map.get(k) ?? map.set(k, []).get(k)!).push(r);
  }
  return [...map.entries()]
    .map(([k, rs]) => computePersistencia(k, rs))
    .sort((a, b) => b.leadsNaCadencia - a.leadsNaCadencia);
}

// —————————————————————————— Descarte × Tentativas
function labelMotivo(m: string | null): string {
  const s = (m ?? "").trim();
  return s.length ? s : "(sem motivo)";
}

export function descartePorMotivo(rows: LeadRowX[]): DescarteMotivoRow[] {
  const descartados = rows.filter((r) => (r.motivo_descarte ?? "").trim().length > 0);
  const map = new Map<string, LeadRowX[]>();
  for (const r of descartados) {
    const k = labelMotivo(r.motivo_descarte);
    (map.get(k) ?? map.set(k, []).get(k)!).push(r);
  }
  return [...map.entries()]
    .map(([motivo, rs]) => ({
      motivo,
      total: rs.length,
      mediaTentativas: avg(rs.map((r) => r.num_tentativas)),
      pctMenosDe3: safeDiv(rs.filter((r) => r.num_tentativas < 3).length, rs.length),
    }))
    .sort((a, b) => b.total - a.total);
}

export function descartePorConjunto(rows: LeadRowX[]): DescarteConjuntoRow[] {
  const descartados = rows.filter((r) => (r.motivo_descarte ?? "").trim().length > 0);
  const map = new Map<string, LeadRowX[]>();
  for (const r of descartados) {
    const k = `${labelOf(r.conjunto_anuncio)}\u0000${labelMotivo(r.motivo_descarte)}`;
    (map.get(k) ?? map.set(k, []).get(k)!).push(r);
  }
  return [...map.entries()]
    .map(([k, rs]) => {
      const [conjunto, motivo] = k.split("\u0000");
      return {
        conjunto, motivo, qtd: rs.length,
        mediaTentativas: avg(rs.map((r) => r.num_tentativas)),
      };
    })
    .sort((a, b) => b.qtd - a.qtd);
}

// —————————————————————————— Auditoria diff v1 vs v2
export function computeAuditoria(rows: LeadRowX[]): AuditoriaDiff {
  const tempoMin = (created: string, contato: string | null): number | null => {
    if (!contato) return null;
    const diff = (new Date(contato).getTime() - new Date(created).getTime()) / 60000;
    return diff >= 0 ? Math.round(diff) : 0;
  };
  let ambosNulos = 0, soV2 = 0, soV1 = 0, iguais = 0, v2Antes = 0;
  const temposV1: number[] = [];
  const temposV2: number[] = [];
  for (const r of rows) {
    const v1 = r.primeiro_contato_em_v1;
    const v2 = r.primeiro_contato_em;
    if (v1 == null && v2 == null) ambosNulos++;
    else if (v1 == null && v2 != null) soV2++;
    else if (v1 != null && v2 == null) soV1++;
    else if (v1 === v2) iguais++;
    else if (v1 && v2 && new Date(v2).getTime() < new Date(v1).getTime()) v2Antes++;
    else iguais++;
    const t1 = tempoMin(r.created_at, v1);
    const t2 = tempoMin(r.created_at, v2);
    if (t1 != null) temposV1.push(t1);
    if (t2 != null) temposV2.push(t2);
  }
  return {
    total: rows.length, ambosNulos, soV2TemDado: soV2, soV1TemDado: soV1,
    iguais, v2AntesDeV1: v2Antes,
    medianaV1Min: mediana(temposV1), medianaV2Min: mediana(temposV2),
  };
}

// —————————————————————————— CSV
function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const pct = (v: number | null) => (v == null ? "" : (v * 100).toFixed(1).replace(".", ",") + "%");
const num1 = (v: number | null) => (v == null ? "" : v.toFixed(1).replace(".", ","));

const RESUMO_HEAD = [
  "Chave", "Leads", "Qualificados", "Desqualificados", "Pendentes", "Neutros",
  "Sem registro", "Taxa qualif.", "Visitas", "Taxa visita", "Vendas", "VGV",
  "Tempo médio (min)", "Tempo mediana (min)",
  "1º contato: WhatsApp", "1º contato: Atividade", "1º contato: Mudança etapa", "1º contato: Sem registro",
];
function resumoLinha(r: Resumo): string {
  return [
    r.chave, r.leads, r.qualificados, r.desqualificados, r.pendentes, r.neutros,
    r.semRegistro, pct(r.taxaQualif), r.visitas, pct(r.taxaVisita), r.vendas,
    r.vgv, r.tempoMedioMin ?? "", r.tempoMedianaMin ?? "",
    r.origWhatsapp, r.origAtividade, r.origMudancaEtapa, r.origSemRegistro,
  ].map(esc).join(",");
}

const PERSIST_HEAD = [
  "Chave", "Leads na cadência", "Média tentativas", "% <3 tent.", "% cadência completa",
  "% sucesso pós-cadência", "% abandonado",
  "Visita contato-de-primeira (total|visita|taxa)",
  "Visita 1-2 tent. (total|visita|taxa)",
  "Visita 3-4 tent. (total|visita|taxa)",
  "Visita 5-7 tent. (total|visita|taxa)",
  "Visita nunca trabalhado (total|visita|taxa)",
];
function persistLinha(p: PersistResumo): string {
  const fx = (f: { total: number; visita: number; taxa: number | null }) =>
    `${f.total}|${f.visita}|${pct(f.taxa)}`;
  return [
    p.chave, p.leadsNaCadencia, num1(p.mediaTentativas), pct(p.pctMenosDe3),
    pct(p.pctCadenciaCompleta), pct(p.pctSucessoPos), pct(p.pctAbandonado),
    fx(p.visitaContatoPrimeira), fx(p.visitaFaixa12), fx(p.visitaFaixa34),
    fx(p.visitaFaixa57), fx(p.visitaNuncaTrabalhado),
  ].map(esc).join(",");
}

export function buildCsv(params: {
  detalhado: LeadRowX[];
  porCampanha: Resumo[];
  porConjunto: Resumo[];
  porPlataforma: Resumo[];
  porCorretor: Resumo[];
  criativos: ResumoCriativo[];
  semOrigemPlataforma: Resumo[];
  semOrigemEmpreendimento: Resumo[];
  persistPorCorretor: PersistResumo[];
  persistPorConjunto: PersistResumo[];
  descarteMotivo: DescarteMotivoRow[];
  descarteConjunto: DescarteConjuntoRow[];
}): string {
  const L: string[] = [];
  const sec = (t: string) => { L.push(""); L.push(`# ${t}`); };
  const resumoBloco = (rows: Resumo[]) => {
    L.push(RESUMO_HEAD.map(esc).join(","));
    rows.forEach((r) => L.push(resumoLinha(r)));
  };
  const persistBloco = (rows: PersistResumo[]) => {
    L.push(PERSIST_HEAD.map(esc).join(","));
    rows.forEach((r) => L.push(persistLinha(r)));
  };

  sec("RESUMO POR CAMPANHA"); resumoBloco(params.porCampanha);
  sec("RESUMO POR CONJUNTO"); resumoBloco(params.porConjunto);
  sec("RESUMO POR PLATAFORMA"); resumoBloco(params.porPlataforma);
  sec("RESUMO POR CORRETOR"); resumoBloco(params.porCorretor);

  sec("RESUMO POR CRIATIVO");
  L.push([...RESUMO_HEAD, "1º lead", "Último lead"].map(esc).join(","));
  params.criativos.forEach((c) =>
    L.push([resumoLinha(c), esc(c.dataPrimeiroLead ?? ""), esc(c.dataUltimoLead ?? "")].join(",")),
  );

  sec("CRIATIVO x SEMANA");
  L.push(["Criativo", "Semana", "Leads", "Taxa qualif.", "Taxa visita"].map(esc).join(","));
  params.criativos.forEach((c) =>
    c.semanas.forEach((w) =>
      L.push([c.chave, w.semana, w.leads, pct(w.taxaQualif), pct(w.taxaVisita)].map(esc).join(",")),
    ),
  );

  sec("SEM ORIGEM — POR PLATAFORMA"); resumoBloco(params.semOrigemPlataforma);
  sec("SEM ORIGEM — POR EMPREENDIMENTO"); resumoBloco(params.semOrigemEmpreendimento);

  sec("PERSISTÊNCIA POR CORRETOR"); persistBloco(params.persistPorCorretor);
  sec("PERSISTÊNCIA POR CONJUNTO"); persistBloco(params.persistPorConjunto);

  sec("DESCARTE x TENTATIVAS");
  L.push(["Motivo", "Total", "Média tent.", "% <3 tent."].map(esc).join(","));
  params.descarteMotivo.forEach((d) =>
    L.push([d.motivo, d.total, num1(d.mediaTentativas), pct(d.pctMenosDe3)].map(esc).join(",")),
  );

  sec("CONJUNTO x MOTIVO DESCARTE");
  L.push(["Conjunto", "Motivo", "Qtd", "Média tent."].map(esc).join(","));
  params.descarteConjunto.forEach((d) =>
    L.push([d.conjunto, d.motivo, d.qtd, num1(d.mediaTentativas)].map(esc).join(",")),
  );

  sec("DETALHADO POR LEAD");
  L.push([
    "Lead", "Criado em", "Origem", "Campanha", "Conjunto", "Criativo", "Plataforma",
    "Empreendimento", "Corretor", "Etapa", "Grupo qualidade", "Sem registro",
    "Visita realizada", "Venda", "VGV", "1º contato", "1º contato v1", "Origem 1º contato",
    "Tempo até 1º contato (min)", "Nº tentativas", "Entrou na cadência",
    "Contato de primeira", "Chegou ao fim", "Sucesso pós-cadência", "Abandonado",
    "Dias em Sem Contato", "Motivo descarte",
  ].map(esc).join(","));
  params.detalhado.forEach((r) =>
    L.push([
      r.nome, r.created_at, r.origem, r.campanha, r.conjunto_anuncio, r.anuncio,
      r.plataforma, r.empreendimento, r.corretor_nome, r.stage_nome, r.grupo,
      r.semRegistro ? "sim" : "não", r.tem_visita_realizada ? "sim" : "não",
      r.tem_venda ? "sim" : "não", r.vgv ?? 0,
      r.primeiro_contato_em ?? "", r.primeiro_contato_em_v1 ?? "", r.origem_primeiro_contato ?? "",
      r.semRegistro ? "" : r.tempo_ate_primeiro_contato_min ?? "",
      r.num_tentativas, r.entrou_na_cadencia ? "sim" : "não",
      r.contato_estabelecido ? "sim" : "não", r.chegou_ao_fim_cadencia ? "sim" : "não",
      r.saiu_da_cadencia_com_contato ? "sim" : "não", r.abandonado_na_cadencia ? "sim" : "não",
      r.tempo_em_sem_contato_dias ?? "", r.motivo_descarte ?? "",
    ].map(esc).join(",")),
  );

  return L.join("\n");
}

export const labelKey = labelOf;
