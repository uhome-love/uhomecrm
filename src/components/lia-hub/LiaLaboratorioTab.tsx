import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FlaskConical, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CENARIOS } from "../../../supabase/functions/_shared/liaLaboratorio";
import LiaCenarioCard, { type Execucao } from "./LiaCenarioCard";

export default function LiaLaboratorioTab() {
  const qc = useQueryClient();
  const [rodando, setRodando] = useState<string | null>(null);

  const { data: execs = [] } = useQuery({
    queryKey: ["lia-lab-execucoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lia_laboratorio_execucoes").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as Execucao[];
    },
  });

  const ultima = new Map<string, Execucao>();
  for (const e of execs) if (!ultima.has(e.cenario_id)) ultima.set(e.cenario_id, e);
  const aprovados = CENARIOS.filter((c) => ultima.get(c.id)?.avaliacao === "ok").length;
  const ajustar = CENARIOS.filter((c) => ultima.get(c.id)?.avaliacao === "ajustar").length;

  const rodar = async (id: string) => {
    setRodando(id);
    const { data, error } = await supabase.functions.invoke("lia-laboratorio", { body: { cenario_id: id } });
    setRodando(null);
    if (error || data?.error) { toast.error(`Não consegui rodar o cenário: ${data?.error ?? error?.message}`); return false; }
    await qc.invalidateQueries({ queryKey: ["lia-lab-execucoes"] });
    return true;
  };

  const rodarTodos = async () => {
    for (const c of CENARIOS) {
      if (ultima.get(c.id)?.avaliacao === "ok") continue;
      const ok = await rodar(c.id);
      if (!ok) break;
    }
  };

  const avaliar = async (e: Execucao, avaliacao: "ok" | "ajustar", comentario?: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("lia_laboratorio_execucoes")
      .update({ avaliacao, comentario: comentario ?? null, avaliado_por: u.user?.id ?? null, avaliado_em: new Date().toISOString() })
      .eq("id", e.id);
    if (error) { toast.error("Não consegui salvar a avaliação."); return; }
    qc.invalidateQueries({ queryKey: ["lia-lab-execucoes"] });
  };

  const grupos = [...new Set(CENARIOS.map((c) => c.grupo))];

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <FlaskConical className="h-6 w-6 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Validação da recuperação</p>
            <p className="text-xs text-muted-foreground">Conversas simuladas com clientes fictícios. Nenhuma mensagem é enviada. O piloto só liga com 100% aprovado.</p>
            <Progress value={(aprovados / CENARIOS.length) * 100} className="mt-2 h-1.5" />
            <p className="mt-1 text-[11px] text-muted-foreground">{aprovados} de {CENARIOS.length} aprovados{ajustar ? ` · ${ajustar} para ajustar` : ""}</p>
          </div>
          <Button size="sm" onClick={rodarTodos} disabled={!!rodando}>
            {rodando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
            {rodando ? "Rodando…" : "Rodar os testes pendentes"}
          </Button>
          <Button asChild size="sm" variant="outline"><Link to="/lia-teste">Conversa livre</Link></Button>
        </CardContent>
      </Card>

      {grupos.map((g) => (
        <div key={g} className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">{g}</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {CENARIOS.filter((c) => c.grupo === g).map((c) => (
              <LiaCenarioCard key={c.id} cenario={c} execucao={ultima.get(c.id)} rodando={rodando === c.id}
                bloqueado={!!rodando} onRodar={() => rodar(c.id)} onAvaliar={avaliar} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
