import { Gift } from "lucide-react";
import type { ReactNode } from "react";
import { isCentralNatal } from "../config";
import "../natal.css";

interface Item { label: string; path: string; icon: ReactNode; badge?: string | number }
interface Grupo { title: string; items: Item[] }

/** Põe "Campanha Natal 2026" no grupo Principal (logo após o 1º item) durante a campanha. RH não vê. */
export function withNatalMenu<G extends Grupo>(grupos: G[], role: string): G[] {
  if (role === "rh" || !isCentralNatal()) return grupos;
  return grupos.map((g) => {
    if (g.title !== "Principal" || g.items.some((i) => i.path === "/campanha-natal")) return g;
    const item: Item = { label: "Campanha Natal 2026", path: "/campanha-natal", icon: <Gift size={15} strokeWidth={1.5} />, badge: "Natal" };
    return { ...g, items: [g.items[0], item, ...g.items.slice(1)].filter(Boolean) };
  });
}
