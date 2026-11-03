import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Gift } from "lucide-react";
import { isCentralNatal } from "../config";

/** Botão "Materiais de Natal" que abre a página Campanha Natal 2026. */
export function AtalhoMateriais() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  if (!isCentralNatal() || pathname === "/campanha-natal") return null;
  return <Button size="sm" variant="outline" onClick={() => nav("/campanha-natal")}><Gift className="mr-1 h-4 w-4" />Materiais de Natal</Button>;
}
