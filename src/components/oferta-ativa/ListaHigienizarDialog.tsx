import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type RegraKey = "sem_interesse" | "numero_invalido" | "ja_convertido" | "sem_contato_60d";

interface RegraConfig {
  key: RegraKey;
  label: string;
  hint: string;
  defaultChecked: boolean;
}

const REGRAS: RegraConfig[] = [
  { key: "sem_interesse",    label: "Sem interesse confirmado",       hint: "Lead já registrou ‘sem interesse’ em alguma tentativa",        defaultChecked: true  },
  { key: "numero_invalido",  label: "Número inválido / não atende",   hint: "4+ tentativas com não atende, caixa postal ou número inválido", defaultChecked: true  },
  { key: "ja_convertido",    label: "Já convertidos",                 hint: "Lead já está marcado como convertido nesta lista",              defaultChecked: true  },
  { key: "sem_contato_60d",  label: "Sem contato há +60 dias",        hint: "Última tentativa há mais de 60 dias",                           defaultChecked: false },
];

interface ListaTarget {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Single list, OR all lists when null (admin/global mode). */
  lista: ListaTarget | null;
  /** When `lista` is null, restrict to these list ids (e.g. all liberadas). */
  listaIdsAll?: string[];
}

type Counts = Record<RegraKey, number>;

export default function ListaHigienizarDialog({ open, onClose, lista, listaIdsAll }: Props) {
  const qc = useQueryClient();
  const [checked, setChecked] = useState<Record<RegraKey, boolean>>(() =>
    Object.fromEntries(REGRAS.map(r => [r.key, r.defaultChecked])) as Record<RegraKey, boolean>
  );
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  const targetIds = lista ? [lista.id] : (listaIdsAll || []);

  useEffect(() => {
    if (!open || targetIds.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setCounts(null);

    const compute = async () => {
      try {
        const sixtyDaysAgo = new Date(Date.now() - 60 * 86400_000).toISOString();
        const result: Counts = { sem_interesse: 0, numero_invalido: 0, ja_convertido: 0, sem_contato_60d: 0 };

        // Pull active leads (na_fila + em_cooldown) for these lists
        const { data: leads } = await supabase
          .from("oferta_ativa_leads")
          .select("id, status, motivo_descarte, tentativas_count, ultima_tentativa")
          .in("lista_id", targetIds)
          .in("status", ["na_fila", "em_cooldown", "convertido"])
          .limit(10000);

        if (!leads || cancelled) {
          if (!cancelled) setCounts(result);
          return;
        }

        // ja_convertido
        result.ja_convertido = leads.filter(l => l.status === "convertido").length;

        // sem_contato_60d
        result.sem_contato_60d = leads.filter(l =>
          l.status !== "convertido" && l.ultima_tentativa && l.ultima_tentativa < sixtyDaysAgo
        ).length;

        // sem_interesse / numero_invalido — need to inspect tentativas
        const activeIds = leads.filter(l => l.status !== "convertido").map(l => l.id);
        if (activeIds.length > 0) {
          const { data: tents } = await supabase
            .from("oferta_ativa_tentativas")
            .select("lead_id, resultado")
            .in("lead_id", activeIds)
            .limit(20000);

          const semInteresseSet = new Set<string>();
          const naoAtendeMap: Record<string, number> = {};
          for (const t of (tents || [])) {
            if (!t.lead_id) continue;
            const r = (t.resultado || "").toLowerCase();
            if (r.includes("sem_interesse") || r === "nao_qualificado" || r.includes("desinteresse")) {
              semInteresseSet.add(t.lead_id);
            }
            if (r === "nao_atende" || r === "numero_invalido" || r === "caixa_postal" || r.includes("nao atende")) {
              naoAtendeMap[t.lead_id] = (naoAtendeMap[t.lead_id] || 0) + 1;
            }
          }
          result.sem_interesse = semInteresseSet.size;
          result.numero_invalido = Object.values(naoAtendeMap).filter(n => n >= 4).length;
        }

        if (!cancelled) setCounts(result);
      } catch (err) {
        console.error("Higienizar preview error:", err);
        if (!cancelled) setCounts({ sem_interesse: 0, numero_invalido: 0, ja_convertido: 0, sem_contato_60d: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    compute();
    return () => { cancelled = true; };
  }, [open, targetIds.join(",")]);

  const totalSelecionado = REGRAS.reduce((s, r) => s + (checked[r.key] && counts ? counts[r.key] : 0), 0);

  const handleExecute = async () => {
    if (!counts || totalSelecionado === 0) {
      toast.info("Nenhum lead a higienizar");
      return;
    }
    setExecuting(true);
    try {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 86400_000).toISOString();

      // Re-fetch active leads (small window)
      const { data: leads } = await supabase
        .from("oferta_ativa_leads")
        .select("id, status, ultima_tentativa")
        .in("lista_id", targetIds)
        .in("status", ["na_fila", "em_cooldown", "convertido"])
        .limit(10000);

      if (!leads) throw new Error("Falha ao carregar leads");

      const toDescart: { id: string; motivo: string }[] = [];

      // ja_convertido — already convertido status; we just exclude them from being touched.
      // Treat them as "already cleaned"; only mark non-convertido that bate other rules.

      // sem_contato_60d
      if (checked.sem_contato_60d) {
        for (const l of leads) {
          if (l.status === "convertido") continue;
          if (l.ultima_tentativa && l.ultima_tentativa < sixtyDaysAgo) {
            toDescart.push({ id: l.id, motivo: "sem_contato_60d" });
          }
        }
      }

      // sem_interesse / numero_invalido — pull tentativas
      if (checked.sem_interesse || checked.numero_invalido) {
        const activeIds = leads.filter(l => l.status !== "convertido").map(l => l.id);
        const { data: tents } = await supabase
          .from("oferta_ativa_tentativas")
          .select("lead_id, resultado")
          .in("lead_id", activeIds)
          .limit(20000);

        const semInteresseSet = new Set<string>();
        const naoAtendeMap: Record<string, number> = {};
        for (const t of (tents || [])) {
          if (!t.lead_id) continue;
          const r = (t.resultado || "").toLowerCase();
          if (r.includes("sem_interesse") || r === "nao_qualificado" || r.includes("desinteresse")) {
            semInteresseSet.add(t.lead_id);
          }
          if (r === "nao_atende" || r === "numero_invalido" || r === "caixa_postal" || r.includes("nao atende")) {
            naoAtendeMap[t.lead_id] = (naoAtendeMap[t.lead_id] || 0) + 1;
          }
        }

        if (checked.sem_interesse) {
          for (const id of semInteresseSet) toDescart.push({ id, motivo: "higienizado_sem_interesse" });
        }
        if (checked.numero_invalido) {
          for (const [id, n] of Object.entries(naoAtendeMap)) {
            if (n >= 4) toDescart.push({ id, motivo: "higienizado_numero_invalido" });
          }
        }
      }

      // Dedup by id (keep first reason)
      const seen = new Set<string>();
      const unique: { id: string; motivo: string }[] = [];
      for (const x of toDescart) {
        if (!seen.has(x.id)) { seen.add(x.id); unique.push(x); }
      }

      if (unique.length === 0) {
        toast.info("Nenhum lead corresponde aos critérios selecionados");
      } else {
        // Group by motivo for batched updates
        const byMotivo: Record<string, string[]> = {};
        for (const x of unique) {
          (byMotivo[x.motivo] ||= []).push(x.id);
        }
        for (const [motivo, ids] of Object.entries(byMotivo)) {
          for (let i = 0; i < ids.length; i += 500) {
            const batch = ids.slice(i, i + 500);
            const { error } = await supabase
              .from("oferta_ativa_leads")
              .update({ status: "descartado", motivo_descarte: motivo, updated_at: new Date().toISOString() })
              .in("id", batch);
            if (error) console.error("higienizar batch", motivo, error);
          }
        }

        // Stamp ultima_higienizacao_at on the lists
        await supabase
          .from("oferta_ativa_listas")
          .update({ ultima_higienizacao_at: new Date().toISOString() })
          .in("id", targetIds);

        toast.success(`🧹 ${unique.length} lead${unique.length > 1 ? "s" : ""} higienizado${unique.length > 1 ? "s" : ""}`);
        qc.invalidateQueries({ queryKey: ["oa-listas"] });
        qc.invalidateQueries({ queryKey: ["oa-listas-batch-stats"] });
      }

      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao higienizar: " + (err.message || "desconhecido"));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            Higienizar {lista ? `“${lista.nome}”` : `${targetIds.length} listas`}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Marca leads como descartados sem apagar histórico. Auditável e reversível.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 py-2">
          {REGRAS.map(regra => {
            const c = counts?.[regra.key] ?? null;
            const disabled = c === 0;
            return (
              <label
                key={regra.key}
                className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                  disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50"
                }`}
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <Checkbox
                  checked={checked[regra.key]}
                  onCheckedChange={(v) => setChecked(p => ({ ...p, [regra.key]: !!v }))}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{regra.label}</span>
                    {loading ? (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    ) : (
                      <span className={`text-xs font-bold tabular-nums ${c && c > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                        {c ?? "—"}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{regra.hint}</p>
                </div>
              </label>
            );
          })}
        </div>

        {counts && totalSelecionado > 0 && (
          <div className="text-xs flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>{totalSelecionado}</strong> lead{totalSelecionado > 1 ? "s" : ""} ser
              {totalSelecionado > 1 ? "ão" : "á"} marcado{totalSelecionado > 1 ? "s" : ""} como descartado{totalSelecionado > 1 ? "s" : ""} (saem da fila ativa).
            </span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose} disabled={executing}>Cancelar</Button>
          <Button
            onClick={handleExecute}
            disabled={loading || executing || totalSelecionado === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {executing ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Higienizando...</>
            ) : (
              <>🧹 Higienizar {totalSelecionado > 0 ? totalSelecionado : ""}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
