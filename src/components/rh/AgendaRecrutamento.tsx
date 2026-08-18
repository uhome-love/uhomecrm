import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, X, Clock, CalendarDays, Video, Search, Phone } from "lucide-react";
import { MEET_LINK, ETAPAS } from "@/config/recrutamento";
import { toast } from "sonner";
import { format, isToday, isTomorrow, isPast, parseISO, addDays, startOfDay, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

/**
 * AgendaRecrutamento — agenda por DATA das entrevistas do funil de recrutamento.
 * O candidato (nome, etapa, temperatura, gerente, telefone) é buscado DIRETO do
 * banco (rh_candidatos), não do prop — antes o nome sumia quando a lista vinha
 * filtrada/parcial. Filtros: busca, gerente, status e período.
 */

interface CandInfo {
  nome: string;
  telefone: string | null;
  etapa: string;
  temperatura: string | null;
  gerente_id: string | null;
  origem: string | null;
}

interface Entrevista {
  id: string;
  candidato_id: string;
  data_entrevista: string;
  local: string | null;
  observacoes: string | null;
  status: string;
}

interface GerenteOpt {
  user_id: string;
  nome: string;
}

type StatusFiltro = "todas" | "agendada" | "realizada" | "nao_compareceu";
type PeriodoFiltro = "7d" | "mes" | "todas";

const STATUS_OPTS: { key: StatusFiltro; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "agendada", label: "Agendadas" },
  { key: "realizada", label: "Realizadas" },
  { key: "nao_compareceu", label: "Não compareceu" },
];

const PERIODO_OPTS: { key: PeriodoFiltro; label: string }[] = [
  { key: "7d", label: "Próximos 7 dias" },
  { key: "mes", label: "Este mês" },
  { key: "todas", label: "Todas" },
];

const ETAPA_META: Record<string, { label: string; color: string }> = Object.fromEntries(
  ETAPAS.map((e) => [e.key, { label: e.label, color: e.color }])
);

const TEMP_META: Record<string, { label: string; color: string; soft: string }> = {
  quente: { label: "Quente", color: "#E0533A", soft: "rgba(224, 83, 58, 0.12)" },
  morno: { label: "Morno", color: "#E0982A", soft: "rgba(224, 152, 42, 0.12)" },
  frio: { label: "Frio", color: "#7C8AA3", soft: "rgba(124, 138, 163, 0.14)" },
};

function statusBadge(status: string) {
  switch (status) {
    case "agendada":
      return (
        <Badge className="bg-primary/12 text-primary border-primary/25 text-[10px] rounded-full">
          <Clock className="h-3 w-3 mr-1" />Agendada
        </Badge>
      );
    case "realizada":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200 text-[10px] rounded-full">
          <Check className="h-3 w-3 mr-1" />Realizada
        </Badge>
      );
    case "nao_compareceu":
      return (
        <Badge className="bg-red-500/15 text-red-600 border-red-200 text-[10px] rounded-full">
          <X className="h-3 w-3 mr-1" />Não compareceu
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-[10px] rounded-full">{status}</Badge>;
  }
}

function dayLabel(d: Date) {
  if (isToday(d)) return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  return format(d, "EEE, dd/MM", { locale: ptBR });
}

function onlyDigits(s?: string | null) {
  return (s || "").replace(/\D/g, "");
}

interface Props {
  /** Lista mínima (fallback). O nome real vem do banco. */
  candidatos: { id: string; nome: string; etapa: string }[];
  gerentes?: GerenteOpt[];
  /** 'rh' mostra filtro por gerente; 'gerente' não precisa. */
  scope?: "rh" | "gerente";
  onKanbanUpdate: () => void;
  readOnly?: boolean;
}

export default function AgendaRecrutamento({ candidatos, gerentes = [], scope = "rh", onKanbanUpdate, readOnly = false }: Props) {
  const [entrevistas, setEntrevistas] = useState<Entrevista[]>([]);
  const [candInfo, setCandInfo] = useState<Record<string, CandInfo>>({});
  const [status, setStatus] = useState<StatusFiltro>("todas");
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("7d");
  const [busca, setBusca] = useState("");
  const [filtroGerente, setFiltroGerente] = useState<string>("todos");

  const gerenteNome = useMemo(() => {
    const m: Record<string, string> = {};
    for (const g of gerentes) m[g.user_id] = g.nome;
    return m;
  }, [gerentes]);

  const fetchTudo = useCallback(async () => {
    const { data: ents, error } = await supabase
      .from("rh_entrevistas" as any)
      .select("id, candidato_id, data_entrevista, local, observacoes, status")
      .order("data_entrevista", { ascending: true });
    if (error) return;
    const lista = ((ents || []) as unknown as Entrevista[]);
    setEntrevistas(lista);

    // Candidato buscado DIRETO do banco (RLS aplica escopo) — nome sempre correto.
    const ids = Array.from(new Set(lista.map((e) => e.candidato_id).filter(Boolean)));
    if (ids.length === 0) { setCandInfo({}); return; }
    const { data: cands } = await supabase
      .from("rh_candidatos" as any)
      .select("id, nome, telefone, etapa, temperatura, gerente_id, origem")
      .in("id", ids);
    const map: Record<string, CandInfo> = {};
    for (const c of (cands || []) as any[]) {
      map[c.id] = {
        nome: c.nome, telefone: c.telefone, etapa: c.etapa,
        temperatura: c.temperatura, gerente_id: c.gerente_id, origem: c.origem,
      };
    }
    // Fallback pelo prop (caso RLS não devolva algum, ainda mostra o nome do kanban).
    for (const c of candidatos) if (!map[c.id]) map[c.id] = { nome: c.nome, telefone: null, etapa: c.etapa, temperatura: null, gerente_id: null, origem: null };
    setCandInfo(map);
  }, [candidatos]);

  useEffect(() => { fetchTudo(); }, [fetchTudo]);

  const marcar = async (e: Entrevista, novo: "realizada" | "nao_compareceu") => {
    const { error } = await supabase
      .from("rh_entrevistas" as any)
      .update({ status: novo, updated_at: new Date().toISOString() })
      .eq("id", e.id);
    if (error) { toast.error("Erro ao atualizar entrevista"); return; }

    await supabase
      .from("rh_candidatos" as any)
      .update({
        etapa: novo === "realizada" ? "pre_entrevista_realizada" : "sem_interesse",
        updated_at: new Date().toISOString(),
      })
      .eq("id", e.candidato_id);

    toast.success(novo === "realizada" ? "Entrevista marcada como realizada!" : "Candidato marcado como não compareceu");
    fetchTudo();
    onKanbanUpdate();
  };

  const grupos = useMemo(() => {
    const hoje = startOfDay(new Date());
    const limite =
      periodo === "7d" ? addDays(hoje, 7) : periodo === "mes" ? endOfMonth(hoje) : null;
    const q = busca.trim().toLowerCase();
    const qDigits = onlyDigits(busca);

    const filtradas = entrevistas.filter((e) => {
      if (status !== "todas" && e.status !== status) return false;
      if (limite) {
        const d = parseISO(e.data_entrevista);
        if (d < hoje || d > limite) return false;
      }
      const c = candInfo[e.candidato_id];
      if (filtroGerente !== "todos" && (c?.gerente_id ?? "sem") !== filtroGerente) return false;
      if (q) {
        const nome = (c?.nome || "").toLowerCase();
        const tel = onlyDigits(c?.telefone);
        const hitNome = nome.includes(q);
        const hitTel = qDigits.length >= 3 && tel.includes(qDigits);
        if (!hitNome && !hitTel) return false;
      }
      return true;
    });

    const map = new Map<string, { date: Date; items: Entrevista[] }>();
    for (const e of filtradas) {
      const d = parseISO(e.data_entrevista);
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, { date: startOfDay(d), items: [] });
      map.get(key)!.items.push(e);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({ key, ...v }));
  }, [entrevistas, candInfo, status, periodo, busca, filtroGerente]);

  const totalFiltradas = useMemo(() => grupos.reduce((n, g) => n + g.items.length, 0), [grupos]);
  // Só mostra o filtro de gerente quando há gerentes atribuídos entre as entrevistas.
  const temGerentes = scope === "rh" && gerentes.length > 0;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar candidato ou telefone…"
            className="h-8 pl-8 text-xs rounded-full"
          />
        </div>

        {temGerentes && (
          <Select value={filtroGerente} onValueChange={setFiltroGerente}>
            <SelectTrigger className="h-8 w-[170px] text-xs rounded-full">
              <SelectValue placeholder="Gerente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os gerentes</SelectItem>
              <SelectItem value="sem">Sem gerente</SelectItem>
              {gerentes.map((g) => (
                <SelectItem key={g.user_id} value={g.user_id}>{g.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/80 p-1 shadow-sm">
          {STATUS_OPTS.map((o) => (
            <button
              key={o.key}
              onClick={() => setStatus(o.key)}
              className={cn(
                "px-3 py-1 text-[11px] font-semibold rounded-full transition-colors",
                status === o.key ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/80 p-1 shadow-sm">
          {PERIODO_OPTS.map((o) => (
            <button
              key={o.key}
              onClick={() => setPeriodo(o.key)}
              className={cn(
                "px-3 py-1 text-[11px] font-semibold rounded-full transition-colors",
                periodo === o.key ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {grupos.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 py-12">
          <CalendarDays size={20} strokeWidth={1.5} className="text-muted-foreground/60" />
          <p className="text-xs font-medium text-muted-foreground">Nenhuma entrevista neste filtro</p>
        </div>
      )}

      <div className="space-y-5">
        {grupos.map((g) => (
          <section key={g.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">{dayLabel(g.date)}</span>
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                {g.items.length}
              </span>
              <span className="flex-1 h-px bg-border/60" />
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/70 dark:bg-muted/50 divide-y divide-border/50 overflow-hidden">
              {g.items.map((e) => {
                const d = parseISO(e.data_entrevista);
                const atrasada = e.status === "agendada" && isPast(d);
                const c = candInfo[e.candidato_id];
                const etapa = c ? ETAPA_META[c.etapa] : undefined;
                const temp = c?.temperatura ? TEMP_META[(c.temperatura || "").toLowerCase()] : undefined;
                const ger = c?.gerente_id ? gerenteNome[c.gerente_id] : null;
                const tel = onlyDigits(c?.telefone);
                const meta: string[] = [];
                if (ger) meta.push(`👤 ${ger}`);
                if (e.local) meta.push(e.local);
                if (c?.origem) meta.push(c.origem);
                return (
                  <div
                    key={e.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      atrasada && "bg-destructive/[0.04]"
                    )}
                  >
                    <span className="text-[13px] font-bold text-primary tabular-nums w-12 shrink-0">
                      {format(d, "HH:mm")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {c?.nome || "Candidato removido"}
                        </p>
                        {etapa && (
                          <span
                            className="inline-flex items-center rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide"
                            style={{ color: etapa.color, backgroundColor: `${etapa.color}1f` }}
                          >
                            {etapa.label}
                          </span>
                        )}
                        {temp && (
                          <span
                            className="inline-flex items-center rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide"
                            style={{ color: temp.color, backgroundColor: temp.soft }}
                          >
                            {temp.label}
                          </span>
                        )}
                      </div>
                      {meta.length > 0 && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{meta.join(" · ")}</p>
                      )}
                    </div>
                    {tel.length >= 10 && (
                      <a
                        href={`https://wa.me/55${tel}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="WhatsApp"
                        className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full border border-emerald-300 text-emerald-600 hover:bg-emerald-50 transition-colors"
                      >
                        <Phone className="h-3 w-3" />
                      </a>
                    )}
                    {statusBadge(e.status)}
                    {e.status === "agendada" && (
                      <a
                        href={MEET_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/15 transition-colors"
                      >
                        <Video className="h-3 w-3" /> Entrar no Meet
                      </a>
                    )}
                    {!readOnly && e.status === "agendada" && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-[11px] gap-1 rounded-full border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                          onClick={() => marcar(e, "realizada")}
                        >
                          <Check className="h-3 w-3" /> Realizada
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="h-7 w-7 p-0 rounded-full border-red-300 text-red-600 hover:bg-red-50"
                          title="Não compareceu"
                          onClick={() => marcar(e, "nao_compareceu")}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {totalFiltradas > 0 && (
        <p className="text-[11px] text-muted-foreground text-center pt-1">
          {totalFiltradas} entrevista{totalFiltradas !== 1 ? "s" : ""} no filtro
        </p>
      )}
    </div>
  );
}
