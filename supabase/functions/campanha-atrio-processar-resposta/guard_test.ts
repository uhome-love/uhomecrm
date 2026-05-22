// Testes do guardrail de stage avançada (Sub-fix 4).
// Usa stubs do cliente Supabase — não bate em rede.
// As linhas de pipeline_leads usadas como fixture vêm de leituras reais ao DB
// em 22/05/2026 (validadas via supabase--read_query antes da execução).
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkLeadIntocavel, STAGES_INTOCAVEIS } from "./guard.ts";

// IDs de stage canônicos (snapshot do schema 22/05/2026)
const STAGE_NEGOCIO_CRIADO = "a8a1a867-5b0c-414e-9532-8873c4ca5a0f";
const STAGE_SEM_CONTATO = "2fcba9be-1188-4a54-9452-394beefdc330";
const STAGE_CONTATO_INICIADO = "8e2a3285-70f9-438d-be2d-13b0bf4610c4";

// Helper: stub mínimo que devolve uma lista fixa a partir de .from().select()...
// Imita só o chain usado por checkLeadIntocavel.
// deno-lint-ignore no-explicit-any
function makeStubClient(rows: any[]) {
  const builder = {
    select() { return this; },
    ilike() { return this; },
    order() { return this; },
    async limit() { return { data: rows, error: null }; },
  };
  return { from() { return builder; } };
}

Deno.test("STAGES_INTOCAVEIS contém as 9 stages aprovadas", () => {
  assertEquals(STAGES_INTOCAVEIS.size, 9);
  assertEquals(STAGES_INTOCAVEIS.has(STAGE_NEGOCIO_CRIADO), true);
  assertEquals(STAGES_INTOCAVEIS.has(STAGE_SEM_CONTATO), false);
});

Deno.test("Caso A — Júnior Greski (Negócio Criado) → skip=true, motivo='stage'", async () => {
  // Fixture real lida do DB:
  // id=d8bb7cf3..., nome='Júnior Greski', tel_norm='5551999122212',
  // stage='Negócio Criado', arquivado=false, negocio_id=a087f77d...
  const stub = makeStubClient([
    {
      id: "d8bb7cf3-20a6-4887-b102-48fcf136abd4",
      nome: "Júnior Greski",
      telefone_normalizado: "5551999122212",
      stage_id: STAGE_NEGOCIO_CRIADO,
      arquivado: false,
      negocio_id: "a087f77d-a220-4d6b-91d3-c1789803f696",
      pipeline_stages: { nome: "Negócio Criado" },
    },
  ]);
  const r = await checkLeadIntocavel(stub, "+5551999122212");
  assertEquals(r.skip, true);
  assertEquals(r.motivo, "stage");
  assertEquals(r.lead?.id, "d8bb7cf3-20a6-4887-b102-48fcf136abd4");
  assertEquals(r.lead?.stage_nome, "Negócio Criado");
});

Deno.test("Caso B — Edvania (arquivado=true, Sem Contato) → skip=true, motivo='arquivado'", async () => {
  // Fixture real (lead inativado pela auditoria de 22/05/2026):
  // id=3e5df597..., nome='Edvania', tel_norm='53984075719',
  // stage='Sem Contato', arquivado=true
  const stub = makeStubClient([
    {
      id: "3e5df597-4738-4a22-ba33-3d9e7f06e45b",
      nome: "Edvania",
      telefone_normalizado: "53984075719",
      stage_id: STAGE_SEM_CONTATO,
      arquivado: true,
      negocio_id: null,
      pipeline_stages: { nome: "Sem Contato" },
    },
  ]);
  const r = await checkLeadIntocavel(stub, "5553984075719");
  assertEquals(r.skip, true);
  assertEquals(r.motivo, "arquivado");
  assertEquals(r.lead?.id, "3e5df597-4738-4a22-ba33-3d9e7f06e45b");
});

Deno.test("Caso C — Rodolfo Medeiros (Sem Contato ativo) → skip=false", async () => {
  // Fixture real: id=a8ea5c05..., nome='Rodolfo Medeiros',
  // tel_norm='41978620770', stage='Sem Contato', arquivado=false, negocio_id=null
  const stub = makeStubClient([
    {
      id: "a8ea5c05-e4c9-483e-b26a-47885fd8f310",
      nome: "Rodolfo Medeiros",
      telefone_normalizado: "41978620770",
      stage_id: STAGE_SEM_CONTATO,
      arquivado: false,
      negocio_id: null,
      pipeline_stages: { nome: "Sem Contato" },
    },
  ]);
  const r = await checkLeadIntocavel(stub, "5541978620770");
  assertEquals(r.skip, false);
  assertEquals(r.motivo, undefined);
  assertEquals(r.lead, undefined);
});

Deno.test("Telefone com menos de 8 dígitos → skip=false sem consultar DB", async () => {
  const stub = makeStubClient([]);
  const r = await checkLeadIntocavel(stub, "123");
  assertEquals(r.skip, false);
});

Deno.test("Múltiplos candidatos — primeiro intocável vence (duplicata Greski)", async () => {
  // Cenário do incidente: 2 leads mesmo telefone. Greski dup (Contato Iniciado,
  // arquivado=true após audit) vem primeiro em created_at DESC; o original
  // (Negócio Criado, ativo) vem depois. Guard deve bloquear no primeiro hit.
  const stub = makeStubClient([
    {
      id: "567f6ab4-1a45-47ce-ae02-0e03147ea64a",
      nome: "Greski",
      telefone_normalizado: "555199122212",
      stage_id: STAGE_CONTATO_INICIADO,
      arquivado: true,
      negocio_id: null,
      pipeline_stages: { nome: "Contato Iniciado" },
    },
    {
      id: "d8bb7cf3-20a6-4887-b102-48fcf136abd4",
      nome: "Júnior Greski",
      telefone_normalizado: "5551999122212",
      stage_id: STAGE_NEGOCIO_CRIADO,
      arquivado: false,
      negocio_id: "a087f77d-a220-4d6b-91d3-c1789803f696",
      pipeline_stages: { nome: "Negócio Criado" },
    },
  ]);
  const r = await checkLeadIntocavel(stub, "555199122212");
  assertEquals(r.skip, true);
  assertEquals(r.motivo, "arquivado");
  assertEquals(r.lead?.id, "567f6ab4-1a45-47ce-ae02-0e03147ea64a");
});
