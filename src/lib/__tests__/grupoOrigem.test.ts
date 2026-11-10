import { describe, it, expect } from "vitest";
import { grupoOrigem } from "../leadOrigemUtils";
describe("grupoOrigem", () => {
  it("junta variações do Meta", () => {
    for (const o of ["ig","fb","meta_ads","meta_backfill","Facebook Leads Ads","FacebookAds","Network"]) expect(grupoOrigem(o)).toBe("Meta");
  });
  it("TikTok", () => { expect(grupoOrigem("TikTok Ads")).toBe("TikTok"); expect(grupoOrigem("tiktok_ads")).toBe("TikTok"); });
  it("Reengajamento", () => { expect(grupoOrigem("Reengajamento (Nutrição)")).toBe("Reengajamento"); expect(grupoOrigem("Nutrição - Campanha Casa Tua (Maio/2026)")).toBe("Reengajamento"); });
  it("outros", () => { expect(grupoOrigem("Oferta Ativa")).toBe("Oferta Ativa"); expect(grupoOrigem("LIA")).toBe("Lia"); expect(grupoOrigem("site_uhome")).toBe("Site"); expect(grupoOrigem("indicacao")).toBe("Indicação"); expect(grupoOrigem(null)).toBe("Outros"); expect(grupoOrigem("RGI")).toBe("Outros"); });
});
