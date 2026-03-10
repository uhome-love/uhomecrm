import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, CheckCircle, AlertCircle, Building2, Trophy, Users, Calendar } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

interface VendaAssinada {
  id: string;
  nome: string;
  und: string | null;
  empreendimento: string | null;
  vgv: number | null;
  status_pagamento: string | null;
  corretor: string | null;
  equipe: string | null;
  gerente_nome: string;
  mes: string;
  data_visita: string | null;
  created_at: string;
}

function fmtCurrency(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}K`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function CeoVendasAssinadas() {
  const [vendas, setVendas] = useState<VendaAssinada[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesFiltro, setMesFiltro] = useState(format(new Date(), "yyyy-MM"));
  const [empreendimentoFiltro, setEmpreendimentoFiltro] = useState("all");

  useEffect(() => { loadVendas(); }, [mesFiltro]);

  const loadVendas = async () => {
    setLoading(true);
    const { data: negs } = await supabase
      .from("negocios")
      .select("id, nome_cliente, empreendimento, vgv_final, vgv_estimado, fase, gerente_id, corretor_id, created_at")
      .eq("fase", "assinado")
      .gte("created_at", `${mesFiltro}-01`)
      .lt("created_at", `${mesFiltro}-32`);

    if (!negs || negs.length === 0) { setVendas([]); setLoading(false); return; }

    const gerenteIds = [...new Set(negs.map(p => p.gerente_id).filter(Boolean))];
    const corretorIds = [...new Set(negs.map(p => p.corretor_id).filter(Boolean))];
    const allIds = [...new Set([...gerenteIds, ...corretorIds])];
    const { data: profiles } = await supabase.from("profiles").select("id, user_id, nome").in("id", allIds);
    const profileMap = new Map((profiles || []).map(p => [p.id, p.nome]));
    // Also map by user_id
    (profiles || []).forEach(p => { if (p.user_id) profileMap.set(p.user_id, p.nome); });

    const result: VendaAssinada[] = negs.map(p => ({
      id: p.id, nome: p.nome_cliente || "—", und: null, empreendimento: p.empreendimento,
      vgv: Number(p.vgv_final || p.vgv_estimado || 0), status_pagamento: null,
      corretor: profileMap.get(p.corretor_id || "") || "—",
      equipe: null, gerente_nome: profileMap.get(p.gerente_id || "") || "—",
      mes: mesFiltro, data_visita: null, created_at: p.created_at,
    }));

    result.sort((a, b) => (b.vgv || 0) - (a.vgv || 0));
    setVendas(result);
    setLoading(false);
  };

  const empreendimentos = [...new Set(vendas.map(v => v.empreendimento).filter(Boolean))] as string[];
  const filtered = empreendimentoFiltro === "all" ? vendas : vendas.filter(v => v.empreendimento === empreendimentoFiltro);

  const totalVgv = filtered.reduce((s, v) => s + (v.vgv || 0), 0);
  const totalPago = filtered.filter(v => v.status_pagamento === "pago").reduce((s, v) => s + (v.vgv || 0), 0);
  const totalFaltaPagar = filtered.filter(v => v.status_pagamento === "falta_pagar").reduce((s, v) => s + (v.vgv || 0), 0);
  const ticketMedio = filtered.length > 0 ? totalVgv / filtered.length : 0;

  // Top performers
  const topCorretor = useMemo(() => {
    const byCorretor: Record<string, { nome: string; vgv: number; count: number }> = {};
    for (const v of filtered) {
      const key = v.corretor || "—";
      if (!byCorretor[key]) byCorretor[key] = { nome: key, vgv: 0, count: 0 };
      byCorretor[key].vgv += v.vgv || 0;
      byCorretor[key].count++;
    }
    return Object.values(byCorretor).sort((a, b) => b.vgv - a.vgv)[0] || null;
  }, [filtered]);

  const topGerente = useMemo(() => {
    const byGerente: Record<string, { nome: string; vgv: number; count: number }> = {};
    for (const v of filtered) {
      if (!byGerente[v.gerente_nome]) byGerente[v.gerente_nome] = { nome: v.gerente_nome, vgv: 0, count: 0 };
      byGerente[v.gerente_nome].vgv += v.vgv || 0;
      byGerente[v.gerente_nome].count++;
    }
    return Object.values(byGerente).sort((a, b) => b.vgv - a.vgv)[0] || null;
  }, [filtered]);

  const topEmpreendimento = useMemo(() => {
    const byEmp: Record<string, { nome: string; vgv: number }> = {};
    for (const v of filtered) {
      const key = v.empreendimento || "—";
      if (!byEmp[key]) byEmp[key] = { nome: key, vgv: 0 };
      byEmp[key].vgv += v.vgv || 0;
    }
    return Object.values(byEmp).sort((a, b) => b.vgv - a.vgv)[0] || null;
  }, [filtered]);

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    return format(d, "yyyy-MM");
  });

  const formatMonth = (mes: string) => {
    const [y, m] = mes.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[parseInt(m) - 1]} ${y}`;
  };

  const byEmpreendimento = filtered.reduce<Record<string, { count: number; vgv: number }>>((acc, v) => {
    const key = v.empreendimento || "Sem empreendimento";
    if (!acc[key]) acc[key] = { count: 0, vgv: 0 };
    acc[key].count++; acc[key].vgv += v.vgv || 0;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={mesFiltro} onValueChange={setMesFiltro}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map(m => <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        {empreendimentos.length > 0 && (
          <Select value={empreendimentoFiltro} onValueChange={setEmpreendimentoFiltro}>
            <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Empreendimento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os empreendimentos</SelectItem>
              {empreendimentos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* KPI Cards - Enhanced */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">VGV Total Assinado</span>
                </div>
                <p className="text-2xl font-display font-bold text-foreground">{fmtCurrency(totalVgv)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{filtered.length} vendas em {formatMonth(mesFiltro)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4 text-warning" />
                  <span className="text-xs font-medium">Ticket Médio</span>
                </div>
                <p className="text-2xl font-display font-bold text-foreground">{fmtCurrency(ticketMedio)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">por venda assinada</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-xs font-medium">VGV Pago</span>
                </div>
                <p className="text-2xl font-display font-bold text-success">{fmtCurrency(totalPago)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{filtered.filter(v => v.status_pagamento === "pago").length} vendas pagas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <span className="text-xs font-medium">Falta Assinar</span>
                </div>
                <p className="text-2xl font-display font-bold text-warning">{fmtCurrency(totalFaltaPagar)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{filtered.filter(v => v.status_pagamento === "falta_pagar").length} pendentes</p>
              </CardContent>
            </Card>
          </div>

          {/* Top Performers */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {topCorretor && (
                <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-4 w-4 text-warning" />
                    <span className="text-xs font-semibold text-warning">Top Corretor do Mês</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{topCorretor.nome}</p>
                  <p className="text-xs text-muted-foreground">{fmtCurrency(topCorretor.vgv)} · {topCorretor.count} venda(s)</p>
                </div>
              )}
              {topGerente && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-primary">Top Gerente do Mês</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{topGerente.nome}</p>
                  <p className="text-xs text-muted-foreground">{fmtCurrency(topGerente.vgv)} · {topGerente.count} venda(s)</p>
                </div>
              )}
              {topEmpreendimento && (
                <div className="rounded-xl border border-success/20 bg-success/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-success" />
                    <span className="text-xs font-semibold text-success">Top Empreendimento</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{topEmpreendimento.nome}</p>
                  <p className="text-xs text-muted-foreground">{fmtCurrency(topEmpreendimento.vgv)}</p>
                </div>
              )}
            </div>
          )}

          {/* Summary by Empreendimento */}
          {Object.keys(byEmpreendimento).length > 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(byEmpreendimento)
                .sort((a, b) => b[1].vgv - a[1].vgv)
                .map(([emp, data]) => (
                  <div key={emp} className="rounded-lg border border-border bg-card p-3 text-center">
                    <p className="text-[10px] text-muted-foreground truncate">{emp}</p>
                    <p className="text-sm font-bold text-foreground">{fmtCurrency(data.vgv)}</p>
                    <p className="text-[10px] text-muted-foreground">{data.count} venda{data.count > 1 ? "s" : ""}</p>
                  </div>
                ))}
            </div>
          )}

          {/* Detailed Table - Enhanced */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                Vendas Assinadas — {formatMonth(mesFiltro)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma venda assinada em {formatMonth(mesFiltro)}.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Cliente</TableHead>
                        <TableHead className="text-xs text-center">Und</TableHead>
                        <TableHead className="text-xs">Empreendimento</TableHead>
                        <TableHead className="text-xs text-right">VGV (R$)</TableHead>
                        <TableHead className="text-xs text-center">Pagamento</TableHead>
                        <TableHead className="text-xs">Corretor</TableHead>
                        <TableHead className="text-xs">Gerente</TableHead>
                        <TableHead className="text-xs text-center">Data Venda</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(v => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium text-xs">{v.nome}</TableCell>
                          <TableCell className="text-center text-xs">{v.und || "—"}</TableCell>
                          <TableCell className="text-xs">{v.empreendimento || "—"}</TableCell>
                          <TableCell className="text-right text-xs font-semibold">{fmtCurrency(v.vgv || 0)}</TableCell>
                          <TableCell className="text-center">
                            {v.status_pagamento === "pago" ? (
                              <Badge variant="secondary" className="bg-success/10 text-success border-success/30 text-[10px]">PAGO</Badge>
                            ) : v.status_pagamento === "falta_pagar" ? (
                              <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30 text-[10px]">PENDENTE</Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{v.corretor || "—"}</TableCell>
                          <TableCell className="text-xs">{v.gerente_nome}</TableCell>
                          <TableCell className="text-center text-xs">{v.data_visita || "—"}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-semibold">
                        <TableCell className="text-xs">TOTAL</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-right text-xs">{fmtCurrency(totalVgv)}</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
