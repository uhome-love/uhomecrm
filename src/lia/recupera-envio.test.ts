import { describe, expect, it } from "vitest";
import { MODELOS_RECUPERA } from "./recupera";
import {
  MODELO_TEXTO, MODELO_VARS, MODELOS_KEYS, OFERTA_NATAL, converterEmpreendimento, escolherModelo, imovelLembrete,
  paramsModelo, primeiroNomeValido, recuperaVigente, textoFinal, isModeloRecupera,
} from "../../supabase/functions/_shared/liaRecuperaModelos";

const canon = ["Casa Tua Canoas", "Casa Tua Porto Alegre", "Open Bosque", "Open Arvoredo", "Flow", "AWA", "Lake Eyre", "Avulso", "Orygem", "Vértice Las Casas", "Connect JW"]
  .map((nome, i) => ({ id: String(i), nome }));
const cli = (o: Partial<Parameters<typeof escolherModelo>[0]> = {}) => ({ nome: "MARIA SILVA", balde: "nao_atende", empreendimentoRaw: "Flow - v2", teveContatoHumano: true, corretorInativo: false, ...o });

describe("modelos e informações", () => {
  it("textos iguais aos da tela e quantidade de informações", () => {
    for (const m of MODELOS_RECUPERA) expect(MODELO_TEXTO[m.chave as keyof typeof MODELO_TEXTO]).toBe(m.texto);
    expect(MODELO_VARS).toEqual({ lia_recupera_a: 2, lia_recupera_b: 2, lia_recupera_c: 2, lia_recupera_d: 1, lia_recupera_lembrete: 3, lia_recupera_final: 1 });
  });
  it("ordem das informações", () => {
    expect(paramsModelo("lia_recupera_a", { nome: "Maria", empreendimento: "Flow" })).toEqual(["Maria", "Flow"]);
    expect(paramsModelo("lia_recupera_d", { nome: "Maria", empreendimento: "Flow" })).toEqual(["Maria"]);
    expect(paramsModelo("lia_recupera_final", { nome: "Maria" })).toEqual(["Maria"]);
    expect(paramsModelo("lia_recupera_lembrete", { nome: "Maria", imovel: "Skyglass", oferta: OFERTA_NATAL.Skyglass })).toEqual(["Maria", "Skyglass", OFERTA_NATAL.Skyglass]);
  });
  it("sem quebra de linha nem espaços seguidos e nunca vazio", () => {
    expect(paramsModelo("lia_recupera_a", { nome: " Maria ", empreendimento: "Open\n  Bosque" })).toEqual(["Maria", "Open Bosque"]);
    expect(() => paramsModelo("lia_recupera_a", { nome: "Maria", empreendimento: "" })).toThrow();
    expect(textoFinal("lia_recupera_a", ["Maria", "Flow"])).not.toMatch(/\{\{/);
  });
});

describe("nome", () => {
  it("primeiro nome com inicial maiúscula", () => {
    expect(primeiroNomeValido("MARIA SILVA")).toBe("Maria");
    expect(primeiroNomeValido("joão")).toBe("João");
  });
  it.each(["", "A", "Cliente", "lead", "wpp", "teste", "Sem nome", "Maria2", "😀 Ana", "123"])("%s vira sem_nome", (n) => {
    expect(primeiroNomeValido(n)).toBeNull();
    expect(escolherModelo(cli({ nome: n }), canon, [])).toEqual({ ok: false, motivo: "sem_nome" });
  });
});

describe("empreendimento", () => {
  it("nome de campanha vira nome oficial", () => {
    expect(converterEmpreendimento("Casa Tua Canoas v6 - Videos Novos - Tst", canon, []).nome).toBe("Casa Tua Canoas");
    expect(converterEmpreendimento("Casa Tua Canoas | RMKT Quente 60D", canon, []).nome).toBe("Casa Tua Canoas");
    expect(converterEmpreendimento("Open Bosque - v4", canon, []).nome).toBe("Open Bosque");
    expect(converterEmpreendimento("Open Arvoredo v1", canon, []).nome).toBe("Open Arvoredo");
    expect(converterEmpreendimento("Casa Tua Alto Petrópolis", canon, []).nome).toBe("Casa Tua Porto Alegre");
    expect(converterEmpreendimento("Casa Tua Porto Alegre - CAPI - v5", canon, []).nome).toBe("Casa Tua Porto Alegre");
    expect(converterEmpreendimento("casa tua", canon, []).nome).toBe("Casa Tua Porto Alegre");
  });
  it("usa o cadastro de apelidos primeiro", () => {
    expect(converterEmpreendimento("CT Canoas", canon, [{ alias_norm: "ct canoas", empreendimento_id: "0" }]).nome).toBe("Casa Tua Canoas");
  });
  it("avulso ou não convertido → sem empreendimento", () => {
    expect(converterEmpreendimento("Avulso", canon, []).nome).toBeNull();
    expect(converterEmpreendimento("Apartamento terceiros Moinhos", canon, []).nome).toBeNull();
  });
});

describe("escolha do modelo", () => {
  const m = (o: Partial<Parameters<typeof escolherModelo>[0]>) => { const r = escolherModelo(cli(o), canon, []); return r.ok ? r.modelo : r.motivo; };
  it("sem contato humano → C (antes de tudo)", () => expect(m({ teveContatoHumano: false, balde: "sem_interesse_momento" })).toBe("lia_recupera_c"));
  it.each(["sem_interesse_momento", "sem_condicao_financeira", "desistiu_compra"])("%s → B", (b) => expect(m({ balde: b })).toBe("lia_recupera_b"));
  it("sem interesse com corretor que saiu continua B", () => expect(m({ balde: "sem_interesse_momento", corretorInativo: true })).toBe("lia_recupera_b"));
  it("corretor inativo → C", () => expect(m({ corretorInativo: true })).toBe("lia_recupera_c"));
  it.each(["nao_atende", "sem_motivo", "outro", "sem_perfil", "lead_antigo"])("%s → A", (b) => expect(m({ balde: b })).toBe("lia_recupera_a"));
  it.each([
    { teveContatoHumano: false }, { balde: "sem_interesse_momento" }, { corretorInativo: true }, {},
  ])("A/B/C sem empreendimento → D", (o) => expect(m({ ...o, empreendimentoRaw: "Avulso" })).toBe("lia_recupera_d"));
});

describe("lembrete", () => {
  it("próprio imóvel de Natal e Lakes → Golden Lake", () => {
    expect(imovelLembrete("Casa Tua Canoas")).toMatchObject({ imovel: "Casa Tua Canoas", caminho: "proprio" });
    expect(imovelLembrete("Lake Eyre")).toMatchObject({ imovel: "Golden Lake", caminho: "proprio" });
  });
  it("tabela de troca", () => {
    expect(imovelLembrete("AWA").imovel).toBe("Skyglass");
    expect(imovelLembrete("Orygem").imovel).toBe("Casa Tua Canoas");
    expect(imovelLembrete("Flow").imovel).toBe("Open Bosque");
    expect(imovelLembrete("Vértice Las Casas").imovel).toBe("Essence Canoas");
    expect(imovelLembrete("Seen Três Figueiras").imovel).toBe("Golden Lake");
  });
  it("outro ou sem empreendimento → Open Bosque", () => {
    expect(imovelLembrete("Hola")).toMatchObject({ imovel: "Open Bosque", caminho: "open_bosque" });
    expect(imovelLembrete(null)).toMatchObject({ imovel: "Open Bosque", caminho: "open_bosque" });
  });
  it("oferta não começa com 'com' nem 'o'", () => {
    for (const o of Object.values(OFERTA_NATAL)) expect(o).not.toMatch(/^(com|o)\s/i);
    expect(Object.keys(OFERTA_NATAL)).toHaveLength(8);
  });
});

describe("prazo e trava", () => {
  it("os 6 modelos param depois de 18/12", () => {
    expect(recuperaVigente("2026-12-18")).toBe(true);
    expect(recuperaVigente("2026-12-19")).toBe(false);
    expect(MODELOS_KEYS).toHaveLength(6);
    for (const k of MODELOS_KEYS) expect(isModeloRecupera(k)).toBe(true);
    expect(isModeloRecupera("lia_reengajar_cardapio")).toBe(false);
  });
});

describe("modelo C — lead anterior ao CRM (09/03/2026)", () => {
  const m = (o: Partial<Parameters<typeof escolherModelo>[0]>) => { const r = escolherModelo(cli(o), canon, []); return r.ok ? [r.modelo, r.porqueC] : [r.motivo, null]; };
  it("lead novo sem contato vai para C por sem_contato", () => {
    expect(m({ teveContatoHumano: false, leadCriadoEm: "2026-03-09T03:00:00Z" })).toEqual(["lia_recupera_c", "sem_contato"]);
  });
  it("lead antigo sem contato não vai para C por sem_contato: A", () => {
    expect(m({ teveContatoHumano: false, leadCriadoEm: "2026-03-08T12:00:00Z" })).toEqual(["lia_recupera_a", null]);
  });
  it("lead antigo sem contato com motivo de B fica no B", () => {
    expect(m({ teveContatoHumano: false, leadCriadoEm: "2025-10-01T12:00:00Z", balde: "sem_interesse_momento" })).toEqual(["lia_recupera_b", null]);
  });
  it("lead antigo sem contato com corretor inativo vai para C por corretor_inativo", () => {
    expect(m({ teveContatoHumano: false, leadCriadoEm: "2025-10-01T12:00:00Z", corretorInativo: true })).toEqual(["lia_recupera_c", "corretor_inativo"]);
  });
});
