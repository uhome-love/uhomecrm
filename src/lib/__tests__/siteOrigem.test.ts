
describe("lerSiteOrigem — dados extras do site", () => {
  const real = { fonte: "Google Ads — Natal", gclid: "teste", device: "mobile", contexto: { rastreamento: { fonte: "Google Ads — Natal", numero_visitas: 2 } }, referrer: "", formulario: "Pop-up de saída", pagina_url: "https://uhome.com.br/busca?x=1", utm_source: "google", landing_url: "https://uhome.com.br/?gclid=teste", utm_campaign: "Natal", origem_componente: "exit_intent" };
  it("usa a fonte pronta do site, visitas e página de entrada", () => {
    const r = lerSiteOrigem(real);
    expect(r.fonteTexto).toBe("Google Ads — Natal");
    expect(r.visitas).toBe("2 visitas");
    expect(r.entrouPor).toBe("uhome.com.br (página inicial)");
    expect(r.clienteVoltou).toBe(true);
  });
  it("acesso direto quando não vem fonte", () => {
    expect(lerSiteOrigem({ referrer: "" }).fonteTexto).toBe("Acesso direto");
  });
  it("lê imóveis vistos, favoritos e LIA", () => {
    const r = lerSiteOrigem({ contexto: { rastreamento: { imoveis_vistos: [{ titulo: "A" }, "B"], favoritos: ["C"], conversou_lia: true, utm_term: "apto poa" } } });
    expect(r.imoveisVistos).toEqual(["A", "B"]);
    expect(r.favoritos).toEqual(["C"]);
    expect(r.conversouLia).toBe(true);
    expect(r.palavraPesquisada).toBe("apto poa");
  });
});
