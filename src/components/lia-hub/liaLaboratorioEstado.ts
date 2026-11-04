import type { Execucao } from "./LiaCenarioCard";

export function ultimasExecucoes(execs: Execucao[]) {
  const map = new Map<string, Execucao>();
  for (const e of [...execs].sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))) {
    if (!map.has(e.cenario_id)) map.set(e.cenario_id,e);
  }
  return map;
}
export function fichaVigente(e: Execucao | undefined, atual: string | undefined) {
  if (!e) return false;
  return !!atual && !!e.ficha_versao && new Date(e.ficha_versao).getTime() === new Date(atual).getTime();
}