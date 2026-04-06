import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatBRLCompact } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Loader2, Printer, CalendarIcon } from "lucide-react";

import { toast } from "sonner";

interface Props {
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
  gerenteNome: string;
}

type ReportPeriod = "semana" | "mes" | "custom";

function getPeriodRange(period: ReportPeriod, customFrom?: Date, customTo?: Date) {
  const now = new Date();
  if (period === "custom" && customFrom && customTo) {
    return {
      start: format(customFrom, "yyyy-MM-dd"),
      end: format(customTo, "yyyy-MM-dd"),
      startTs: `${format(customFrom, "yyyy-MM-dd")}T00:00:00-03:00`,
      endTs: `${format(customTo, "yyyy-MM-dd")}T23:59:59.999-03:00`,
      label: `${format(customFrom, "dd/MM/yyyy", { locale: ptBR })} a ${format(customTo, "dd/MM/yyyy", { locale: ptBR })}`,
    };
  }
  if (period === "semana") {
    const s = startOfWeek(now, { weekStartsOn: 1 });
    const e = endOfWeek(now, { weekStartsOn: 1 });
    return {
      start: format(s, "yyyy-MM-dd"),
      end: format(e, "yyyy-MM-dd"),
      startTs: `${format(s, "yyyy-MM-dd")}T00:00:00-03:00`,
      endTs: `${format(e, "yyyy-MM-dd")}T23:59:59.999-03:00`,
      label: `Semana ${format(s, "dd/MM", { locale: ptBR })} a ${format(e, "dd/MM", { locale: ptBR })}`,
    };
  }
  const s = startOfMonth(now);
  const e = endOfMonth(now);
  return {
    start: format(s, "yyyy-MM-dd"),
    end: format(e, "yyyy-MM-dd"),
    startTs: `${format(s, "yyyy-MM-dd")}T00:00:00-03:00`,
    endTs: `${format(e, "yyyy-MM-dd")}T23:59:59.999-03:00`,
    label: format(s, "MMMM yyyy", { locale: ptBR }),
  };
}

interface CorretorRow {
  nome: string;
  ligacoes: number;
  aproveitados: number;
  taxa: number;
  roleta: number;
  descartados: number;
  followups: number;
  atualizados: number;
  visitas_marcadas: number;
  visitas_realizadas: number;
  negocios: number;
  propostas: number;
  assinados: number;
  vgv: number;
  pontos: number;
}

export default function TeamReportExport({ teamUserIds, teamNameMap, gerenteNome }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<ReportPeriod>("semana");
  const [loading, setLoading] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const generateReport = useCallback(async () => {
    if (!user || teamUserIds.length === 0) return;
    if (period === "custom" && (!customFrom || !customTo)) {
      toast.error("Selecione as datas de início e fim");
      return;
    }
    setLoading(true);

    try {
      const { start, end, startTs, endTs, label } = getPeriodRange(period, customFrom, customTo);

      // Get profile mappings
      const { data: profiles } = await supabase.from("profiles").select("id, user_id").in("user_id", teamUserIds);
      const userToProfile: Record<string, string> = {};
      const profileToUser: Record<string, string> = {};
      (profiles || []).forEach(p => {
        userToProfile[p.user_id] = p.id;
        profileToUser[p.id] = p.user_id;
      });
      const teamProfileIds = (profiles || []).map(p => p.id);

      // Parallel queries
      const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
        supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado, pontos").in("corretor_id", teamUserIds).gte("created_at", startTs).lte("created_at", endTs).limit(10000),
        supabase.from("visitas").select("corretor_id, status").in("corretor_id", teamUserIds).gte("data_visita", start).lte("data_visita", end),
        supabase.from("negocios").select("corretor_id, fase, vgv_estimado, vgv_final, data_assinatura, created_at, fase_changed_at").in("corretor_id", teamProfileIds),
        supabase.from("pipeline_tarefas").select("responsavel_id").in("responsavel_id", teamUserIds).gte("concluida_em", startTs).lte("concluida_em", endTs),
        supabase.from("distribuicao_historico").select("corretor_id").in("corretor_id", teamUserIds).eq("acao", "aceito").gte("created_at", startTs).lte("created_at", endTs),
        supabase.from("pipeline_leads").select("corretor_id").in("corretor_id", teamUserIds).eq("arquivado", true).gte("updated_at", startTs).lte("updated_at", endTs),
        supabase.from("pipeline_leads").select("corretor_id").in("corretor_id", teamUserIds).gte("ultima_acao_at", startTs).lte("ultima_acao_at", endTs),
      ]);

      // Build stats
      const stats: Record<string, CorretorRow> = {};
      teamUserIds.forEach(uid => {
        stats[uid] = {
          nome: teamNameMap[uid] || "Corretor",
          ligacoes: 0, aproveitados: 0, taxa: 0,
          roleta: 0, descartados: 0, followups: 0, atualizados: 0,
          visitas_marcadas: 0, visitas_realizadas: 0,
          negocios: 0, propostas: 0, assinados: 0, vgv: 0, pontos: 0,
        };
      });

      (r1.data || []).forEach(t => {
        if (!stats[t.corretor_id]) return;
        stats[t.corretor_id].ligacoes++;
        stats[t.corretor_id].pontos += t.pontos || 0;
        if (t.resultado === "com_interesse") stats[t.corretor_id].aproveitados++;
      });

      (r2.data || []).forEach(v => {
        if (!v.corretor_id || !stats[v.corretor_id]) return;
        if (v.status !== "cancelada") stats[v.corretor_id].visitas_marcadas++;
        if (v.status === "realizada") stats[v.corretor_id].visitas_realizadas++;
      });

      (r3.data || []).forEach(n => {
        if (!n.corretor_id) return;
        const uid = profileToUser[n.corretor_id];
        if (!uid || !stats[uid]) return;
        if (n.created_at && n.created_at >= startTs && n.created_at <= endTs) stats[uid].negocios++;
        if (n.fase === "proposta" && n.fase_changed_at && n.fase_changed_at >= startTs && n.fase_changed_at <= endTs) stats[uid].propostas++;
        if ((n.fase === "assinado" || n.fase === "vendido") && n.data_assinatura && n.data_assinatura >= start && n.data_assinatura <= end) {
          stats[uid].assinados++;
          stats[uid].vgv += Number(n.vgv_final || n.vgv_estimado || 0);
        }
      });

      (r4.data || []).forEach(f => { const uid = (f as any).responsavel_id; if (uid && stats[uid]) stats[uid].followups++; });
      (r5.data || []).forEach(r => { if (r.corretor_id && stats[r.corretor_id]) stats[r.corretor_id].roleta++; });
      (r6.data || []).forEach(d => { if (d.corretor_id && stats[d.corretor_id]) stats[d.corretor_id].descartados++; });
      (r7.data || []).forEach(a => { if (a.corretor_id && stats[a.corretor_id]) stats[a.corretor_id].atualizados++; });

      Object.values(stats).forEach(s => {
        s.taxa = s.ligacoes > 0 ? Math.round((s.aproveitados / s.ligacoes) * 100) : 0;
      });

      const rows = Object.values(stats).sort((a, b) => b.pontos - a.pontos);
      const sum = (key: keyof CorretorRow) => rows.reduce((s, r) => s + (r[key] as number), 0);
      const totalLig = sum("ligacoes");
      const totalAprov = sum("aproveitados");
      const totals = {
        ligacoes: totalLig, aproveitados: totalAprov,
        taxa: totalLig > 0 ? Math.round((totalAprov / totalLig) * 100) : 0,
        roleta: sum("roleta"), descartados: sum("descartados"), followups: sum("followups"), atualizados: sum("atualizados"),
        visitas_marcadas: sum("visitas_marcadas"), visitas_realizadas: sum("visitas_realizadas"),
        negocios: sum("negocios"), propostas: sum("propostas"), assinados: sum("assinados"),
        vgv: sum("vgv"), pontos: sum("pontos"),
      };

      // Generate printable HTML
      const html = buildReportHTML(rows, totals, label, gerenteNome, rows.length);
      printReport(html);
      toast.success("Relatório gerado!");
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  }, [user, teamUserIds, teamNameMap, period, gerenteNome, customFrom, customTo]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileDown className="h-4 w-4" />
          <span className="hidden sm:inline">Relatório Equipe</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Gerar Relatório da Equipe</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Período</label>
            <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semana">Esta semana</SelectItem>
                <SelectItem value="mes">Este mês</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === "custom" && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left font-normal", !customFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customFrom ? format(customFrom, "dd/MM/yyyy") : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left font-normal", !customTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customTo ? format(customTo, "dd/MM/yyyy") : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} disabled={(d) => customFrom ? d < customFrom : false} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}
          <Button onClick={generateReport} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {loading ? "Gerando..." : "Gerar e Imprimir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function printReport(html: string) {
  const w = window.open("", "_blank");
  if (!w) { toast.error("Popup bloqueado. Permita popups."); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

function buildReportHTML(
  rows: CorretorRow[],
  totals: Record<string, number>,
  periodLabel: string,
  gerenteNome: string,
  teamSize: number,
): string {
  const fmtVGV = (v: number) => {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
    return `R$ ${v.toFixed(0)}`;
  };

  const tableRows = rows.map((r, i) => `
    <tr>
      <td style="font-weight:700;color:#888">${i + 1}</td>
      <td style="font-weight:600;text-align:left;white-space:nowrap">${r.nome.split(" ").slice(0, 2).join(" ")}</td>
      <td>${r.ligacoes}</td>
      <td>${r.aproveitados}</td>
      <td>${r.taxa}%</td>
      <td>${r.roleta}</td>
      <td>${r.descartados}</td>
      <td>${r.followups}</td>
      <td>${r.atualizados}</td>
      <td>${r.visitas_marcadas}</td>
      <td>${r.visitas_realizadas}</td>
      <td>${r.negocios}</td>
      <td>${r.propostas}</td>
      <td>${r.assinados}</td>
      <td>${fmtVGV(r.vgv)}</td>
      <td style="font-weight:800">${r.pontos}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Relatório Equipe — ${gerenteNome}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1a1a1a; font-size: 11px; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 16px; }
  .summary { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .summary-card { border: 1px solid #ddd; border-radius: 8px; padding: 10px 14px; min-width: 100px; }
  .summary-card .label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-card .value { font-size: 20px; font-weight: 800; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #f5f5f5; padding: 6px 4px; text-align: center; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 2px solid #ddd; }
  td { padding: 5px 4px; text-align: center; border-bottom: 1px solid #eee; }
  tr:hover { background: #fafafa; }
  .total-row td { font-weight: 700; background: #f0f4ff; border-top: 2px solid #3b82f6; }
  .group-header { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px; }
  .blue { color: #2563eb; }
  .green { color: #16a34a; }
  .amber { color: #d97706; }
  .purple { color: #7c3aed; }
  .footer { margin-top: 16px; font-size: 9px; color: #999; text-align: center; }
  @media print { body { padding: 12px; } }
</style>
</head><body>
  <h1>📊 Relatório da Equipe — ${gerenteNome}</h1>
  <p class="sub">${periodLabel} · ${teamSize} corretores · Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
  
  <div class="summary">
    <div class="summary-card">
      <div class="label">Ligações</div>
      <div class="value blue">${totals.ligacoes}</div>
    </div>
    <div class="summary-card">
      <div class="label">Aproveitados</div>
      <div class="value green">${totals.aproveitados} <span style="font-size:12px;color:#888">(${totals.taxa}%)</span></div>
    </div>
    <div class="summary-card">
      <div class="label">Visitas Marc.</div>
      <div class="value amber">${totals.visitas_marcadas}</div>
    </div>
    <div class="summary-card">
      <div class="label">Visitas Real.</div>
      <div class="value green">${totals.visitas_realizadas}</div>
    </div>
    <div class="summary-card">
      <div class="label">Assinados</div>
      <div class="value purple">${totals.assinados}</div>
    </div>
    <div class="summary-card">
      <div class="label">VGV Assinado</div>
      <div class="value purple">${fmtVGV(totals.vgv)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th style="text-align:left">Corretor</th>
        <th class="blue">Lig</th>
        <th class="blue">Aprov</th>
        <th class="blue">Taxa</th>
        <th class="green">Roleta</th>
        <th class="green">Desc.</th>
        <th class="green">Follow</th>
        <th class="green">Atual.</th>
        <th class="amber">V.Marc</th>
        <th class="amber">V.Real</th>
        <th class="purple">Negóc.</th>
        <th class="purple">Prop.</th>
        <th class="purple">Assin.</th>
        <th class="purple">VGV</th>
        <th>Pts</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr class="total-row">
        <td colspan="2" style="text-align:left;font-weight:800">TOTAL</td>
        <td>${totals.ligacoes}</td>
        <td>${totals.aproveitados}</td>
        <td>${totals.taxa}%</td>
        <td>${totals.roleta}</td>
        <td>${totals.descartados}</td>
        <td>${totals.followups}</td>
        <td>${totals.atualizados}</td>
        <td>${totals.visitas_marcadas}</td>
        <td>${totals.visitas_realizadas}</td>
        <td>${totals.negocios}</td>
        <td>${totals.propostas}</td>
        <td>${totals.assinados}</td>
        <td>${fmtVGV(totals.vgv)}</td>
        <td style="font-weight:800">${totals.pontos}</td>
      </tr>
    </tbody>
  </table>
  <p class="footer">UHome CRM · Relatório gerado automaticamente</p>
</body></html>`;
}
