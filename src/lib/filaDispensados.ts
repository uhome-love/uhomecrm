// filaDispensados — "Dispensar" um card das Prioridades tira ele da sugestão por
// 24h (não é adiar: não cria lembrete, não muda saúde). Guardado por-dispositivo
// no localStorage; some sozinho depois de 24h.

const CHAVE = "fila_dispensados_v1";
const JANELA_MS = 24 * 60 * 60 * 1000;

type Mapa = Record<string, number>; // leadId -> dispensado em (epoch ms)

function ler(): Mapa {
  try {
    const raw = localStorage.getItem(CHAVE);
    return raw ? (JSON.parse(raw) as Mapa) : {};
  } catch { return {}; }
}

function gravar(m: Mapa) {
  try { localStorage.setItem(CHAVE, JSON.stringify(m)); } catch { /* ignore */ }
}

/** Ids ainda "dispensados" (dentro das 24h). Já limpa os expirados. */
export function leadsDispensados(agora: number = Date.now()): Set<string> {
  const m = ler();
  const validos: Mapa = {};
  const set = new Set<string>();
  for (const [id, ts] of Object.entries(m)) {
    if (agora - ts < JANELA_MS) { validos[id] = ts; set.add(id); }
  }
  if (Object.keys(validos).length !== Object.keys(m).length) gravar(validos);
  return set;
}

/** Dispensa um lead da fila por 24h. */
export function dispensarLead(id: string, agora: number = Date.now()) {
  const m = ler();
  m[id] = agora;
  gravar(m);
}
