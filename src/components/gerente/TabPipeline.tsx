import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Building2, Briefcase, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { formatBRLCompact } from "@/lib/utils";
import type { FunnelStage, VisitaHoje, NegocioAcao } from "@/hooks/useGerenteDashboard";

interface NegPorFase {
  id: string;
  nome_cliente: string;
  empreendimento: string;
  vgv: number;
  fase: string;
  corretor_nome: string;
}

interface Props {
  funnel: FunnelStage[];
  negociosPorFase: { proposta: NegPorFase[]; negociacao: NegPorFase[]; documentacao: NegPorFase[] };
  agendaHoje: VisitaHoje[];
}

const statusIcons: Record<string, string> = { marcada: "🟡", confirmada: "🟢", realizada: "✅", no_show: "🔴", reagendada: "🔄", cancelada: "⬛" };

export default function TabPipeline({ funnel, negociosPorFase, agendaHoje }: Props) {
  const navigate = useNavigate();

  // Compute VGV by fase
  const faseData = [
    { key: "proposta", label: "Proposta", items: negociosPorFase.proposta, color: "bg-amber-500", textColor: "text-amber-600" },
    { key: "negociacao", label: "Negociação", items: negociosPorFase.negociacao, color: "bg-orange-500", textColor: "text-orange-600" },
    { key: "documentacao", label: "Contrato", items: negociosPorFase.documentacao, color: "bg-purple-500", textColor: "text-purple-600" },
  ];

  return (
    <div className="space-y-4">
      {/* Funil de Leads */}
      {funnel.length > 0 && (
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground">Funil de Leads</h2>
              <button className="text-[10px] text-primary hover:underline font-medium flex items-center gap-1" onClick={() => navigate("/pipeline-leads")}>
                Pipeline <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-border/30 rounded-full" />
              <div className="relative flex items-center justify-between gap-1">
                {funnel.map((stage, i) => {
                  const maxCount = Math.max(...funnel.map(s => s.count), 1);
                  const intensity = Math.max(0.15, stage.count / maxCount);
                  const colors = ["bg-violet-500", "bg-slate-500", "bg-blue-500", "bg-sky-500", "bg-amber-500", "bg-orange-500", "bg-cyan-500", "bg-teal-500", "bg-yellow-500", "bg-emerald-500"];
                  const bgColor = colors[i % colors.length];
                  const size = Math.max(36, 36 + (intensity * 20));
                  return (
                    <div key={stage.key} className="flex items-center">
                      <div className="flex flex-col items-center relative">
                        <div className={`${bgColor} rounded-full flex items-center justify-center text-white font-black shadow-lg`} style={{ width: size, height: size, fontSize: size > 44 ? 16 : 13 }}>
                          {stage.count}
                        </div>
                        <p className="text-[9px] font-medium text-muted-foreground text-center mt-1.5 leading-tight max-w-[70px]">{stage.label}</p>
                        {i > 0 && stage.pct > 0 && (
                          <span className={`absolute -top-5 text-[8px] font-bold px-1 py-0.5 rounded-full ${stage.pct >= 50 ? "text-emerald-600 bg-emerald-500/10" : stage.pct >= 20 ? "text-amber-600 bg-amber-500/10" : "text-destructive bg-destructive/10"}`}>{stage.pct}%</span>
                        )}
                      </div>
                      {i < funnel.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/30 mx-0.5 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Funil de Negócios por fase */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">Negócios por Fase</h2>
            </div>
            <button className="text-[10px] text-primary hover:underline font-medium flex items-center gap-1" onClick={() => navigate("/pipeline-negocios")}>
              Pipeline <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {faseData.map(fase => {
              const totalVgv = fase.items.reduce((s, n) => s + n.vgv, 0);
              const corretores = [...new Set(fase.items.map(n => n.corretor_nome))];
              return (
                <div key={fase.key} className="rounded-xl border border-border/40 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${fase.color}`} />
                      <span className="text-sm font-bold text-foreground">{fase.label}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${fase.textColor}`}>{fase.items.length}</Badge>
                  </div>
                  <p className={`text-lg font-black ${fase.textColor} mb-2`}>{formatBRLCompact(totalVgv)}</p>
                  {corretores.length > 0 ? (
                    <p className="text-[10px] text-muted-foreground">{corretores.slice(0, 4).map(c => c?.split(" ")[0]).join(", ")}{corretores.length > 4 ? ` +${corretores.length - 4}` : ""}</p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">Nenhum negócio</p>
                  )}
                  {fase.items.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto">
                      {fase.items.slice(0, 3).map(n => (
                        <div key={n.id} className="flex items-center justify-between text-[10px] p-1.5 rounded bg-accent/30">
                          <span className="truncate flex-1 text-foreground font-medium">{n.nome_cliente}</span>
                          <span className="text-emerald-600 font-bold ml-2">{formatBRLCompact(n.vgv)}</span>
                        </div>
                      ))}
                      {fase.items.length > 3 && (
                        <button className="text-[10px] text-primary hover:underline w-full text-center" onClick={() => navigate("/pipeline-negocios")}>
                          +{fase.items.length - 3} mais
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Agenda + Negócios em andamento side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agenda de Hoje */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Agenda de Hoje</h2>
              </div>
              <button className="text-[10px] text-primary hover:underline font-medium flex items-center gap-1" onClick={() => navigate("/agenda-visitas")}>
                Ver completa <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {agendaHoje.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">Nenhuma visita hoje</div>
            ) : (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {agendaHoje.map(v => (
                  <div key={v.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-accent/30 border border-border/30">
                    <span className="text-xs font-mono font-semibold text-foreground w-11 shrink-0">{v.hora_visita?.slice(0, 5) || "--:--"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{v.nome_cliente}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{v.empreendimento}{v.corretor_nome ? ` · ${v.corretor_nome}` : ""}</p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] shrink-0 ${v.status === "realizada" ? "border-emerald-300 text-emerald-600" : v.status === "confirmada" ? "border-green-300 text-green-600" : "border-amber-300 text-amber-600"}`}>
                      {statusIcons[v.status] || "⚪"} {v.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Negócios em andamento summary */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Resumo de Negócios</h2>
              </div>
              <button className="text-[10px] text-primary hover:underline font-medium flex items-center gap-1" onClick={() => navigate("/pipeline-negocios")}>
                Pipeline <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {faseData.map(f => (
                <div key={f.key} className="text-center p-3 rounded-lg bg-accent/30">
                  <p className={`text-2xl font-black ${f.textColor}`}>{f.items.length}</p>
                  <p className="text-[10px] text-muted-foreground">{f.label}</p>
                  <p className={`text-xs font-bold ${f.textColor} mt-1`}>{formatBRLCompact(f.items.reduce((s, n) => s + n.vgv, 0))}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
