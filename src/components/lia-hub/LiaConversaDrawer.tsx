import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRT } from "@/lib/brtTime";
import { STATUS_META, origemDoReferral, useLiaConversa, type LiaEstado } from "./useLiaHub";

interface Props {
  estado: LiaEstado | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function LiaConversaDrawer({ estado, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { data: mensagens, isLoading } = useLiaConversa(open ? estado?.telefone ?? null : null);

  const meta = STATUS_META[estado?.status ?? ""] ?? {
    label: estado?.status ?? "—",
    cls: "bg-muted text-muted-foreground border-border",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-5 text-left">
          <SheetTitle className="text-lg">{estado?.nome || "Sem nome"}</SheetTitle>
          <SheetDescription>{estado?.telefone}</SheetDescription>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
            {estado?.nivel ? (
              <Badge variant="outline" className="border-warning/20 bg-warning/10 text-warning">
                {estado.nivel === "quente" ? "🔥 Quente" : "Qualificado"}
              </Badge>
            ) : null}
            <Badge variant="secondary">Follow-ups: {estado?.followup_count ?? 0}</Badge>
            <Badge variant="secondary">{origemDoReferral(estado?.referral)}</Badge>
          </div>
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
          <div className="space-y-3 p-5">
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
                        "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
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
      </SheetContent>
    </Sheet>
  );
}
