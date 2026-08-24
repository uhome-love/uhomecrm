import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowRight, Trash2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRT } from "@/lib/brtTime";
import {
  MOTIVOS_DESCARTE,
  origemDoReferral,
  produtoLabel,
  statusMetaLead,
  useLiaConversa,
  useDescartarLead,
  useReativarLead,
  type LiaEstado,
} from "./useLiaHub";

interface Props {
  estado: LiaEstado | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const MAX_FOLLOWUPS = 5; // espelha o motor (lia-followup MAX_CUTUCOES)

export default function LiaConversaDrawer({ estado, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { data: mensagens, isLoading } = useLiaConversa(open ? estado?.telefone ?? null : null);
  const descartar = useDescartarLead();
  const reativar = useReativarLead();

  const [motivo, setMotivo] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  // reseta a escolha de motivo ao trocar de lead
  useEffect(() => setMotivo(""), [estado?.telefone]);

  const meta = statusMetaLead({ status: estado?.status, motivo: estado?.motivo });

  const status = estado?.status ?? "";
  const podeDescartar = !!estado && !["qualificado", "descartado", "opt_out"].includes(status);
  const estaDescartado = status === "descartado";
  const followups = estado?.followup_count ?? 0;

  async function confirmarDescarte() {
    if (!estado || !motivo) return;
    try {
      await descartar.mutateAsync({ telefone: estado.telefone, motivo });
      toast.success("Lead descartado", { description: `${estado.nome || estado.telefone} saiu da fila da LIA.` });
      setConfirmando(false);
      onOpenChange(false);
    } catch {
      toast.error("Não consegui descartar", { description: "Tenta de novo em instantes." });
    }
  }

  async function reativarLead() {
    if (!estado) return;
    try {
      await reativar.mutateAsync({ telefone: estado.telefone });
      toast.success("Lead reativado", { description: "Voltou pra fila da LIA como 'em conversa'." });
      onOpenChange(false);
    } catch {
      toast.error("Não consegui reativar", { description: "Tenta de novo em instantes." });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-[100dvh] w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border p-4 pt-[max(1rem,env(safe-area-inset-top))] text-left sm:p-5 sm:pt-5">
          <SheetTitle className="text-lg">{estado?.nome || "Sem nome"}</SheetTitle>
          <SheetDescription>{estado?.telefone}</SheetDescription>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {estado?.produto_slug ? (
              <Badge variant="secondary" className="border-primary/20 bg-primary/10 text-primary">
                {produtoLabel(estado.produto_slug)}
              </Badge>
            ) : null}
            <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
            {estado?.nivel ? (
              <Badge variant="outline" className="border-warning/20 bg-warning/10 text-warning">
                {estado.nivel === "quente" ? "🔥 Quente" : "Qualificado"}
              </Badge>
            ) : null}
            <Badge variant="secondary">Follow-ups: {followups}</Badge>
            <Badge variant="secondary">{origemDoReferral(estado?.referral)}</Badge>
          </div>
          {estaDescartado && estado?.motivo ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Descartado{estado.descartado_em ? ` em ${formatBRT(estado.descartado_em, "dd/MM HH:mm")}` : ""} · {estado.motivo}
            </p>
          ) : null}
          {estado?.lead_id ? (
            <Button
              size="sm"
              className="mt-3 w-fit gap-2"
              onClick={() => {
                onOpenChange(false);
                navigate(`/pipeline-leads?lead=${estado.lead_id}`);
              }}
            >
              Assumir conversa <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Ainda sem lead no pipeline — a LIA cria o lead ao qualificar.
            </p>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
            {isLoading ? (
              <>
                <Skeleton className="h-12 w-2/3" />
                <Skeleton className="ml-auto h-12 w-2/3" />
                <Skeleton className="h-12 w-1/2" />
              </>
            ) : (mensagens ?? []).length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sem mensagens.</p>
            ) : (
              (mensagens ?? []).map((m, i) => {
                const isUser = m.role === "user";
                return (
                  <div key={i} className={cn("flex", isUser ? "justify-start" : "justify-end")}>
                    <div
                      className={cn(
                        "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[80%]",
                        isUser
                          ? "rounded-bl-sm bg-muted text-foreground"
                          : "rounded-br-sm bg-primary/10 text-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {formatBRT(m.created_at, "dd/MM HH:mm")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Rodapé de desfecho: descartar (não qualificado) ou reativar (já descartado) */}
        {(podeDescartar || estaDescartado) && (
          <div className="shrink-0 border-t border-border bg-muted/20 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
            {estaDescartado ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Lead fora da fila da LIA.</p>
                <Button variant="outline" size="sm" className="gap-2" onClick={reativarLead} disabled={reativar.isPending}>
                  <RotateCcw className="h-4 w-4" /> Reativar
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Motivo do descarte…" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_DESCARTE.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={!motivo || descartar.isPending}
                  onClick={() => setConfirmando(true)}
                >
                  <Trash2 className="h-4 w-4" /> Descartar
                </Button>
              </div>
            )}
            {podeDescartar && followups < MAX_FOLLOWUPS && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Dica: a linha de follow-up ainda pode trazer esse lead de volta ({followups} de {MAX_FOLLOWUPS} toques enviados). Descartar só quando não fizer mais sentido insistir.
              </p>
            )}
          </div>
        )}

        <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Descartar este lead?</AlertDialogTitle>
              <AlertDialogDescription>
                {estado?.nome || estado?.telefone} sai da fila da LIA e os follow-ups em aberto são cancelados.
                Motivo: <strong>{motivo}</strong>. Dá pra reativar depois, é reversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); confirmarDescarte(); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Descartar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
