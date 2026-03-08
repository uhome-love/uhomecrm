import { useMemo } from "react";
import { useCeoData, type CeoPeriod } from "@/hooks/useCeoData";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DollarSign, FileText, ShoppingBag, Loader2 } from "lucide-react";
import { getLevel } from "@/lib/gamification";
import RankingPodium, { type PodiumEntry } from "./RankingPodium";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const medals = ["👑", "🥈", "🥉"];

function getInitials(nome: string) {
  return nome.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function fmtBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

const periodMap: Record<string, CeoPeriod> = { hoje: "dia", semana: "semana", mes: "mes" };

export default function RankingVGVTab({ period }: { period: "hoje" | "semana" | "mes" }) {
  const { user } = useAuth();
  const { isCorretor } = useUserRole();
  const [corretorGerenteId, setCorretorGerenteId] = useState<string | undefined>();

  useEffect(() => {
    if (isCorretor && user?.id) {
      supabase
        .from("team_members")
        .select("gerente_id")
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .limit(1)
        .maybeSingle()
        .then(({ data }) => { if (data) setCorretorGerenteId(data.gerente_id); });
    }
  }, [isCorretor, user?.id]);

  const filterGerenteId = isCorretor ? corretorGerenteId : undefined;
  const { allCorretores, loading } = useCeoData(periodMap[period] || "dia", undefined, undefined, filterGerenteId);

  const sorted = useMemo(() => {
    return [...allCorretores].sort((a, b) => b.real_vgv_assinado - a.real_vgv_assinado);
  }, [allCorretores]);

  const totals = useMemo(() => {
    return sorted.reduce((acc, c) => ({
      propostas: acc.propostas + c.real_propostas,
      vgvGerado: acc.vgvGerado + c.real_vgv_gerado,
      vendas: acc.vendas + (c.real_vgv_assinado > 0 ? 1 : 0),
      vgvAssinado: acc.vgvAssinado + c.real_vgv_assinado,
    }), { propostas: 0, vgvGerado: 0, vendas: 0, vgvAssinado: 0 });
  }, [sorted]);

  const podiumEntries: PodiumEntry[] = useMemo(() => {
    return sorted.slice(0, 3).map(c => ({
      id: c.corretor_id,
      nome: c.corretor_nome,
      value: fmtBRL(c.real_vgv_assinado),
      points: c.score,
      isMe: c.corretor_id === user?.id,
    }));
  }, [sorted, user?.id]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (sorted.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Sem dados de VGV para o período</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: FileText, label: "Propostas", value: totals.propostas, color: "text-primary" },
          { icon: DollarSign, label: "VGV Gerado", value: fmtBRL(totals.vgvGerado), color: "text-blue-600" },
          { icon: ShoppingBag, label: "Vendas", value: totals.vendas, color: "text-emerald-600" },
          { icon: DollarSign, label: "VGV Assinado", value: fmtBRL(totals.vgvAssinado), color: "text-emerald-600" },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Podium */}
      {podiumEntries.length >= 3 && (
        <Card><CardContent className="pb-0 pt-2">
          <RankingPodium entries={podiumEntries} />
        </CardContent></Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 px-3 text-left w-10">#</th>
                  <th className="py-2 px-3 text-left">Corretor</th>
                  <th className="py-2 px-3 text-center">Propostas</th>
                  <th className="py-2 px-3 text-center">VGV Prop.</th>
                  <th className="py-2 px-3 text-center">Vendas</th>
                  <th className="py-2 px-3 text-center">VGV Real</th>
                  <th className="py-2 px-3 text-center">Score</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c, i) => {
                  const isMe = c.corretor_id === user?.id;
                  const level = getLevel(c.score);
                  const hasVenda = c.real_vgv_assinado > 0;
                  return (
                    <tr
                      key={c.corretor_id}
                      className={`border-b border-border transition-colors ${isMe ? "bg-primary/5 border-l-2 border-l-primary" : i % 2 ? "bg-muted/5" : ""}`}
                    >
                      <td className="py-2.5 px-3">
                        {i < 3 ? <span className="text-base">{medals[i]}</span> : <span className="text-sm text-muted-foreground font-bold">{i + 1}</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px]">{getInitials(c.corretor_nome)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <span className="font-medium truncate block">{c.corretor_nome}</span>
                            <span className={`text-[10px] font-semibold ${level.color}`}>{level.emoji} {level.label}</span>
                          </div>
                          {isMe && <span className="text-[10px] text-primary font-medium">← você</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">{c.real_propostas}</td>
                      <td className="py-2.5 px-3 text-center text-blue-600 font-medium">{fmtBRL(c.real_vgv_gerado)}</td>
                      <td className="py-2.5 px-3 text-center">{hasVenda ? "✅" : "—"}</td>
                      <td className={`py-2.5 px-3 text-center font-bold ${hasVenda ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {hasVenda ? fmtBRL(c.real_vgv_assinado) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-primary">{c.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
