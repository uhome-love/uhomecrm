import { useState, useMemo } from "react";
import { useOAListas, useOAFila, type OALista } from "@/hooks/useOfertaAtiva";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Phone, ArrowLeft, Loader2, Users, Search } from "lucide-react";
import DialingModeWithScript from "./DialingModeWithScript";
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
  const [search, setSearch] = useState("");

  const liberadas = listas.filter(l => l.status === "liberada");

  const filtered = useMemo(() => {
    if (!search.trim()) return liberadas;
    const q = search.toLowerCase();
    return liberadas.filter(l =>
      l.empreendimento.toLowerCase().includes(q) ||
      (l.campanha?.toLowerCase().includes(q)) ||
      l.nome.toLowerCase().includes(q)
    );
  }, [liberadas, search]);

  if (selectedLista) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setSelectedLista(null)}>
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar às listas
        </Button>
        <DialingModeWithScript lista={selectedLista} onBack={() => setSelectedLista(null)} />
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
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4" /> Escolha uma lista ({liberadas.length} liberadas)
        </h3>
      </div>
      {liberadas.length > 6 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por empreendimento ou campanha..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}
      {filtered.length === 0 && search && (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma lista encontrada para "{search}"</p>
      )}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(lista => (
          <ListaCard key={lista.id} lista={lista} onSelect={() => setSelectedLista(lista)} />
        ))}
      </div>
    </div>
  );
}
