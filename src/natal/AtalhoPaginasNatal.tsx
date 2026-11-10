import { Link } from "react-router-dom";
import { Gift, ChevronRight } from "lucide-react";
import { isCentralNatal } from "./config";

/** Atalho do painel do corretor para "Minhas páginas de Natal". */
export function AtalhoPaginasNatal() {
  if (!isCentralNatal()) return null;
  return (
    <Link to="/campanha-natal?aba=paginas" className="natal-noite natal-borda-ouro flex items-center gap-3 rounded-2xl px-4 py-3 transition-opacity hover:opacity-95">
      <Gift className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Minhas páginas de Natal</p>
        <p className="truncate text-xs opacity-80">Envie ao cliente sua página e os empreendimentos, já com o seu nome</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}
