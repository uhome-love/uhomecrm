import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRT } from "@/lib/brtTime";
import LiaConversaDrawer from "./LiaConversaDrawer";
import LiaLeadAcoesMenu from "./LiaLeadAcoesMenu";
import { NIVEL_META, origemDoReferral, produtoLabel, useLiaEstados, type LiaEstado } from "./useLiaHub";

// Kanban pela SITUAÇÃO do lead no pré-atendimento (não por temperatura): reflete onde ele está
// no fluxo da LIA, do primeiro oi até o repasse. Descartado/Opt-out ficam no fim, fora do fluxo ativo.
type ColunaId =
  | "novo"
  | "sem_contato"
  | "atendimento"
  | "qualificacao"
  | "followup"
  | "qualificado"
  | "descartado"
  | "opt_out";

const COLUNAS: { id: ColunaId; titulo: string; cor: string }[] = [
  { id: "novo", titulo: "Novo", cor: "bg-primary" },
  { id: "sem_contato", titulo: "Sem contato", cor: "bg-muted-foreground" },
  { id: "atendimento", titulo: "Atendimento inicial", cor: "bg-sky-500" },
  { id: "qualificacao", titulo: "Qualificação", cor: "bg-warning" },
  { id: "followup", titulo: "Follow-up", cor: "bg-violet-500" },
  { id: "qualificado", titulo: "Qualificado", cor: "bg-success" },
  { id: "descartado", titulo: "Descartados", cor: "bg-muted-foreground/50" },
  { id: "opt_out", titulo: "Opt-out", cor: "bg-destructive" },
];

export default function LiaKanbanTab() {
  const { data: estados, isLoading } = useLiaEstados();
  const [selecionado, setSelecionado] = useState<LiaEstado | null>(null);
  const [filtroProduto, setFiltroProduto] = useState<string>("todos");
  const qc = useQueryClient();

  // produtos presentes na base (pra montar os botões de filtro)
  const produtos = useMemo(() => {
    const set = new Set<string>();
    for (const e of estados ?? []) if (e.produto_slug) set.add(e.produto_slug);
    return Array.from(set).sort();
  }, [estados]);

  const filtrados = useMemo(
    () =>
      filtroProduto === "todos"
        ? (estados ?? [])
        : (estados ?? []).filter((e) => (e.produto_slug ?? "") === filtroProduto),
    [estados, filtroProduto]
  );

  const retomar = useMutation({
    mutationFn: async (telefone: string) => {
      const { error } = await supabase
        .from("lia_estado")
        .update({ status: "em_conversa", descartado_em: null, motivo: null })
        .eq("telefone", telefone);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead retomado");
      qc.invalidateQueries({ queryKey: ["lia-hub", "estados"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível retomar"),
  });

  const colunas = useMemo(() => {
    const mapa: Record<ColunaId, LiaEstado[]> = {
      novo: [],
      sem_contato: [],
      atendimento: [],
      qualificacao: [],
      followup: [],
      qualificado: [],
      descartado: [],
      opt_out: [],
    };
    for (const e of filtrados) {
      const respondeu = !!e.last_user_at;                  // o lead já mandou alguma mensagem?
      const emCadencia = (e.followup_count ?? 0) > 0;       // já entrou na cadência de follow-up?
      const cutucado = !!e.reengajado_em;                   // já levou o cutucão proativo?
      const temTemperatura = !!String(e.nivel ?? "").toLowerCase();

      if (e.status === "opt_out" || e.optout) mapa.opt_out.push(e);
      else if (e.status === "descartado") mapa.descartado.push(e);
      else if (e.status === "qualificado") mapa.qualificado.push(e);
      else if (!respondeu) {
        // nunca respondeu: recém-chegado é "Novo"; se já levou toque/cutucão e segue mudo, é "Sem contato"
        if (emCadencia || cutucado) mapa.sem_contato.push(e);
        else mapa.novo.push(e);
      } else {
        // respondeu (em conversa): esfriou na cadência = Follow-up; com temperatura lida = Qualificação;
        // senão ainda é Atendimento inicial
        if (emCadencia) mapa.followup.push(e);
        else if (temTemperatura) mapa.qualificacao.push(e);
        else mapa.atendimento.push(e);
      }
    }
    return mapa;
  }, [filtrados]);

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
      {produtos.length > 1 ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Imóvel:</span>
          <Button
            size="sm"
            variant={filtroProduto === "todos" ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setFiltroProduto("todos")}
          >
            Todos
          </Button>
          {produtos.map((slug) => (
            <Button
              key={slug}
              size="sm"
              variant={filtroProduto === slug ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setFiltroProduto(slug)}
            >
              {produtoLabel(slug)}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:snap-none sm:px-0">
        {COLUNAS.map((c) => {
          const itens = colunas[c.id];
          return (
            <div
              key={c.id}
              className="flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl border border-border bg-muted/20 sm:w-[264px] sm:max-w-none sm:snap-align-none"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${c.cor}`} />
                  <span className="text-sm font-semibold text-foreground">{c.titulo}</span>
                </div>
                <Badge variant="secondary">{itens.length}</Badge>
              </div>
              <div className="max-h-[55vh] space-y-2 overflow-y-auto p-2 sm:max-h-[62vh]">
                {itens.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">Vazio</p>
                ) : (
                  itens.slice(0, 60).map((e) => (
                    <Card
                      key={e.telefone}
                      onClick={() => setSelecionado(e)}
                      className="cursor-pointer p-3 transition-colors hover:border-primary/40"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {e.nome || "Sem nome"}
                          </div>
                          <div className="text-xs text-muted-foreground">{e.telefone}</div>
                        </div>
                        <LiaLeadAcoesMenu estado={e} className="-mr-1 -mt-1 shrink-0" />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {e.produto_slug ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {produtoLabel(e.produto_slug)}
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="text-[10px]">
                          {origemDoReferral(e.referral)}
                        </Badge>
                        {NIVEL_META[String(e.nivel ?? "").toLowerCase()] ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${NIVEL_META[String(e.nivel).toLowerCase()].cls}`}
                          >
                            {NIVEL_META[String(e.nivel).toLowerCase()].emoji}{" "}
                            {NIVEL_META[String(e.nivel).toLowerCase()].label}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        {formatBRT(e.last_msg_em, "dd/MM HH:mm")}
                      </div>
                      {c.id === "descartado" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7 w-full gap-1.5 text-xs"
                          disabled={retomar.isPending && retomar.variables === e.telefone}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            retomar.mutate(e.telefone);
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Retomar
                        </Button>
                      ) : null}
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
