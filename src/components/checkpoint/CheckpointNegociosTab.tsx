import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Briefcase, AlertTriangle, Clock, TrendingUp, ArrowRight, User, Building2, DollarSign } from "lucide-react";
import { formatDistanceToNow, differenceInDays, format } from "date-fns";
import { formatBRLCompact } from "@/lib/utils";
import { ptBR } from "date-fns/locale";

interface Negocio {
  id: string;
  nome_cliente: string | null;
  empreendimento: string | null;
  fase: string | null;
  corretor_id: string | null;
  vgv_estimado: number | null;
  vgv_final: number | null;
  created_at: string | null;
  updated_at: string | null;
  fase_changed_at: string | null;
  unidade: string | null;
}

interface Atividade {
  id: string;
  negocio_id: string;
  tipo: string;
  titulo: string | null;
  descricao: string | null;
  created_at: string;
}

const FASES = ["visita", "gerado", "negociacao", "proposta", "assinado", "vendido"] as const;

const FASE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  visita: { label: "Visita", color: "text-blue-700", bg: "bg-blue-100" },
  gerado: { label: "Gerado", color: "text-indigo-700", bg: "bg-indigo-100" },
  negociacao: { label: "Negociação", color: "text-amber-700", bg: "bg-amber-100" },
  proposta: { label: "Proposta", color: "text-orange-700", bg: "bg-orange-100" },
  assinado: { label: "Assinado", color: "text-emerald-700", bg: "bg-emerald-100" },
  vendido: { label: "Vendido", color: "text-green-700", bg: "bg-green-100" },
};

const fmtCurrency = formatBRLCompact;

interface Props {
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
}

export default function CheckpointNegociosTab({ teamUserIds, teamNameMap }: Props) {
  const { user } = useAuth();
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: neg }, { data: atv }] = await Promise.all([
      supabase
        .from("negocios")
        .select("id, nome_cliente, empreendimento, fase, corretor_id, vgv_estimado, vgv_final, created_at, updated_at, fase_changed_at, unidade")
        .eq("gerente_id", user.id)
        .not("fase", "in", "(perdido,cancelado)"),
      supabase
        .from("negocios_atividades")
        .select("id, negocio_id, tipo, titulo, descricao, created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    setNegocios(neg || []);

    // Filter atividades to only those belonging to this gerente's negocios
    const negIds = new Set((neg || []).map(n => n.id));
    setAtividades((atv || []).filter(a => negIds.has(a.negocio_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">Carregando negócios...</div>;
  }

  // ═══ FUNIL POR FASE ═══
  const funilData = FASES.map(fase => {
    const items = negocios.filter(n => n.fase === fase);
    const vgv = items.reduce((s, n) => s + Number(n.vgv_final || n.vgv_estimado || 0), 0);
    return { fase, ...FASE_CONFIG[fase], count: items.length, vgv };
  }).filter(f => f.count > 0);

  const totalNegocios = negocios.length;
  const totalVgv = negocios.reduce((s, n) => s + Number(n.vgv_final || n.vgv_estimado || 0), 0);

  // ═══ POR CORRETOR ═══
  const corretorData = teamUserIds.map(uid => {
    const items = negocios.filter(n => n.corretor_id === uid);
    const byFase: Record<string, number> = {};
    const vgvByFase: Record<string, number> = {};
    items.forEach(n => {
      const f = n.fase || "outro";
      byFase[f] = (byFase[f] || 0) + 1;
      vgvByFase[f] = (vgvByFase[f] || 0) + Number(n.vgv_final || n.vgv_estimado || 0);
    });
    const totalVgv = items.reduce((s, n) => s + Number(n.vgv_final || n.vgv_estimado || 0), 0);
    return { uid, nome: teamNameMap[uid] || "Corretor", total: items.length, byFase, vgvByFase, totalVgv };
  }).filter(c => c.total > 0).sort((a, b) => b.totalVgv - a.totalVgv);

  // ═══ NEGÓCIOS PARADOS ═══
  const now = new Date();
  const parados = negocios
    .filter(n => {
      const lastUpdate = n.fase_changed_at || n.updated_at || n.created_at;
      if (!lastUpdate) return false;
      const days = differenceInDays(now, new Date(lastUpdate));
      return days >= 5 && !["assinado", "vendido"].includes(n.fase || "");
    })
    .map(n => {
      const lastUpdate = n.fase_changed_at || n.updated_at || n.created_at;
      return { ...n, diasParado: differenceInDays(now, new Date(lastUpdate!)) };
    })
    .sort((a, b) => b.diasParado - a.diasParado);

  // ═══ TIMELINE ═══
  const negMap = new Map(negocios.map(n => [n.id, n]));

  const tipoIcon: Record<string, string> = {
    mudanca_fase: "🔄",
    nota: "📝",
    visita: "🏠",
    ligacao: "📞",
    whatsapp: "💬",
    proposta: "📋",
    tarefa: "✅",
  };

  return (
    <div className="space-y-5">
      {/* ═══ FUNIL VISUAL ═══ */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Funil de Negócios do Time</h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span><b className="text-foreground">{totalNegocios}</b> negócios ativos</span>
            <span className="font-bold text-primary">{fmtCurrency(totalVgv)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {funilData.map((f, i) => {
            const widthPct = Math.max(15, (f.count / Math.max(totalNegocios, 1)) * 100);
            return (
              <div key={f.fase} className="flex items-center gap-1" style={{ flex: widthPct }}>
                <div className={`${f.bg} rounded-lg p-3 w-full text-center transition-all hover:scale-[1.02]`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${f.color}`}>{f.label}</p>
                  <p className={`text-2xl font-bold ${f.color}`}>{f.count}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{fmtCurrency(f.vgv)}</p>
                </div>
                {i < funilData.length - 1 && <ArrowRight size={14} className="text-muted-foreground/40 shrink-0" />}
              </div>
            );
          })}
          {funilData.length === 0 && (
            <p className="text-sm text-muted-foreground text-center w-full py-6">Nenhum negócio ativo no time.</p>
          )}
        </div>
      </div>

      {/* ═══ POR CORRETOR ═══ */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <User size={16} className="text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Negócios por Corretor</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Corretor</th>
                {FASES.map(f => (
                  <th key={f} className="px-2 py-2.5 text-center font-semibold">
                    <span className={`${FASE_CONFIG[f].color}`}>{FASE_CONFIG[f].label}</span>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center font-semibold text-foreground">Total</th>
                <th className="px-3 py-2.5 text-center font-semibold text-primary">VGV Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {corretorData.map(c => (
                <tr key={c.uid} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-foreground">{c.nome}</td>
                  {FASES.map(f => (
                    <td key={f} className="px-2 py-2.5 text-center">
                      {c.byFase[f] ? (
                        <div>
                          <span className="font-bold text-foreground">{c.byFase[f]}</span>
                          {(c.vgvByFase[f] || 0) > 0 && (
                            <p className="text-[9px] text-muted-foreground">{fmtCurrency(c.vgvByFase[f])}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center font-bold text-foreground">{c.total}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-primary">{fmtCurrency(c.totalVgv)}</td>
                </tr>
              ))}
              {corretorData.length === 0 && (
                <tr><td colSpan={FASES.length + 3} className="py-8 text-center text-muted-foreground">Sem negócios no time.</td></tr>
              )}
            </tbody>
            {corretorData.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30 font-semibold text-sm">
                  <td className="px-4 py-2.5 text-muted-foreground">Totais</td>
                  {FASES.map(f => {
                    const total = corretorData.reduce((s, c) => s + (c.byFase[f] || 0), 0);
                    return <td key={f} className="px-2 py-2.5 text-center text-foreground">{total || "—"}</td>;
                  })}
                  <td className="px-3 py-2.5 text-center text-foreground">{totalNegocios}</td>
                  <td className="px-3 py-2.5 text-center text-primary font-bold">{fmtCurrency(totalVgv)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ═══ NEGÓCIOS PARADOS ═══ */}
      {parados.length > 0 && (
        <div className="bg-card border border-destructive/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-destructive" />
            <h3 className="font-semibold text-sm text-foreground">
              ⚠️ Negócios Parados ({parados.length})
            </h3>
            <span className="text-[10px] text-muted-foreground">Sem atualização há 5+ dias</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {parados.slice(0, 9).map(n => {
              const fc = FASE_CONFIG[n.fase || ""] || { label: n.fase, color: "text-muted-foreground", bg: "bg-muted" };
              return (
                <div key={n.id} className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{n.nome_cliente || "Sem nome"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${fc.bg} ${fc.color}`}>{fc.label}</span>
                      {n.empreendimento && <span className="text-[10px] text-muted-foreground truncate">{n.empreendimento}</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {teamNameMap[n.corretor_id || ""] || "—"} · {fmtCurrency(Number(n.vgv_estimado || 0))}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-destructive">{n.diasParado}d</p>
                    <p className="text-[9px] text-muted-foreground">parado</p>
                  </div>
                </div>
              );
            })}
          </div>
          {parados.length > 9 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">+ {parados.length - 9} negócios parados</p>
          )}
        </div>
      )}

      {/* ═══ TIMELINE ═══ */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Movimentações Recentes</h3>
        </div>
        {atividades.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade registrada.</p>
        ) : (
          <div className="space-y-1">
            {atividades.slice(0, 15).map(a => {
              const neg = negMap.get(a.negocio_id);
              const icon = tipoIcon[a.tipo] || "📌";
              return (
                <div key={a.id} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                  <span className="text-sm mt-0.5">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground">
                      <span className="font-medium">{a.titulo || a.tipo}</span>
                      {a.descricao && <span className="text-muted-foreground"> — {a.descricao}</span>}
                    </p>
                    {neg && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {neg.nome_cliente} · {neg.empreendimento || "—"} · {teamNameMap[neg.corretor_id || ""] || "—"}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
