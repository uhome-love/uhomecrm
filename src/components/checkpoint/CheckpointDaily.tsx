import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Copy, Lock, RotateCcw, Save, ChevronLeft, ChevronRight } from "lucide-react";

interface TeamMember { id: string; nome: string; equipe: string | null; status: string; }
interface CheckpointLine {
  id?: string;
  corretor_id: string;
  corretor_nome: string;
  meta_ligacoes: number; meta_presenca: string; meta_visitas_marcadas: number;
  meta_visitas_realizadas: number; meta_propostas: number; meta_vgv_gerado: number; meta_vgv_assinado: number;
  obs_gerente: string;
  real_ligacoes: number | null; real_presenca: string | null; real_visitas_marcadas: number | null;
  real_visitas_realizadas: number | null; real_propostas: number | null; real_vgv_gerado: number | null;
  real_vgv_assinado: number | null; obs_dia: string | null; status_dia: string | null;
}

function calcStatusDia(line: CheckpointLine): string {
  let achieved = 0, total = 0;
  const checks = [
    [line.real_ligacoes, line.meta_ligacoes],
    [line.real_visitas_marcadas, line.meta_visitas_marcadas],
    [line.real_visitas_realizadas, line.meta_visitas_realizadas],
    [line.real_propostas, line.meta_propostas],
  ];
  for (const [real, meta] of checks) {
    if (meta && meta > 0) { total++; if (real != null && real >= meta) achieved++; }
  }
  if (total === 0) return "OK";
  const pct = achieved / total;
  if (pct >= 0.7) return "OK";
  if (pct >= 0.4) return "Atenção";
  return "Crítico";
}

const statusColors: Record<string, string> = {
  OK: "bg-success/10 text-success border-success/30",
  "Atenção": "bg-warning/10 text-warning border-warning/30",
  "Crítico": "bg-destructive/10 text-destructive border-destructive/30",
};

export default function CheckpointDaily() {
  const { user } = useAuth();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [checkpointStatus, setCheckpointStatus] = useState("aberto");
  const [lines, setLines] = useState<CheckpointLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const loadCheckpoint = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get team members
    const { data: team } = await supabase.from("team_members").select("*").eq("gerente_id", user.id).eq("status", "ativo").order("nome");
    const members = (team || []) as TeamMember[];

    // Get or create checkpoint
    let { data: cp } = await supabase.from("checkpoints").select("*").eq("gerente_id", user.id).eq("data", date).maybeSingle();

    if (!cp) {
      const { data: newCp, error } = await supabase.from("checkpoints").insert({ gerente_id: user.id, data: date }).select().single();
      if (error) { toast.error("Erro ao criar checkpoint."); setLoading(false); return; }
      cp = newCp;
    }

    setCheckpointId(cp.id);
    setCheckpointStatus(cp.status);

    // Get lines
    const { data: existingLines } = await supabase.from("checkpoint_lines").select("*").eq("checkpoint_id", cp.id);
    const linesMap = new Map((existingLines || []).map((l: any) => [l.corretor_id, l]));

    // Create lines for missing members
    const allLines: CheckpointLine[] = [];
    for (const m of members) {
      const existing = linesMap.get(m.id);
      if (existing) {
        allLines.push({
          id: existing.id, corretor_id: m.id, corretor_nome: m.nome,
          meta_ligacoes: existing.meta_ligacoes ?? 0, meta_presenca: existing.meta_presenca ?? "sim",
          meta_visitas_marcadas: existing.meta_visitas_marcadas ?? 0, meta_visitas_realizadas: existing.meta_visitas_realizadas ?? 0,
          meta_propostas: existing.meta_propostas ?? 0, meta_vgv_gerado: Number(existing.meta_vgv_gerado ?? 0),
          meta_vgv_assinado: Number(existing.meta_vgv_assinado ?? 0), obs_gerente: existing.obs_gerente ?? "",
          real_ligacoes: existing.real_ligacoes, real_presenca: existing.real_presenca,
          real_visitas_marcadas: existing.real_visitas_marcadas, real_visitas_realizadas: existing.real_visitas_realizadas,
          real_propostas: existing.real_propostas, real_vgv_gerado: existing.real_vgv_gerado != null ? Number(existing.real_vgv_gerado) : null,
          real_vgv_assinado: existing.real_vgv_assinado != null ? Number(existing.real_vgv_assinado) : null,
          obs_dia: existing.obs_dia, status_dia: existing.status_dia,
        });
      } else {
        // Insert new line
        const { data: newLine } = await supabase.from("checkpoint_lines").insert({
          checkpoint_id: cp.id, corretor_id: m.id,
        }).select().single();
        allLines.push({
          id: newLine?.id, corretor_id: m.id, corretor_nome: m.nome,
          meta_ligacoes: 0, meta_presenca: "sim", meta_visitas_marcadas: 0,
          meta_visitas_realizadas: 0, meta_propostas: 0, meta_vgv_gerado: 0, meta_vgv_assinado: 0,
          obs_gerente: "", real_ligacoes: null, real_presenca: null,
          real_visitas_marcadas: null, real_visitas_realizadas: null,
          real_propostas: null, real_vgv_gerado: null, real_vgv_assinado: null,
          obs_dia: null, status_dia: null,
        });
      }
    }
    setLines(allLines);
    setLoading(false);
  }, [user, date]);

  useEffect(() => { loadCheckpoint(); }, [loadCheckpoint]);

  const updateLine = (idx: number, field: keyof CheckpointLine, value: any) => {
    setLines((prev) => {
      const next = [...prev];
      (next[idx] as any)[field] = value;
      next[idx].status_dia = calcStatusDia(next[idx]);
      return next;
    });
    // Auto-save debounce
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveAll(), 2000);
  };

  const saveAll = async () => {
    if (!checkpointId) return;
    setSaving(true);
    for (const line of lines) {
      if (!line.id) continue;
      await supabase.from("checkpoint_lines").update({
        meta_ligacoes: line.meta_ligacoes, meta_presenca: line.meta_presenca,
        meta_visitas_marcadas: line.meta_visitas_marcadas, meta_visitas_realizadas: line.meta_visitas_realizadas,
        meta_propostas: line.meta_propostas, meta_vgv_gerado: line.meta_vgv_gerado,
        meta_vgv_assinado: line.meta_vgv_assinado, obs_gerente: line.obs_gerente,
        real_ligacoes: line.real_ligacoes, real_presenca: line.real_presenca,
        real_visitas_marcadas: line.real_visitas_marcadas, real_visitas_realizadas: line.real_visitas_realizadas,
        real_propostas: line.real_propostas, real_vgv_gerado: line.real_vgv_gerado,
        real_vgv_assinado: line.real_vgv_assinado, obs_dia: line.obs_dia,
        status_dia: calcStatusDia(line),
      }).eq("id", line.id);
    }
    setSaving(false);
    toast.success("Salvo!");
  };

  const duplicateYesterday = async () => {
    if (!user) return;
    const yesterday = format(subDays(new Date(date), 1), "yyyy-MM-dd");
    const { data: yCp } = await supabase.from("checkpoints").select("id").eq("gerente_id", user.id).eq("data", yesterday).maybeSingle();
    if (!yCp) { toast.error("Sem checkpoint de ontem."); return; }
    const { data: yLines } = await supabase.from("checkpoint_lines").select("*").eq("checkpoint_id", yCp.id);
    if (!yLines || yLines.length === 0) { toast.error("Sem dados de ontem."); return; }
    setLines((prev) => prev.map((line) => {
      const yLine = yLines.find((y: any) => y.corretor_id === line.corretor_id);
      if (!yLine) return line;
      return {
        ...line,
        meta_ligacoes: yLine.meta_ligacoes ?? 0, meta_presenca: yLine.meta_presenca ?? "sim",
        meta_visitas_marcadas: yLine.meta_visitas_marcadas ?? 0, meta_visitas_realizadas: yLine.meta_visitas_realizadas ?? 0,
        meta_propostas: yLine.meta_propostas ?? 0, meta_vgv_gerado: Number(yLine.meta_vgv_gerado ?? 0),
        meta_vgv_assinado: Number(yLine.meta_vgv_assinado ?? 0),
      };
    }));
    toast.success("Metas de ontem copiadas!");
  };

  const resetResults = () => {
    setLines((prev) => prev.map((l) => ({
      ...l, real_ligacoes: null, real_presenca: null, real_visitas_marcadas: null,
      real_visitas_realizadas: null, real_propostas: null, real_vgv_gerado: null,
      real_vgv_assinado: null, obs_dia: null, status_dia: null,
    })));
    toast.info("Resultados zerados (salve para confirmar).");
  };

  const publishMetas = async () => {
    if (!checkpointId) return;
    await saveAll();
    await supabase.from("checkpoints").update({ status: "metas_publicadas" }).eq("id", checkpointId);
    setCheckpointStatus("metas_publicadas");
    toast.success("Metas publicadas! Resultados podem ser preenchidos.");
  };

  const closeDay = async () => {
    if (!checkpointId) return;
    await saveAll();
    await supabase.from("checkpoints").update({ status: "fechado" }).eq("id", checkpointId);
    setCheckpointStatus("fechado");
    toast.success("Dia fechado!");
  };

  const changeDate = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(format(d, "yyyy-MM-dd"));
  };

  const metasLocked = checkpointStatus === "metas_publicadas" || checkpointStatus === "fechado";
  const resultsLocked = checkpointStatus === "fechado";

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando checkpoint...</div>;

  if (lines.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-2">Nenhum corretor ativo no time.</p>
        <p className="text-sm text-muted-foreground">Vá na aba "Meu Time" e adicione corretores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date nav + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => changeDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
            <Calendar className="h-4 w-4 text-primary" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-sm font-medium text-foreground border-none outline-none" />
          </div>
          <Button size="sm" variant="outline" onClick={() => changeDate(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>

        <div className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
          checkpointStatus === "aberto" ? "bg-info/10 text-info border-info/30" :
          checkpointStatus === "metas_publicadas" ? "bg-warning/10 text-warning border-warning/30" :
          "bg-success/10 text-success border-success/30"
        }`}>
          {checkpointStatus === "aberto" ? "🔵 Aberto" : checkpointStatus === "metas_publicadas" ? "🟡 Metas publicadas" : "🟢 Fechado"}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button size="sm" variant="outline" onClick={duplicateYesterday} className="gap-1.5 text-xs" disabled={metasLocked}>
            <Copy className="h-3.5 w-3.5" /> Copiar ontem
          </Button>
          <Button size="sm" variant="outline" onClick={resetResults} className="gap-1.5 text-xs" disabled={resultsLocked}>
            <RotateCcw className="h-3.5 w-3.5" /> Zerar resultados
          </Button>
          <Button size="sm" variant="outline" onClick={saveAll} className="gap-1.5 text-xs" disabled={saving}>
            <Save className="h-3.5 w-3.5" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
          {checkpointStatus === "aberto" && (
            <Button size="sm" onClick={publishMetas} className="gap-1.5 text-xs">
              <Lock className="h-3.5 w-3.5" /> Publicar metas
            </Button>
          )}
          {checkpointStatus === "metas_publicadas" && (
            <Button size="sm" onClick={closeDay} className="gap-1.5 text-xs bg-success hover:bg-success/90 text-success-foreground">
              <Lock className="h-3.5 w-3.5" /> Fechar dia
            </Button>
          )}
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="rounded-xl border border-border bg-card shadow-card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-3 py-2 font-display font-semibold sticky left-0 bg-muted/40 z-10 min-w-[140px]">Corretor</th>
              <th colSpan={8} className="text-center px-2 py-1 font-display font-semibold text-primary border-l border-border">METAS</th>
              <th colSpan={9} className="text-center px-2 py-1 font-display font-semibold text-success border-l border-border">RESULTADOS</th>
            </tr>
            <tr className="border-b border-border bg-muted/20">
              <th className="px-3 py-1.5 text-left sticky left-0 bg-muted/20 z-10"></th>
              {/* Meta cols */}
              <th className="px-2 py-1.5 text-center border-l border-border min-w-[60px]">Lig.</th>
              <th className="px-2 py-1.5 text-center min-w-[60px]">Pres.</th>
              <th className="px-2 py-1.5 text-center min-w-[60px]">V.Marc</th>
              <th className="px-2 py-1.5 text-center min-w-[60px]">V.Real</th>
              <th className="px-2 py-1.5 text-center min-w-[60px]">Prop.</th>
              <th className="px-2 py-1.5 text-center min-w-[80px]">VGV Ger.</th>
              <th className="px-2 py-1.5 text-center min-w-[80px]">VGV Ass.</th>
              <th className="px-2 py-1.5 text-center min-w-[100px]">Obs</th>
              {/* Result cols */}
              <th className="px-2 py-1.5 text-center border-l border-border min-w-[60px]">Lig.</th>
              <th className="px-2 py-1.5 text-center min-w-[60px]">Pres.</th>
              <th className="px-2 py-1.5 text-center min-w-[60px]">V.Marc</th>
              <th className="px-2 py-1.5 text-center min-w-[60px]">V.Real</th>
              <th className="px-2 py-1.5 text-center min-w-[60px]">Prop.</th>
              <th className="px-2 py-1.5 text-center min-w-[80px]">VGV Ger.</th>
              <th className="px-2 py-1.5 text-center min-w-[80px]">VGV Ass.</th>
              <th className="px-2 py-1.5 text-center min-w-[100px]">Obs</th>
              <th className="px-2 py-1.5 text-center min-w-[70px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.corretor_id} className="border-b border-border hover:bg-muted/10 transition-colors">
                <td className="px-3 py-1.5 font-medium text-foreground sticky left-0 bg-card z-10">{line.corretor_nome}</td>
                {/* Meta inputs */}
                <td className="px-1 py-1 border-l border-border"><Input type="number" className="h-7 text-xs text-center px-1" value={line.meta_ligacoes} onChange={(e) => updateLine(idx, "meta_ligacoes", Number(e.target.value))} disabled={metasLocked} /></td>
                <td className="px-1 py-1"><Input className="h-7 text-xs text-center px-1" value={line.meta_presenca} onChange={(e) => updateLine(idx, "meta_presenca", e.target.value)} disabled={metasLocked} /></td>
                <td className="px-1 py-1"><Input type="number" className="h-7 text-xs text-center px-1" value={line.meta_visitas_marcadas} onChange={(e) => updateLine(idx, "meta_visitas_marcadas", Number(e.target.value))} disabled={metasLocked} /></td>
                <td className="px-1 py-1"><Input type="number" className="h-7 text-xs text-center px-1" value={line.meta_visitas_realizadas} onChange={(e) => updateLine(idx, "meta_visitas_realizadas", Number(e.target.value))} disabled={metasLocked} /></td>
                <td className="px-1 py-1"><Input type="number" className="h-7 text-xs text-center px-1" value={line.meta_propostas} onChange={(e) => updateLine(idx, "meta_propostas", Number(e.target.value))} disabled={metasLocked} /></td>
                <td className="px-1 py-1"><Input type="number" className="h-7 text-xs text-center px-1" value={line.meta_vgv_gerado} onChange={(e) => updateLine(idx, "meta_vgv_gerado", Number(e.target.value))} disabled={metasLocked} /></td>
                <td className="px-1 py-1"><Input type="number" className="h-7 text-xs text-center px-1" value={line.meta_vgv_assinado} onChange={(e) => updateLine(idx, "meta_vgv_assinado", Number(e.target.value))} disabled={metasLocked} /></td>
                <td className="px-1 py-1"><Input className="h-7 text-xs px-1" value={line.obs_gerente} onChange={(e) => updateLine(idx, "obs_gerente", e.target.value)} disabled={metasLocked} placeholder="..." /></td>
                {/* Result inputs */}
                <td className="px-1 py-1 border-l border-border"><Input type="number" className="h-7 text-xs text-center px-1" value={line.real_ligacoes ?? ""} onChange={(e) => updateLine(idx, "real_ligacoes", e.target.value ? Number(e.target.value) : null)} disabled={resultsLocked} /></td>
                <td className="px-1 py-1"><Input className="h-7 text-xs text-center px-1" value={line.real_presenca ?? ""} onChange={(e) => updateLine(idx, "real_presenca", e.target.value || null)} disabled={resultsLocked} /></td>
                <td className="px-1 py-1"><Input type="number" className="h-7 text-xs text-center px-1" value={line.real_visitas_marcadas ?? ""} onChange={(e) => updateLine(idx, "real_visitas_marcadas", e.target.value ? Number(e.target.value) : null)} disabled={resultsLocked} /></td>
                <td className="px-1 py-1"><Input type="number" className="h-7 text-xs text-center px-1" value={line.real_visitas_realizadas ?? ""} onChange={(e) => updateLine(idx, "real_visitas_realizadas", e.target.value ? Number(e.target.value) : null)} disabled={resultsLocked} /></td>
                <td className="px-1 py-1"><Input type="number" className="h-7 text-xs text-center px-1" value={line.real_propostas ?? ""} onChange={(e) => updateLine(idx, "real_propostas", e.target.value ? Number(e.target.value) : null)} disabled={resultsLocked} /></td>
                <td className="px-1 py-1"><Input type="number" className="h-7 text-xs text-center px-1" value={line.real_vgv_gerado ?? ""} onChange={(e) => updateLine(idx, "real_vgv_gerado", e.target.value ? Number(e.target.value) : null)} disabled={resultsLocked} /></td>
                <td className="px-1 py-1"><Input type="number" className="h-7 text-xs text-center px-1" value={line.real_vgv_assinado ?? ""} onChange={(e) => updateLine(idx, "real_vgv_assinado", e.target.value ? Number(e.target.value) : null)} disabled={resultsLocked} /></td>
                <td className="px-1 py-1"><Input className="h-7 text-xs px-1" value={line.obs_dia ?? ""} onChange={(e) => updateLine(idx, "obs_dia", e.target.value || null)} disabled={resultsLocked} placeholder="..." /></td>
                <td className="px-1 py-1 text-center">
                  {line.status_dia && (
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${statusColors[line.status_dia] || ""}`}>
                      {line.status_dia}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
