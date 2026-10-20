import { useNavigate } from "react-router-dom";
import { Phone, Users, ListChecks, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

const ATALHOS = [
  { label: "Oferta Ativa", path: "/corretor/call", icon: Phone },
  { label: "Clientes", path: "/pipeline-leads", icon: Users },
  { label: "Tarefas", path: "/tarefas", icon: ListChecks },
  { label: "Agenda", path: "/agenda-visitas", icon: CalendarDays },
];

export default function AtalhosRotina({ variante = "lista" }: { variante?: "lista" | "redondo" }) {
  const navigate = useNavigate();

  if (variante === "redondo") {
    return (
      <div className="grid grid-cols-4 gap-2">
        {ATALHOS.map(({ label, path, icon: Icon }) => (
          <button
            key={path}
            type="button"
            onClick={() => navigate(path)}
            className="flex flex-col items-center gap-1.5 transition-transform active:scale-90"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/30">
              <Icon className="h-6 w-6" />
            </span>
            <span className="text-xs font-medium text-foreground">{label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-bold text-foreground">Atalhos</h2>
      <div className="flex flex-col gap-2">
        <Button onClick={() => navigate("/corretor/call")} className="justify-start"><Phone className="mr-2 h-4 w-4" />Oferta Ativa</Button>
        <Button variant="outline" onClick={() => navigate("/pipeline-leads")} className="justify-start"><Users className="mr-2 h-4 w-4" />Meus clientes</Button>
        <Button variant="outline" onClick={() => navigate("/tarefas")} className="justify-start"><ListChecks className="mr-2 h-4 w-4" />Tarefas</Button>
        <Button variant="outline" onClick={() => navigate("/agenda-visitas")} className="justify-start"><CalendarDays className="mr-2 h-4 w-4" />Agenda</Button>
      </div>
    </section>
  );
}
