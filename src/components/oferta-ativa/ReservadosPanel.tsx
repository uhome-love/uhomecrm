// ReservadosPanel — Onda 3 · Bloco 4
// 3 sub-abas: 📌 Meus retornos · 🔖 Separados por mim · ⏰ Vencidos
// Lista os reservados do corretor logado (gestão vê tudo via RLS).
// Ações por linha: Ligar (WhatsApp/tel), Reagendar, Devolver.

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Bookmark, Phone, RotateCcw, Undo2, Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type SubAba = "retornos" | "separados" | "vencidos";

interface ReservadoRow {
  id: string;
  pipeline_lead_id: string;
  corretor_id: string;
  tipo: "retorno" | "separado";
  agendado_para: string | null;
  observacao: string | null;
  lista_id: string | null;
  created_at: string;
  lead?: {
    nome: string | null;
    telefone: string | null;
    empreendimento: string | null;
  } | null;
}

async function fetchReservados(): Promise<ReservadoRow[]> {
  const { data, error } = await supabase
    .from("oferta_ativa_reservados")
    .select(`
      id, pipeline_lead_id, corretor_id, tipo, agendado_para, observacao, lista_id, created_at,
      lead:pipeline_leads!oferta_ativa_reservados_pipeline_lead_id_fkey(nome, telefone, empreendimento)
    `)
    .is("devolvido_at", null)
    .order("agendado_para", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as ReservadoRow[];
}

export default function ReservadosPanel() {
  const [sub, setSub] = useState<SubAba>("retornos");
  const [search, setSearch] = useState("");
  const [reagendarTarget, setReagendarTarget] = useState<ReservadoRow | null>(null);

  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["oa-reservados"],
    queryFn: fetchReservados,
    staleTime: 30_000,
  });

  const rows = data ?? [];
  const nowMs = Date.now();

  const buckets = useMemo(() => {
    const retornos: ReservadoRow[] = [];
    const separados: ReservadoRow[] = [];
    const vencidos: ReservadoRow[] = [];
    for (const r of rows) {
      if (r.tipo === "retorno") {
        const isVenc = r.agendado_para && new Date(r.agendado_para).getTime() < nowMs;
        if (isVenc) vencidos.push(r);
        else retornos.push(r);
      } else {
        separados.push(r);
      }
    }
    return { retornos, separados, vencidos };
  }, [rows, nowMs]);

  const visible = useMemo(() => {
    const list = sub === "retornos" ? buckets.retornos
      : sub === "separados" ? buckets.separados
      : buckets.vencidos;
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => (r.lead?.nome ?? "").toLowerCase().includes(q));
  }, [sub, buckets, search]);

  const devolver = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("oferta-ativa-reservar", {
        body: { action: "devolver", reservado_id: id },
      });
      if (error) throw error;
      if (data && (data as any).ok === false) throw new Error((data as any).reason ?? "Falha");
      return data;
    },
    onSuccess: () => {
      toast.success("Lead devolvido à base");
      qc.invalidateQueries({ queryKey: ["oa-reservados"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao devolver"),
  });

  const reagendar = useMutation({
    mutationFn: async (payload: { id: string; agendado_para: string }) => {
      const { data, error } = await supabase.functions.invoke("oferta-ativa-reservar", {
        body: { action: "reagendar", reservado_id: payload.id, agendado_para: payload.agendado_para },
      });
      if (error) throw error;
      if (data && (data as any).ok === false) throw new Error((data as any).reason ?? "Falha");
      return data;
    },
    onSuccess: () => {
      toast.success("Retorno reagendado");
      setReagendarTarget(null);
      qc.invalidateQueries({ queryKey: ["oa-reservados"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao reagendar"),
  });

  const chips: Array<{ key: SubAba; label: string; count: number }> = [
    { key: "retornos", label: "📌 Meus retornos", count: buckets.retornos.length },
    { key: "separados", label: "🔖 Separados por mim", count: buckets.separados.length },
    { key: "vencidos", label: "⏰ Vencidos", count: buckets.vencidos.length },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-abas */}
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => {
          const active = sub === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setSub(c.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-muted border-border text-muted-foreground"
              }`}
            >
              {c.label}
              <span className={`text-[10px] ${active ? "opacity-80" : "opacity-70"}`}>{c.count}</span>
            </button>
          );
        })}
        <div className="flex-1" />
        <Input
          placeholder="🔎 buscar lead"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
      </div>

      {/* Conteúdo */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Carregando…
          </div>
        ) : visible.length === 0 ? (
          <EmptyState sub={sub} />
        ) : sub === "separados" ? (
          <SeparadosGrid
            rows={visible}
            onDevolver={(id) => devolver.mutate(id)}
            busyId={devolver.isPending ? devolver.variables : undefined}
          />
        ) : (
          <RetornosList
            rows={visible}
            vencidos={sub === "vencidos"}
            onDevolver={(id) => devolver.mutate(id)}
            onReagendar={(row) => setReagendarTarget(row)}
            busyId={devolver.isPending ? devolver.variables : undefined}
          />
        )}
      </div>

      <p className="text-xs text-muted-foreground px-1">
        Regras: <span className="text-foreground/80">Devolver</span> volta o lead pra base pública imediatamente ·
        Após 30 dias sem contato, o sistema devolve automaticamente · Reservado por você é invisível pros outros corretores.
      </p>

      {/* Reagendar */}
      <ReagendarDialog
        target={reagendarTarget}
        onClose={() => setReagendarTarget(null)}
        onConfirm={(iso) => reagendar.mutate({ id: reagendarTarget!.id, agendado_para: iso })}
        busy={reagendar.isPending}
      />
    </div>
  );
}

function EmptyState({ sub }: { sub: SubAba }) {
  const msg = sub === "retornos"
    ? "Nenhum retorno agendado."
    : sub === "separados"
    ? "Você ainda não separou leads."
    : "Nenhum retorno vencido.";
  return (
    <div className="p-10 text-center space-y-2">
      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
        <Bookmark size={20} />
      </div>
      <p className="text-sm text-muted-foreground">{msg}</p>
    </div>
  );
}

function RetornosList({
  rows,
  vencidos,
  onDevolver,
  onReagendar,
  busyId,
}: {
  rows: ReservadoRow[];
  vencidos: boolean;
  onDevolver: (id: string) => void;
  onReagendar: (row: ReservadoRow) => void;
  busyId?: string;
}) {
  return (
    <div className="divide-y divide-border">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
          <TimingPill agendado_para={r.agendado_para} vencido={vencidos} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {r.lead?.nome ?? "Lead"}
              {r.lead?.empreendimento && (
                <span className="text-muted-foreground text-xs ml-2">{r.lead.empreendimento}</span>
              )}
            </div>
            {r.observacao && (
              <div className="text-xs text-muted-foreground truncate">{r.observacao}</div>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => callLead(r.lead?.telefone)}
            disabled={!r.lead?.telefone}
          >
            <Phone size={14} className="mr-1" /> Ligar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onReagendar(r)}>
            <RotateCcw size={14} className="mr-1" /> Reagendar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDevolver(r.id)}
            disabled={busyId === r.id}
          >
            <Undo2 size={14} className="mr-1" /> Devolver
          </Button>
        </div>
      ))}
    </div>
  );
}

function SeparadosGrid({
  rows,
  onDevolver,
  busyId,
}: {
  rows: ReservadoRow[];
  onDevolver: (id: string) => void;
  busyId?: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
      {rows.map((r) => {
        const diasReservado = Math.floor(
          (Date.now() - new Date(r.created_at).getTime()) / 86400000,
        );
        const stale = diasReservado >= 25;
        return (
          <div
            key={r.id}
            className={`rounded-xl border bg-card p-3 space-y-2 ${stale ? "border-amber-500/40" : ""}`}
          >
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-[10px]">
                🔖 Reservado {diasReservado}d
              </Badge>
              {stale && (
                <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/40">
                  <Clock size={10} className="mr-1" /> devolve em {30 - diasReservado}d
                </Badge>
              )}
            </div>
            <div className="text-sm font-medium truncate">{r.lead?.nome ?? "Lead"}</div>
            <div className="text-xs text-muted-foreground truncate">
              {r.lead?.empreendimento ?? "—"}
              {r.observacao ? ` · ${r.observacao}` : ""}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => callLead(r.lead?.telefone)}
                disabled={!r.lead?.telefone}
              >
                <Phone size={14} className="mr-1" /> Ligar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDevolver(r.id)}
                disabled={busyId === r.id}
                title="Devolver à base"
              >
                <Undo2 size={14} />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimingPill({ agendado_para, vencido }: { agendado_para: string | null; vencido: boolean }) {
  if (!agendado_para) {
    return <Badge variant="secondary" className="text-[10px]">📅 Sem horário</Badge>;
  }
  const label = formatDistanceToNow(new Date(agendado_para), { locale: ptBR, addSuffix: true });
  if (vencido) {
    return (
      <Badge className="text-[10px] bg-rose-500/20 text-rose-300 border-rose-500/40">
        ⏰ Vencido · {label}
      </Badge>
    );
  }
  const isSoon = new Date(agendado_para).getTime() - Date.now() < 12 * 3600 * 1000;
  return (
    <Badge
      className={`text-[10px] ${
        isSoon
          ? "bg-primary/15 text-primary border-primary/30"
          : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      }`}
    >
      📅 {label}
    </Badge>
  );
}

function callLead(telefone: string | null | undefined) {
  if (!telefone) return;
  const clean = telefone.replace(/\D/g, "");
  window.location.href = `tel:${clean}`;
}

function ReagendarDialog({
  target,
  onClose,
  onConfirm,
  busy,
}: {
  target: ReservadoRow | null;
  onClose: () => void;
  onConfirm: (iso: string) => void;
  busy: boolean;
}) {
  const defaultDt = useMemo(() => {
    const d = target?.agendado_para ? new Date(target.agendado_para) : new Date(Date.now() + 24 * 3600 * 1000);
    // Format for datetime-local (local timezone)
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [target]);
  const [val, setVal] = useState(defaultDt);

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reagendar retorno</DialogTitle>
          <DialogDescription>
            {target?.lead?.nome ?? "Lead"} — escolha nova data e hora.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="datetime-local"
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!val) return;
              onConfirm(new Date(val).toISOString());
            }}
            disabled={busy || !val}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reagendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
