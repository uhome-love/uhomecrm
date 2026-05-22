// Testes Sub-fix 1 — Dedup canônica + persistência híbrida (Opção A+)
// Stubs in-memory, sem rede. 15 testes conforme spec aprovada 22/05/2026.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  findExistingLead,
  normalizarNome,
  normalizarTelefone,
  registrarDedupHit,
} from "./dedup.ts";

// ─── Stub multi-call para findExistingLead ─────────────────────────────
// queue: array de respostas (uma por chamada .limit()/.single()), retornadas em ordem FIFO.
// deno-lint-ignore no-explicit-any
function makeFindStub(queue: any[][]) {
  let idx = 0;
  const builder = {
    select() { return this; },
    ilike() { return this; },
    eq() { return this; },
    order() { return this; },
    async limit() {
      const rows = queue[idx] ?? [];
      idx += 1;
      return { data: rows, error: null };
    },
  };
  return { from() { return builder; } };
}

// ─── Stub para registrarDedupHit (rastreia update/insert) ──────────────
// deno-lint-ignore no-explicit-any
function makePersistStub(observacoesIniciais: string | null) {
  const calls = {
    update_observacoes: null as string | null,
    insert_respostas: null as any,
  };
  let currentObs = observacoesIniciais;

  const leadsBuilder = {
    _select: "",
    select(cols: string) { this._select = cols; return this; },
    eq() { return this; },
    async single() {
      return { data: { observacoes: currentObs }, error: null };
    },
    update(payload: { observacoes: string }) {
      calls.update_observacoes = payload.observacoes;
      currentObs = payload.observacoes;
      return { eq: () => Promise.resolve({ data: null, error: null }) };
    },
  };
  const respostasBuilder = {
    insert(payload: any) {
      calls.insert_respostas = payload;
      return Promise.resolve({ data: null, error: null });
    },
  };

  return {
    calls,
    client: {
      from(table: string) {
        if (table === "pipeline_leads") return leadsBuilder;
        if (table === "campanha_atrio_respostas") return respostasBuilder;
        throw new Error(`unexpected table ${table}`);
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1-2 — Helpers de normalização
// ═══════════════════════════════════════════════════════════════════════

Deno.test("1) normalizarTelefone — 5 inputs incluindo Greski 12-dig 55-prefix", () => {
  assertEquals(normalizarTelefone("5551999122212"), "51999122212"); // 13 + 55
  assertEquals(normalizarTelefone("555199122212"), "5199122212");   // 12 + 55 (Greski real)
  assertEquals(normalizarTelefone("51999122212"), "51999122212");   // 11 canônico
  assertEquals(normalizarTelefone("+55 (51) 99912-2212"), "51999122212"); // máscara
  assertEquals(normalizarTelefone("5199122212"), "5199122212");     // 10 fixo
});

Deno.test("2) normalizarNome — acentos, caixa, espaços", () => {
  assertEquals(normalizarNome("José da Silva  "), "jose da silva");
  assertEquals(normalizarNome("  ANA   MARIA  "), "ana maria");
  assertEquals(normalizarNome(""), "");
});

// ═══════════════════════════════════════════════════════════════════════
// 3-7 — Camadas de dedup
// ═══════════════════════════════════════════════════════════════════════

Deno.test("3) Camada 1 acerta — canônico exato", async () => {
  const stub = makeFindStub([
    [{ id: "L1", nome: "Ana", telefone_normalizado: "51999122212" }],
  ]);
  const r = await findExistingLead(stub, "+55 51 99912-2212");
  assertEquals(r.camada, 1);
  assertEquals(r.lead?.id, "L1");
});

Deno.test("4) Camada 1 vazia, Camada 2 acerta por last-8", async () => {
  const stub = makeFindStub([
    [], // C1: nada
    [{ id: "L2", nome: "Bia", telefone_normalizado: "555199122212" }], // C2: variante DDI estranha
  ]);
  const r = await findExistingLead(stub, "5199122212");
  assertEquals(r.camada, 2);
  assertEquals(r.lead?.id, "L2");
});

Deno.test("5) Camadas 1+2 vazias, Camada 3 acerta por nome+DDD", async () => {
  const stub = makeFindStub([
    [],
    [],
    [{ id: "L3", nome: "Carlos Pereira", telefone_normalizado: "51988887777" }],
  ]);
  const r = await findExistingLead(stub, "5551988880000", "Carlos Pereira");
  // tel input canônico: 51988880000 → last8 88880000 (não bate com 88887777 → C2 falha)
  // C3: nome "pereira" (≥5) + DDD 51 + canônico ≥10 → match
  assertEquals(r.camada, 3);
  assertEquals(r.lead?.id, "L3");
});

Deno.test("6) Tudo vazio → lead=null, camada=null", async () => {
  const stub = makeFindStub([[], [], []]);
  const r = await findExistingLead(stub, "5199999999", "Fulano Beltrano");
  assertEquals(r.lead, null);
  assertEquals(r.camada, null);
});

Deno.test("7) Caso Greski — last8 diferente, nome+DDD casa → Camada 3", async () => {
  // input: tel sem alguns dígitos finais, mas nome forte casa
  const stub = makeFindStub([
    [],
    [], // last8 não bate
    [{ id: "L7", nome: "Júnior Greski", telefone_normalizado: "51999122212" }],
  ]);
  const r = await findExistingLead(stub, "5551955551234", "Junior Greski");
  assertEquals(r.camada, 3);
  assertEquals(r.lead?.id, "L7");
});

// ═══════════════════════════════════════════════════════════════════════
// 8-12 — Robustez
// ═══════════════════════════════════════════════════════════════════════

Deno.test("8) Nome curto (<10 chars OU sem token ≥5) → Camada 3 não dispara", async () => {
  const stub = makeFindStub([[], [], []]);
  const r1 = await findExistingLead(stub, "5199999999", "Ana Maria");
  assertEquals(r1.camada, null);
  const stub2 = makeFindStub([[], [], []]);
  const r2 = await findExistingLead(stub2, "5199999999", "Lu");
  assertEquals(r2.camada, null);
});

Deno.test("9) ilike sem % no final — não dá falso positivo (canônico estende)", async () => {
  // Postgres ilike '%51999122212' não casa com '51999122212X', mas como o stub
  // entrega rows arbitrárias, o filtro pós-fetch precisa rejeitar canônico ≠.
  const stub = makeFindStub([
    [
      // candidato com canônico DIFERENTE (extra dígito) — deve ser filtrado fora
      { id: "FP", nome: "X", telefone_normalizado: "519991222129" },
    ],
    [], // C2 vazio (last8 também não bate)
  ]);
  const r = await findExistingLead(stub, "51999122212");
  assertEquals(r.camada, null);
  assertEquals(r.lead, null);
});

Deno.test("10) Camada 3 — DDD BR inválido pula camada", async () => {
  const stub = makeFindStub([[], [], []]);
  // canônico começa com 00 (DDD inválido)
  const r = await findExistingLead(stub, "0099887766", "Maria Aparecida");
  assertEquals(r.camada, null);
});

Deno.test("11) Telefone <8 dígitos canônicos → C1 e C2 puladas; só C3 se possível", async () => {
  // Sem nome → tudo pulado
  let queries = 0;
  // deno-lint-ignore no-explicit-any
  const stub: any = {
    from() {
      return {
        select() { return this; },
        ilike() { return this; },
        order() { return this; },
        async limit() { queries += 1; return { data: [], error: null }; },
      };
    },
  };
  const r = await findExistingLead(stub, "123");
  assertEquals(r.lead, null);
  assertEquals(queries, 0); // canonical curto + sem nome → zero queries
});

Deno.test("12) Múltiplos candidatos C2 → filtro pós-fetch elege canônico igual", async () => {
  const stub = makeFindStub([
    [], // C1
    [
      { id: "L_OUTRO", nome: "Outro", telefone_normalizado: "11999122212" }, // last8 bate mas DDD diferente
      { id: "L_BOM",   nome: "Bom",   telefone_normalizado: "51999122212" }, // canônico exato
    ],
  ]);
  const r = await findExistingLead(stub, "51999122212");
  assertEquals(r.camada, 2);
  // L_OUTRO tem last8 99122212 igual ao input, é candidato válido;
  // mas L_BOM tem canônico exato → preferência
  assertEquals(r.lead?.id, "L_BOM");
});

// ═══════════════════════════════════════════════════════════════════════
// 13-15 — Persistência híbrida (Opção A+)
// ═══════════════════════════════════════════════════════════════════════

Deno.test("13) Lead sem tag → append em observacoes + insert em respostas", async () => {
  const s = makePersistStub(null);
  const r = await registrarDedupHit(
    s.client,
    { lead: { id: "L13", nome: "Ana", telefone_normalizado: "51999122212" }, camada: 2 },
    { from: "5551999122212", wamid: "WAM13" },
  );
  assertEquals(r.observacao_anexada, true);
  assertEquals(r.resposta_registrada, true);
  // observacoes anexada contém tag
  assertEquals(s.calls.update_observacoes?.includes("[CAMPANHA_ATRIO_DEDUP]"), true);
  // resposta registrada com motivo correto
  assertEquals(s.calls.insert_respostas?.motivo_falha_roleta, "SKIP_DEDUP_CAMADA_2");
  assertEquals(s.calls.insert_respostas?.lead_id, "L13");
});

Deno.test("14) Lead JÁ COM tag _DEDUP → pula append, AINDA registra resposta", async () => {
  const obsExistente = "Obs anterior\n---\n[CAMPANHA_ATRIO_DEDUP] hit em 2026-05-22T10:00:00Z (camada 1).";
  const s = makePersistStub(obsExistente);
  const r = await registrarDedupHit(
    s.client,
    { lead: { id: "L14", nome: "Bia", telefone_normalizado: "51999122212" }, camada: 1 },
    { from: "5551999122212", wamid: "WAM14" },
  );
  assertEquals(r.observacao_anexada, false);
  assertEquals(r.resposta_registrada, true);
  assertEquals(s.calls.update_observacoes, null); // não atualizou
  assertEquals(s.calls.insert_respostas?.motivo_falha_roleta, "SKIP_DEDUP_CAMADA_1");
});

Deno.test("15) Lead com [CAMPANHA_ATRIO] original sem _DEDUP → faz append + registra", async () => {
  const obsExistente = "[CAMPANHA_ATRIO] Tag legacy do incidente 22/05/2026.";
  const s = makePersistStub(obsExistente);
  const r = await registrarDedupHit(
    s.client,
    { lead: { id: "L15", nome: "Cris", telefone_normalizado: "51999122212" }, camada: 3 },
    { from: "5551999122212", wamid: "WAM15" },
  );
  assertEquals(r.observacao_anexada, true);
  assertEquals(r.resposta_registrada, true);
  // preservou observação antiga + adicionou nova
  assertEquals(s.calls.update_observacoes?.includes("[CAMPANHA_ATRIO] Tag legacy"), true);
  assertEquals(s.calls.update_observacoes?.includes("[CAMPANHA_ATRIO_DEDUP]"), true);
  assertEquals(s.calls.insert_respostas?.motivo_falha_roleta, "SKIP_DEDUP_CAMADA_3");
});
