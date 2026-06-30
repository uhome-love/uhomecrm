import { useMemo, useState } from "react";
import {
  AlarmClock,
  Users,
  Clock,
  ShieldAlert,
  UserCheck,
  RotateCcw,
  Trash2,
  Search,
  X,
  Loader2,
  Undo2,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  usePipelineMeta,
  useEstagnadoLeadDrawer,
} from "@/hooks/useEstagnadoLeadDrawer";
import PipelineLeadDetail from "@/components/pipeline/PipelineLeadDetail";
import { formatBRT } from "@/lib/brtTime";
import { cn } from "@/lib/utils";

const TABS: { value: CategoriaEstagnacao; label: string }[] = [
  { value: "estagnado", label: "Estagnados" },
  { value: "candidato", label: "A estagnar" },
  { value: "em_aviso", label: "Em aviso (48h)" },
  { value: "em_parceria", label: "Em parceria" },
];

type SortKey = "dias_desc" | "dias_asc" | "nome";

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
  devolver: "Devolver ao corretor",
  repassar: "Repassar para outro corretor",
  roleta: "Enviar para a Fila do CEO",
  descartar: "Descartar (reengajável)",
};

export default function LeadsEstagnados() {
  const { data, isLoading } = usePipelineEstagnacao();
  const meta = usePipelineMeta();
  const drawer = useEstagnadoLeadDrawer();
  const [tab, setTab] = useState<CategoriaEstagnacao>("estagnado");
  const [decision, setDecision] = useState<
    { leads: LeadEstagnacao[]; acao: AcaoEstagnacao } | null
  >(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [corretorFilter, setCorretorFilter] = useState<string>("todos");
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState<string>("todos");
  const [etapaFilter, setEtapaFilter] = useState<string>("todos");
  const [sort, setSort] = useState<SortKey>("dias_desc");

  // Seleção múltipla
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const baseRows = useMemo(
    () => (data ?? []).filter((l) => l.categoria === tab),
    [data, tab],
  );

  // Opções dinâmicas dos filtros (baseadas na categoria atual)
  const corretorOptions = useMemo(() => {
    const map = new Map<string, string>();
    baseRows.forEach((l) => {
      if (l.corretor_id) map.set(l.corretor_id, l.corretor_nome ?? "—");
    });
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [baseRows]);

  const empreendimentoOptions = useMemo(() => {
    const set = new Set<string>();
    baseRows.forEach((l) => {
      if (l.empreendimento) set.add(l.empreendimento);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [baseRows]);

  const etapaOptions = useMemo(() => {
    const set = new Set<string>();
    baseRows.forEach((l) => {
      if (l.etapa) set.add(l.etapa);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [baseRows]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = baseRows.filter((l) => {
      if (corretorFilter !== "todos" && l.corretor_id !== corretorFilter) return false;
      if (empreendimentoFilter !== "todos" && l.empreendimento !== empreendimentoFilter)
        return false;
      if (etapaFilter !== "todos" && l.etapa !== etapaFilter) return false;
      if (q) {
        const hay = `${l.nome} ${l.empreendimento ?? ""} ${l.corretor_nome ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    result = [...result].sort((a, b) => {
      if (sort === "nome") return a.nome.localeCompare(b.nome);
      if (sort === "dias_asc") return a.dias_sem_acao - b.dias_sem_acao;
      return b.dias_sem_acao - a.dias_sem_acao;
    });
    return result;
  }, [baseRows, search, corretorFilter, empreendimentoFilter, etapaFilter, sort]);

  const selectedRows = useMemo(
    () => rows.filter((l) => selected.has(l.lead_id)),
    [rows, selected],
  );
  const allSelected = rows.length > 0 && rows.every((l) => selected.has(l.lead_id));


  const handleTabChange = (v: string) => {
    setTab(v as CategoriaEstagnacao);
    setSearch("");
    setCorretorFilter("todos");
    setEmpreendimentoFilter("todos");
    setEtapaFilter("todos");
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (rows.every((l) => prev.has(l.lead_id))) {
        const next = new Set(prev);
        rows.forEach((l) => next.delete(l.lead_id));
        return next;
      }
      const next = new Set(prev);
      rows.forEach((l) => next.add(l.lead_id));
      return next;
    });
  };

  const hasFilters =
    search.trim() !== "" || corretorFilter !== "todos" || empreendimentoFilter !== "todos" || etapaFilter !== "todos";

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Leads Estagnados"
        subtitle="Leads sem nenhuma ação humana além do limite da etapa. Clique no lead para ver o histórico e decida: repassar, roleta ou descartar."
        icon={<AlarmClock className="h-5 w-5" />}
        tabs={TABS.map((t) => ({ label: t.label, value: t.value, badge: counts[t.value] }))}
        activeTab={tab}
        onTabChange={handleTabChange}
      />

      {tab === "em_parceria" && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-[13px] text-muted-foreground">
          <Users className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            Leads em parceria ativa não são estagnados automaticamente. Decida manualmente para não desfazer a parceria sem alinhar com o parceiro.
          </span>
        </div>
      )}

      {/* Filtros */}
      {!isLoading && baseRows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome, empreendimento, corretor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Select value={corretorFilter} onValueChange={setCorretorFilter}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Corretor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os corretores</SelectItem>
              {corretorOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {empreendimentoOptions.length > 0 && (
            <Select value={empreendimentoFilter} onValueChange={setEmpreendimentoFilter}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Empreendimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos empreendimentos</SelectItem>
                {empreendimentoOptions.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {etapaOptions.length > 0 && (
            <Select value={etapaFilter} onValueChange={setEtapaFilter}>
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as etapas</SelectItem>
                {etapaOptions.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}


          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dias_desc">Mais dias parado</SelectItem>
              <SelectItem value="dias_asc">Menos dias parado</SelectItem>
              <SelectItem value="nome">Nome (A-Z)</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 text-[12px]"
              onClick={() => {
                setSearch("");
                setCorretorFilter("todos");
                setEmpreendimentoFilter("todos");
                setEtapaFilter("todos");
              }}
            >
              <X className="h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>
      )}

      {/* Barra de seleção múltipla */}
      {selectedRows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-[13px] font-semibold text-foreground">
            {selectedRows.length} selecionado{selectedRows.length > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-[12px]"
              onClick={() => setDecision({ leads: selectedRows, acao: "devolver" })}
            >
              <Undo2 className="h-3.5 w-3.5" /> Devolver
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-[12px]"
              onClick={() => setDecision({ leads: selectedRows, acao: "repassar" })}
            >
              <UserCheck className="h-3.5 w-3.5" /> Repassar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-[12px]"
              onClick={() => setDecision({ leads: selectedRows, acao: "roleta" })}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Roleta
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-[12px] text-destructive hover:text-destructive"
              onClick={() => setDecision({ leads: selectedRows, acao: "descartar" })}
            >
              <Trash2 className="h-3.5 w-3.5" /> Descartar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[12px]"
              onClick={() => setSelected(new Set())}
            >
              Limpar seleção
            </Button>
          </div>
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
          {baseRows.length === 0
            ? "Nenhum lead nesta categoria."
            : "Nenhum lead corresponde aos filtros."}
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Selecionar todos */}
          <div className="flex items-center gap-2 px-1 pb-1">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="Selecionar todos"
            />
            <span className="text-[12px] text-muted-foreground">
              Selecionar todos ({rows.length})
            </span>
          </div>

          {rows.map((l) => (
            <LeadRow
              key={l.lead_id}
              lead={l}
              selected={selected.has(l.lead_id)}
              onToggleSelect={() => toggleSelect(l.lead_id)}
              onOpen={() => drawer.openLead(l.lead_id)}
              onDecide={(acao) => setDecision({ leads: [l], acao })}
            />
          ))}
        </div>
      )}

      <DecisionDialog
        open={!!decision}
        leads={decision?.leads ?? []}
        acao={decision?.acao ?? null}
        onClose={() => setDecision(null)}
        onDone={() => setSelected(new Set())}
      />

      {drawer.loadingLead && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/40">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {drawer.lead && (
        <PipelineLeadDetail
          lead={drawer.lead}
          stages={meta.stages}
          segmentos={meta.segmentos}
          open={drawer.open}
          onOpenChange={(o) => {
            if (!o) drawer.close();
          }}
          onUpdate={drawer.onUpdate}
          onMove={drawer.onMove}
          onDelete={drawer.onDelete}
        />
      )}
    </div>
  );
}

function LeadRow({
  lead,
  selected,
  onToggleSelect,
  onOpen,
  onDecide,
}: {
  lead: LeadEstagnacao;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onDecide: (acao: AcaoEstagnacao) => void;
}) {
  return (
    <Card
      className={cn(
        "p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between transition-colors",
        selected && "ring-1 ring-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="pt-0.5">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={`Selecionar ${lead.nome}`}
          />
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left group"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[14px] text-foreground truncate group-hover:text-primary group-hover:underline underline-offset-2">
              {lead.nome}
            </span>
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
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap pl-7 sm:pl-0">
        {diasBadge(lead.dias_sem_acao)}
        <div className="flex items-center gap-1.5">
          {lead.corretor_id && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" onClick={() => onDecide("devolver")}>
              <Undo2 className="h-3.5 w-3.5" /> Devolver
            </Button>
          )}
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
  leads,
  acao,
  onClose,
  onDone,
}: {
  open: boolean;
  leads: LeadEstagnacao[];
  acao: AcaoEstagnacao | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: corretores, isLoading: loadingCorretores } = useCorretoresOptions();
  const decidir = useDecidirEstagnado();
  const [corretorDestino, setCorretorDestino] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const isMulti = leads.length > 1;
  const firstLead = leads[0] ?? null;

  // Reset on open
  const key = leads.map((l) => l.lead_id).join(",") + (acao ?? "");
  const [lastKey, setLastKey] = useState<string>("");
  if (open && key !== lastKey) {
    setLastKey(key);
    setCorretorDestino("");
    setMotivo("");
    setProgress(null);
  }

  if (!firstLead || !acao) return null;

  const isRepassar = acao === "repassar";
  const busy = decidir.isPending || progress !== null;
  const disabled = busy || (isRepassar && !corretorDestino);

  // Para repasse de seleção, evita repassar para o mesmo corretor de origem (quando único)
  const origemCorretorId = isMulti ? null : firstLead.corretor_id;

  const handleConfirm = async () => {
    let done = 0;
    setProgress({ done, total: leads.length });
    let okCount = 0;
    for (const l of leads) {
      try {
        await decidir.mutateAsync({
          leadId: l.lead_id,
          acao,
          corretorDestino: isRepassar ? corretorDestino : undefined,
          motivo: motivo.trim() || undefined,
        });
        okCount += 1;
      } catch (err) {
        console.error("[decidir] falha lead", l.lead_id, err);
      }
      done += 1;
      setProgress({ done, total: leads.length });
    }
    setProgress(null);
    if (isMulti) {
      const labels: Record<AcaoEstagnacao, string> = {
        devolver: "devolvidos ao corretor",
        repassar: "repassados",
        roleta: "enviados para a Fila do CEO",
        descartar: "descartados",
      };
      if (okCount > 0) {
        // toast individual já é emitido pelo hook; um resumo extra para lote
        // mantém clareza sem duplicar excessivamente.
      }
    }
    onDone();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {ACAO_LABELS[acao]}
            {isMulti ? ` · ${leads.length} leads` : ""}
          </DialogTitle>
          <DialogDescription>
            {isMulti
              ? `Esta ação será aplicada a ${leads.length} leads selecionados.`
              : `${firstLead.nome} · ${firstLead.etapa}${firstLead.empreendimento ? ` · ${firstLead.empreendimento}` : ""}`}
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
                    .filter((c) => !origemCorretorId || c.user_id !== origemCorretorId)
                    .map((c) => (
                      <SelectItem key={c.user_id} value={c.user_id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {acao === "devolver" && (
            <p className="text-[13px] text-muted-foreground">
              {isMulti ? "Os leads voltarão" : "O lead voltará"} para {isMulti ? "os corretores atuais" : firstLead.corretor_nome ?? "o corretor atual"} na etapa <strong>Novo Lead</strong>, saindo da estagnação.
            </p>
          )}
          {acao === "roleta" && (
            <p className="text-[13px] text-muted-foreground">
              {isMulti ? "Os leads sairão" : "O lead sairá"} do corretor atual e {isMulti ? "irão" : "irá"} para a Fila do CEO, aguardando redistribuição.
            </p>
          )}
          {acao === "descartar" && (
            <p className="text-[13px] text-muted-foreground">
              {isMulti ? "Os leads irão" : "O lead irá"} para a etapa de Descarte como reengajável e {isMulti ? "poderão" : "poderá"} voltar via nutrição/reengajamento.
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

          {progress && (
            <p className="text-[12px] text-muted-foreground">
              Processando {progress.done}/{progress.total}...
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant={acao === "descartar" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={disabled}
          >
            {busy ? "Processando..." : isMulti ? `Confirmar (${leads.length})` : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
