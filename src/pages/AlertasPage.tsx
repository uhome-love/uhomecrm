import { useState, useMemo } from "react";
import { useHomiAlertsPage, type HomiAlertRow } from "@/hooks/useHomiAlertsPage";
import { Bell, AlertTriangle, Info, CheckCircle2, X, Eye, EyeOff, Filter, RefreshCw, Users, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const TIPO_LABELS: Record<string, string> = {
  leads_sem_contato: "Leads sem contato",
  lead_stuck_stage: "Leads estagnados",
  visita_sem_confirmacao: "Visita sem confirmação",
  corretor_inativo: "Corretor inativo",
  tarefa_vencida: "Tarefas vencidas",
};

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof AlertTriangle }> = {
  critical: { label: "Crítico", color: "text-destructive", bg: "bg-destructive/5", border: "border-destructive/20", icon: AlertTriangle },
  normal: { label: "Atenção", color: "text-warning", bg: "bg-warning/5", border: "border-warning/20", icon: Bell },
  info: { label: "Info", color: "text-info", bg: "bg-info/5", border: "border-info/20", icon: Info },
};

const GROUPABLE_TYPES = ["lead_stuck_stage", "tarefa_vencida"];

const PRIORIDADE_ORDER: Record<string, number> = { critical: 0, normal: 1, info: 2 };

type FilterTab = "active" | "read" | "dismissed";

interface GroupedAlert {
  key: string;
  tipo: string;
  gerenteNome: string;
  prioridade: string; // worst case
  totalCount: number;
  alerts: HomiAlertRow[];
  worst: { corretorNome: string; count: number; dias?: number };
  allIds: string[];
  allCorretorIds: string[];
  hasUnread: boolean;
}

function buildGroups(alerts: HomiAlertRow[]): { groups: GroupedAlert[]; ungrouped: HomiAlertRow[] } {
  const ungrouped: HomiAlertRow[] = [];
  const groupMap = new Map<string, GroupedAlert>();

  for (const alert of alerts) {
    if (!GROUPABLE_TYPES.includes(alert.tipo)) {
      ungrouped.push(alert);
      continue;
    }

    const ctx = alert.contexto || {};
    const gerenteNome = ctx.gerente_nome || "Sem equipe";
    const key = `${alert.tipo}::${gerenteNome}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        tipo: alert.tipo,
        gerenteNome,
        prioridade: alert.prioridade,
        totalCount: 0,
        alerts: [],
        worst: { corretorNome: ctx.corretor_nome || "?", count: ctx.count || 0, dias: ctx.dias_parado },
        allIds: [],
        allCorretorIds: [],
        hasUnread: false,
      });
    }

    const group = groupMap.get(key)!;
    group.alerts.push(alert);
    group.allIds.push(alert.id);
    if (ctx.corretor_id && !group.allCorretorIds.includes(ctx.corretor_id)) {
      group.allCorretorIds.push(ctx.corretor_id);
    }

    const count = ctx.count || 0;
    group.totalCount += count;

    if (!alert.lida && !alert.dispensada) group.hasUnread = true;

    // Track worst priority
    if ((PRIORIDADE_ORDER[alert.prioridade] ?? 2) < (PRIORIDADE_ORDER[group.prioridade] ?? 2)) {
      group.prioridade = alert.prioridade;
    }

    // Track worst corretor
    if (count > group.worst.count) {
      group.worst = { corretorNome: ctx.corretor_nome || "?", count, dias: ctx.dias_parado };
    }
  }

  return { groups: Array.from(groupMap.values()), ungrouped };
}

export default function AlertasPage() {
  const { alerts, loading, unreadCount, fetchAlerts, dismissAlert, markAsRead, markAllAsRead, dismissAll } = useHomiAlertsPage();
  const navigate = useNavigate();
  const [tab, setTab] = useState<FilterTab>("active");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterPrioridade, setFilterPrioridade] = useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Filter alerts first
  const preFiltered = useMemo(() => {
    let filtered = alerts;
    if (tab === "active") filtered = filtered.filter(a => !a.dispensada && !a.lida);
    else if (tab === "read") filtered = filtered.filter(a => a.lida && !a.dispensada);
    else if (tab === "dismissed") filtered = filtered.filter(a => a.dispensada);
    if (filterTipo !== "all") filtered = filtered.filter(a => a.tipo === filterTipo);
    if (filterPrioridade !== "all") filtered = filtered.filter(a => a.prioridade === filterPrioridade);
    return filtered;
  }, [alerts, tab, filterTipo, filterPrioridade]);

  const { groups, ungrouped } = useMemo(() => buildGroups(preFiltered), [preFiltered]);

  // Sort: groups by priority then ungrouped by priority
  const sortedGroups = useMemo(() =>
    [...groups].sort((a, b) => (PRIORIDADE_ORDER[a.prioridade] ?? 2) - (PRIORIDADE_ORDER[b.prioridade] ?? 2)),
    [groups]
  );

  const sortedUngrouped = useMemo(() =>
    [...ungrouped].sort((a, b) => (PRIORIDADE_ORDER[a.prioridade] ?? 2) - (PRIORIDADE_ORDER[b.prioridade] ?? 2)),
    [ungrouped]
  );

  // Stats
  const stats = useMemo(() => {
    const active = alerts.filter(a => !a.dispensada && !a.lida);
    return {
      total: active.length,
      critical: active.filter(a => a.prioridade === "critical").length,
      normal: active.filter(a => a.prioridade === "normal").length,
      info: active.filter(a => a.prioridade === "info").length,
    };
  }, [alerts]);

  const availableTypes = useMemo(() => {
    const types = new Set(alerts.map(a => a.tipo));
    return Array.from(types);
  }, [alerts]);

  function getAlertActions(alert: HomiAlertRow) {
    const ctx = alert.contexto || {};
    const actions: { label: string; onClick: () => void }[] = [];

    switch (alert.tipo) {
      case "leads_sem_contato":
      case "lead_stuck_stage":
        if (ctx.corretor_id) {
          actions.push({
            label: `Ver leads (${ctx.count || "?"})`,
            onClick: () => navigate(`/pipeline-leads?corretor=${ctx.corretor_id}`),
          });
        }
        break;
      case "visita_sem_confirmacao":
        actions.push({ label: "Ver visitas", onClick: () => navigate("/agenda-visitas") });
        if (ctx.corretor_id) {
          actions.push({ label: "Ver corretor", onClick: () => navigate(`/pipeline-leads?corretor=${ctx.corretor_id}`) });
        }
        break;
      case "corretor_inativo":
        if (ctx.corretor_id) {
          actions.push({
            label: `Ver leads (${ctx.pending_leads || "?"})`,
            onClick: () => navigate(`/pipeline-leads?corretor=${ctx.corretor_id}`),
          });
        }
        break;
      case "tarefa_vencida":
        if (ctx.corretor_id) {
          actions.push({
            label: `Ver tarefas (${ctx.count || "?"})`,
            onClick: () => navigate(`/pipeline-leads?corretor=${ctx.corretor_id}`),
          });
        }
        break;
    }
    return actions;
  }

  function handleDismissGroup(group: GroupedAlert) {
    group.allIds.forEach(id => dismissAlert(id));
  }

  function handleMarkGroupRead(group: GroupedAlert) {
    group.allIds.forEach(id => markAsRead(id));
  }

  const totalItems = sortedGroups.length + sortedUngrouped.length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Central de Alertas</h1>
            <p className="text-sm text-muted-foreground">Alertas operacionais do HOMI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAlerts} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
          {unreadCount > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Marcar tudo lido
              </Button>
              <Button variant="outline" size="sm" onClick={dismissAll} className="gap-1.5 text-destructive hover:text-destructive">
                <X className="h-3.5 w-3.5" /> Dispensar todos
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Ativos", value: stats.total, color: "text-foreground", bg: "bg-muted/50" },
          { label: "Críticos", value: stats.critical, color: "text-destructive", bg: "bg-destructive/5" },
          { label: "Atenção", value: stats.normal, color: "text-warning", bg: "bg-warning/5" },
          { label: "Info", value: stats.info, color: "text-info", bg: "bg-info/5" },
        ].map(s => (
          <Card key={s.label} className={`${s.bg} border`}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs + Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: "active" as FilterTab, label: "Ativos", count: alerts.filter(a => !a.dispensada && !a.lida).length },
          { key: "read" as FilterTab, label: "Lidos", count: alerts.filter(a => a.lida && !a.dispensada).length },
          { key: "dismissed" as FilterTab, label: "Dispensados", count: alerts.filter(a => a.dispensada).length },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              tab === t.key
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-card border-border text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}

        <div className="w-px h-5 bg-border mx-1" />

        <select
          value={filterTipo}
          onChange={e => setFilterTipo(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg border border-border bg-card text-foreground"
        >
          <option value="all">Todos os tipos</option>
          {availableTypes.map(t => (
            <option key={t} value={t}>{TIPO_LABELS[t] || t}</option>
          ))}
        </select>

        <select
          value={filterPrioridade}
          onChange={e => setFilterPrioridade(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg border border-border bg-card text-foreground"
        >
          <option value="all">Todas prioridades</option>
          <option value="critical">Crítico</option>
          <option value="normal">Atenção</option>
          <option value="info">Info</option>
        </select>
      </div>

      {/* Alert list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando alertas...</div>
      ) : totalItems === 0 ? (
        <Card className="border-success/20 bg-success/5">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
            <p className="text-sm font-medium text-success">Nenhum alerta nesta categoria</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Grouped alerts */}
          {sortedGroups.map(group => {
            const config = PRIORIDADE_CONFIG[group.prioridade] || PRIORIDADE_CONFIG.info;
            const Icon = config.icon;
            const isExpanded = expandedGroups.has(group.key);
            const tipoLabel = TIPO_LABELS[group.tipo] || group.tipo;
            const corretorCount = group.alerts.length;

            return (
              <div
                key={group.key}
                className={`rounded-xl border transition-colors ${config.bg} ${config.border}`}
              >
                {/* Group header */}
                <div className="flex items-start gap-3 p-4">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${config.bg}`}>
                    <Icon className={`h-4.5 w-4.5 ${config.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {tipoLabel}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-0.5">
                        <Users className="h-2.5 w-2.5" /> Equipe {group.gerenteNome}
                      </span>
                    </div>

                    <p className="text-sm text-foreground leading-snug font-medium">
                      Equipe {group.gerenteNome} — {corretorCount} corretor{corretorCount > 1 ? "es" : ""} com {tipoLabel.toLowerCase()}
                      {" · "}{group.totalCount} {group.tipo === "tarefa_vencida" ? "tarefa" : "lead"}{group.totalCount > 1 ? "s" : ""} no total
                      {group.worst.count > 0 && (
                        <span className="text-muted-foreground font-normal">
                          {" "}(pior: {group.worst.corretorNome}, {group.worst.count} {group.tipo === "tarefa_vencida" ? "tarefas" : "leads"}
                          {group.worst.dias ? ` há ${group.worst.dias}d` : ""})
                        </span>
                      )}
                    </p>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Button
                        variant="default"
                        size="sm"
                        className="h-6 text-[10px] rounded-lg px-2"
                        onClick={() => {
                          // Navigate with all corretors from the group
                          const firstCorretorId = group.allCorretorIds[0];
                          if (firstCorretorId) {
                            navigate(`/pipeline-leads?corretor=${firstCorretorId}`);
                          }
                        }}
                      >
                        Ver {group.tipo === "tarefa_vencida" ? "tarefas" : "leads"} ({group.totalCount})
                      </Button>

                      <button
                        onClick={() => toggleGroup(group.key)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {isExpanded ? "Recolher" : `Ver ${corretorCount} corretor${corretorCount > 1 ? "es" : ""}`}
                      </button>
                    </div>
                  </div>

                  {/* Group actions */}
                  <div className="flex flex-col gap-1 shrink-0">
                    {group.hasUnread && (
                      <button
                        onClick={() => handleMarkGroupRead(group)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                        title="Marcar grupo como lido"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDismissGroup(group)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                      title="Dispensar grupo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Accordion: individual corretors */}
                {isExpanded && (
                  <div className="border-t border-border/50 mx-4 mb-3">
                    {group.alerts
                      .sort((a, b) => ((b.contexto?.count || 0) - (a.contexto?.count || 0)))
                      .map(alert => {
                        const ctx = alert.contexto || {};
                        const subConfig = PRIORIDADE_CONFIG[alert.prioridade] || PRIORIDADE_CONFIG.info;
                        const timeAgo = formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR });

                        return (
                          <div
                            key={alert.id}
                            className={`flex items-center gap-3 py-2.5 border-b border-border/30 last:border-b-0 ${alert.lida ? "opacity-60" : ""}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-semibold ${subConfig.color}`}>
                                  {subConfig.label}
                                </span>
                                <span className="text-xs text-foreground font-medium">
                                  {ctx.corretor_nome || "?"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {ctx.count || 0} {group.tipo === "tarefa_vencida" ? "tarefa(s)" : "lead(s)"}
                                  {ctx.dias_parado ? ` · há ${ctx.dias_parado}d` : ""}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[9px] text-muted-foreground">{timeAgo}</span>
                              {ctx.corretor_id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-5 text-[9px] rounded px-1.5"
                                  onClick={() => navigate(`/pipeline-leads?corretor=${ctx.corretor_id}`)}
                                >
                                  Ver
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Ungrouped alerts (original layout) */}
          {sortedUngrouped.map(alert => {
            const config = PRIORIDADE_CONFIG[alert.prioridade] || PRIORIDADE_CONFIG.info;
            const Icon = config.icon;
            const actions = getAlertActions(alert);
            const ctx = alert.contexto || {};
            const timeAgo = formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR });

            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${config.bg} ${config.border} ${
                  alert.lida ? "opacity-70" : ""
                }`}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${config.bg}`}>
                  <Icon className={`h-4.5 w-4.5 ${config.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {TIPO_LABELS[alert.tipo] || alert.tipo}
                    </span>
                    {ctx.corretor_nome && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-0.5">
                        <Users className="h-2.5 w-2.5" /> {ctx.corretor_nome}
                      </span>
                    )}
                    {ctx.gerente_nome && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        Equipe {ctx.gerente_nome}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-foreground leading-snug">{alert.mensagem}</p>

                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" /> {timeAgo}
                    </span>

                    {actions.map((action, i) => (
                      <Button
                        key={i}
                        variant={i === 0 ? "default" : "outline"}
                        size="sm"
                        className="h-6 text-[10px] rounded-lg px-2"
                        onClick={action.onClick}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  {!alert.lida && !alert.dispensada && (
                    <button
                      onClick={() => markAsRead(alert.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                      title="Marcar como lido"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!alert.dispensada && (
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                      title="Dispensar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
