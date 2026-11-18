import { describe, expect, it } from "vitest";
import { lerNotasPedidoSite } from "./sitePedidoNotas";

describe("notas dos pedidos antes do cartão", () => {
  it("um registro por id do pedido", () => {
    const id = "a0000000-0000-4000-8000-000000000001";
    const r = lerNotasPedidoSite({ _pedidos_notas: { [id]: { titulo: "Visita", descricao: null } } });
    expect(r.map(n => n.id)).toEqual([id]);
  });
  it("sem dados de nota retorna vazio", () => {
    expect(lerNotasPedidoSite({ jornada: {}, pedidos: [] })).toEqual([]);
  });
  it("ignora entradas sem registro válido", () => {
    expect(lerNotasPedidoSite({ _pedidos_notas: { invalido: null, vazio: {} } })).toEqual([]);
  });
});