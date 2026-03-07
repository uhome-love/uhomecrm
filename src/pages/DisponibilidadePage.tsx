import DisponibilidadeGerencialPanel from "@/components/disponibilidade/DisponibilidadeGerencialPanel";

export default function DisponibilidadePage() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Roleta de Leads
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualize a disponibilidade dos corretores e quem está na roleta
        </p>
      </div>
      <DisponibilidadeGerencialPanel />
    </div>
  );
}
