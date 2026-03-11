import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Download, Copy, RefreshCw, Sparkles, TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { formatBRLCompact } from "@/lib/utils";

const fmtCurrency = formatBRLCompact;

function VariacaoIcon({ v }: { v: number }) {
  if (v > 0) return <TrendingUp className="h-3.5 w-3.5 text-success inline" />;
  if (v < 0) return <TrendingDown className="h-3.5 w-3.5 text-destructive inline" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground inline" />;
}

export default function CeoMonthlyReports() {
  const [generating, setGenerating] = useState(false);
  const [selectedMes, setSelectedMes] = useState<string | null>(null);

  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ["executive-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("executive_reports")
        .select("*")
        .order("mes", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  const selectedReport = reports?.find(r => r.mes === selectedMes);

  const generateReport = async (mes?: string) => {
    setGenerating(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-monthly-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ mes }),
      });
      if (!resp.ok) throw new Error("Falha ao gerar relatório");
      const result = await resp.json();
      toast.success("Relatório gerado com sucesso!");
      await refetch();
      setSelectedMes(mes || result.mes);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyReport = () => {
    if (selectedReport?.conteudo_completo) {
      navigator.clipboard.writeText(selectedReport.conteudo_completo as string);
      toast.success("Relatório copiado!");
    }
  };

  const printReport = () => {
    if (!selectedReport?.conteudo_completo) return;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`<html><head><title>${selectedReport.titulo}</title><style>body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;line-height:1.7;color:#1a1a2e}h1{color:#4E6BFF;border-bottom:2px solid #4E6BFF;padding-bottom:8px}h2{color:#1a1a2e;margin-top:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}@media print{body{font-size:11pt}}</style></head><body><div id="content"></div><script>document.getElementById("content").innerHTML = ${JSON.stringify((selectedReport.conteudo_completo as string).replace(/\n/g, "<br>"))}</script></body></html>`);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  // Generate month options for the last 6 months
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1 - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const formatMesLabel = (mes: string) => {
    const [y, m] = mes.split("-").map(Number);
    return new Date(y, m - 1).toLocaleString("pt-BR", { month: "long", year: "numeric" });
  };

  const metricas = selectedReport?.metricas as any;
  const comparativo = selectedReport?.comparativo as any;

  return (
    <div className="space-y-4">
      {/* Header & Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Relatórios Executivos Mensais
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateReport()}
                disabled={generating}
                className="gap-1.5"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar Mês Anterior
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Month selector */}
          <div className="flex flex-wrap gap-2">
            {monthOptions.map(mes => {
              const report = reports?.find(r => r.mes === mes);
              const isSelected = selectedMes === mes;
              return (
                <Button
                  key={mes}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    if (report) {
                      setSelectedMes(mes);
                    } else {
                      generateReport(mes);
                    }
                  }}
                  disabled={generating}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {formatMesLabel(mes)}
                  {report ? (
                    <Badge variant="secondary" className="ml-1 text-[10px]">
                      {report.status === "completo" ? "✓" : "..."}
                    </Badge>
                  ) : null}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Carregando relatórios...
        </div>
      )}

      {/* Selected Report */}
      {selectedReport && (
        <>
          {/* KPI Cards */}
          {metricas && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: "Leads", key: "leads" },
                { label: "Ligações", key: "ligacoes" },
                { label: "Visitas Marc.", key: "visitas_marcadas" },
                { label: "Visitas Real.", key: "visitas_realizadas" },
                { label: "Propostas", key: "propostas" },
                { label: "VGV Assinado", key: "vgv_assinado", currency: true },
              ].map(({ label, key, currency }) => {
                const val = metricas[key] || 0;
                const comp = comparativo?.[key];
                const variacao = comp?.variacao || 0;
                return (
                  <Card key={key} className="border-border">
                    <CardContent className="p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                      <p className="text-lg font-display font-bold mt-0.5">
                        {currency ? fmtCurrency(val) : val.toLocaleString("pt-BR")}
                      </p>
                      {comp && (
                        <div className="flex items-center gap-1 mt-1">
                          <VariacaoIcon v={variacao} />
                          <span className={`text-[10px] font-medium ${variacao > 0 ? "text-success" : variacao < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {variacao > 0 ? "+" : ""}{variacao}% vs anterior
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Additional KPIs row */}
          {metricas && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-border">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Ticket Médio</p>
                  <p className="text-lg font-display font-bold">{fmtCurrency(metricas.ticketMedio || 0)}</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Negócios PDN</p>
                  <p className="text-lg font-display font-bold">{metricas.pdnCount || 0}</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">VGV PDN</p>
                  <p className="text-lg font-display font-bold">{fmtCurrency(metricas.pdnVgv || 0)}</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">PDN Assinado</p>
                  <p className="text-lg font-display font-bold">{fmtCurrency(metricas.pdnAssinado || 0)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Comparativo Table */}
          {comparativo && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">📊 Comparativo vs Mês Anterior</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-3 py-2">Métrica</th>
                        <th className="px-3 py-2 text-center">Anterior</th>
                        <th className="px-3 py-2 text-center">Atual</th>
                        <th className="px-3 py-2 text-center">Variação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(comparativo).map(([key, v]: [string, any]) => {
                        const isCurrency = key.includes("vgv");
                        return (
                          <tr key={key} className="border-b border-border">
                            <td className="px-3 py-2 font-medium capitalize">{key.replace(/_/g, " ")}</td>
                            <td className="px-3 py-2 text-center">{isCurrency ? fmtCurrency(v.anterior) : v.anterior}</td>
                            <td className="px-3 py-2 text-center font-semibold">{isCurrency ? fmtCurrency(v.atual) : v.atual}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex items-center gap-1 font-semibold ${v.variacao > 0 ? "text-success" : v.variacao < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                <VariacaoIcon v={v.variacao} />
                                {v.variacao > 0 ? "+" : ""}{v.variacao}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full AI Report */}
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{selectedReport.titulo}</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => generateReport(selectedReport.mes)} disabled={generating} className="gap-1.5 text-xs">
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerar
                  </Button>
                  <Button size="sm" variant="outline" onClick={copyReport} className="gap-1.5 text-xs">
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                  <Button size="sm" variant="outline" onClick={printReport} className="gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" /> Imprimir
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{(selectedReport.conteudo_completo as string) || ""}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty state */}
      {!isLoading && !selectedReport && reports?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="font-display font-semibold text-foreground mb-1">Nenhum relatório gerado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Clique em "Gerar Mês Anterior" ou selecione um mês para gerar o relatório executivo.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
