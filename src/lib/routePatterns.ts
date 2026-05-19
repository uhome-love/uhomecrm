// Toda rota nova entra automaticamente via pageRegistry.
// Rotas públicas (sem tracking): editar PUBLIC_ROUTES abaixo.

import { ROUTE_TO_TAB } from "@/config/pageRegistry";

export const PUBLIC_ROUTES: string[] = [
  "/auth",
  "/welcome",
  "/privacidade",
  "/casatua",
  "/oauth/google/callback",
  "/wa",
  "/wa/*",
  "/placar-do-dia",
  "/diagnostico-rede",
  "/visita/:token",
  "/indica/:codigo",
  "/vitrine/:id",
  "/imovel/:codigo",
];

// Dinâmicas registradas em pageRegistry.DYNAMIC_PATTERNS + rotas extras conhecidas no App.tsx
const DYNAMIC_PATTERNS: string[] = [
  "/academia/trilha/:trilhaId",
  "/academia/aula/:aulaId",
  "/ceo/telemetria-rede",
];

const REDIRECT_ALIASES: string[] = [
  "/fechamento-day",
  "/gestao",
  "/index",
  "/index.html",
  "/links-site",
];

export const ROUTE_PATTERNS: string[] = Array.from(
  new Set<string>([
    ...Object.keys(ROUTE_TO_TAB),
    ...DYNAMIC_PATTERNS,
    ...REDIRECT_ALIASES,
    ...PUBLIC_ROUTES,
  ])
);

// Ordena por especificidade: mais segmentos primeiro; menos params dinâmicos primeiro
const SORTED_PATTERNS = [...ROUTE_PATTERNS].sort((a, b) => {
  const segDiff = b.split("/").length - a.split("/").length;
  if (segDiff !== 0) return segDiff;
  const aParams = (a.match(/:/g) ?? []).length;
  const bParams = (b.match(/:/g) ?? []).length;
  return aParams - bParams;
});

export function matchRoutePattern(path: string): string {
  // Normaliza: remove trailing slash (exceto raiz) e query/hash
  const clean = (path.split("?")[0].split("#")[0] || "/").replace(/\/+$/, "") || "/";
  for (const pattern of SORTED_PATTERNS) {
    const regex = "^" + pattern.replace(/\*/g, ".*").replace(/:[^/]+/g, "[^/]+") + "$";
    if (new RegExp(regex).test(clean)) return pattern;
  }
  return "/_unknown";
}

export function isPublicRoute(pattern: string): boolean {
  return PUBLIC_ROUTES.includes(pattern);
}
