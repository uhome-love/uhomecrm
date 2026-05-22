// ────────────────────────────────────────────────────────────────────────────
// SUB-FIX 1 — Dedup canônica com fallback (22/05/2026, Opção A+ aprovada)
// Corrige a causa raiz do incidente Greski: eq("telefone_normalizado", x)
// exigia match exato e falhava com formatos variantes (+55, máscara, etc).
//
// Estratégia de 3 camadas:
//   1) ilike canônico (sem % no final) + filtro pós-fetch
//   2) ilike pelos últimos 8 dígitos + filtro pós-fetch canônico
//   3) nome (token forte ≥5 chars) + DDD BR válido como fallback
//
// Persistência híbrida (Opção A+):
//   • pipeline_leads.observacoes — append idempotente com tag
//     [CAMPANHA_ATRIO_DEDUP] (visível ao corretor no card).
//   • campanha_atrio_respostas — INSERT por evento com
//     motivo_falha_roleta='SKIP_DEDUP_CAMADA_N' (auditoria).
// Não toca em pipeline_historico (schema exige stage_novo_id + movido_por).
// ────────────────────────────────────────────────────────────────────────────

const DDD_BR_VALIDOS = new Set<string>([
  "11","12","13","14","15","16","17","18","19",
  "21","22","24","27","28",
  "31","32","33","34","35","37","38",
  "41","42","43","44","45","46","47","48","49",
  "51","53","54","55",
  "61","62","63","64","65","66","67","68","69",
  "71","73","74","75","77","79",
  "81","82","83","84","85","86","87","88","89",
  "91","92","93","94","95","96","97","98","99",
]);

/**
 * Normaliza telefone para forma canônica BR usando heurística por comprimento.
 * Regras:
 *   • 13 dígitos começando com 55 → remove DDI → 11 dígitos (celular)
 *   • 12 dígitos começando com 55 → remove DDI → 10 dígitos (fixo)
 *   • 11 dígitos → mantém (celular com 9)
 *   • 10 dígitos → mantém (fixo sem 9)
 *   • >13 dígitos → fica com os 11 últimos
 *   • <10 dígitos → mantém como está (curto demais para canônico)
 */
export function normalizarTelefone(input: string): string {
  const d = (input || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 13 && d.startsWith("55")) return d.slice(2);
  if (d.length === 12 && d.startsWith("55")) return d.slice(2);
  if (d.length === 11) return d;
  if (d.length === 10) return d;
  if (d.length > 13) return d.slice(-11);
  return d;
}

/**
 * Normaliza nome para comparação: minúsculas, sem acentos, espaços colapsados.
 */
export function normalizarNome(input: string): string {
  return (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function ehDddBrValido(canonical: string): boolean {
  if (canonical.length < 10) return false;
  return DDD_BR_VALIDOS.has(canonical.slice(0, 2));
}

export type Camada = 1 | 2 | 3;
export interface ExistingLead {
  id: string;
  nome: string | null;
  telefone_normalizado: string | null;
}
export interface FindExistingResult {
  lead: ExistingLead | null;
  camada: Camada | null;
}

/**
 * Busca lead existente em 3 camadas. Para na primeira que encontrar.
 * Sempre filtra pós-fetch para evitar falso positivo do ilike.
 */
export async function findExistingLead(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  telefoneBruto: string,
  nomeBruto?: string | null,
): Promise<FindExistingResult> {
  const canonical = normalizarTelefone(telefoneBruto);
  const nomeNorm = normalizarNome(nomeBruto || "");

  // ── Camada 1: canônico exato via ilike sem % no final ────────────────
  if (canonical.length >= 10) {
    const { data: c1 } = await supabase
      .from("pipeline_leads")
      .select("id, nome, telefone_normalizado")
      .ilike("telefone_normalizado", `%${canonical}`)
      .order("created_at", { ascending: false })
      .limit(10);
    const match1 = (c1 || []).find((r: ExistingLead) =>
      normalizarTelefone(r.telefone_normalizado || "") === canonical
    );
    if (match1) return { lead: match1, camada: 1 };
  }

  // ── Camada 2: últimos 8 dígitos + filtro canônico ────────────────────
  const last8 = canonical.slice(-8);
  if (last8.length === 8) {
    const { data: c2 } = await supabase
      .from("pipeline_leads")
      .select("id, nome, telefone_normalizado")
      .ilike("telefone_normalizado", `%${last8}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    const candidatos = (c2 || []).filter((r: ExistingLead) =>
      normalizarTelefone(r.telefone_normalizado || "").slice(-8) === last8
    );
    // Preferir match com canônico idêntico; senão pega o mais recente
    const exato = candidatos.find((r: ExistingLead) =>
      normalizarTelefone(r.telefone_normalizado || "") === canonical
    );
    const escolhido = exato || candidatos[0];
    if (escolhido) return { lead: escolhido, camada: 2 };
  }

  // ── Camada 3: nome (token forte) + DDD BR válido ─────────────────────
  const tokens = nomeNorm.split(" ").filter((t) => t.length >= 5);
  if (nomeNorm.length >= 10 && tokens.length >= 1 && ehDddBrValido(canonical)) {
    const ddd = canonical.slice(0, 2);
    const tokenChave = tokens[0];
    const { data: c3 } = await supabase
      .from("pipeline_leads")
      .select("id, nome, telefone_normalizado")
      .ilike("nome", `%${tokenChave}%`)
      .ilike("telefone_normalizado", `%${ddd}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    const match3 = (c3 || []).find((r: ExistingLead) => {
      const n = normalizarNome(r.nome || "");
      const c = normalizarTelefone(r.telefone_normalizado || "");
      return n.includes(tokenChave) && c.startsWith(ddd) && c.length >= 10;
    });
    if (match3) return { lead: match3, camada: 3 };
  }

  return { lead: null, camada: null };
}

// ────────────────────────────────────────────────────────────────────────────
// Persistência híbrida (Opção A+)
// ────────────────────────────────────────────────────────────────────────────

const TAG_DEDUP = "[CAMPANHA_ATRIO_DEDUP]";

export interface DedupHitContext {
  from: string;
  wamid?: string | null;
}
export interface RegistrarDedupHitResult {
  observacao_anexada: boolean;
  resposta_registrada: boolean;
}

/**
 * Registra um hit de dedup: idempotente em observacoes; sempre insere
 * em campanha_atrio_respostas para auditoria por evento.
 */
export async function registrarDedupHit(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  match: { lead: ExistingLead; camada: Camada },
  ctx: DedupHitContext,
): Promise<RegistrarDedupHitResult> {
  const motivoFalha = `SKIP_DEDUP_CAMADA_${match.camada}`;

  // 1) Ler observacoes atual
  const { data: lead } = await supabase
    .from("pipeline_leads")
    .select("observacoes")
    .eq("id", match.lead.id)
    .single();

  const observacoesAtuais: string = lead?.observacoes ?? "";
  const jaMarcado = observacoesAtuais.includes(TAG_DEDUP);

  // 2) Append em observacoes (somente se não marcado)
  if (!jaMarcado) {
    const nova = (observacoesAtuais ? observacoesAtuais + "\n---\n" : "") +
      `${TAG_DEDUP} Tentativa de duplicação bloqueada em ` +
      `${new Date().toISOString()} (camada ${match.camada}).`;
    await supabase
      .from("pipeline_leads")
      .update({ observacoes: nova })
      .eq("id", match.lead.id);
  }

  // 3) Insert em campanha_atrio_respostas (sempre)
  await supabase.from("campanha_atrio_respostas").insert({
    lead_id: match.lead.id,
    telefone: ctx.from,
    tipo_resposta: "texto_livre",
    conteudo_resposta: JSON.stringify({
      wamid: ctx.wamid || null,
      motivo: motivoFalha,
      camada: match.camada,
      lead_existente_id: match.lead.id,
      lead_existente_nome: match.lead.nome,
    }).slice(0, 1000),
    wamid_origem: ctx.wamid || null,
    enviado_para_roleta: false,
    motivo_falha_roleta: motivoFalha,
  });

  return {
    observacao_anexada: !jaMarcado,
    resposta_registrada: true,
  };
}
