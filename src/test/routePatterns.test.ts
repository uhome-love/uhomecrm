import { describe, it, expect } from "vitest";
import { matchRoutePattern, isPublicRoute, ROUTE_PATTERNS } from "@/lib/routePatterns";

describe("routePatterns", () => {
  it("matches static routes exactly", () => {
    expect(matchRoutePattern("/")).toBe("/");
    expect(matchRoutePattern("/pipeline")).toBe("/pipeline");
    expect(matchRoutePattern("/admin/ingestao")).toBe("/admin/ingestao");
  });

  it("matches dynamic routes with :param", () => {
    expect(matchRoutePattern("/imovel/abc-123-def")).toBe("/imovel/:codigo");
    expect(matchRoutePattern("/visita/token-xyz")).toBe("/visita/:token");
    expect(matchRoutePattern("/academia/trilha/uuid-1")).toBe("/academia/trilha/:trilhaId");
  });

  it("strips query string and hash", () => {
    expect(matchRoutePattern("/pipeline?tab=x#sec")).toBe("/pipeline");
  });

  it("returns /_unknown for unmapped routes", () => {
    expect(matchRoutePattern("/rota-que-nao-existe")).toBe("/_unknown");
  });

  it("identifies public routes", () => {
    expect(isPublicRoute("/auth")).toBe(true);
    expect(isPublicRoute("/pipeline")).toBe(false);
  });

  it("has a reasonable amount of patterns", () => {
    // sanity: pageRegistry tem ~80 + dynamic + public
    expect(ROUTE_PATTERNS.length).toBeGreaterThan(80);
    expect(ROUTE_PATTERNS.length).toBeLessThan(150);
  });
});
