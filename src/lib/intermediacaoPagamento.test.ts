import { describe, it, expect } from "vitest";
import { calcularRepasse, construtoraDoEmpreendimento } from "./intermediacaoPagamento";

const credores = [
  { nome: "Corretor", total: 8000 },
  { nome: "Gerente", total: 2000 },
  { nome: "Diretoria", total: 2000 },
  { nome: "Uhome", total: 8000 },
];

describe("forma de pagamento da intermediação", () => {
  it("desconto NF conserva o total em divisões com centavos",()=>{const r=calcularRepasse(Array.from({length:7},(_,j)=>({nome:`Pessoa ${j}`,total:1.05})),"nota_fiscal");expect(r.bruto).toBe(7.35);expect(r.desconto).toBe(0.74);expect(r.liquido).toBe(6.61);});
  it("nota fiscal desconta 10% do bruto de todos", () => {
    const r = calcularRepasse(credores, "nota_fiscal");
    expect(r.bruto).toBe(20000);
    expect(r.desconto).toBe(2000);
    expect(r.liquido).toBe(18000);
    expect(r.linhas[0].liquido).toBe(7200);
  });

  it("PIX e Zemo não têm desconto", () => {
    expect(calcularRepasse(credores, "pix").desconto).toBe(0);
    expect(calcularRepasse(credores, "zemo").liquido).toBe(20000);
  });

  it("construtoras oficiais", () => {
    expect(construtoraDoEmpreendimento("Connect João Wallig")).toBe("Cyrela");
    expect(construtoraDoEmpreendimento("Casa Tua Canoas")).toBe("Encorp");
    expect(construtoraDoEmpreendimento("Lake Victoria")).toBe("Multiplan");
    expect(construtoraDoEmpreendimento("Átrio")).toBe("ABF");
  });
});
