import { useOAAproveitados } from "@/hooks/useOfertaAtiva";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Copy, Loader2, User, Filter, Search } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";

export default function AproveitadosPanel() {
  const { aproveitados, isLoading, marcarCadastrado } = useOAAproveitados();
  const [jetimobIds, setJetimobIds] = useState<Record<string, string>>({});
  const [filterEmp, setFilterEmp] = useState("__all__");
  const [filterJetimob, setFilterJetimob] = useState("__all__");
  const [search, setSearch] = useState("");

  const empreendimentos = useMemo(() =>
    [...new Set(aproveitados.map(a => a.empreendimento).filter(Boolean))] as string[],
    [aproveitados]
  );

  const filtered = useMemo(() => {
    return aproveitados.filter(lead => {
      if (filterEmp !== "__all__" && lead.empreendimento !== filterEmp) return false;
      if (filterJetimob === "cadastrado" && !lead.cadastrado_jetimob) return false;
      if (filterJetimob === "pendente" && lead.cadastrado_jetimob) return false;
      if (search && !lead.nome.toLowerCase().includes(search.toLowerCase()) && !lead.telefone?.includes(search)) return false;
      return true;
    });
  }, [aproveitados, filterEmp, filterJetimob, search]);

  const copyResumo = (lead: typeof aproveitados[0]) => {
    const text = [
      `Nome: ${lead.nome}`,
      lead.telefone ? `Telefone: ${lead.telefone}` : "",
      lead.email ? `Email: ${lead.email}` : "",
      `Empreendimento: ${lead.empreendimento || "N/A"}`,
      lead.campanha ? `Campanha: ${lead.campanha}` : "",
      lead.origem ? `Origem: ${lead.origem}` : "",
      lead.observacoes ? `Obs: ${lead.observacoes}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Resumo copiado!");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (aproveitados.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum lead aproveitado ainda</p>
          <p className="text-sm mt-1">Leads com interesse aparecerão aqui para cadastro no Jetimob.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-emerald-500" />
        Leads Aproveitados ({filtered.length}{filtered.length !== aproveitados.length ? ` de ${aproveitados.length}` : ""})
      </h3>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="h-8 pl-8 text-xs" placeholder="Buscar por nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterEmp} onValueChange={setFilterEmp}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Empreendimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos empreendimentos</SelectItem>
            {empreendimentos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterJetimob} onValueChange={setFilterJetimob}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Status Jetimob" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="pendente">Pendente cadastro</SelectItem>
            <SelectItem value="cadastrado">Já cadastrado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.map(lead => (
        <Card key={lead.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <h4 className="font-semibold text-foreground">{lead.nome}</h4>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                    {lead.cadastrado_jetimob ? "Cadastrado" : "Aproveitado"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {lead.telefone && <p>📞 {lead.telefone}</p>}
                  {lead.email && <p>✉️ {lead.email}</p>}
                  <p>🏢 {lead.empreendimento} {lead.campanha ? `· ${lead.campanha}` : ""}</p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 shrink-0">
                <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => copyResumo(lead)}>
                  <Copy className="h-3 w-3" /> Copiar resumo
                </Button>
              </div>
            </div>

            {/* Jetimob registration */}
            {!lead.cadastrado_jetimob && (
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                <Input
                  className="h-8 text-xs flex-1"
                  placeholder="ID do lead no Jetimob (opcional)"
                  value={jetimobIds[lead.id] || ""}
                  onChange={e => setJetimobIds(prev => ({ ...prev, [lead.id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => marcarCadastrado(lead.id, jetimobIds[lead.id])}
                >
                  <CheckCircle className="h-3 w-3" /> Cadastrado no Jetimob
                </Button>
              </div>
            )}
            {lead.cadastrado_jetimob && (
              <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                Cadastrado no Jetimob {lead.jetimob_id && <span className="font-mono">(ID: {lead.jetimob_id})</span>}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">Nenhum resultado para os filtros selecionados.</div>
      )}
    </div>
  );
}