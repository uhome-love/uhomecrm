import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Users, Check, LogOut, UserPlus, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import {
  useDashboardGerenteV4Dia,
  type RoletaCredenciado,
} from "@/hooks/useDashboardGerenteV4Dia";
import { useRoletaPresencas } from "@/hooks/useRoletaPresencas";
import {
  derivarEstadoTurno,
  expandirTurnos,
  ESTADO_LABEL,
  ESTADO_CLASSES,
  TURNO_LABEL,
  type EstadoCorretor,
  type PresencaTurno,
} from "@/lib/roletaPresenca";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
  gestorId: string | undefined;
}

const TURNO_ORDER: Record<string, number> = {
  manha: 0,
  tarde: 1,
  noturna: 2,
  dia_todo: 3,
};

interface CredAgrupado {
  corretor_id: string;
  nome: string | null;
  avatar_url: string | null;
  turno_ativo_agora: boolean;
  turnos: { janela: string; leads: number }[];
}

function groupByCorretor(list: RoletaCredenciado[]): CredAgrupado[] {
  const map = new Map<string, CredAgrupado>();
  for (const c of list) {
    const existing = map.get(c.corretor_id);
    if (existing) {
      existing.turno_ativo_agora = existing.turno_ativo_agora || c.turno_ativo_agora;
      existing.turnos.push({ janela: c.janela, leads: c.leads_recebidos_dia });
    } else {
      map.set(c.corretor_id, {
        corretor_id: c.corretor_id,
        nome: c.nome,
        avatar_url: c.avatar_url,
        turno_ativo_agora: c.turno_ativo_agora,
        turnos: [{ janela: c.janela, leads: c.leads_recebidos_dia }],
      });
    }
  }
  for (const item of map.values()) {
    item.turnos.sort(
      (a, b) => (TURNO_ORDER[a.janela] ?? 99) - (TURNO_ORDER[b.janela] ?? 99),
    );
  }
  return Array.from(map.values());
}

// Estado agregado do corretor considerando todos os turnos do dia:
// prioridade saiu > na_empresa > na_roleta > falta
function estadoAgregado(
  turnos: string[],
  getPresenca: (id: string, turno: string) => any,
  corretorId: string,
): EstadoCorretor {
  const expandidos = expandirTurnos(turnos);
  const estados = expandidos.map((t) =>
    derivarEstadoTurno(getPresenca(corretorId, t), true),
  );
  if (estados.some((e) => e === "na_empresa")) return "na_empresa";
  if (estados.some((e) => e === "saiu")) return "saiu";
  if (estados.every((e) => e === "falta")) return "falta";
  return "na_roleta";
}

function CredRow({
  c,
  canManage,
  getPresenca,
  onMark,
  isMutating,
}: {
  c: CredAgrupado;
  canManage: boolean;
  getPresenca: (id: string, turno: string) => any;
  onMark: (corretor_id: string, turnos: string[], status: "na_empresa" | "saiu") => void;
  isMutating: boolean;
}) {
  const turnosStr = c.turnos.map((t) => t.janela);
  const estado = estadoAgregado(turnosStr, getPresenca, c.corretor_id);

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/20 p-2.5">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={c.avatar_url ?? undefined} alt={c.nome ?? ""} />
        <AvatarFallback className="text-xs">
          {(c.nome ?? "?").slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-foreground truncate">{c.nome ?? "—"}</p>
          <span
            className={cn(
              "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-[1px] rounded-full whitespace-nowrap",
              ESTADO_CLASSES[estado],
            )}
          >
            {ESTADO_LABEL[estado]}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground truncate">
          {c.turnos
            .map((t) => `${TURNO_LABEL[t.janela] ?? t.janela} · ${t.leads}`)
            .join("  ·  ")}
        </p>
      </div>
      {canManage && (
        <div className="flex flex-col gap-1 shrink-0">
          {estado !== "na_empresa" && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] gap-1"
              disabled={isMutating}
              onClick={() => onMark(c.corretor_id, turnosStr, "na_empresa")}
              title="Confirmar chegada em todos os turnos"
            >
              <Check className="h-3 w-3" /> Chegou
            </Button>
          )}
          {estado === "na_empresa" && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] gap-1 border-yellow-500/40 text-yellow-700 hover:bg-yellow-500/10"
              disabled={isMutating}
              onClick={() => onMark(c.corretor_id, turnosStr, "saiu")}
              title="Marcar que saiu — remove da fila"
            >
              <LogOut className="h-3 w-3" /> Saiu
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Diálogo: marcar presença de corretor sem credenciamento (chegou tarde)
// -----------------------------------------------------------------------------
function MarcarPresencaAvulsaDialog({
  onMark,
  jaCredenciadosIds,
}: {
  onMark: (corretor_id: string, turnos: PresencaTurno[]) => Promise<void>;
  jaCredenciadosIds: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [corretorId, setCorretorId] = useState<string>("");
  const [turno, setTurno] = useState<PresencaTurno>("manha");
  const [saving, setSaving] = useState(false);

  const { data: corretores } = useQuery({
    queryKey: ["corretores-para-presenca"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, cargo, ativo")
        .in("cargo", ["corretor", "gerente", "gestor", "admin"])
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleSubmit = async () => {
    if (!corretorId) {
      toast.error("Selecione um corretor");
      return;
    }
    setSaving(true);
    try {
      await onMark(corretorId, [turno]);
      toast.success("Presença registrada");
      setOpen(false);
      setCorretorId("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
          <UserPlus className="h-3 w-3" /> Marcar presença
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar presença avulsa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Corretor</label>
            <Select value={corretorId} onValueChange={setCorretorId}>
              <SelectTrigger><SelectValue placeholder="Selecionar corretor" /></SelectTrigger>
              <SelectContent>
                {(corretores ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} {jaCredenciadosIds.has(c.id) ? "· já credenciado" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Turno</label>
            <Select value={turno} onValueChange={(v) => setTurno(v as PresencaTurno)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manha">Manhã</SelectItem>
                <SelectItem value="tarde">Tarde</SelectItem>
                <SelectItem value="noturna">Noite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Marca o corretor como <strong>Na empresa</strong> neste turno. Vale como
            presença mesmo sem credenciamento prévio (chegou depois do horário).
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Confirmar chegada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
export function V4PanelRoleta({ gestorId }: Props) {
  const { isAdmin, isManager } = useUserRole();
  const canManage = isAdmin || isManager;
  const { data, isLoading } = useDashboardGerenteV4Dia(gestorId, "hoje");
  const { getPresenca, marcar, marcarAsync, isMutating } = useRoletaPresencas();

  const roleta = data?.roleta_dia;
  const credenciados = roleta?.credenciados ?? [];
  const agrupados = groupByCorretor(credenciados);
  const jaCredenciadosIds = new Set(agrupados.map((c) => c.corretor_id));
  const turnoLabel = TURNO_LABEL[roleta?.turno_ativo_atual ?? ""] ?? "—";

  // Contagens dinâmicas com base em presença validada agora
  const naEmpresa = agrupados.filter(
    (c) => estadoAgregado(c.turnos.map((t) => t.janela), getPresenca, c.corretor_id) === "na_empresa",
  ).length;

  const handleMark = (corretor_id: string, turnos: string[], status: "na_empresa" | "saiu") => {
    marcar({ corretor_id, turnos, status });
  };

  const handleAvulsa = async (corretor_id: string, turnos: PresencaTurno[]) => {
    await marcarAsync({ corretor_id, turnos, status: "na_empresa" });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-sm font-semibold text-foreground">Roleta — turno {turnoLabel}</h3>
        {canManage && (
          <MarcarPresencaAvulsaDialog onMark={handleAvulsa} jaCredenciadosIds={jaCredenciadosIds} />
        )}
      </div>

      <div
        className={cn(
          "rounded-lg p-2.5 mb-3 text-xs font-medium",
          naEmpresa > 0 ? "bg-success-50 text-success-700" : "bg-muted/40 text-muted-foreground",
        )}
      >
        Na empresa agora: <span className="tabular-nums font-bold">{naEmpresa}</span> / {agrupados.length}
      </div>

      <div className="flex-1 min-h-[180px]">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : agrupados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum credenciamento aprovado hoje
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {agrupados.map((c) => (
              <CredRow
                key={c.corretor_id}
                c={c}
                canManage={canManage}
                getPresenca={getPresenca}
                onMark={handleMark}
                isMutating={isMutating}
              />
            ))}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mt-4 pt-3 border-t border-border flex justify-end">
          <Link
            to="/roleta"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
          >
            Gerenciar roleta <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
