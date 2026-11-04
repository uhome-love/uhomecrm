import { describe, expect, it } from "vitest";
import { CENARIOS, PRECOS_NATAL, conferir, abertura, type Msg } from "../../supabase/functions/_shared/liaLaboratorio";
import { PRODUTOS_NATAL } from "./catalogoNatal";

const ok = (c: ReturnType<typeof conferir>, k: string) => c.find((x) => x.chave === k)?.ok;
const cen = (id: string) => CENARIOS.find((c) => c.id === id)!;

describe("laboratório da Lia", () => {
  it("tem 30 cenários com ids únicos", () => {
    expect(CENARIOS).toHaveLength(30);
    expect(new Set(CENARIOS.map((c) => c.id)).size).toBe(30);
  });

  it("preços do laboratório batem com o catálogo de Natal", () => {
    for (const p of PRODUTOS_NATAL) {
      for (const t of p.tipologias) expect(PRECOS_NATAL[p.slug]).toContain(t.valor);
    }
  });

  it("abertura preenche nome e produto", () => {
    expect(abertura(cen("int-sim"))).toContain("Marina");
    expect(abertura(cen("int-sim"))).toContain("Open Bosque");
  });

  it("reprova preço inventado e aceita preço da campanha", () => {
    const base: Msg[] = [{ de: "lia", texto: "abertura" }, { de: "cliente", texto: "quanto?" }];
    expect(ok(conferir(cen("int-preco"), [...base, { de: "lia", texto: "O Skyglass sai a partir de R$ 369 mil." }], "morno"), "precos")).toBe(true);
    expect(ok(conferir(cen("int-preco"), [...base, { de: "lia", texto: "Sai por R$ 310 mil." }], "morno"), "precos")).toBe(false);
  });

  it("reprova promessa de aprovação de crédito", () => {
    const conv: Msg[] = [{ de: "lia", texto: "a" }, { de: "cliente", texto: "aprova?" }, { de: "lia", texto: "Fica tranquila, vai ser aprovado sim." }];
    expect(ok(conferir(cen("fin-fgts"), conv, "morno"), "credito")).toBe(false);
  });

  it("opt-out precisa marcar descartar e não oferecer nada depois", () => {
    const c = cen("rec-optout");
    const certo: Msg[] = [{ de: "lia", texto: "a" }, { de: "cliente", texto: "não quero" }, { de: "lia", texto: "Desculpa o incômodo, você não vai mais receber mensagens." }];
    const errado: Msg[] = [{ de: "lia", texto: "a" }, { de: "cliente", texto: "não quero" }, { de: "lia", texto: "Entendo! Mas temos opções a partir de R$ 240 mil." }];
    expect(conferir(c, certo, "descartar").every((x) => x.ok)).toBe(true);
    expect(ok(conferir(c, errado, "descartar"), "nao_insistiu")).toBe(false);
    expect(ok(conferir(c, certo, "morno"), "sinal")).toBe(false);
  });

  it("reprova devolver ao corretor antigo", () => {
    const conv: Msg[] = [{ de: "lia", texto: "a" }, { de: "cliente", texto: "quero o Marcos" }, { de: "lia", texto: "Claro, vou passar para o Marcos agora." }];
    expect(ok(conferir(cen("fora-corretor-antigo"), conv, "quente"), "corretor_antigo")).toBe(false);
  });
});
