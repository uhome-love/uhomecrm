import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";

const ORIGENS_CAMPANHA = ["ig", "fb", "instagram", "facebook", "meta", "meta_backfill", "landing", "landing_page", "anuncio"];

type Pendencia = { texto: string; total: number };
type Empreendimento = { id: string; nome: string };

/**
 * Lista textos de empreendimento vindos de campanhas pagas que o sistema
 * não conseguiu resolver para um empreendimento canônico. Enquanto não
 * houver apelido cadastrado, esses leads param na Fila do CEO.
 */
export function ProdutosNaoIdentificadosCard() {
  const [loading, setLoading] = useState(true);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [empreendimentos, setEmpreendimentos] = useState<Empreendimento[]>([]);
  const [selecao, setSelecao] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: leads }, { data: emps }] = await Promise.all([
      supabase
        .from("pipeline_leads")
        .select("empreendimento, origem")
        .is("empreendimento_canonico_id", null)
        .not("empreendimento", "is", null)
        .gte("created_at", desde)
        .limit(1000),
      supabase
        .from("empreendimentos_canonicos")
        .select("id, nome")
        .order("nome"),
    ]);

    const mapa = new Map<string, number>();
    (leads || []).forEach((l: any) => {
      const texto = (l.empreendimento || "").trim();
      const origem = (l.origem || "").toLowerCase().trim();
      const ehCampanha =
        ORIGENS_CAMPANHA.includes(origem) ||
        origem.includes("instagram") ||
        origem.includes("facebook") ||
        origem.includes("meta") ||
        origem.includes("landing");
      if (!texto || !ehCampanha) return;
      mapa.set(texto, (mapa.get(texto) || 0) + 1);
    });

    setPendencias(
      Array.from(mapa.entries())
        .map(([texto, total]) => ({ texto, total }))
        .sort((a, b) => b.total - a.total)
    );
    setEmpreendimentos((emps as Empreendimento[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const vincular = async (texto: string) => {
    const empId = selecao[texto];
    if (!empId) return;
    setSalvando(texto);
    const { error } = await supabase.rpc("vincular_alias_com_backfill", {
      p_texto: texto,
      p_tipo: "campanha",
      p_empreendimento_id: empId,
    });
    setSalvando(null);
    if (error) {
      toast.error("Não foi possível vincular", { description: error.message });
      return;
    }
    toast.success(`"${texto}" vinculado — leads atualizados`);
    carregar();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Verificando anúncios sem produto cadastrado...
        </CardContent>
      </Card>
    );
  }

  if (pendencias.length === 0) return null;

  return (
    <Card className="border-amber-500/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Anúncios sem produto cadastrado
          <Badge variant="secondary">{pendencias.length}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Leads de campanha com esse texto não são distribuídos por foco — ficam na Fila do CEO até o
          apelido ser vinculado a um empreendimento.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {pendencias.map((p) => (
          <div
            key={p.texto}
            className="flex flex-col md:flex-row md:items-center gap-2 rounded-md border border-border/60 px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-sm font-medium truncate">{p.texto}</span>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {p.total} {p.total === 1 ? "lead" : "leads"} / 30d
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={selecao[p.texto] || ""}
                onValueChange={(v) => setSelecao((s) => ({ ...s, [p.texto]: v }))}
              >
                <SelectTrigger className="h-8 w-[220px] text-xs">
                  <SelectValue placeholder="Vincular ao empreendimento" />
                </SelectTrigger>
                <SelectContent>
                  {empreendimentos.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 gap-1.5"
                disabled={!selecao[p.texto] || salvando === p.texto}
                onClick={() => vincular(p.texto)}
              >
                {salvando === p.texto ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                Vincular
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
