import { useState } from "react";
import { useOAListas, useOAFila, type OALista } from "@/hooks/useOfertaAtiva";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, ArrowLeft, Loader2, Users } from "lucide-react";
import DialingMode from "./DialingMode";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function ListaCard({ lista, onSelect }: { lista: OALista; onSelect: () => void }) {
  const { data: stats } = useQuery({
    queryKey: ["oa-lista-fila-count", lista.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { count } = await supabase
        .from("oferta_ativa_leads")
        .select("id", { count: "exact", head: true })
        .eq("lista_id", lista.id)
        .eq("status", "na_fila")
        .or(`proxima_tentativa_apos.is.null,proxima_tentativa_apos.lt.${now}`);
      return count || 0;
    },
    staleTime: 15000,
  });

  return (
    <Card
      className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
      onClick={onSelect}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-foreground text-lg group-hover:text-primary transition-colors">
              {lista.empreendimento}
            </h3>
            {lista.campanha && <p className="text-xs text-muted-foreground">{lista.campanha}</p>}
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
            Liberada
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{stats ?? "..."}</p>
              <p className="text-[10px] text-muted-foreground">na fila</p>
            </div>
          </div>
          <Button size="sm" className="gap-1.5">
            <Phone className="h-3.5 w-3.5" /> Começar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CorretorListSelection() {
  const { listas, isLoading } = useOAListas();
  const [selectedLista, setSelectedLista] = useState<OALista | null>(null);

  const liberadas = listas.filter(l => l.status === "liberada");

  if (selectedLista) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setSelectedLista(null)}>
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar às listas
        </Button>
        <DialingMode lista={selectedLista} onBack={() => setSelectedLista(null)} />
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (liberadas.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Phone className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhuma lista liberada</p>
          <p className="text-sm mt-1">Aguarde o Admin liberar uma campanha para começar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Users className="h-4 w-4" /> Escolha uma lista para trabalhar
      </h3>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {liberadas.map(lista => (
          <ListaCard key={lista.id} lista={lista} onSelect={() => setSelectedLista(lista)} />
        ))}
      </div>
    </div>
  );
}
