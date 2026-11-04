// Executa o SQL de produção em PostgreSQL isolado. Nunca usa a conexão gerenciada do CRM.
// EQUIPES_TEST_PGPORT=55433 bunx vitest run src/test/equipes-negocios-pipeline.integration.test.ts
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const port = process.env.EQUIPES_TEST_PGPORT;
const suite = port ? describe : describe.skip;
const schema = "equipes_pipeline_regression";
const gestor = "00000000-0000-0000-0000-000000000010";
const broker = "00000000-0000-0000-0000-000000000020";

function sql(query: string): string {
  if (!port || !/^\d+$/.test(port)) throw new Error("Configure a porta do PostgreSQL isolado");
  return execFileSync("psql", ["-h", "127.0.0.1", "-p", port, "-U", "lovable", "-d", "postgres", "-X", "-At", "-v", "ON_ERROR_STOP=1"], {
    input: query, encoding: "utf8", env: { PATH: process.env.PATH, PGSSLMODE: "disable" },
  }).trim();
}

function seed(stage: string, archived = false, linked = false) {
  sql(`TRUNCATE ${schema}.pipeline_leads, ${schema}.negocios, ${schema}.pipeline_tarefas;
    INSERT INTO ${schema}.pipeline_leads
    (id, stage_id, corretor_id, nome, arquivado, valor_estimado, negocio_id)
    VALUES ('00000000-0000-0000-0000-000000000100',
      (SELECT id FROM ${schema}.pipeline_stages WHERE tipo='${stage}'), '${broker}', 'Cliente de teste',
      ${archived}, 650000, ${linked ? "'00000000-0000-0000-0000-000000000200'" : "NULL"});
    ${linked ? `INSERT INTO ${schema}.negocios
      (id, pipeline_lead_id, auth_user_id, fase, status, vgv_estimado, vgv_final)
      VALUES ('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000100', '${broker}', 'ganho', 'ativo', 600000, 650000);` : ""}`);
}

function overview() {
  return JSON.parse(sql(`SELECT set_config('app.test_role','admin',false);
    SELECT ${schema}.get_pipeline_equipes_overview();`).split("\n").at(-1) ?? "null") as {
      escritorio: { negocios: number; vgv_pipeline_ativo: number; total_leads_ativos: number; vgv_assinado_mes: number };
      gestores: Array<{ negocios: number; corretores: Array<{ negocios: number }> }>;
    };
}

suite("Equipes: SQL de produção na fonte única Pipeline", () => {
  beforeAll(() => {
    const view = readFileSync("drizzle/migrations/0062_v_negocios_pipeline_fonte_unica.sql", "utf8")
      .split("COMMENT ON VIEW")[0];
    const rpc = readFileSync("drizzle/migrations/0065_equipes_negocios_fonte_pipeline.sql", "utf8");
    const isolated = (source: string) => source.replaceAll("public.", `${schema}.`)
      .replaceAll("auth.uid()", `${schema}.test_uid()`)
      .replace("SET search_path TO 'public'", `SET search_path TO '${schema}'`);
    // A view usa nomes sem schema em alguns ambientes; fixa o search_path durante a criação.
    sql(`CREATE SCHEMA ${schema}; SET search_path TO ${schema};
      CREATE FUNCTION ${schema}.test_uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${broker}'::uuid $$;
      CREATE FUNCTION ${schema}.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$
        SELECT $2 = current_setting('app.test_role',true) $$;
      CREATE FUNCTION ${schema}.lead_saude_status(timestamptz,timestamptz,text,timestamptz)
        RETURNS text LANGUAGE sql AS $$ SELECT 'verde'::text $$;
      CREATE TABLE ${schema}.team_members(user_id uuid, gerente_id uuid, status text);
      CREATE TABLE ${schema}.pipeline_stages(id uuid, tipo text);
      CREATE TABLE ${schema}.pipeline_leads(id uuid, stage_id uuid, corretor_id uuid, nome text,
        arquivado boolean, negocio_id uuid, ultima_acao_at timestamptz, ultimo_toque_at timestamptz,
        distribuido_em timestamptz, aceito_em timestamptz, created_at timestamptz,
        estagnacao_carencia_ate timestamptz, empreendimento text, empreendimento_canonico_id uuid,
        valor_estimado numeric, stage_changed_at timestamptz);
      CREATE TABLE ${schema}.negocios(id uuid, pipeline_lead_id uuid, auth_user_id uuid, nome_cliente text,
        fase text, status text, empreendimento text, empreendimento_canonico_id uuid,
        vgv_final numeric, vgv_estimado numeric, data_assinatura date, fase_changed_at timestamptz,
        updated_at timestamptz, equipe_gerente_auth_id uuid);
      CREATE TABLE ${schema}.pipeline_tarefas(pipeline_lead_id uuid, status text, vence_em date, hora_vencimento time);
      CREATE TABLE ${schema}.profiles(id uuid, user_id uuid, nome text, avatar_url text);
      CREATE TABLE ${schema}.ceo_metas_mensais(gerente_id uuid, mes text, meta_vgv_assinado numeric);
      INSERT INTO ${schema}.team_members VALUES ('${broker}', '${gestor}', 'ativo');
      INSERT INTO ${schema}.profiles VALUES ('${broker}', '${broker}', 'Corretor', null), ('${gestor}', '${gestor}', 'Gestor', null);
      INSERT INTO ${schema}.pipeline_stages VALUES
        ('00000000-0000-0000-0000-000000000001','documentacao'),
        ('00000000-0000-0000-0000-000000000002','proposta'),
        ('00000000-0000-0000-0000-000000000003','contrato_gerado'),
        ('00000000-0000-0000-0000-000000000004','visita'),
        ('00000000-0000-0000-0000-000000000005','venda');
      ${isolated(view)} ${isolated(rpc)}`);
  });
  afterAll(() => sql(`DROP SCHEMA ${schema} CASCADE;`));

  it.each(["documentacao", "proposta", "contrato_gerado"])("conta %s sem exigir ficha de negócio", (stage) => {
    seed(stage);
    const result = overview();
    expect(result.escritorio.negocios).toBe(1);
    expect(result.escritorio.vgv_pipeline_ativo).toBe(650000);
    expect(result.gestores[0]?.negocios).toBe(1);
    expect(result.gestores[0]?.corretores[0]?.negocios).toBe(1);
  });
  it("pós-visita não conta como negócio", () => {
    seed("visita");
    expect(overview().escritorio.negocios).toBe(0);
  });
  it("cliente arquivado não conta", () => {
    seed("proposta", true);
    expect(overview().escritorio.negocios).toBe(0);
  });
  it("Ganho permanece separado da carteira em andamento", () => {
    seed("venda", false, true);
    expect(overview().escritorio.negocios).toBe(0);
    expect(Number(sql(`SELECT count(*) FROM ${schema}.v_negocios_pipeline WHERE etapa='ganho'`))).toBe(1);
  });
  it("ficha antiga não supera a etapa atual do Pipeline", () => {
    seed("visita", false, true);
    sql(`UPDATE ${schema}.negocios SET fase='proposta';`);
    expect(overview().escritorio.negocios).toBe(0);
  });
  it("mantém o escopo de equipes ativas", () => {
    seed("proposta");
    sql(`UPDATE ${schema}.pipeline_leads SET corretor_id='00000000-0000-0000-0000-000000000999';`);
    expect(overview().escritorio.negocios).toBe(0);
  });
  it("reconcilia 11 Documentação e 10 Proposta em 21 negócios", () => {
    seed("proposta");
    sql(`TRUNCATE ${schema}.pipeline_leads;
      INSERT INTO ${schema}.pipeline_leads(id,stage_id,corretor_id,nome,arquivado,valor_estimado)
      SELECT md5(i::text)::uuid,
        (SELECT id FROM ${schema}.pipeline_stages WHERE tipo=CASE WHEN i<=11 THEN 'documentacao' ELSE 'proposta' END),
        '${broker}', 'Teste '||i, false, 100000 FROM generate_series(1,21) i;`);
    const result = overview();
    expect(result.escritorio.negocios).toBe(21);
    expect(result.gestores[0]?.negocios).toBe(21);
    expect(result.gestores[0]?.corretores[0]?.negocios).toBe(21);
    expect(result.escritorio.vgv_pipeline_ativo).toBe(2100000);
  });
  it("mantém o VGV assinado independente da nova contagem", () => {
    seed("proposta", false, true);
    sql(`UPDATE ${schema}.negocios SET data_assinatura=(now() AT TIME ZONE 'America/Sao_Paulo')::date,
      equipe_gerente_auth_id='${gestor}';`);
    const result = overview();
    expect(result.escritorio.negocios).toBe(1);
    expect(result.escritorio.vgv_assinado_mes).toBe(650000);
  });
  it.each(["admin", "diretor"])("permite a leitura autorizada de %s", (role) => {
    expect(sql(`SELECT set_config('app.test_role','${role}',false); SELECT (${schema}.get_pipeline_equipes_overview()->'escritorio'->>'negocios')::int;`)).toMatch(/\n0$/);
  });
  it.each(["gerente", "corretor"])("nega a leitura executiva a %s", (role) => {
    expect(() => sql(`SELECT set_config('app.test_role','${role}',false); SELECT ${schema}.get_pipeline_equipes_overview();`)).toThrow(/Acesso negado/);
  });
});