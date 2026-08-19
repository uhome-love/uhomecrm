import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Bell, Phone, MessageCircle, RefreshCw, Home, Search, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * CriarLembreteModal — o PADRÃO ÚNICO de criar lembrete (Nova Gestão).
 * O MESMO formulário é usado no ⋮ do card, no modal do lead e na Agenda.
 * Regra: lembrete é um alarme (não conta ponto — só ⚡ Registrar conta) e SEMPRE
 * tem data E hora. Quando aberto sem lead, o corretor busca o cliente aqui.
 */

interface Tipo {
  key: string;
  label: string;   // rótulo do chip
  prefixo: string; // vira o começo do título ("Ligar: Fulano")
  icon: LucideIcon;
}

const TIPOS: Tipo[] = [
  { key: "ligar",    label: "Ligar",     prefixo: "Ligar",           icon: Phone },
  { key: "whatsapp", label: "WhatsApp",  prefixo: "WhatsApp",        icon: MessageCircle },
  { key: "followup", label: "Follow-up", prefixo: "Follow-up",       icon: RefreshCw },
  { key: "visita",   label: "Visita",    prefixo: "Agendar visita",  icon: Home },
];

/** hoje em BRT + N dias → 'yyyy-MM-dd'. */
function dataBRT(dias: number): string {
  const brt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  brt.setDate(brt.getDate() + dias);
  const y = brt.getFullYear();
  const m = String(brt.getMonth() + 1).padStart(2, "0");
  const d = String(brt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface LeadRef { id: string; nome: string }

interface Props {
  open: boolean;
  /** Lead já conhecido (⋮ do card, modal do lead). Se null, o modal busca o lead. */
  lead?: LeadRef | null;
  /** Habilita o modo "Anotação pessoal" (lembrete solto, sem cliente). Usado na Agenda. */
  permitirNota?: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function CriarLembreteModal({ open, lead, permitirNota = false, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [modo, setModo] = useState<"cliente" | "nota">("cliente");
  const [leadSel, setLeadSel] = useState<LeadRef | null>(lead ?? null);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<LeadRef[]>([]);
  const [tipo, setTipo] = useState<Tipo>(TIPOS[0]);
  const [tituloNota, setTituloNota] = useState("");
  const [data, setData] = useState(dataBRT(1));
  const [hora, setHora] = useState("09:00");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const buscaTimer = useRef<ReturnType<typeof setTimeout>>();

  // Sincroniza com o lead recebido quando o modal (re)abre.
  useEffect(() => {
    if (open) {
      setModo("cliente");
      setLeadSel(lead ?? null);
      setBusca(""); setResultados([]); setTituloNota("");
      setTipo(TIPOS[0]); setData(dataBRT(1)); setHora("09:00"); setNota("");
    }
  }, [open, lead]);

  // Busca de lead (só quando não veio um lead fixo).
  useEffect(() => {
    if (lead || !busca.trim() || !user) { setResultados([]); return; }
    clearTimeout(buscaTimer.current);
    buscaTimer.current = setTimeout(async () => {
      const { data: rows } = await supabase
        .from("pipeline_leads")
        .select("id, nome")
        .eq("corretor_id", user.id)
        .eq("arquivado", false)
        .ilike("nome", `%${busca.trim()}%`)
        .order("updated_at", { ascending: false })
        .limit(8);
      setResultados((rows ?? []) as LeadRef[]);
    }, 220);
    return () => clearTimeout(buscaTimer.current);
  }, [busca, lead, user]);

  const isNota = permitirNota && modo === "nota";

  const titulo = useMemo(
    () => (isNota ? tituloNota.trim() : leadSel ? `${tipo.prefixo}: ${leadSel.nome}` : tipo.prefixo),
    [isNota, tituloNota, tipo, leadSel]
  );

  const podeSalvar = isNota
    ? !!tituloNota.trim() && !!data && !!hora && !busy
    : !!leadSel && !!data && !!hora && !busy;

  const salvar = async () => {
    if (!podeSalvar || !user) return;
    if (!isNota && !leadSel) return;
    setBusy(true);
    const { error } = await supabase.from("pipeline_tarefas").insert({
      pipeline_lead_id: isNota ? null : leadSel!.id,
      tipo: isNota ? "anotacao" : "lembrete",
      titulo,
      descricao: nota.trim() || null,
      vence_em: data,
      hora_vencimento: hora,
      responsavel_id: user.id,
      created_by: user.id,
      origem: isNota ? "nota" : "manual",
    } as never);
    setBusy(false);
    if (error) { toast.error(isNota ? "Não foi possível criar a anotação." : "Não foi possível criar o lembrete."); return; }
    const dataBr = new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
    toast.success(`${isNota ? "📝 Anotação criada" : "📌 Lembrete criado"} · ${dataBr} ${hora}`);
    window.dispatchEvent(new CustomEvent("pipeline-reload"));
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm gap-0 p-0 overflow-hidden">
        <div className="border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-1.5 text-[15px] font-bold text-foreground">
            <Bell className="h-4 w-4 text-primary" strokeWidth={2.2} /> {isNota ? "Nova anotação" : "Novo lembrete"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {isNota
              ? "um lembrete só seu, sem precisar de cliente (reunião, recado, meta)"
              : "um alarme pra você não esquecer — não conta ponto, só ⚡ Registrar conta"}
          </div>
        </div>

        <div className="space-y-3.5 px-5 py-4">
          {/* Alternador: Lembrete de cliente x Anotação pessoal */}
          {permitirNota && !lead && (
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/50 p-1">
              <button
                type="button"
                onClick={() => setModo("cliente")}
                className={cn(
                  "rounded-lg py-2 text-[12.5px] font-semibold transition-colors",
                  !isNota ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Lembrete de cliente
              </button>
              <button
                type="button"
                onClick={() => setModo("nota")}
                className={cn(
                  "rounded-lg py-2 text-[12.5px] font-semibold transition-colors",
                  isNota ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Anotação pessoal
              </button>
            </div>
          )}

          {/* Anotação: título livre (sem cliente) */}
          {isNota && (
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">O que anotar <span className="text-destructive">*</span></div>
              <input
                autoFocus
                value={tituloNota}
                onChange={(e) => setTituloNota(e.target.value)}
                placeholder="ex.: reunião de metas com a diretoria"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          )}

          {/* Lead */}
          {isNota ? null : leadSel && !lead ? (
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2">
              <span className="text-[13px] font-semibold text-foreground">{leadSel.nome}</span>
              <button type="button" onClick={() => setLeadSel(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : !lead ? (
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Cliente</div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar cliente…"
                  className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
              {resultados.length > 0 && (
                <div className="mt-1.5 max-h-44 overflow-auto rounded-xl border border-border">
                  {resultados.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setLeadSel(r); setBusca(""); setResultados([]); }}
                      className="block w-full px-3 py-2 text-left text-[13px] text-foreground hover:bg-muted"
                    >
                      {r.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-[13px] font-semibold text-foreground">
              {leadSel?.nome}
            </div>
          )}

          {/* Tipo */}
          {!isNota && (
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">O que fazer</div>
            <div className="grid grid-cols-4 gap-2">
              {TIPOS.map((t) => {
                const Icon = t.icon;
                const on = tipo.key === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-semibold transition-colors",
                      on ? "border-primary bg-primary/10 text-primary"
                         : "border-border text-foreground hover:border-primary/50 hover:bg-primary/[0.04]"
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.9} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* Data + hora (obrigatórios) */}
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Data <span className="text-destructive">*</span></div>
              <input
                type="date" value={data} min={dataBRT(0)}
                onChange={(e) => setData(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[13px] text-foreground focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div className="w-28">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Hora <span className="text-destructive">*</span></div>
              <input
                type="time" value={hora}
                onChange={(e) => setHora(e.target.value || "09:00")}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[13px] text-foreground focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Nota opcional */}
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Sobre <span className="font-medium normal-case tracking-normal text-muted-foreground/70">(opcional)</span></div>
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="ex.: confirmar se fechou o financiamento"
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} disabled={busy} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">
            <X className="h-4 w-4" /> Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={!podeSalvar} className="rounded-lg bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {busy ? "Salvando…" : isNota ? "Criar anotação" : "Criar lembrete"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
