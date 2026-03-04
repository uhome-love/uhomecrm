import { useOAAproveitados } from "@/hooks/useOfertaAtiva";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle, Copy, ExternalLink, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function AproveitadosPanel() {
  const { aproveitados, isLoading, marcarCadastrado } = useOAAproveitados();
  const [jetimobIds, setJetimobIds] = useState<Record<string, string>>({});

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
        Leads Aproveitados ({aproveitados.length})
      </h3>

      {aproveitados.map(lead => (
        <Card key={lead.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <h4 className="font-semibold text-foreground">{lead.nome}</h4>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                    Aproveitado
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
