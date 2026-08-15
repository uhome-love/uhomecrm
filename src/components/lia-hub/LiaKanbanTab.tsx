import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRT } from "@/lib/brtTime";
import LiaConversaDrawer from "./LiaConversaDrawer";
import { origemDoReferral, useLiaEstados, useLiaFollowups, type LiaEstado } from "./useLiaHub";

type ColunaId =
  | "novo"
  | "em_conversa"
  | "interesse"
  | "apresentacao"
  | "followup"
  | "descartado"
  | "opt_out";

const COLUNAS: { id: ColunaId; titulo: string; cor: string }[] = [
  { id: "novo", titulo: "Novo", cor: "bg-primary" },
  { id: "em_conversa", titulo: "Em conversa", cor: "bg-warning" },
  { id: "interesse", titulo: "Interesse confirmado", cor: "bg-success" },
  { id: "apresentacao", titulo: "Apresentação agendada", cor: "bg-success" },
  { id: "followup", titulo: "Follow-up", cor: "bg-muted-foreground" },
  { id: "descartado", titulo: "Descartados", cor: "bg-muted-foreground" },
  { id: "opt_out", titulo: "Opt-out", cor: "bg-destructive" },
];

export default function LiaKanbanTab() {
  const { data: estados, isLoading } = useLiaEstados();
  const { data: followups } = useLiaFollowups();
  const [selecionado, setSelecionado] = useState<LiaEstado | null>(null);

  const colunas = useMemo(() => {
    const pendentes = new Set(
      (followups ?? []).filter((f) => f.status === "pendente" || f.status === "aprovado").map((f) => f.telefone)
    );
    const mapa: Record<ColunaId, LiaEstado[]> = {
      novo: [],
      em_conversa: [],
      interesse: [],
      apresentacao: [],
      followup: [],
      descartado: [],
      opt_out: [],
    };
    for (const e of estados ?? []) {
      if (e.status === "opt_out" || e.optout) mapa.opt_out.push(e);
      else if (e.status === "descartado") mapa.descartado.push(e);
      else if (e.status === "qualificado" && e.nivel === "quente") mapa.apresentacao.push(e);
      else if (e.status === "qualificado") mapa.interesse.push(e);
      else if (pendentes.has(e.telefone)) mapa.followup.push(e);
      else if (e.status === "em_conversa") mapa.em_conversa.push(e);
      else mapa.novo.push(e);
    }
    return mapa;
  }, [estados, followups]);

  if (isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUNAS.map((c) => {
          const itens = colunas[c.id];
          return (
            <div key={c.id} className="flex w-[264px] shrink-0 flex-col rounded-xl border border-border bg-muted/20">
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${c.cor}`} />
                  <span className="text-sm font-semibold text-foreground">{c.titulo}</span>
                </div>
                <Badge variant="secondary">{itens.length}</Badge>
              </div>
              <div className="max-h-[62vh] space-y-2 overflow-y-auto p-2">
                {itens.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">Vazio</p>
                ) : (
                  itens.slice(0, 60).map((e) => (
                    <Card
                      key={e.telefone}
                      onClick={() => setSelecionado(e)}
                      className="cursor-pointer p-3 transition-colors hover:border-primary/40"
                    >
                      <div className="truncate text-sm font-medium text-foreground">
                        {e.nome || "Sem nome"}
                      </div>
                      <div className="text-xs text-muted-foreground">{e.telefone}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {origemDoReferral(e.referral)}
                        </Badge>
                        {e.nivel === "quente" ? (
                          <Badge variant="outline" className="border-warning/20 bg-warning/10 text-[10px] text-warning">
                            🔥 Quente
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        {formatBRT(e.last_msg_em, "dd/MM HH:mm")}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <LiaConversaDrawer
        estado={selecionado}
        open={!!selecionado}
        onOpenChange={(v) => !v && setSelecionado(null)}
      />
    </>
  );
}
