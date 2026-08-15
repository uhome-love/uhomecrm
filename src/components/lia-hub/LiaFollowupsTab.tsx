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
import { useLiaEstados, useLiaFollowups, useLiaTemplates } from "./useLiaHub";

export default function LiaFollowupsTab() {
  const qc = useQueryClient();
  const { data: followups, isLoading } = useLiaFollowups();
  const { data: templates } = useLiaTemplates();
  const { data: estados } = useLiaEstados();
  const [emAcao, setEmAcao] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");

  const nomePorTelefone = useMemo(() => {
    const m = new Map<string, string>();
    (estados ?? []).forEach((e) => m.set(e.telefone, e.nome || "Sem nome"));
    return m;
  }, [estados]);

  const pendentes = useMemo(
    () => (followups ?? []).filter((f) => f.status === "pendente"),
    [followups]
  );
  const recentes = useMemo(
    () => (followups ?? []).filter((f) => f.status !== "pendente").slice(0, 20),
    [followups]
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
          <CardTitle className="text-base">Follow-ups aguardando aprovação</CardTitle>
          <CardDescription>
            Nada sai no WhatsApp sem a sua aprovação manual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : pendentes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum follow-up pendente.
            </p>
          ) : (
            pendentes.map((f) => (
              <div key={f.id} className="rounded-xl border border-border p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {nomePorTelefone.get(f.telefone ?? "") ?? f.telefone}
                    </div>
                    <div className="text-xs text-muted-foreground">{f.telefone}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {f.template_key ? <Badge variant="secondary">{f.template_key}</Badge> : null}
                    <Badge
                      variant="outline"
                      className={
                        f.dentro_24h
                          ? "border-success/20 bg-success/10 text-success"
                          : "border-warning/20 bg-warning/10 text-warning"
                      }
                    >
                      {f.dentro_24h ? "Dentro de 24h" : "Fora de 24h"}
                    </Badge>
                    <Badge variant="secondary">Tentativa {f.tentativa ?? 1}</Badge>
                  </div>
                </div>

                {editandoId === f.id ? (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={rascunho}
                      onChange={(e) => setRascunho(e.target.value)}
                      rows={6}
                      className="text-base sm:text-sm"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditandoId(null)}
                        disabled={salvarTexto.isPending}
                        className="w-full sm:w-auto"
                      >
                        Cancelar edição
                      </Button>
                      <Button
                        size="sm"
                        disabled={salvarTexto.isPending || !rascunho.trim()}
                        onClick={() => salvarTexto.mutate({ id: f.id, mensagem: rascunho })}
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm text-foreground">
                    {f.mensagem}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {f.motivo ? `${f.motivo} · ` : ""}
                    agendado {formatBRT(f.agendado_para, "dd/MM HH:mm")}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={editandoId === f.id}
                      onClick={() => {
                        setRascunho(f.mensagem ?? "");
                        setEditandoId(f.id);
                      }}
                      className="gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar texto
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={emAcao === f.id}
                      onClick={() => decidir.mutate({ id: f.id, status: "cancelado" })}
                      className="gap-1.5"
                    >
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </Button>
                    <Button
                      size="sm"
                      disabled={emAcao === f.id}
                      onClick={() => decidir.mutate({ id: f.id, status: "aprovado" })}
                      className="gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" /> Aprovar
                    </Button>
                  </div>
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
                      {f.template_key ?? "—"} · {formatBRT(f.enviado_em ?? f.created_at, "dd/MM HH:mm")}
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
