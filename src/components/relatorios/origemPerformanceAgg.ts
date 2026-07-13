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
  motivo_descarte: string | null;
  tipo_descarte: string | null;
  primeiro_contato_em: string | null;
  tempo_ate_primeiro_contato_min: number | null;
  tem_visita_realizada: boolean;
  tem_venda: boolean;
  vgv: number | null;
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
}

export interface ResumoCriativo extends Resumo {
  dataPrimeiroLead: string | null;
  dataUltimoLead: string | null;
  semanas: SemanaCriativo[];
}

export interface SemanaCriativo {
  semana: string; // 'yyyy-MM-dd' (segunda-feira)
  leads: number;
  taxaQualif: number | null;
  taxaVisita: number;
}

export function enrich(rows: LeadRow[]): LeadRowX[] {
  return rows.map((r) => ({
    ...r,
    grupo: classificarQualidade(r),
    semRegistro: semRegistroContato(r),
  }));
}

function mediana(vals: number[]): number | null {
  if (vals.length === 0) return null;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

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
  // Tempo: só leads COM primeiro contato registrado.
  const tempos = rows
    .filter((r) => !r.semRegistro && r.tempo_ate_primeiro_contato_min != null)
    .map((r) => r.tempo_ate_primeiro_contato_min as number);
  const tempoMedioMin = tempos.length
    ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
    : null;
  return {
    chave,
    leads,
    qualificados,
    desqualificados,
    pendentes,
    neutros,
    semRegistro,
    taxaQualif: taxaQualificacao(qualificados, desqualificados),
    visitas,
    taxaVisita: leads ? visitas / leads : 0,
    vendas,
    vgv,
    tempoMedioMin,
    tempoMedianaMin: mediana(tempos),
  };
}

function labelOf(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s.length ? s : "(sem origem)";
}

export function groupResumo(
  rows: LeadRowX[],
  keyFn: (r: LeadRowX) => string,
): Resumo[] {
  const map = new Map<string, LeadRowX[]>();
  for (const r of rows) {
    const k = keyFn(r);
    (map.get(k) ?? map.set(k, []).get(k)!).push(r);
  }
  return [...map.entries()]
    .map(([k, rs]) => computeResumo(k, rs))
    .sort((a, b) => b.leads - a.leads);
}

// Segunda-feira (BRT-ish, sem hora) da data.
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
      // Semanas
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

// ————————————————————————————————— CSV
function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const pct = (v: number | null) => (v == null ? "" : (v * 100).toFixed(1).replace(".", ",") + "%");

const RESUMO_HEAD = [
  "Chave", "Leads", "Qualificados", "Desqualificados", "Pendentes", "Neutros",
  "Sem registro", "Taxa qualif.", "Visitas", "Taxa visita", "Vendas", "VGV",
  "Tempo médio (min)", "Tempo mediana (min)",
];
function resumoLinha(r: Resumo): string {
  return [
    r.chave, r.leads, r.qualificados, r.desqualificados, r.pendentes, r.neutros,
    r.semRegistro, pct(r.taxaQualif), r.visitas, pct(r.taxaVisita), r.vendas,
    r.vgv, r.tempoMedioMin ?? "", r.tempoMedianaMin ?? "",
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
}): string {
  const L: string[] = [];
  const sec = (t: string) => { L.push(""); L.push(`# ${t}`); };
  const resumoBloco = (rows: Resumo[]) => {
    L.push(RESUMO_HEAD.map(esc).join(","));
    rows.forEach((r) => L.push(resumoLinha(r)));
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

  sec("DETALHADO POR LEAD");
  L.push([
    "Lead", "Criado em", "Origem", "Campanha", "Conjunto", "Criativo", "Plataforma",
    "Empreendimento", "Corretor", "Etapa", "Grupo qualidade", "Sem registro",
    "Visita realizada", "Venda", "VGV", "1º contato", "Tempo até 1º contato (min)",
  ].map(esc).join(","));
  params.detalhado.forEach((r) =>
    L.push([
      r.nome, r.created_at, r.origem, r.campanha, r.conjunto_anuncio, r.anuncio,
      r.plataforma, r.empreendimento, r.corretor_nome, r.stage_nome, r.grupo,
      r.semRegistro ? "sim" : "não", r.tem_visita_realizada ? "sim" : "não",
      r.tem_venda ? "sim" : "não", r.vgv ?? 0, r.primeiro_contato_em ?? "",
      r.semRegistro ? "" : r.tempo_ate_primeiro_contato_min ?? "",
    ].map(esc).join(",")),
  );

  return L.join("\n");
}

export const labelKey = labelOf;
