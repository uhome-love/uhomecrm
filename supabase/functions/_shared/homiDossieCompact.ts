import type { Dossie, Json } from "./homiDossie.ts";

const record = (v: Json | undefined): Dossie => v && typeof v === "object" && !Array.isArray(v) ? v : {};
const rows = (v: Json | undefined): Dossie[] => Array.isArray(v) ? v.map(record) : [];
const norm = (v: Json | undefined) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const noReturn = (f: Dossie) => {
  const text = norm([f.tipo, f.titulo, f.descricao_resumo].join(" "));
  return !/visita|objecao|proximo passo|entrada|etapa|proposta|documentacao/.test(text)
    && (/nao_atendeu|sem_resposta|sem_retorno/.test(norm(f.resultado))
      || (!f.resultado && /nao atendeu|sem (resposta|retorno)|tentativa/.test(text)));
};

/** Only repeated unsuccessful attempts collapse; meaningful milestones never disappear. */
export function groupAttempts(facts: Dossie[]): Dossie[] {
  const groups = new Map<string, Dossie[]>();
  const retained: Dossie[] = [];
  for (const fact of facts) {
    if (!noReturn(fact)) { retained.push(fact); continue; }
    const key = JSON.stringify([fact.fonte, fact.autor_id, fact.ciclo, fact.resultado]);
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  for (const attempts of groups.values()) {
    if (attempts.length === 1) { retained.push(attempts[0]); continue; }
    const sorted = attempts.sort((a, b) => String(a.data).localeCompare(String(b.data)));
    const first = sorted[0], last = sorted[sorted.length - 1];
    retained.push({ fonte: first.fonte ?? null, autor_id: first.autor_id ?? null,
      autor_tipo: first.autor_tipo ?? null, outro_corretor: first.outro_corretor ?? false,
      ciclo: first.ciclo ?? null, data: last.data ?? null, de: first.data ?? null, ate: last.data ?? null,
      tipo: "tentativas_agrupadas", quantidade: sorted.length, resultado: first.resultado ?? "sem_retorno",
      resumo: `${sorted.length} tentativas sem retorno de ${String(first.data).slice(0, 10)} a ${String(last.data).slice(0, 10)}` });
  }
  return retained.sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

export function compactDossier(clean: Dossie): Dossie {
  const copy = structuredClone(clean);
  const timeline = record(copy.timeline), data = record(timeline.dados);
  if (Array.isArray(data.fatos)) data.fatos = groupAttempts(rows(data.fatos));
  const oa = record(copy.oferta_ativa);
  if (Array.isArray(oa.dados)) oa.dados = groupAttempts(rows(oa.dados));
  return copy;
}

/** Short list projection: at most five sourced facts, plus explicit gaps and source states. */
export function shortDossier(clean: Dossie): Dossie {
  const d = compactDossier(clean);
  const facts = [
    ...rows(record(d.visitas).dados), ...rows(record(d.mudancas_etapa).dados),
    ...rows(record(record(d.timeline).dados).fatos), ...rows(record(d.memoria).dados),
  ].sort((a,b) => String(b.data).localeCompare(String(a.data)));
  return { lead: d.lead ?? null, qualificacao: d.qualificacao ?? null,
    fatos: facts.slice(0, 5), lacunas: d.lacunas ?? [],
    fontes: Object.fromEntries(Object.entries(d).filter(([,v]) => record(v).status)
      .map(([k,v]) => [k,record(v).status ?? null])) };
}

const proseKeys = new Set(["descricao", "descricao_resumo", "conteudo", "resumo", "observacao", "feedback", "valor", "mensagem"]);
function squeeze(v: Json, limit: number, key = ""): Json {
  if (typeof v === "string" && proseKeys.has(key) && v.length > limit) return v.slice(0, limit) + " [trecho abreviado]";
  if (Array.isArray(v)) return v.map(x => squeeze(x,limit));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v)
    .filter(([k]) => !["id", "autor_id", "created_at"].includes(k))
    .map(([k,x]) => [k,squeeze(x,limit,k)]));
  return v;
}

export const DOSSIER_MAX_BYTES = 12 * 1024;
export function boundedJson(d: Dossie, maxBytes = DOSSIER_MAX_BYTES): string {
  const size = (s: string) => new TextEncoder().encode(s).byteLength;
  let text = JSON.stringify(d);
  if (size(text) <= maxBytes) return text;
  // Full recent texts are kept whenever possible. Reduce duplicate/auxiliary prose first.
  const work = structuredClone(d);
  const recent = rows(record(work.atividades_recentes).dados);
  const ids = new Set(recent.map(f => f.id).filter(Boolean));
  const timeline = record(record(work.timeline).dados);
  if (Array.isArray(timeline.fatos)) timeline.fatos = rows(timeline.fatos).map(f => ids.has(f.id)
    ? { ...f, descricao_resumo: "Texto integral em atividades_recentes" } : f);
  work.compactacao = { textos_abreviados: true, marcos_preservados: true };
  for (const limit of [400, 240, 120, 60]) {
    text = JSON.stringify(squeeze(work,limit));
    if (size(text) <= maxBytes) return text;
  }
  // Never silently drop stage changes, visits, objections or results to force an envelope.
  throw new Error("Dossiê excede 12 KB mesmo compactado; abra um lead por vez. Nenhum marco foi descartado.");
}