import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRLCompact } from "@/lib/utils";
import type { TeamData, CorretorRankData, KPIs } from "@/hooks/useCeoDashboard";

interface Props {
  teams: TeamData[];
  corretoresRank: CorretorRankData[];
  kpis: KPIs;
  totalLeads: number;
  presentesHoje: number;
}

export default function CeoDailyReport({ teams, corretoresRank, kpis, totalLeads, presentesHoje }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const hoje = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const hojeShort = format(new Date(), "dd-MM-yyyy");

  const totalTeam = teams.reduce((acc, t) => ({
    ligacoes: acc.ligacoes + t.ligacoes,
    aproveitados: acc.aproveitados + t.aproveitados,
    visitasMarcadas: acc.visitasMarcadas + t.visitasMarcadas,
    visitasRealizadas: acc.visitasRealizadas + t.visitasRealizadas,
    propostas: acc.propostas + t.propostas,
    vgv: acc.vgv + t.vgv,
  }), { ligacoes: 0, aproveitados: 0, visitasMarcadas: 0, visitasRealizadas: 0, propostas: 0, vgv: 0 });

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const mod = await import("html2pdf.js");
      const html2pdfFn = mod.default || mod;
      const worker = html2pdfFn();
      await worker
        .set({
          margin: [8, 8, 8, 8],
          filename: `relatorio-diario-${hojeShort}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .from(reportRef.current.cloneNode(true))
        .save();
    } catch (e) {
      console.error("PDF error:", e);
      const { toast } = await import("sonner");
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setDownloading(false);
    }
  };

  const getCorretoresByGerente = (gerenteId: string) =>
    corretoresRank.filter(c => {
      const team = teams.find(t => t.gerente_id === gerenteId);
      return team && c.gerente_nome === team.gerente_nome;
    });

  return (
    <div className="space-y-4">
      {/* Download bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Relatório do Dia</h3>
          <Badge variant="outline" className="text-[10px] capitalize">{hoje}</Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleDownloadPDF}
            disabled={downloading}
          >
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Baixar PDF
          </Button>
        </div>
      </div>

      {/* Report content (this is what gets exported) */}
      <div ref={reportRef} className="space-y-4 bg-background">
        {/* Header */}
        <div className="rounded-xl border border-border bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">📊 Relatório Diário de Performance</h2>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{hoje}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{presentesHoje} corretores presentes</p>
              <p>{totalLeads} leads no período</p>
            </div>
          </div>
        </div>

        {/* Consolidado geral */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🏢 Consolidado Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { label: "Ligações", value: totalTeam.ligacoes },
                { label: "Aproveitados", value: totalTeam.aproveitados },
                { label: "V. Marcadas", value: totalTeam.visitasMarcadas },
                { label: "V. Realizadas", value: totalTeam.visitasRealizadas },
                { label: "Propostas", value: totalTeam.propostas },
                { label: "VGV Assinado", value: totalTeam.vgv, currency: true },
              ].map(m => (
                <div key={m.label} className="text-center p-2 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  <p className="text-sm font-bold mt-0.5">
                    {m.currency ? formatBRLCompact(m.value) : m.value}
                  </p>
                </div>
              ))}
            </div>
            {totalTeam.ligacoes > 0 && (
              <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
                <span>Taxa conversão: <strong className="text-foreground">{Math.round((totalTeam.aproveitados / totalTeam.ligacoes) * 100)}%</strong></span>
                <span>Lig → VM: <strong className="text-foreground">{Math.round((totalTeam.visitasMarcadas / totalTeam.ligacoes) * 100)}%</strong></span>
                {totalTeam.visitasMarcadas > 0 && (
                  <span>VM → VR: <strong className="text-foreground">{Math.round((totalTeam.visitasRealizadas / totalTeam.visitasMarcadas) * 100)}%</strong></span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per team */}
        {teams.map(team => {
          const corretores = getCorretoresByGerente(team.gerente_id);
          const teamTaxa = team.ligacoes > 0 ? Math.round((team.aproveitados / team.ligacoes) * 100) : 0;
          return (
            <Card key={team.gerente_id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    👤 Equipe {team.gerente_nome}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${teamTaxa >= 30 ? "border-emerald-500/50 text-emerald-600" : teamTaxa >= 15 ? "border-amber-500/50 text-amber-600" : "border-destructive/50 text-destructive"}`}
                  >
                    {teamTaxa}% conversão
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Team summary */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                  {[
                    { label: "Ligações", value: team.ligacoes },
                    { label: "Aproveitados", value: team.aproveitados },
                    { label: "V. Marcadas", value: team.visitasMarcadas },
                    { label: "V. Realizadas", value: team.visitasRealizadas },
                    { label: "Propostas", value: team.propostas },
                    { label: "VGV", value: team.vgv, currency: true },
                  ].map(m => (
                    <div key={m.label} className="text-center p-1.5 rounded bg-muted/20">
                      <p className="text-[9px] text-muted-foreground">{m.label}</p>
                      <p className="text-xs font-bold">{m.currency ? formatBRLCompact(m.value) : m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Corretores table */}
                {corretores.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left pb-1.5 font-medium">Corretor</th>
                          <th className="text-right pb-1.5 font-medium">Lig</th>
                          <th className="text-right pb-1.5 font-medium">Aprov</th>
                          <th className="text-right pb-1.5 font-medium">Taxa</th>
                          <th className="text-right pb-1.5 font-medium">VM</th>
                          <th className="text-right pb-1.5 font-medium">VR</th>
                          <th className="text-right pb-1.5 font-medium">Prop</th>
                          <th className="text-right pb-1.5 font-medium">VGV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {corretores
                          .sort((a, b) => b.ligacoes - a.ligacoes)
                          .map(c => (
                            <tr key={c.corretor_id} className="border-b border-border/50 hover:bg-muted/10">
                              <td className="py-1.5 font-medium">{c.nome}</td>
                              <td className="py-1.5 text-right">{c.ligacoes}</td>
                              <td className="py-1.5 text-right">{c.aproveitados}</td>
                              <td className={`py-1.5 text-right font-semibold ${c.taxa >= 30 ? "text-emerald-600" : c.taxa >= 15 ? "text-amber-600" : "text-destructive"}`}>
                                {c.taxa}%
                              </td>
                              <td className="py-1.5 text-right">{c.visitasMarcadas}</td>
                              <td className="py-1.5 text-right">{c.visitasRealizadas}</td>
                              <td className="py-1.5 text-right">{c.propostas}</td>
                              <td className="py-1.5 text-right font-semibold">{formatBRLCompact(c.vgv)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {corretores.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Sem dados de corretores</p>
                )}
              </CardContent>
            </Card>
          );
        })}

        {teams.length === 0 && (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground text-center">Sem dados de equipes para o período selecionado</p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-[10px] text-muted-foreground text-center">
          Relatório gerado automaticamente pelo UHOME IA • {format(new Date(), "dd/MM/yyyy HH:mm")}
        </p>
      </div>
    </div>
  );
}
