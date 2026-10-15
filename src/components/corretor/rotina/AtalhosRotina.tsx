import { useNavigate } from "react-router-dom";
import { Phone, Users, ListChecks, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AtalhosRotina() {
  const navigate = useNavigate();
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
