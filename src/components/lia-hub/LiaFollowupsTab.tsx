import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Clock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRT } from "@/lib/brtTime";
import { produtoLabel, useLiaEstados, useLiaFollowups, useLiaTemplates } from "./useLiaHub";

// Rótulo amigável da cadência: mostra QUAL toque (e o tempo) cada lead está recebendo.
// Régua: 1º contato na entrada → +24h → +48h → +72h → +96h (despedida).
const TOQUE_LABEL: Record<string, string> = {
  primeirocontato_lia: "1º contato",
  followup_novidade_lia: "Toque 1 · Novidade · 24h",
  followup_simulacao_lia: "Toque 2 · Simulação · 48h",
  followup_procurase_lia: "Toque 3 · Procura-se · 72h",
  followup_casatuacanoaslia: "Toque 3 · Reativação · 72h",
  followup_encerramento_lia: "Toque 4 · Despedida · 96h",
};
const toqueLabel = (key?: string | null) => (key ? TOQUE_LABEL[key] ?? key : "—");

export default function LiaFollowupsTab() {
  const qc = useQueryClient();
  const { data: followups, isLoading } = useLiaFollowups();
  const { data: templates } = useLiaTemplates();
  const { data: estados } = useLiaEstados();
  const [emAcao, setEmAcao] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [filtroProduto, setFiltroProduto] = useState<string>("todos");

  const nomePorTelefone = useMemo(() => {
    const m = new Map<string, string>();
    (estados ?? []).forEach((e) => m.set(e.telefone, e.nome || "Sem nome"));
    return m;
  }, [estados]);

  const produtoPorTelefone = useMemo(() => {
    const m = new Map<string, string | null>();
    (estados ?? []).forEach((e) => m.set(e.telefone, e.produto_slug));
    return m;
  }, [estados]);

  const produtos = useMemo(() => {
    const set = new Set<string>();
    (estados ?? []).forEach((e) => e.produto_slug && set.add(e.produto_slug));
    return Array.from(set).sort();
  }, [estados]);

  const passaProduto = (tel: string | null) =>
    filtroProduto === "todos" || (produtoPorTelefone.get(tel ?? "") ?? "") === filtroProduto;

  // "agendados" = próximos toques automáticos (aprovado, ainda não enviado). Sem trava manual:
  // aparecem aqui só para acompanhamento e para você poder PAUSAR (cancelar) se quiser.
  const agendados = useMemo(
    () =>
      (followups ?? []).filter(
        (f) => (f.status === "aprovado" || f.status === "pendente") && !f.enviado_em && passaProduto(f.telefone)
      ),
    [followups, filtroProduto, produtoPorTelefone]
  );
  const recentes = useMemo(
    () =>
      (followups ?? [])
        .filter((f) => (f.enviado_em || f.status === "enviado" || f.status === "cancelado") && passaProduto(f.telefone))
        .slice(0, 30),
    [followups, filtroProduto, produtoPorTelefone]
  );

  const decidir = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "aprovado" | "cancelado" }) => {
      const { error } = await supabase.from("lia_followups").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: ({ id }) => setEmAcao(id),
    onSettled: () => setEmAcao(null),
    onSuccess: (_d, v) => {
      toast.success(v.status === "aprovado" ? "Follow-up aprovado" : "Follow-up cancelado");
      qc.invalidateQueries({ queryKey: ["lia-hub", "followups"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar"),
  });

  const salvarTexto = useMutation({
    mutationFn: async ({ id, mensagem }: { id: string; mensagem: string }) => {
      const { error } = await supabase.from("lia_followups").update({ mensagem }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mensagem atualizada");
      setEditandoId(null);
      qc.invalidateQueries({ queryKey: ["lia-hub", "followups"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar"),
  });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadência automática de follow-up</CardTitle>
          <CardDescription>
            A LIA cutuca sozinha quem esfriou, com os templates aprovados, em horário comercial (9h-20h).
            Ela para na hora se o lead responder, qualificar ou pedir pra sair. Aqui você acompanha e pode pausar um toque.
          </CardDescription>
          {produtos.length > 1 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Próximos toques agendados (envio automático)</p>
          {isLoading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : agendados.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum toque agendado agora.
            </p>
          ) : (
            agendados.map((f) => (
              <div key={f.id} className="rounded-xl border border-border p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {nomePorTelefone.get(f.telefone ?? "") ?? f.telefone}
                    </div>
                    <div className="text-xs text-muted-foreground">{f.telefone}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {produtoPorTelefone.get(f.telefone ?? "") ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {produtoLabel(produtoPorTelefone.get(f.telefone ?? ""))}
                      </Badge>
                    ) : null}
                    {f.template_key ? <Badge variant="outline">{toqueLabel(f.template_key)}</Badge> : null}
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm text-foreground">
                  {f.mensagem}
                </p>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {f.motivo ? `${f.motivo} · ` : ""}
                    {f.agendado_para ? `agendado ${formatBRT(f.agendado_para, "dd/MM HH:mm")}` : "envia na próxima rodada"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={emAcao === f.id}
                    onClick={() => decidir.mutate({ id: f.id, status: "cancelado" })}
                    className="w-full gap-1.5 sm:w-auto"
                  >
                    <X className="h-3.5 w-3.5" /> Pausar este toque
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Templates ativos</CardTitle>
            <CardDescription>Somente leitura.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(templates ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum template ativo.</p>
            ) : (
              (templates ?? []).map((t) => (
                <div key={t.key} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{t.nome || t.key}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {t.dentro_24h ? "24h" : "HSM"}
                    </Badge>
                  </div>
                  {t.descricao ? (
                    <p className="mt-1 text-xs text-muted-foreground">{t.descricao}</p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
                    {t.corpo}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico recente</CardTitle>
            <CardDescription>Últimos follow-ups decididos ou enviados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sem histórico.</p>
            ) : (
              recentes.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-foreground">
                      {nomePorTelefone.get(f.telefone ?? "") ?? f.telefone}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {toqueLabel(f.template_key)} · {formatBRT(f.enviado_em ?? f.created_at, "dd/MM HH:mm")}
                    </div>
                  </div>
                  <Badge variant="secondary">{f.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
