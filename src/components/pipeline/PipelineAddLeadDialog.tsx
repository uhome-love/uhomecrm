import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PipelineStage, PipelineLead, PipelineSegmento } from "@/hooks/usePipeline";
import { Loader2, AlertTriangle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PipelineStage[];
  segmentos: PipelineSegmento[];
  onAdd: (lead: Partial<PipelineLead>) => Promise<any>;
}

const ORIGENS = [
  { value: "meta_ads", label: "Meta Ads" },
  { value: "tiktok_ads", label: "TikTok Ads" },
  { value: "portal", label: "Portal" },
  { value: "site", label: "Site" },
  { value: "indicacao", label: "Indicação" },
  { value: "oferta_ativa", label: "Oferta Ativa" },
  { value: "outro", label: "Outro" },
];

interface DuplicateResult {
  id: string;
  nome: string;
  telefone: string;
  corretor_nome?: string;
  empreendimento?: string;
  source: "pipeline" | "oferta_ativa";
}

export default function PipelineAddLeadDialog({ open, onOpenChange, stages, segmentos, onAdd }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    email: "",
    segmento_id: "",
    empreendimento: "",
    origem: "",
    origem_detalhe: "",
    observacoes: "",
    valor_estimado: "",
  });

  const [duplicates, setDuplicates] = useState<DuplicateResult[]>([]);
  const [checkingDup, setCheckingDup] = useState(false);
  const debouncedPhone = useDebounce(form.telefone, 500);

  // Check for duplicates when phone changes
  useEffect(() => {
    const normalized = debouncedPhone.replace(/\D/g, "");
    if (normalized.length < 8) {
      setDuplicates([]);
      return;
    }

    const checkDuplicates = async () => {
      setCheckingDup(true);
      try {
        // Search pipeline_leads by phone (partial match)
        const phoneVariants = [normalized];
        if (normalized.length === 11) {
          phoneVariants.push(`+55${normalized}`);
          phoneVariants.push(`55${normalized}`);
        }

        const { data: pipelineResults } = await supabase
          .from("pipeline_leads")
          .select("id, nome, telefone, corretor_id, empreendimento")
          .or(phoneVariants.map(p => `telefone.ilike.%${p.slice(-8)}%`).join(","))
          .limit(5);

        const results: DuplicateResult[] = [];

        if (pipelineResults && pipelineResults.length > 0) {
          // Resolve corretor names
          const corretorIds = [...new Set(pipelineResults.filter(l => l.corretor_id).map(l => l.corretor_id!))];
          let corretorNames: Record<string, string> = {};
          if (corretorIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("user_id, nome")
              .in("user_id", corretorIds);
            for (const p of profiles || []) {
              corretorNames[p.user_id!] = p.nome || "Corretor";
            }
          }

          for (const lead of pipelineResults) {
            results.push({
              id: lead.id,
              nome: lead.nome || "Sem nome",
              telefone: lead.telefone || "",
              corretor_nome: lead.corretor_id ? corretorNames[lead.corretor_id] || "Corretor" : "Sem corretor",
              empreendimento: lead.empreendimento || undefined,
              source: "pipeline",
            });
          }
        }

        // Also check oferta_ativa_leads
        const { data: oaResults } = await supabase
          .from("oferta_ativa_leads")
          .select("id, nome, telefone")
          .or(phoneVariants.map(p => `telefone.ilike.%${p.slice(-8)}%`).join(","))
          .limit(3);

        for (const lead of oaResults || []) {
          results.push({
            id: lead.id,
            nome: lead.nome || "Sem nome",
            telefone: lead.telefone || "",
            source: "oferta_ativa",
          });
        }

        setDuplicates(results);
      } catch (err) {
        console.error("Erro ao verificar duplicidade:", err);
      } finally {
        setCheckingDup(false);
      }
    };

    checkDuplicates();
  }, [debouncedPhone]);

  const hasDuplicates = duplicates.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    if (hasDuplicates) return; // Block submission

    setLoading(true);
    try {
      const result = await onAdd({
        nome: form.nome.trim(),
        telefone: form.telefone || null,
        email: form.email || null,
        segmento_id: form.segmento_id || null,
        empreendimento: form.empreendimento || null,
        origem: form.origem || "Manual",
        origem_detalhe: form.origem_detalhe || null,
        observacoes: form.observacoes || null,
        valor_estimado: form.valor_estimado ? parseFloat(form.valor_estimado) : null,
      });
      if (result) {
        setForm({ nome: "", telefone: "", email: "", segmento_id: "", empreendimento: "", origem: "", origem_detalhe: "", observacoes: "", valor_estimado: "" });
        setDuplicates([]);
        onOpenChange(false);
      }
    } catch (err) {
      console.error("Erro ao adicionar lead:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Adicionar Lead ao Pipeline</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome do cliente"
                required
              />
            </div>
            <div className="col-span-2">
              <Label className="flex items-center gap-1">
                Telefone
                {checkingDup && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                {!checkingDup && debouncedPhone.replace(/\D/g, "").length >= 8 && !hasDuplicates && (
                  <span className="text-xs text-green-600">✓ Disponível</span>
                )}
              </Label>
              <div className="relative">
                <Input
                  value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                  placeholder="(51) 99999-9999"
                  className={hasDuplicates ? "border-destructive pr-8" : ""}
                />
                {checkingDup && (
                  <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground animate-pulse" />
                )}
              </div>

              {/* Duplicate warning */}
              {hasDuplicates && (
                <div className="mt-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-destructive text-sm font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    Lead já existe no sistema!
                  </div>
                  {duplicates.map(dup => (
                    <div key={`${dup.source}-${dup.id}`} className="text-xs bg-background rounded p-2 space-y-0.5">
                      <div className="font-medium">{dup.nome}</div>
                      <div className="text-muted-foreground">
                        📞 {dup.telefone}
                        {dup.empreendimento && ` · 🏢 ${dup.empreendimento}`}
                      </div>
                      <div className="text-muted-foreground">
                        {dup.source === "pipeline" ? "📋 Pipeline" : "📞 Oferta Ativa"}
                        {dup.corretor_nome && ` · 👤 ${dup.corretor_nome}`}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Não é possível cadastrar um lead com telefone já existente.
                  </p>
                </div>
              )}
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label>Segmento</Label>
              <Select value={form.segmento_id} onValueChange={v => setForm(f => ({ ...f, segmento_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {segmentos.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.cor }} />
                        {s.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Origem</Label>
              <Select value={form.origem} onValueChange={v => setForm(f => ({ ...f, origem: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empreendimento</Label>
              <Input
                value={form.empreendimento}
                onChange={e => setForm(f => ({ ...f, empreendimento: e.target.value }))}
                placeholder="Nome do empreendimento"
              />
            </div>
            <div>
              <Label>Valor Estimado (R$)</Label>
              <Input
                type="number"
                value={form.valor_estimado}
                onChange={e => setForm(f => ({ ...f, valor_estimado: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Observações sobre o lead..."
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !form.nome.trim() || hasDuplicates}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
