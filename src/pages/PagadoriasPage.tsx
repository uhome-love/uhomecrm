import { useState, useMemo, useEffect } from "react";
import { usePagadorias } from "@/hooks/useBackofficeData";
import { usePagadoriaConfig } from "@/hooks/usePagadoriaConfig";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Plus, Search, FileText, Link, Loader2, Trash2, Settings, FileDown } from "lucide-react";
import { toast } from "sonner";
import PagadoriaConfigModal from "@/components/pagadorias/PagadoriaConfigModal";
import ContratoIntermediacao from "@/components/pagadorias/ContratoIntermediacao";
import CompradorDocUpload, { type Comprador } from "@/components/pagadorias/CompradorDocUpload";

const STATUS_MAP: Record<string, { label: string }> = {
  rascunho: { label: "Rascunho" },
  pendente: { label: "Pendente" },
  aguardando_assinatura: { label: "⏳ Aguard. Assinatura" },
  assinada: { label: "✅ Assinada" },
  paga: { label: "💰 Paga" },
};

interface Credor {
  credor_tipo: string;
  credor_nome: string;
  credor_id: string | null;
  percentual: number;
  valor: number;
  auto: boolean; // whether % is calculated automatically
}

export default function PagadoriasPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { pagadorias, isLoading, createPagadoria } = usePagadorias();
  const { corretorFaixas, gerenteFaixas, credoresFixos, getFaixaPercentual, isLoading: configLoading } = usePagadoriaConfig();

  const [filter, setFilter] = useState("todas");
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [contratoOpen, setContratoOpen] = useState(false);
  const [contratoData, setContratoData] = useState<any>(null);

  // Step 1 form
  const [form, setForm] = useState({
    cliente_nome: "", cliente_cpf: "", cliente_email: "", cliente_telefone: "", cliente_endereco: "",
    empreendimento: "", unidade: "", vgv: 0, data_venda: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    forma_pagamento: "a_vista", corretor_nome: "", gerente_nome: "",
  });

  // Compradores (buyers) with document uploads
  const [compradores, setCompradores] = useState<Comprador[]>([{
    nome: "", cpf: "", rg: "", nacionalidade: "brasileira", estado_civil: "",
    telefone: "", email: "", endereco: "", cidade: "", estado: "",
    doc_identidade_url: null, doc_comprovante_url: null,
  }]);

  // Sync first comprador data to form (for backward compat)
  useEffect(() => {
    const c = compradores[0];
    if (c) {
      setForm(f => ({
        ...f,
        cliente_nome: c.nome,
        cliente_cpf: c.cpf,
        cliente_email: c.email,
        cliente_telefone: c.telefone,
        cliente_endereco: c.endereco + (c.cidade ? `, ${c.cidade}` : "") + (c.estado ? `/${c.estado}` : ""),
      }));
    }
  }, [compradores]);

  // Step 2
  const [comissaoPct, setComissaoPct] = useState(5);
  const [vgvAcumuladoCorretor, setVgvAcumuladoCorretor] = useState(0);
  const [vgvAcumuladoGerente, setVgvAcumuladoGerente] = useState(0);
  const [selectedCorretorFaixaIdx, setSelectedCorretorFaixaIdx] = useState(0);
  const [selectedGerenteFaixaIdx, setSelectedGerenteFaixaIdx] = useState(0);
  const [credores, setCredores] = useState<Credor[]>([]);

  const totalComissao = (form.vgv * comissaoPct) / 100;

  // Initialize credores when entering step 2
  useEffect(() => {
    if (step === 2 && credores.length === 0) {
      const corretorPct = getFaixaPercentual(corretorFaixas, vgvAcumuladoCorretor);
      const gerentePct = getFaixaPercentual(gerenteFaixas, vgvAcumuladoGerente);

      const initial: Credor[] = [
        { credor_tipo: "corretor", credor_nome: form.corretor_nome || "Corretor", credor_id: null, percentual: corretorPct, valor: 0, auto: true },
        { credor_tipo: "gerente", credor_nome: form.gerente_nome || "Gerente", credor_id: null, percentual: gerentePct, valor: 0, auto: true },
        ...credoresFixos.map(c => ({
          credor_tipo: c.tipo, credor_nome: c.nome, credor_id: null, percentual: c.percentual, valor: 0, auto: false,
        })),
        { credor_tipo: "uhome", credor_nome: "UHome", credor_id: null, percentual: 0, valor: 0, auto: true },
      ];
      setCredores(recalcCredores(totalComissao, initial));
    }
  }, [step]);

  // Recalc when comissaoPct or vgv changes
  useEffect(() => {
    if (credores.length > 0) {
      // Update corretor/gerente auto percentuals
      const corretorPct = getFaixaPercentual(corretorFaixas, vgvAcumuladoCorretor);
      const gerentePct = getFaixaPercentual(gerenteFaixas, vgvAcumuladoGerente);
      const updated = credores.map(c => {
        if (c.credor_tipo === "corretor") return { ...c, percentual: corretorPct };
        if (c.credor_tipo === "gerente") return { ...c, percentual: gerentePct };
        return c;
      });
      setCredores(recalcCredores(totalComissao, updated));
    }
  }, [comissaoPct, form.vgv, vgvAcumuladoCorretor, vgvAcumuladoGerente]);

  const recalcCredores = (total: number, creds: Credor[]) => {
    const sumPctExcUhome = creds.filter(c => c.credor_tipo !== "uhome").reduce((s, c) => s + c.percentual, 0);
    return creds.map(c => {
      if (c.credor_tipo === "uhome") {
        const pct = Math.max(0, 100 - sumPctExcUhome);
        return { ...c, percentual: pct, valor: Math.round((pct / 100) * total * 100) / 100 };
      }
      return { ...c, valor: Math.round((c.percentual / 100) * total * 100) / 100 };
    });
  };

  const handleCredorChange = (idx: number, field: string, value: any) => {
    setCredores(prev => {
      const next = [...prev];
      (next[idx] as any)[field] = value;
      return recalcCredores(totalComissao, next);
    });
  };

  const addCredor = () => {
    setCredores(prev => {
      const uhomeIdx = prev.findIndex(c => c.credor_tipo === "uhome");
      const newCred: Credor = { credor_tipo: "outro", credor_nome: "", credor_id: null, percentual: 0, valor: 0, auto: false };
      const next = [...prev];
      next.splice(uhomeIdx, 0, newCred);
      return recalcCredores(totalComissao, next);
    });
  };

  const removeCredor = (idx: number) => {
    setCredores(prev => recalcCredores(totalComissao, prev.filter((_, i) => i !== idx)));
  };

  const totalPct = credores.reduce((s, c) => s + c.percentual, 0);
  const totalValor = credores.reduce((s, c) => s + c.valor, 0);
  const pctValid = Math.abs(totalPct - 100) < 0.01;

  const filtered = pagadorias.filter((p: any) => {
    if (filter !== "todas" && p.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.cliente_nome?.toLowerCase().includes(q) || p.empreendimento?.toLowerCase().includes(q);
    }
    return true;
  });

  const fmtR = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const fmtVgv = (v: number | null) => v === null ? "Acima" : `Até ${fmtR(v)}`;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const pag = await createPagadoria.mutateAsync({
        ...form,
        criada_por: user.id,
        status: "pendente",
        comissao_pct: comissaoPct,
        comissao_total: totalComissao,
      });
      const credorRows = credores
        .filter(c => c.percentual > 0 || c.credor_tipo === "uhome")
        .map(c => ({
          pagadoria_id: (pag as any).id,
          credor_tipo: c.credor_tipo,
          credor_nome: c.credor_nome,
          credor_id: c.credor_id,
          percentual: c.percentual,
          valor: c.valor,
        }));
      await supabase.from("pagadoria_credores" as any).insert(credorRows);
      toast.success("Pagadoria criada com sucesso!");
      resetWizard();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetWizard = () => {
    setWizardOpen(false);
    setStep(1);
    setForm({ cliente_nome: "", cliente_cpf: "", cliente_email: "", cliente_telefone: "", cliente_endereco: "", empreendimento: "", unidade: "", vgv: 0, data_venda: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }), forma_pagamento: "a_vista", corretor_nome: "", gerente_nome: "" });
    setCompradores([{ nome: "", cpf: "", rg: "", nacionalidade: "brasileira", estado_civil: "", telefone: "", email: "", endereco: "", cidade: "", estado: "", doc_identidade_url: null, doc_comprovante_url: null }]);
    setCredores([]);
    setComissaoPct(5);
    setVgvAcumuladoCorretor(0);
    setVgvAcumuladoGerente(0);
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" /> Pagadorias
          </h1>
          <p className="text-sm text-muted-foreground">Gestão de pagadorias e comissões</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
              <Settings className="h-4 w-4 mr-1" /> Configurar Tabelas
            </Button>
          )}
          <Button onClick={() => setWizardOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova Pagadoria
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente ou empreendimento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="aguardando_assinatura">Aguard. Assinatura</SelectItem>
            <SelectItem value="assinada">Assinadas</SelectItem>
            <SelectItem value="paga">Pagas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">Nenhuma pagadoria encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">Crie uma nova pagadoria para começar.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p: any) => {
            const st = STATUS_MAP[p.status] || STATUS_MAP.rascunho;
            return (
              <Card key={p.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">{p.cliente_nome}</p>
                      <span className="text-xs text-muted-foreground">· {p.empreendimento}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>VGV: <strong className="text-foreground">R$ {Number(p.vgv).toLocaleString("pt-BR")}</strong></span>
                      <span>Venda: {new Date(p.data_venda).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-xs">{st.label}</Badge>
                    {p.docusign_link && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(p.docusign_link, "_blank")}>
                        <Link className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={v => { if (!v) resetWizard(); else setWizardOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Pagadoria — Passo {step}/3</DialogTitle>
          </DialogHeader>

          {/* ─── STEP 1 ─── */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground">Dados do(s) Comprador(es)</h3>
              <CompradorDocUpload compradores={compradores} onChange={setCompradores} />

              <div className="border-t pt-4 space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground">Dados do Negócio</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Empreendimento</Label><Input value={form.empreendimento} onChange={e => setForm(f => ({ ...f, empreendimento: e.target.value }))} /></div>
                  <div><Label>Unidade</Label><Input value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))} /></div>
                  <div><Label>VGV (R$)</Label><Input type="number" value={form.vgv || ""} onChange={e => setForm(f => ({ ...f, vgv: Number(e.target.value) }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Corretor</Label><Input value={form.corretor_nome} onChange={e => setForm(f => ({ ...f, corretor_nome: e.target.value }))} placeholder="Nome do corretor" /></div>
                  <div><Label>Gerente</Label><Input value={form.gerente_nome} onChange={e => setForm(f => ({ ...f, gerente_nome: e.target.value }))} placeholder="Nome do gerente" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Data da venda</Label><Input type="date" value={form.data_venda} onChange={e => setForm(f => ({ ...f, data_venda: e.target.value }))} /></div>
                  <div>
                    <Label>Pagamento</Label>
                    <Select value={form.forma_pagamento} onValueChange={v => setForm(f => ({ ...f, forma_pagamento: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a_vista">À vista</SelectItem>
                        <SelectItem value="parcelado">Parcelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!compradores[0]?.nome || !form.empreendimento || !form.vgv}>Próximo →</Button>
              </div>
            </div>
          )}

          {/* ─── STEP 2 ─── */}
          {step === 2 && (
            <div className="space-y-5">
              {/* SEÇÃO A — Comissão sobre o VGV */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground">Seção A — Comissão sobre o VGV</h3>
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div>
                    <Label>% de comissão sobre o VGV</Label>
                    <Input type="number" step="0.5" value={comissaoPct} onChange={e => setComissaoPct(Number(e.target.value))} className="h-9" />
                  </div>
                  <div>
                    <Label>VGV do negócio</Label>
                    <p className="text-sm font-semibold mt-1">{fmtR(form.vgv)}</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg px-3 py-2 text-center">
                    <p className="text-xs text-muted-foreground">💰 Total de comissão</p>
                    <p className="text-lg font-bold text-primary">{fmtR(totalComissao)}</p>
                  </div>
                </div>
              </div>

              {/* SEÇÃO B — Tabela Progressiva do Corretor */}
              <div className="space-y-2 border rounded-lg p-3">
                <h4 className="font-semibold text-sm">Comissão do Corretor (tabela progressiva)</h4>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <Label className="text-xs">Faixa do corretor</Label>
                    <Select value={String(selectedCorretorFaixaIdx)} onValueChange={v => setSelectedCorretorFaixaIdx(Number(v))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {corretorFaixas.map((f, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {fmtVgv(f.vgv_max)} → {f.percentual}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Corretor recebe </span>
                    <strong className="text-primary">{corretorFaixas[selectedCorretorFaixaIdx]?.percentual ?? 0}%</strong>
                    <span className="text-muted-foreground"> → </span>
                    <strong>{fmtR(((corretorFaixas[selectedCorretorFaixaIdx]?.percentual ?? 0) / 100) * totalComissao)}</strong>
                  </div>
                </div>
              </div>

              {/* SEÇÃO B2 — Gerente */}
              <div className="space-y-2 border rounded-lg p-3">
                <h4 className="font-semibold text-sm">Comissão do Gerente</h4>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <Label className="text-xs">Faixa do gerente</Label>
                    <Select value={String(selectedGerenteFaixaIdx)} onValueChange={v => setSelectedGerenteFaixaIdx(Number(v))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {gerenteFaixas.map((f, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {fmtVgv(f.vgv_max)} → {f.percentual}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Gerente recebe </span>
                    <strong className="text-primary">{gerenteFaixas[selectedGerenteFaixaIdx]?.percentual ?? 0}%</strong>
                    <span className="text-muted-foreground"> → </span>
                    <strong>{fmtR(((gerenteFaixas[selectedGerenteFaixaIdx]?.percentual ?? 0) / 100) * totalComissao)}</strong>
                  </div>
                </div>
              </div>

              {/* SEÇÃO C — Credores */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">Seção C — Distribuição Completa</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Credor</th>
                        <th className="text-center px-3 py-2 font-medium w-24">%</th>
                        <th className="text-right px-3 py-2 font-medium w-36">Valor (R$)</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {credores.map((c, i) => {
                        const isFixed = c.credor_tipo === "corretor" || c.credor_tipo === "gerente" || c.credor_tipo === "uhome";
                        return (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-1.5">
                              {isFixed ? (
                                <span className="text-sm font-medium">{c.credor_nome}</span>
                              ) : (
                                <Input value={c.credor_nome} onChange={e => handleCredorChange(i, "credor_nome", e.target.value)} className="h-7 text-sm" placeholder="Nome" />
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {c.credor_tipo === "uhome" || c.auto ? (
                                <span className="text-sm font-semibold">{c.percentual.toFixed(1)}%</span>
                              ) : (
                                <Input type="number" step="0.5" value={c.percentual || ""} onChange={e => handleCredorChange(i, "percentual", Number(e.target.value))} className="h-7 text-sm text-center w-20 mx-auto" />
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-sm">{fmtR(c.valor)}</td>
                            <td className="px-1 py-1.5">
                              {!isFixed && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCredor(i)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-muted/50 border-t-2">
                      <tr>
                        <td className="px-3 py-2 font-bold">Total</td>
                        <td className={`px-3 py-2 text-center font-bold ${pctValid ? "text-green-600" : "text-red-500"}`}>
                          {totalPct.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2 text-right font-bold font-mono">{fmtR(totalValor)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={addCredor}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar credor
                  </Button>
                  {pctValid ? (
                    <span className="text-sm text-green-600 font-medium">✅ Distribuição completa</span>
                  ) : (
                    <span className="text-sm text-red-500 font-medium">
                      ⚠️ Falta {(100 - totalPct).toFixed(1)}% para fechar
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>← Voltar</Button>
                <Button onClick={() => setStep(3)} disabled={!pctValid}>Próximo →</Button>
              </div>
            </div>
          )}

          {/* ─── STEP 3 ─── */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground">Resumo & Envio</h3>
              <Card>
                <CardContent className="p-4 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Cliente:</span> <strong>{form.cliente_nome}</strong></div>
                    <div><span className="text-muted-foreground">CPF:</span> {form.cliente_cpf || "—"}</div>
                    <div><span className="text-muted-foreground">Empreendimento:</span> <strong>{form.empreendimento}</strong></div>
                    <div><span className="text-muted-foreground">Unidade:</span> {form.unidade || "—"}</div>
                    <div><span className="text-muted-foreground">VGV:</span> <strong>{fmtR(form.vgv)}</strong></div>
                    <div><span className="text-muted-foreground">Data:</span> {new Date(form.data_venda).toLocaleDateString("pt-BR")}</div>
                    <div><span className="text-muted-foreground">Corretor:</span> {form.corretor_nome || "—"}</div>
                    <div><span className="text-muted-foreground">Gerente:</span> {form.gerente_nome || "—"}</div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between mb-2">
                      <p className="font-semibold">Comissões ({comissaoPct}% sobre VGV)</p>
                      <p className="font-semibold text-primary">{fmtR(totalComissao)}</p>
                    </div>
                    {credores.filter(c => c.percentual > 0).map((c, i) => (
                      <div key={i} className="flex justify-between py-0.5">
                        <span>{c.credor_nome || c.credor_tipo}</span>
                        <span className="font-mono">{c.percentual.toFixed(1)}% — {fmtR(c.valor)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <div className="flex flex-wrap gap-2 justify-between items-center">
                <Button variant="outline" onClick={() => setStep(2)}>← Voltar</Button>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => {
                    setContratoData({
                      ...form,
                      compradores,
                      comissao_pct: comissaoPct,
                      comissao_total: totalComissao,
                      credores,
                      parcelas: [],
                      corretor_cpf: "", corretor_creci: "", corretor_email: "",
                      gerente_cpf: "", gerente_creci: "", gerente_email: "",
                      data_assinatura: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
                    });
                    setContratoOpen(true);
                  }}>
                    <FileDown className="h-4 w-4 mr-1" /> 📄 Gerar Contrato
                  </Button>
                  <Button variant="outline" onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Salvar como Pendente
                  </Button>
                  <Button onClick={() => { toast.info("Copie o link da pagadoria e envie pelo DocuSign manualmente."); handleSave(); }} disabled={saving}>
                    📤 Salvar + Gerar link DocuSign
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Config Modal */}
      <PagadoriaConfigModal open={configOpen} onOpenChange={setConfigOpen} />

      {/* Contrato Modal */}
      {contratoData && (
        <ContratoIntermediacao
          open={contratoOpen}
          onOpenChange={setContratoOpen}
          data={contratoData}
          onDataChange={setContratoData}
          onGenerated={async () => {
            // Mark contrato_gerado_em if pagadoria already saved
          }}
        />
      )}
    </div>
  );
}
