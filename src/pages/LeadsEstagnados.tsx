import { useMemo, useState } from "react";
import { AlarmClock, Users, Clock, ShieldAlert, UserCheck, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  usePipelineEstagnacao,
  useCorretoresOptions,
  useDecidirEstagnado,
  type CategoriaEstagnacao,
  type LeadEstagnacao,
  type AcaoEstagnacao,
} from "@/hooks/usePipelineEstagnacao";
import { formatBRT } from "@/lib/brtTime";
import { cn } from "@/lib/utils";

const TABS: { value: CategoriaEstagnacao; label: string }[] = [
  { value: "candidato", label: "Estagnados" },
  { value: "em_aviso", label: "Em aviso (48h)" },
  { value: "em_parceria", label: "Em parceria" },
  { value: "estagnado", label: "Confirmados" },
];

function diasBadge(dias: number) {
  const variant = dias >= 60 ? "danger" : dias >= 30 ? "warning" : "muted";
  const cls =
    variant === "danger"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : variant === "warning"
      ? "bg-warning/10 text-warning-foreground border-warning/20"
      : "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[12px] font-semibold", cls)}>
      {dias} dias
    </span>
  );
}

const ACAO_LABELS: Record<AcaoEstagnacao, string> = {
  repassar: "Repassar para outro corretor",
  roleta: "Enviar para a Fila do CEO",
  descartar: "Descartar (reengajável)",
};

export default function LeadsEstagnados() {
  const { data, isLoading } = usePipelineEstagnacao();
  const [tab, setTab] = useState<CategoriaEstagnacao>("candidato");
  const [decision, setDecision] = useState<{ lead: LeadEstagnacao; acao: AcaoEstagnacao } | null>(null);

  const counts = useMemo(() => {
    const c: Record<CategoriaEstagnacao, number> = {
      candidato: 0,
      em_aviso: 0,
      em_parceria: 0,
      estagnado: 0,
    };
    (data ?? []).forEach((l) => {
      c[l.categoria] = (c[l.categoria] ?? 0) + 1;
    });
    return c;
  }, [data]);

  const rows = useMemo(
    () => (data ?? []).filter((l) => l.categoria === tab),
    [data, tab],
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Leads Estagnados"
        subtitle="Leads sem nenhuma ação humana além do limite da etapa. Decida o destino: repassar, roleta ou descartar."
        icon={<AlarmClock className="h-5 w-5" />}
        tabs={TABS.map((t) => ({ label: t.label, value: t.value, badge: counts[t.value] }))}
        activeTab={tab}
        onTabChange={(v) => setTab(v as CategoriaEstagnacao)}
      />

      {tab === "em_parceria" && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-[13px] text-muted-foreground">
          <Users className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            Leads em parceria ativa não são estagnados automaticamente. Decida manualmente para não desfazer a parceria sem alinhar com o parceiro.
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-[14px]">
          <ShieldAlert className="h-8 w-8 mx-auto mb-3 opacity-40" />
          Nenhum lead nesta categoria.
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((l) => (
            <LeadRow key={l.lead_id} lead={l} onDecide={(acao) => setDecision({ lead: l, acao })} />
          ))}
        </div>
      )}

      <DecisionDialog
        open={!!decision}
        lead={decision?.lead ?? null}
        acao={decision?.acao ?? null}
        onClose={() => setDecision(null)}
      />
    </div>
  );
}

function LeadRow({ lead, onDecide }: { lead: LeadEstagnacao; onDecide: (acao: AcaoEstagnacao) => void }) {
  return (
    <Card className="p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[14px] text-foreground truncate">{lead.nome}</span>
          <Badge variant="outline" className="text-[11px]">{lead.etapa}</Badge>
          {lead.empreendimento && (
            <span className="text-[12px] text-muted-foreground truncate">{lead.empreendimento}</span>
          )}
        </div>
        <div className="text-[12px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
          <span>Corretor: {lead.corretor_nome ?? "—"}</span>
          <span className="opacity-40">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Última ação: {formatBRT(lead.ultima_acao_humana, "dd/MM/yyyy")}
          </span>
          {lead.categoria === "em_aviso" && lead.estagnado_prazo_em && (
            <>
              <span className="opacity-40">·</span>
              <span className="text-warning-foreground font-medium">
                Prazo: {formatBRT(lead.estagnado_prazo_em, "dd/MM HH:mm")}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {diasBadge(lead.dias_sem_acao)}
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" onClick={() => onDecide("repassar")}>
            <UserCheck className="h-3.5 w-3.5" /> Repassar
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" onClick={() => onDecide("roleta")}>
            <RotateCcw className="h-3.5 w-3.5" /> Roleta
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-[12px] text-destructive hover:text-destructive"
            onClick={() => onDecide("descartar")}
          >
            <Trash2 className="h-3.5 w-3.5" /> Descartar
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DecisionDialog({
  open,
  lead,
  acao,
  onClose,
}: {
  open: boolean;
  lead: LeadEstagnacao | null;
  acao: AcaoEstagnacao | null;
  onClose: () => void;
}) {
  const { data: corretores, isLoading: loadingCorretores } = useCorretoresOptions();
  const decidir = useDecidirEstagnado();
  const [corretorDestino, setCorretorDestino] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");

  // Reset on open
  const key = lead?.lead_id + (acao ?? "");
  const [lastKey, setLastKey] = useState<string>("");
  if (open && key !== lastKey) {
    setLastKey(key);
    setCorretorDestino("");
    setMotivo("");
  }

  if (!lead || !acao) return null;

  const isRepassar = acao === "repassar";
  const disabled = decidir.isPending || (isRepassar && !corretorDestino);

  const handleConfirm = () => {
    decidir.mutate(
      {
        leadId: lead.lead_id,
        acao,
        corretorDestino: isRepassar ? corretorDestino : undefined,
        motivo: motivo.trim() || undefined,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ACAO_LABELS[acao]}</DialogTitle>
          <DialogDescription>
            {lead.nome} · {lead.etapa}
            {lead.empreendimento ? ` · ${lead.empreendimento}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isRepassar && (
            <div>
              <label className="text-[13px] font-medium text-foreground mb-1.5 block">Corretor de destino</label>
              <Select value={corretorDestino} onValueChange={setCorretorDestino} disabled={loadingCorretores}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingCorretores ? "Carregando..." : "Selecione um corretor"} />
                </SelectTrigger>
                <SelectContent>
                  {(corretores ?? [])
                    .filter((c) => c.user_id !== lead.corretor_id)
                    .map((c) => (
                      <SelectItem key={c.user_id} value={c.user_id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {acao === "roleta" && (
            <p className="text-[13px] text-muted-foreground">
              O lead sairá do corretor atual e irá para a Fila do CEO, aguardando redistribuição.
            </p>
          )}
          {acao === "descartar" && (
            <p className="text-[13px] text-muted-foreground">
              O lead irá para a etapa de Descarte como reengajável e poderá voltar via nutrição/reengajamento.
            </p>
          )}

          <div>
            <label className="text-[13px] font-medium text-foreground mb-1.5 block">
              Motivo {acao === "descartar" ? "" : "(opcional)"}
            </label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Anote o motivo da decisão"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={decidir.isPending}>
            Cancelar
          </Button>
          <Button
            variant={acao === "descartar" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={disabled}
          >
            {decidir.isPending ? "Processando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
