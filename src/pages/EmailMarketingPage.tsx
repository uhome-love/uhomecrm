import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Mail, Settings, FileText, BarChart3, Send, Plus, Trash2, Eye, Copy, Pencil, Database, FileSpreadsheet, Upload, Pause, Play, RotateCcw } from "lucide-react";
import { useEmailSettings, useEmailTemplates, useEmailCampaigns } from "@/hooks/useEmail";
import { useOAListas } from "@/hooks/useOfertaAtiva";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Papa from "papaparse";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Settings Tab ───
function EmailSettingsTab() {
  const { settings, loading, updateSetting } = useEmailSettings();
  const [editing, setEditing] = useState<Record<string, string>>({});

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const fields = [
    { key: "mailgun_domain", label: "Domínio Mailgun", type: "text" },
    { key: "mailgun_base_url", label: "Base URL da API", type: "text" },
    { key: "mailgun_from", label: "Remetente padrão (From)", type: "text" },
    { key: "mailgun_reply_to", label: "Reply-To padrão", type: "text" },
    { key: "webhook_signing_key", label: "Webhook Signing Key", type: "password" },
  ];

  const toggles = [
    { key: "tracking_opens", label: "Rastrear aberturas" },
    { key: "tracking_clicks", label: "Rastrear cliques" },
    { key: "tracking_unsubscribe", label: "Rastrear descadastros" },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Settings className="h-4 w-4" /> Configuração Mailgun</h3>
        {fields.map(f => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs">{f.label}</Label>
            <div className="flex gap-2">
              <Input
                type={f.type}
                value={editing[f.key] ?? settings[f.key] ?? ""}
                onChange={e => setEditing(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="text-sm"
              />
              {editing[f.key] !== undefined && editing[f.key] !== settings[f.key] && (
                <Button size="sm" onClick={() => { updateSetting(f.key, editing[f.key]); setEditing(prev => { const n = { ...prev }; delete n[f.key]; return n; }); }}>
                  Salvar
                </Button>
              )}
            </div>
          </div>
        ))}
      </Card>
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-sm">Tracking</h3>
        {toggles.map(t => (
          <div key={t.key} className="flex items-center justify-between">
            <Label className="text-sm">{t.label}</Label>
            <Switch
              checked={settings[t.key] === "true"}
              onCheckedChange={v => updateSetting(t.key, v ? "true" : "false")}
            />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Templates Tab ───
function EmailTemplatesTab() {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useEmailTemplates();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", assunto: "", html_content: "", text_content: "", categoria: "geral" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const handleSave = async () => {
    if (!form.nome || !form.assunto) { toast.error("Nome e assunto obrigatórios"); return; }
    if (editingId) {
      const ok = await updateTemplate(editingId, form as any);
      if (ok) { setDialogOpen(false); setEditingId(null); }
    } else {
      const ok = await createTemplate(form as any);
      if (ok) { setDialogOpen(false); }
    }
    setForm({ nome: "", assunto: "", html_content: "", text_content: "", categoria: "geral" });
  };

  const openEdit = (t: any) => {
    setForm({ nome: t.nome, assunto: t.assunto, html_content: t.html_content, text_content: t.text_content || "", categoria: t.categoria });
    setEditingId(t.id);
    setDialogOpen(true);
  };

  const PLACEHOLDERS = ["{{nome}}", "{{email}}", "{{telefone}}", "{{empreendimento}}", "{{bairro}}", "{{corretor}}", "{{link_landing}}", "{{link_whatsapp}}", "{{origem}}", "{{faixa_valor}}"];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{templates.length} templates</p>
        <Button size="sm" onClick={() => { setEditingId(null); setForm({ nome: "", assunto: "", html_content: "", text_content: "", categoria: "geral" }); setDialogOpen(true); }} className="gap-1">
          <Plus className="h-4 w-4" /> Novo Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum template criado ainda</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map(t => (
            <Card key={t.id} className={`p-4 ${!t.ativo ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">{t.nome}</h4>
                    <Badge variant="secondary" className="text-[10px]">{t.categoria}</Badge>
                    {!t.ativo && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">Assunto: {t.assunto}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewHtml(t.html_content)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTemplate(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Geral</SelectItem>
                    <SelectItem value="campanha">Campanha</SelectItem>
                    <SelectItem value="followup">Follow-up</SelectItem>
                    <SelectItem value="reativacao">Reativação</SelectItem>
                    <SelectItem value="transacional">Transacional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Assunto</Label>
              <Input value={form.assunto} onChange={e => setForm(p => ({ ...p, assunto: e.target.value }))} placeholder="Assunto do email" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Conteúdo HTML</Label>
              <Textarea value={form.html_content} onChange={e => setForm(p => ({ ...p, html_content: e.target.value }))} rows={12} className="font-mono text-xs" placeholder="<html>...</html>" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Versão texto simples (opcional)</Label>
              <Textarea value={form.text_content} onChange={e => setForm(p => ({ ...p, text_content: e.target.value }))} rows={4} className="text-xs" />
            </div>
            <div>
              <Label className="text-xs mb-2 block">Placeholders disponíveis</Label>
              <div className="flex flex-wrap gap-1">
                {PLACEHOLDERS.map(p => (
                  <Badge key={p} variant="outline" className="text-[10px] cursor-pointer hover:bg-accent" onClick={() => {
                    navigator.clipboard.writeText(p);
                    toast.success(`${p} copiado`);
                  }}>{p}</Badge>
                ))}
              </div>
            </div>
            <Button onClick={handleSave} className="w-full">{editingId ? "Salvar alterações" : "Criar template"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader><DialogTitle>Preview do Template</DialogTitle></DialogHeader>
          <div className="border rounded-lg overflow-auto max-h-[60vh] bg-white">
            <iframe srcDoc={previewHtml || ""} className="w-full min-h-[400px]" sandbox="" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Campaigns Tab ───
type FonteDados = "pipeline" | "oferta_ativa" | "manual";

function EmailCampaignsTab() {
  const { campaigns, loading, createCampaign, updateCampaign, deleteCampaign, sendCampaign, reload: reloadCampaigns } = useEmailCampaigns();
  const { templates } = useEmailTemplates();
  const { listas: oaListas } = useOAListas();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<"info" | "segment" | "preview">("info");
  const [form, setForm] = useState({ nome: "", assunto: "", template_id: "", html_content: "" });
  const [fonte, setFonte] = useState<FonteDados>("pipeline");
  const [filters, setFilters] = useState({ empreendimento: "", origem: "", etapa: "", corretor: "", tags: "", temperatura: "" });
  const [selectedListaIds, setSelectedListaIds] = useState<string[]>([]);
  const [manualLeads, setManualLeads] = useState<any[]>([]);
  const [previewLeads, setPreviewLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [addingRecipients, setAddingRecipients] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter options
  const [filterOptions, setFilterOptions] = useState<{
    empreendimentos: string[]; origens: string[]; corretores: { id: string; nome: string }[]; temperaturas: string[];
  }>({ empreendimentos: [], origens: [], corretores: [], temperaturas: [] });

  useEffect(() => {
    (async () => {
      const [empRes, origRes, corrRes] = await Promise.all([
        supabase.from("pipeline_leads").select("empreendimento").not("empreendimento", "is", null) as any,
        supabase.from("pipeline_leads").select("origem").not("origem", "is", null) as any,
        supabase.from("profiles").select("id, nome").order("nome") as any,
      ]);
      const emps = [...new Set((empRes.data || []).map((r: any) => r.empreendimento).filter(Boolean))].sort() as string[];
      const origs = [...new Set((origRes.data || []).map((r: any) => r.origem).filter(Boolean))].sort() as string[];
      setFilterOptions({
        empreendimentos: emps,
        origens: origs,
        corretores: (corrRes.data || []),
        temperaturas: ["quente", "morno", "frio"],
      });
    })();
  }, []);

  const toggleListaId = (id: string) => {
    setSelectedListaIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const searchLeadsPipeline = useCallback(async () => {
    setLoadingLeads(true);
    let query = supabase.from("pipeline_leads").select("id, nome, email, telefone, empreendimento, origem, temperatura, corretor_id") as any;
    query = query.not("email", "is", null).neq("email", "");
    if (filters.empreendimento) query = query.eq("empreendimento", filters.empreendimento);
    if (filters.origem) query = query.eq("origem", filters.origem);
    if (filters.corretor) query = query.eq("corretor_id", filters.corretor);
    if (filters.temperatura) query = query.eq("temperatura", filters.temperatura);
    query = query.order("created_at", { ascending: false }).limit(500);
    const { data } = await query;

    const emails = (data || []).map((l: any) => l.email).filter(Boolean);
    let suppressedEmails: string[] = [];
    if (emails.length > 0) {
      const { data: suppressed } = await supabase.from("email_suppression_list").select("email").in("email", emails) as any;
      suppressedEmails = (suppressed || []).map((s: any) => s.email);
    }

    const filtered = (data || []).filter((l: any) => l.email && !suppressedEmails.includes(l.email));
    setPreviewLeads(filtered);
    setLoadingLeads(false);
  }, [filters]);

  const searchLeadsOA = useCallback(async () => {
    if (selectedListaIds.length === 0) { toast.error("Selecione ao menos uma lista"); return; }
    setLoadingLeads(true);
    let allOALeads: any[] = [];
    for (const listaId of selectedListaIds) {
      const { data } = await supabase
        .from("oferta_ativa_leads")
        .select("id, nome, telefone, email, empreendimento, campanha, origem, lista_id")
        .eq("lista_id", listaId)
        .not("email", "is", null)
        .neq("email", "" as any)
        .in("status", ["na_fila", "em_cooldown", "aproveitado"])
        .order("created_at", { ascending: false })
        .limit(500) as any;
      if (data) allOALeads.push(...data);
    }

    // Deduplicate by email
    const seen = new Set<string>();
    const unique = allOALeads.filter(l => {
      if (!l.email) return false;
      const e = l.email.toLowerCase();
      if (seen.has(e)) return false;
      seen.add(e);
      return true;
    });

    // Filter suppressed
    const emails = unique.map(l => l.email);
    let suppressedEmails: string[] = [];
    if (emails.length > 0) {
      const { data: suppressed } = await supabase.from("email_suppression_list").select("email").in("email", emails) as any;
      suppressedEmails = (suppressed || []).map((s: any) => s.email);
    }
    setPreviewLeads(unique.filter(l => !suppressedEmails.includes(l.email)));
    setLoadingLeads(false);
  }, [selectedListaIds]);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const leads = (results.data as any[])
          .map((row, i) => {
            const email = row.email || row.Email || row.EMAIL || row["E-mail"] || row["e-mail"] || "";
            const nome = row.nome || row.Nome || row.NOME || row.name || row.Name || "";
            if (!email || !email.includes("@")) return null;
            return { id: `manual-${i}`, nome, email: email.trim().toLowerCase(), empreendimento: row.empreendimento || row.Empreendimento || "" };
          })
          .filter(Boolean);
        setManualLeads(leads);
        toast.success(`${leads.length} leads com email válido importados`);
      },
      error: () => toast.error("Erro ao ler arquivo CSV"),
    });
    e.target.value = "";
  };

  const handleConfirmSegment = async () => {
    if (fonte === "pipeline") {
      await searchLeadsPipeline();
    } else if (fonte === "oferta_ativa") {
      await searchLeadsOA();
    } else {
      // Manual - filter suppressed
      if (manualLeads.length === 0) { toast.error("Importe um CSV primeiro"); return; }
      setLoadingLeads(true);
      const emails = manualLeads.map(l => l.email);
      let suppressedEmails: string[] = [];
      if (emails.length > 0) {
        const { data: suppressed } = await supabase.from("email_suppression_list").select("email").in("email", emails) as any;
        suppressedEmails = (suppressed || []).map((s: any) => s.email);
      }
      setPreviewLeads(manualLeads.filter(l => !suppressedEmails.includes(l.email)));
      setLoadingLeads(false);
    }
    setStep("preview");
  };

  const handleCreate = async () => {
    if (!form.nome || !form.assunto) { toast.error("Nome e assunto obrigatórios"); return; }
    setStep("segment");
  };

  const handleFinalCreate = async () => {
    if (previewLeads.length === 0) { toast.error("Nenhum lead com email encontrado"); return; }
    setAddingRecipients(true);
    const tpl = templates.find(t => t.id === form.template_id);
    const campaign = await createCampaign({
      nome: form.nome,
      assunto: form.assunto,
      template_id: form.template_id || null,
      html_content: form.html_content || tpl?.html_content || "",
      filtros: { ...filters, fonte },
      total_destinatarios: previewLeads.length,
    } as any);

    if (campaign) {
      const batchSize = 100;
      let insertedCount = 0;
      for (let i = 0; i < previewLeads.length; i += batchSize) {
        const batch = previewLeads.slice(i, i + batchSize).map(l => ({
          campaign_id: campaign.id,
          lead_id: fonte === "manual" ? null : l.id,
          email: l.email,
          nome: l.nome,
          status: "pendente",
          variaveis: { nome: l.nome || "", empreendimento: l.empreendimento || "", origem: l.origem || "" },
        }));
        const { error: insertErr } = await supabase.from("email_campaign_recipients").insert(batch as any) as any;
        if (insertErr) {
          console.error("Erro ao inserir destinatários batch", i, insertErr);
          toast.error(`Erro ao inserir lote ${Math.floor(i/batchSize)+1}: ${insertErr.message}`);
        } else {
          insertedCount += batch.length;
        }
      }
      toast.success(`${insertedCount} destinatários adicionados`);
      setDialogOpen(false);
      setStep("info");
      reloadCampaigns();
    }
    setAddingRecipients(false);
  };

  const handleSend = async (id: string) => {
    const { count } = await supabase.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", id).or("status.eq.pendente,status.is.null") as any;
    if (!count || count === 0) { toast.error("Campanha sem destinatários pendentes"); return; }
    setSending(id);
    await sendCampaign(id);
    setSending(null);
  };

  const handlePause = async (id: string) => {
    await updateCampaign(id, { status: "pausada" } as any);
    toast.success("Campanha pausada");
  };

  const handleResume = async (id: string) => {
    setSending(id);
    await updateCampaign(id, { status: "enviando" } as any);
    await sendCampaign(id);
    setSending(null);
  };

  const handleResend = async (id: string) => {
    // Reset errors back to pending
    await supabase.from("email_campaign_recipients")
      .update({ status: "pendente", erro: null } as any)
      .eq("campaign_id", id)
      .eq("status", "erro");
    setSending(id);
    await updateCampaign(id, { status: "enviando" } as any);
    await sendCampaign(id);
    setSending(null);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const STATUS_COLORS: Record<string, string> = { rascunho: "secondary", enviando: "default", enviada: "default", agendada: "outline", pausada: "secondary" };
  const STATUS_LABELS: Record<string, string> = { rascunho: "Rascunho", enviando: "Enviando...", enviada: "Enviada", agendada: "Agendada", pausada: "Pausada" };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{campaigns.length} campanhas</p>
        <Button size="sm" onClick={() => { setForm({ nome: "", assunto: "", template_id: "", html_content: "" }); setFilters({ empreendimento: "", origem: "", etapa: "", corretor: "", tags: "", temperatura: "" }); setPreviewLeads([]); setManualLeads([]); setSelectedListaIds([]); setFonte("pipeline"); setStep("info"); setDialogOpen(true); }} className="gap-1">
          <Plus className="h-4 w-4" /> Nova Campanha
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card className="p-8 text-center">
          <Send className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma campanha criada</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">{c.nome}</h4>
                    <Badge variant={STATUS_COLORS[c.status] as any || "secondary"} className="text-[10px]">
                      {STATUS_LABELS[c.status] || c.status}
                    </Badge>
                    {c.total_destinatarios > 0 && (
                      <Badge variant="outline" className="text-[10px]">{c.total_destinatarios} dest.</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Assunto: {c.assunto}</p>
                  {(c.status === "enviada" || c.status === "enviando" || c.status === "pausada") && (
                    <div className="flex gap-4 text-[11px] text-muted-foreground mt-2">
                      <span>📤 {c.total_enviados} enviados</span>
                      {c.total_erros > 0 && <span>❌ {c.total_erros} erros</span>}
                      {c.status !== "enviada" && (
                        <span>⏳ {c.total_destinatarios - (c.total_enviados || 0) - (c.total_erros || 0)} pendentes</span>
                      )}
                      {c.status === "enviada" && (
                        <>
                          <span>📬 {c.total_entregues} entregues</span>
                          <span>👁 {c.total_aberturas} aberturas</span>
                          <span>🔗 {c.total_cliques} cliques</span>
                          <span>⛔ {c.total_bounces} bounces</span>
                          <span>🚫 {c.total_unsubscribes} unsub</span>
                        </>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {c.status === "rascunho" && (
                    <Button size="sm" variant="default" className="gap-1 text-xs" onClick={() => handleSend(c.id)} disabled={sending === c.id}>
                      {sending === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      Enviar
                    </Button>
                  )}
                  {c.status === "enviando" && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => handlePause(c.id)}>
                      <Pause className="h-3 w-3" /> Pausar
                    </Button>
                  )}
                  {(c.status === "pausada" || c.status === "enviando") && (
                    <Button size="sm" variant="default" className="gap-1 text-xs" onClick={() => handleResume(c.id)} disabled={sending === c.id}>
                      {sending === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      {c.status === "pausada" ? "Retomar" : "Continuar"}
                    </Button>
                  )}
                  {(c.status === "enviada" || c.status === "pausada" || c.status === "enviando") && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleResend(c.id)} disabled={sending === c.id}>
                      <RotateCcw className="h-3 w-3" /> Reenviar erros
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCampaign(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Campaign Wizard Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {step === "info" && "1/3 · Dados da Campanha"}
              {step === "segment" && "2/3 · Segmentação de Leads"}
              {step === "preview" && "3/3 · Confirmar Destinatários"}
            </DialogTitle>
          </DialogHeader>

          {step === "info" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Nome da campanha</Label>
                <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Melnick Day - Março" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Assunto do email</Label>
                <Input value={form.assunto} onChange={e => setForm(p => ({ ...p, assunto: e.target.value }))} placeholder="Ex: 🏠 Oportunidade exclusiva para você!" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Template</Label>
                <Select value={form.template_id} onValueChange={v => setForm(p => ({ ...p, template_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                  <SelectContent>
                    {templates.filter(t => t.ativo).map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!form.template_id && (
                <div className="space-y-1">
                  <Label className="text-xs">HTML do email</Label>
                  <Textarea value={form.html_content} onChange={e => setForm(p => ({ ...p, html_content: e.target.value }))} rows={8} className="font-mono text-xs" />
                </div>
              )}
              <Button onClick={handleCreate} className="w-full">Próximo → Segmentação</Button>
            </div>
          )}

          {step === "segment" && (
            <div className="space-y-4">
              {/* Fonte de Dados Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Fonte de Dados</Label>
                <div className="flex gap-2">
                  <Button
                    variant={fonte === "pipeline" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setFonte("pipeline"); setPreviewLeads([]); }}
                    className="gap-1.5 flex-1"
                  >
                    <Database className="h-3.5 w-3.5" /> Pipeline de Leads
                  </Button>
                  <Button
                    variant={fonte === "oferta_ativa" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setFonte("oferta_ativa"); setPreviewLeads([]); }}
                    className="gap-1.5 flex-1"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Oferta Ativa
                  </Button>
                  <Button
                    variant={fonte === "manual" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setFonte("manual"); setPreviewLeads([]); }}
                    className="gap-1.5 flex-1"
                  >
                    <Upload className="h-3.5 w-3.5" /> Base Manual
                  </Button>
                </div>
              </div>

              {/* Pipeline filters */}
              {fonte === "pipeline" && (
                <>
                  <p className="text-sm text-muted-foreground">Filtre os leads do pipeline. Apenas leads com email serão incluídos. Suprimidos (bounce/unsub) são excluídos automaticamente.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Empreendimento</Label>
                      <Select value={filters.empreendimento} onValueChange={v => setFilters(p => ({ ...p, empreendimento: v === "_all" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_all">Todos</SelectItem>
                          {filterOptions.empreendimentos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Origem</Label>
                      <Select value={filters.origem} onValueChange={v => setFilters(p => ({ ...p, origem: v === "_all" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_all">Todas</SelectItem>
                          {filterOptions.origens.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Corretor</Label>
                      <Select value={filters.corretor} onValueChange={v => setFilters(p => ({ ...p, corretor: v === "_all" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_all">Todos</SelectItem>
                          {filterOptions.corretores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Temperatura</Label>
                      <Select value={filters.temperatura} onValueChange={v => setFilters(p => ({ ...p, temperatura: v === "_all" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_all">Todas</SelectItem>
                          {filterOptions.temperaturas.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              {/* Oferta Ativa lists */}
              {fonte === "oferta_ativa" && (
                <>
                  <p className="text-sm text-muted-foreground">Selecione as listas da Oferta Ativa. Apenas leads com email serão incluídos.</p>
                  {oaListas.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma lista encontrada</p>
                  ) : (
                    <>
                      {(() => {
                        const availableListas = oaListas.filter(l => ["ativa", "liberada"].includes(l.status));
                        const allSelected = availableListas.length > 0 && availableListas.every(l => selectedListaIds.includes(l.id));
                        return (
                          <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-sm font-medium text-primary hover:underline">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => {
                                if (allSelected) {
                                  availableListas.forEach(l => {
                                    if (selectedListaIds.includes(l.id)) toggleListaId(l.id);
                                  });
                                } else {
                                  availableListas.forEach(l => {
                                    if (!selectedListaIds.includes(l.id)) toggleListaId(l.id);
                                  });
                                }
                              }}
                            />
                            {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                          </label>
                        );
                      })()}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto">
                        {oaListas.filter(l => ["ativa", "liberada"].includes(l.status)).map(lista => (
                          <label
                            key={lista.id}
                            className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                              selectedListaIds.includes(lista.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                            }`}
                          >
                            <Checkbox
                              checked={selectedListaIds.includes(lista.id)}
                              onCheckedChange={() => toggleListaId(lista.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{lista.nome}</p>
                              <p className="text-xs text-muted-foreground">{lista.empreendimento} · {lista.total_leads} leads</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Manual CSV upload */}
              {fonte === "manual" && (
                <>
                  <p className="text-sm text-muted-foreground">Importe um arquivo CSV com colunas <strong>email</strong> e <strong>nome</strong>. Suprimidos serão excluídos automaticamente.</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleCSVUpload}
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {manualLeads.length > 0 ? `${manualLeads.length} leads importados — clique para trocar` : "Selecionar arquivo CSV"}
                  </Button>
                  {manualLeads.length > 0 && (
                    <div className="border rounded-lg max-h-32 overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-medium">Nome</th>
                            <th className="text-left p-2 font-medium">Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {manualLeads.slice(0, 10).map(l => (
                            <tr key={l.id} className="border-t">
                              <td className="p-2">{l.nome || "—"}</td>
                              <td className="p-2 text-muted-foreground">{l.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {manualLeads.length > 10 && (
                        <p className="text-center text-xs text-muted-foreground py-1">...e mais {manualLeads.length - 10}</p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("info")} className="flex-1">← Voltar</Button>
                <Button onClick={handleConfirmSegment} className="flex-1" disabled={loadingLeads || (fonte === "manual" && manualLeads.length === 0) || (fonte === "oferta_ativa" && selectedListaIds.length === 0)}>
                  {loadingLeads ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar leads →"}
                </Button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="default" className="text-sm px-3 py-1">
                  {previewLeads.length} leads encontrados
                </Badge>
                <p className="text-xs text-muted-foreground">com email válido, sem supressão</p>
              </div>

              {previewLeads.length > 0 && (
                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Nome</th>
                        <th className="text-left p-2 font-medium">Email</th>
                        <th className="text-left p-2 font-medium">Empreendimento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewLeads.slice(0, 50).map(l => (
                        <tr key={l.id} className="border-t">
                          <td className="p-2">{l.nome || "—"}</td>
                          <td className="p-2 text-muted-foreground">{l.email}</td>
                          <td className="p-2 text-muted-foreground">{l.empreendimento || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewLeads.length > 50 && (
                    <p className="text-center text-xs text-muted-foreground py-2">
                      ...e mais {previewLeads.length - 50} leads
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("segment")} className="flex-1">← Filtros</Button>
                <Button onClick={handleFinalCreate} className="flex-1" disabled={addingRecipients || previewLeads.length === 0}>
                  {addingRecipients ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Criar campanha com {previewLeads.length} destinatários
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Dashboard Tab ───
function EmailDashboardTab() {
  const { campaigns } = useEmailCampaigns();
  const sentCampaigns = campaigns.filter(c => c.status === "enviada");
  
  const totals = sentCampaigns.reduce((acc, c) => ({
    enviados: acc.enviados + c.total_enviados,
    entregues: acc.entregues + c.total_entregues,
    aberturas: acc.aberturas + c.total_aberturas,
    cliques: acc.cliques + c.total_cliques,
    bounces: acc.bounces + c.total_bounces,
    unsubscribes: acc.unsubscribes + c.total_unsubscribes,
  }), { enviados: 0, entregues: 0, aberturas: 0, cliques: 0, bounces: 0, unsubscribes: 0 });

  const taxaEntrega = totals.enviados > 0 ? ((totals.entregues / totals.enviados) * 100).toFixed(1) : "0";
  const taxaAbertura = totals.entregues > 0 ? ((totals.aberturas / totals.entregues) * 100).toFixed(1) : "0";
  const taxaClique = totals.aberturas > 0 ? ((totals.cliques / totals.aberturas) * 100).toFixed(1) : "0";
  const taxaBounce = totals.enviados > 0 ? ((totals.bounces / totals.enviados) * 100).toFixed(1) : "0";

  const stats = [
    { label: "Enviados", value: totals.enviados, icon: "📤" },
    { label: "Entregues", value: totals.entregues, icon: "📬", sub: `${taxaEntrega}%` },
    { label: "Aberturas", value: totals.aberturas, icon: "👁", sub: `${taxaAbertura}%` },
    { label: "Cliques", value: totals.cliques, icon: "🔗", sub: `${taxaClique}%` },
    { label: "Bounces", value: totals.bounces, icon: "⛔", sub: `${taxaBounce}%` },
    { label: "Unsub", value: totals.unsubscribes, icon: "🚫" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="p-4 text-center">
            <p className="text-2xl">{s.icon}</p>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            {s.sub && <p className="text-xs text-primary font-medium">{s.sub}</p>}
          </Card>
        ))}
      </div>

      {sentCampaigns.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Campanhas enviadas</h3>
          <div className="space-y-2">
            {sentCampaigns.map(c => {
              const openRate = c.total_entregues > 0 ? ((c.total_aberturas / c.total_entregues) * 100).toFixed(1) : "0";
              return (
                <div key={c.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <span className="font-medium">{c.nome}</span>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{c.total_enviados} env.</span>
                    <span>{openRate}% abertura</span>
                    <span>{c.total_cliques} cliques</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {sentCampaigns.length === 0 && (
        <Card className="p-8 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Envie sua primeira campanha para ver métricas aqui</p>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ───
export default function EmailMarketingPage() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Email Marketing</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Campanhas, templates e rastreamento de emails via Mailgun
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-1"><BarChart3 className="h-3.5 w-3.5" /> Dashboard</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1"><Send className="h-3.5 w-3.5" /> Campanhas</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1"><FileText className="h-3.5 w-3.5" /> Templates</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1"><Settings className="h-3.5 w-3.5" /> Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><EmailDashboardTab /></TabsContent>
        <TabsContent value="campaigns"><EmailCampaignsTab /></TabsContent>
        <TabsContent value="templates"><EmailTemplatesTab /></TabsContent>
        <TabsContent value="settings"><EmailSettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
