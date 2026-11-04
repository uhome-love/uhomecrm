import type { AppRole } from "@/hooks/useUserRole";

/** Presentation context only; never determines authorization or query scope. */
export function teamPresentationContext(roles: readonly AppRole[]): "company" | "team" {
  return roles.includes("admin") || roles.includes("diretor") ? "company" : "team";
}

export function tabPresentationLabel(key: string, fallback: string, roles: readonly AppRole[]): string {
  if (key !== "meu-time" || roles.length === 0) return fallback;
  return teamPresentationContext(roles) === "team" ? "Meu time" : "Usuários";
}