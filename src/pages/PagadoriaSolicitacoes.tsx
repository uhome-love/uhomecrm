import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Search, FileText, Upload, Download, Clock, CheckCircle2, Settings, RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Solicitacao {
  id: string;
  negocio_id: string;
  solicitante_id: string;
  nome_cliente: string;
  cpf: string | null;
  rg: string | null;
  email: string | null;
  telefone: string | null;
  empreendimento: string | null;
  unidade: string | null;
  vgv_contrato: number | null;
  percentual_comissao: number | null;
  rg_url: string | null;
  cpf_url: string | null;
  comprovante_residencia_url: string | null;
  ficha_construtora_url: string | null;
  status: string;
  contrato_pdf_url: string | null;
  observacoes: string | null;
  obs_backoffice: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  enviado: { label: "📩 Enviado", color: "bg-blue-500/15 text-blue-600 border-blue-500/30", icon: Clock },
  producao: { label: "⚙️ Em Produção", color: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: Settings },
  pronto: { label: "✅ Pronto", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
};

export default function PagadoriaSolicitacoes() {
  const { user } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todas");
  const [selected, setSelected] = useState<Solicitacao | null>(null);
  const [uploading, setUploading] = useState(false);
  const [obsBackoffice, setObsBackoffice] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("pagadoria_solicitacoes")
      .select("*")
      .order("created_at", { ascending: false });
    setSolicitacoes((data || []) as Solicitacao[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = solicitacoes.filter(s => {
    if (filterStatus !== "todas" && s.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.nome_cliente.toLowerCase().includes(q) || s.empreendimento?.toLowerCase().includes(q);
    }
    return true;
  });

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("pagadoria_solicitacoes").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    toast.success(`Status atualizado para ${STATUS_CONFIG[status]?.label || status}`);
    load();
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
  };

  const handleUploadContrato = async (file: File) => {
    if (!selected || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${selected.negocio_id}/contrato_final_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("pagadoria-docs").upload(path, file);
      if (upErr) throw upErr;

      await supabase.from("pagadoria_solicitacoes").update({
        contrato_pdf_url: path,
        status: "pronto",
        updated_at: new Date().toISOString(),
      }).eq("id", selected.id);

      toast.success("✅ Contrato anexado e status atualizado para Pronto!");
      load();
      setSelected(prev => prev ? { ...prev, contrato_pdf_url: path, status: "pronto" } : null);
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const saveObs = async () => {
    if (!selected) return;
    await supabase.from("pagadoria_solicitacoes").update({
      obs_backoffice: obsBackoffice,
      updated_at: new Date().toISOString(),
    }).eq("id", selected.id);
    toast.success("Observação salva");
  };

  const downloadDoc = async (path: string) => {
    const { data } = await supabase.storage.from("pagadoria-docs").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Erro ao gerar link");
  };

  const counts = {
    enviado: solicitacoes.filter(s => s.status === "enviado").length,
    producao: solicitacoes.filter(s => s.status === "producao").length,
    pronto: solicitacoes.filter(s => s.status === "pronto").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Solicitações de Pagadoria</h1>
          <p className="text-sm text-muted-foreground">Gerencie contratos solicitados pelo time comercial</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(counts).map(([status, count]) => {
          const cfg = STATUS_CONFIG[status];
          return (
            <Card key={status} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus(status === filterStatus ? "todas" : status)}>
              <CardContent className="flex items-center gap-3 py-4 px-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${cfg.color}`}>
                  <cfg.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente ou empreendimento..." className="pl-9 h-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="enviado">📩 Enviado</SelectItem>
            <SelectItem value="producao">⚙️ Produção</SelectItem>
            <SelectItem value="pronto">✅ Pronto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Nenhuma solicitação encontrada</CardContent></Card>
        ) : filtered.map(s => {
          const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.enviado;
          return (
            <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSelected(s); setObsBackoffice(s.obs_backoffice || ""); }}>
              <CardContent className="flex items-center justify-between py-3 px-4 gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <cfg.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{s.nome_cliente}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.empreendimento || "Sem empreendimento"} {s.unidade ? `• Un. ${s.unidade}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {s.vgv_contrato && (
                    <span className="text-xs font-semibold text-foreground">
                      R$ {s.vgv_contrato.toLocaleString("pt-BR")}
                    </span>
                  )}
                  <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(s.created_at), "dd/MM", { locale: ptBR })}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={v => { if (!v) setSelected(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {selected.nome_cliente}
                </DialogTitle>
                <Badge variant="outline" className={`w-fit text-xs ${STATUS_CONFIG[selected.status]?.color}`}>
                  {STATUS_CONFIG[selected.status]?.label}
                </Badge>
              </DialogHeader>

              <div className="space-y-4">
                {/* Dados */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-xs text-muted-foreground">CPF:</span><p className="font-medium">{selected.cpf || "—"}</p></div>
                  <div><span className="text-xs text-muted-foreground">RG:</span><p className="font-medium">{selected.rg || "—"}</p></div>
                  <div><span className="text-xs text-muted-foreground">E-mail:</span><p className="font-medium">{selected.email || "—"}</p></div>
                  <div><span className="text-xs text-muted-foreground">Telefone:</span><p className="font-medium">{selected.telefone || "—"}</p></div>
                  <div><span className="text-xs text-muted-foreground">Empreendimento:</span><p className="font-medium">{selected.empreendimento || "—"}</p></div>
                  <div><span className="text-xs text-muted-foreground">Unidade:</span><p className="font-medium">{selected.unidade || "—"}</p></div>
                  <div><span className="text-xs text-muted-foreground">VGV Contrato:</span><p className="font-medium">{selected.vgv_contrato ? `R$ ${selected.vgv_contrato.toLocaleString("pt-BR")}` : "—"}</p></div>
                  <div><span className="text-xs text-muted-foreground">% Comissão:</span><p className="font-medium">{selected.percentual_comissao ? `${selected.percentual_comissao}%` : "—"}</p></div>
                </div>

                {selected.observacoes && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Obs. do solicitante</Label>
                    <p className="text-sm bg-muted/40 rounded-lg p-2 mt-1">{selected.observacoes}</p>
                  </div>
                )}

                {/* Documentos */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Documentos Enviados</h4>
                  <div className="flex flex-wrap gap-2">
                    {selected.rg_url && (
                      <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => downloadDoc(selected.rg_url!)}>
                        <Download className="h-3 w-3" /> RG
                      </Button>
                    )}
                    {selected.cpf_url && (
                      <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => downloadDoc(selected.cpf_url!)}>
                        <Download className="h-3 w-3" /> CPF
                      </Button>
                    )}
                    {selected.comprovante_residencia_url && (
                      <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => downloadDoc(selected.comprovante_residencia_url!)}>
                        <Download className="h-3 w-3" /> Comprovante
                      </Button>
                    )}
                    {selected.ficha_construtora_url && (
                      <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => downloadDoc(selected.ficha_construtora_url!)}>
                        <Download className="h-3 w-3" /> Ficha Construtora
                      </Button>
                    )}
                    {!selected.rg_url && !selected.cpf_url && !selected.comprovante_residencia_url && !selected.ficha_construtora_url && (
                      <p className="text-xs text-muted-foreground italic">Nenhum documento anexado</p>
                    )}
                  </div>
                </div>

                {/* Status actions */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Ações</h4>
                  <div className="flex gap-2 flex-wrap">
                    {selected.status === "enviado" && (
                      <Button size="sm" className="text-xs gap-1" onClick={() => updateStatus(selected.id, "producao")}>
                        <Settings className="h-3 w-3" /> Iniciar Produção
                      </Button>
                    )}
                    {selected.status === "producao" && (
                      <label>
                        <Button size="sm" className="text-xs gap-1" disabled={uploading} asChild>
                          <span>
                            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                            Anexar Contrato e Finalizar
                          </span>
                        </Button>
                        <input type="file" className="hidden" accept=".pdf" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadContrato(file);
                        }} />
                      </label>
                    )}
                    {selected.status === "pronto" && selected.contrato_pdf_url && (
                      <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => downloadDoc(selected.contrato_pdf_url!)}>
                        <Download className="h-3 w-3" /> Baixar Contrato Final
                      </Button>
                    )}
                  </div>
                </div>

                {/* Obs backoffice */}
                <div>
                  <Label className="text-xs">Observação interna (backoffice)</Label>
                  <div className="flex gap-2 mt-1">
                    <Textarea value={obsBackoffice} onChange={e => setObsBackoffice(e.target.value)} className="text-sm h-16 flex-1" placeholder="Notas internas..." />
                    <Button variant="outline" size="sm" className="self-end text-xs" onClick={saveObs}>Salvar</Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
