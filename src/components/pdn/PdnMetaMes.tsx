import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, Users, Loader2, Pencil, Check, X } from "lucide-react";
import { fmtMoney, parseMoney, formatMoneyInput } from "@/lib/fmtMoney";
import type { PdnRow } from "@/hooks/usePdn";
import { useMetasMes } from "@/hooks/pdn/useMetasMes";

/**
 * Aba "Meta do mês" — Fase 6.
 * Consolidado da empresa + grid por corretor. Não usa filtros da toolbar
 * (mostra sempre o mês completo, independente de recorte).
 */
export function PdnMetaMes({ mes, rows }: { mes: string; rows: PdnRow[] }) {
  const { empresaMeta, corretorMetas, loading, upsertEmpresa, upsertCorretor } = useMetasMes(mes);

  // Realizado (Ganhos) por corretor + total empresa. Só linhas do pipeline
  // (com corretorAuthId) contam para a meta — linhas 100% manuais não têm dono.
  const {
    realizadoEmpresa,
    contratoEmpresa,
    porCorretor,
  } = useMemo(() => {
    let rEmp = 0; let cEmp = 0;
    const map = new Map<string, { authId: string; nome: string; realizado: number; contrato: number; negociacao: number }>();
    for (const r of rows) {
      if (r.caiu) continue;
      if (r.grupo === "ganho") rEmp += r.vgv;
      if (r.grupo === "contrato") cEmp += r.vgv;
      if (!r.corretorAuthId) continue;
      const key = r.corretorAuthId;
      const cur = map.get(key) || { authId: key, nome: r.corretor, realizado: 0, contrato: 0, negociacao: 0 };
      if (r.grupo === "ganho") cur.realizado += r.vgv;
      else if (r.grupo === "contrato") cur.contrato += r.vgv;
      else if (r.grupo === "em_negociacao") cur.negociacao += r.vgv;
      map.set(key, cur);
    }
    return {
      realizadoEmpresa: rEmp,
      contratoEmpresa: cEmp,
      porCorretor: Array.from(map.values()),
    };
  }, [rows]);

  // Junta com corretores que têm meta cadastrada mas ainda não têm negócio
  // no mês — precisam aparecer no grid para o gestor ver 0%.
  const gridRows = useMemo(() => {
    const known = new Set(porCorretor.map(c => c.authId));
    const extras = Object.keys(corretorMetas)
      .filter(uid => !known.has(uid))
      .map(uid => ({ authId: uid, nome: "(sem negócios no mês)", realizado: 0, contrato: 0, negociacao: 0 }));
    const merged = [...porCorretor, ...extras];
    return merged
      .map(c => {
        const meta = corretorMetas[c.authId] || 0;
        const gap = Math.max(0, meta - c.realizado);
        const pct = meta > 0 ? Math.min(100, (c.realizado / meta) * 100) : 0;
        return { ...c, meta, gap, pct };
      })
      .sort((a, b) => {
        // Primeiro: quem tem meta e maior gap. Depois: sem meta.
        if (a.meta === 0 && b.meta > 0) return 1;
        if (b.meta === 0 && a.meta > 0) return -1;
        return b.gap - a.gap;
      });
  }, [porCorretor, corretorMetas]);

  const metaEmp = empresaMeta || 0;
  const gapEmp = Math.max(0, metaEmp - realizadoEmpresa);
  const pctEmp = metaEmp > 0 ? Math.min(100, (realizadoEmpresa / metaEmp) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando metas…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Card empresa */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Target className="h-4 w-4 text-primary" /> Meta da empresa · {mes}
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Realizado (Ganhos)</div>
                <div className="text-2xl font-bold text-emerald-500">{fmtMoney(realizadoEmpresa, "short")}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Meta</div>
                <MetaEditor value={metaEmp} onSave={upsertEmpresa} />
              </div>
            </div>
            <Progress value={pctEmp} className="h-2" />
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span><b className="text-foreground">{pctEmp.toFixed(0)}%</b> da meta</span>
              <span>Gap: <b className={gapEmp > 0 ? "text-amber-500" : "text-emerald-500"}>{fmtMoney(gapEmp, "short")}</b></span>
              <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Em contrato: <b className="text-foreground">{fmtMoney(contratoEmpresa, "short")}</b></span>
            </div>
          </div>
        </div>
      </Card>

      {/* Grid corretores */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="h-4 w-4 text-primary" /> Meta por corretor
          <Badge variant="outline" className="ml-2 text-xs">{gridRows.length} corretor{gridRows.length === 1 ? "" : "es"}</Badge>
        </div>
        {gridRows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum corretor com negócios ou meta cadastrada neste mês.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {gridRows.map(c => (
              <div key={c.authId} className={`rounded-xl border p-3 ${c.meta === 0 ? "border-dashed bg-muted/20" : "bg-card"}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-medium text-foreground">{c.nome}</div>
                  {c.meta > 0 && (
                    <Badge variant={c.pct >= 100 ? "default" : c.pct >= 60 ? "secondary" : "outline"} className="text-[10px]">
                      {c.pct.toFixed(0)}%
                    </Badge>
                  )}
                </div>
                <div className="mb-2 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Realizado</div>
                    <div className="text-lg font-bold text-emerald-500">{fmtMoney(c.realizado, "short")}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Meta</div>
                    <MetaEditor value={c.meta} onSave={(v) => upsertCorretor(c.authId, v)} compact />
                  </div>
                </div>
                <Progress value={c.pct} className="h-1.5" />
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {c.meta > 0 && (
                    <span>Gap: <b className={c.gap > 0 ? "text-amber-500" : "text-emerald-500"}>{fmtMoney(c.gap, "short")}</b></span>
                  )}
                  {c.contrato > 0 && <span>Contrato: <b className="text-foreground">{fmtMoney(c.contrato, "short")}</b></span>}
                  {c.negociacao > 0 && <span>Em neg.: <b className="text-foreground">{fmtMoney(c.negociacao, "short")}</b></span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Editor inline de meta em BRL. Click no valor → input; Enter/blur → salva.
 * Cancela com Esc.
 */
function MetaEditor({ value, onSave, compact = false }: { value: number; onSave: (v: number) => void | Promise<boolean | void>; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const start = () => { setDraft(formatMoneyInput(value)); setEditing(true); };
  const commit = async () => {
    const n = parseMoney(draft);
    if (n !== value) await onSave(n);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={start}
        className={`group inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-right hover:bg-muted ${compact ? "text-base font-bold" : "text-2xl font-bold"} text-foreground`}
        title="Editar meta"
      >
        {value > 0 ? fmtMoney(value, "short") : <span className="text-muted-foreground">— definir</span>}
        <Pencil className="h-3 w-3 opacity-0 transition group-hover:opacity-60" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        autoFocus
        className={`h-8 ${compact ? "w-28" : "w-36"} text-right text-sm`}
        placeholder="R$ 0"
      />
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={commit} title="Salvar">
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)} title="Cancelar">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
