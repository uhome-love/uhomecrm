import { useEffect, useState } from "react";
import { PDN_GRUPOS, type PdnGrupo, type PdnRow } from "@/hooks/usePdn";
import { fmtMoney } from "@/lib/fmtMoney";
import { formatBRT } from "@/lib/brtTime";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, TrendingDown, RotateCcw, AlertTriangle, Send, Undo2, CheckCircle2, Megaphone, ExternalLink } from "lucide-react";
import type { PdnSavePatch } from "./PdnKanban";
import { MoneyInput } from "./MoneyInput";

const STATUS_PRESETS = [
  "Aguardando docs", "Em aprovação", "Negociando", "Proposta", "Follow up",
  "Em confecção", "Gerado", "Assinado",
];

/**
 * Hash curto (SHA-1 → 10 chars hex) via Web Crypto. Usado para idempotência
 * das notas publicadas no histórico do lead (marcador embutido no conteúdo).
 */
async function sha1Short(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 10);
}

type PubField = "observacao" | "proxima_acao";

const FIELD_LABEL: Record<PubField, string> = {
  observacao: "Observação",
  proxima_acao: "Próxima ação",
};

export function PdnCardDrawer({
  row, onClose, onSave, onUpdateManual, onRemove, onQueda, onReativar, onMudarEtapa, onLimparEtapa, onAvisar,
}: {
  row: PdnRow | null;
  onClose: () => void;
  onSave: (row: PdnRow, patch: PdnSavePatch) => void;
  onUpdateManual: (overrideId: string, patch: Record<string, any>) => void;
  onRemove: (row: PdnRow) => void;
  onQueda: (row: PdnRow) => void;
  onReativar: (row: PdnRow) => void;
  onMudarEtapa: (row: PdnRow, grupo: PdnGrupo) => void;
  onLimparEtapa: (row: PdnRow) => void;
  onAvisar: (row: PdnRow, mensagem: string) => void;
}) {
  const [status, setStatus] = useState("");
  const [obs, setObs] = useState("");
  const [proxAcao, setProxAcao] = useState("");
  const [proxData, setProxData] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [riscoManual, setRiscoManual] = useState(false);
  const [riscoMotivo, setRiscoMotivo] = useState("");
  // Campos de linha manual
  const [nome, setNome] = useState("");
  const [empreend, setEmpreend] = useState("");
  const [vgv, setVgv] = useState(0);
  const [corretor, setCorretor] = useState("");
  // Avisar corretor
  const [avisarOpen, setAvisarOpen] = useState(false);
  const [avisoMsg, setAvisoMsg] = useState("");
  // Publicar no lead — controla estado por campo
  const [publishing, setPublishing] = useState<PubField | null>(null);
  const [publishedHash, setPublishedHash] = useState<Record<PubField, string | null>>({ observacao: null, proxima_acao: null });

  useEffect(() => {
    if (!row) return;
    setStatus(row.status || "");
    setObs(row.observacoes || "");
    setProxAcao(row.proximaAcao || "");
    setProxData(row.proximaAcaoData || "");
    setPrioridade(row.prioridade || "");
    setRiscoManual(row.riscoManual);
    setRiscoMotivo(row.riscoMotivo || "");
    setNome(row.nome || "");
    setEmpreend(row.empreendimento === "—" ? "" : row.empreendimento);
    setVgv(row.vgv || 0);
    setCorretor(row.corretor === "—" ? "" : row.corretor);
    setAvisarOpen(false);
    setAvisoMsg("");
    setPublishedHash({ observacao: null, proxima_acao: null });

    // Pré-carrega hashes já publicados para este lead (últimos 60 dias) para
    // sinalizar "Publicado ✓" vs "Republicar" no botão.
    if (row.pipelineLeadId) {
      (async () => {
        const { data } = await supabase
          .from("pipeline_anotacoes")
          .select("conteudo, created_at")
          .eq("pipeline_lead_id", row.pipelineLeadId!)
          .ilike("conteudo", "%[pdn:%")
          .order("created_at", { ascending: false })
          .limit(30);
        const found: Record<PubField, string | null> = { observacao: null, proxima_acao: null };
        for (const r of data || []) {
          const c = String((r as any).conteudo || "");
          for (const f of ["observacao", "proxima_acao"] as PubField[]) {
            if (found[f]) continue;
            const re = new RegExp(`\\[pdn:${row.pipelineLeadId}:${f}:([a-f0-9]{6,20})\\]`);
            const m = c.match(re);
            if (m) found[f] = m[1];
          }
        }
        setPublishedHash(found);
      })();
    }
  }, [row]);

  if (!row) return null;

  const save = () => {
    onSave(row, {
      status, observacoes: obs, proximaAcao: proxAcao, proximaAcaoData: proxData,
      prioridade: (prioridade as PdnRow["prioridade"]) || "",
      riscoManual, riscoMotivo,
      // Empreendimento/VGV também são editáveis para negócios do pipeline (overlay do gestor)
      ...(row.isManual ? {} : { empreendimento: empreend, vgv }),
    });
    if (row.isManual && row.overrideId) {
      onUpdateManual(row.overrideId, {
        nome, empreendimento: empreend || null, vgv, corretor: corretor || null,
      });
    }
    onClose();
  };

  async function publicarNoLead(field: PubField, texto: string) {
    if (!row?.pipelineLeadId) return;
    const clean = texto.trim();
    if (!clean) { toast.info("Escreva algo antes de publicar"); return; }
    setPublishing(field);
    try {
      const hash = await sha1Short(clean);
      const marker = `[pdn:${row.pipelineLeadId}:${field}:${hash}]`;

      // Idempotência: se já existe nota com o mesmo hash, não duplica.
      const { data: exists } = await supabase
        .from("pipeline_anotacoes")
        .select("id")
        .eq("pipeline_lead_id", row.pipelineLeadId)
        .ilike("conteudo", `%${marker}%`)
        .limit(1);
      if (exists && exists.length > 0) {
        setPublishedHash(prev => ({ ...prev, [field]: hash }));
        toast.info("Este texto já foi publicado no lead");
        return;
      }

      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) { toast.error("Sessão expirada"); return; }

      // Nome do autor (opcional, best-effort)
      let autorNome = "Gestor (PDN)";
      const { data: prof } = await supabase.from("profiles").select("nome").eq("user_id", uid).maybeSingle();
      if (prof && (prof as any).nome) autorNome = `${(prof as any).nome} (Gestor · PDN)`;

      const conteudo = `[Gestor · PDN] ${FIELD_LABEL[field]}: ${clean}\n\n${marker}`;
      const { error } = await supabase.from("pipeline_anotacoes").insert({
        pipeline_lead_id: row.pipelineLeadId,
        conteudo,
        autor_id: uid,
        autor_nome: autorNome,
        fixada: false,
      });
      if (error) { toast.error("Erro ao publicar: " + error.message); return; }

      // Também persiste no overlay (garante que a última edição fica salva)
      if (field === "observacao") onSave(row, { observacoes: clean });
      else onSave(row, { proximaAcao: clean, proximaAcaoData: proxData });

      setPublishedHash(prev => ({ ...prev, [field]: hash }));
      toast.success("Publicado no histórico do lead ✓");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao publicar no lead");
    } finally {
      setPublishing(null);
    }
  }

  function PublishButton({ field, texto }: { field: PubField; texto: string }) {
    if (!row?.pipelineLeadId) return null;
    const clean = texto.trim();
    const disabled = !clean || publishing === field;
    const isBusy = publishing === field;
    const [localHash, setLocalHash] = useState<string | null>(null);
    // Recalcula hash local para comparar com o publicado.
    useEffect(() => {
      let cancelled = false;
      if (!clean) { setLocalHash(null); return; }
      sha1Short(clean).then(h => { if (!cancelled) setLocalHash(h); });
      return () => { cancelled = true; };
    }, [clean]);
    const pubHash = publishedHash[field];
    const isPublishedSame = pubHash && localHash && pubHash === localHash;
    const isPublishedDrift = pubHash && localHash && pubHash !== localHash;
    const label = isBusy
      ? "Publicando…"
      : isPublishedSame
        ? "Publicado no lead ✓"
        : isPublishedDrift
          ? "Republicar no lead"
          : "Publicar no lead";
    return (
      <Button
        type="button"
        variant={isPublishedSame ? "ghost" : "outline"}
        size="sm"
        disabled={disabled}
        onClick={() => publicarNoLead(field, clean)}
        className={`h-8 gap-1.5 text-xs ${isPublishedSame ? "text-emerald-600 dark:text-emerald-400" : ""}`}
        title={`Cria uma nota no histórico do lead com esta ${FIELD_LABEL[field].toLowerCase()}.`}
      >
        {isPublishedSame ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Megaphone className="h-3.5 w-3.5" />}
        {label}
      </Button>
    );
  }

  return (
    <Sheet open={!!row} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {row.emRisco && <AlertTriangle className="h-4 w-4 text-amber-500" />}
            {row.isManual ? "Negócio manual" : row.nome}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Atalho para abrir o lead no pipeline em nova aba */}
          {!row.isManual && row.pipelineLeadId && (
            <a
              href={`/pipeline-leads?lead=${row.pipelineLeadId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Abrir lead no pipeline
            </a>
          )}

          {/* Etapa no PDN (interna — não altera o pipeline do corretor) */}
          <div className="space-y-1 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Label>Etapa no PDN</Label>
              {row.etapaAjustada && <Badge variant="secondary" className="text-[10px]">ajustada pelo gestor</Badge>}
            </div>
            <Select value={row.grupo} onValueChange={(v) => onMudarEtapa(row, v as PdnGrupo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PDN_GRUPOS.map(g => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {!row.isManual && row.etapaAjustada && (
              <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs text-muted-foreground" onClick={() => onLimparEtapa(row)}>
                <Undo2 className="mr-1 h-3 w-3" /> Voltar à etapa do pipeline ({PDN_GRUPOS.find(g => g.key === row.grupoOrigem)?.label})
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">Mudar a etapa aqui só reorganiza o PDN. O pipeline do corretor não é alterado.</p>
          </div>

          {/* Avisar corretor (notificação no app) */}
          {!row.isManual && row.corretorAuthId && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label>Avisar corretor</Label>
                {row.avisadoEm && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Avisado {formatBRT(row.avisadoEm, "dd/MM HH:mm")}
                  </span>
                )}
              </div>
              {avisarOpen ? (
                <>
                  <Textarea
                    autoFocus
                    value={avisoMsg}
                    onChange={(e) => setAvisoMsg(e.target.value)}
                    className="min-h-[70px] text-sm"
                    placeholder={`Ex.: Atualize o pipeline de ${row.nome} para "${PDN_GRUPOS.find(g => g.key === row.grupo)?.label}".`}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setAvisarOpen(false)}>Cancelar</Button>
                    <Button size="sm" onClick={() => { onAvisar(row, avisoMsg.trim()); setAvisarOpen(false); setAvisoMsg(""); }}>
                      <Send className="mr-1.5 h-3.5 w-3.5" /> Enviar aviso
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setAvisarOpen(true)}>
                  <Send className="mr-1.5 h-3.5 w-3.5" /> Avisar corretor para atualizar o pipeline
                </Button>
              )}
            </div>
          )}


          {/* Empreendimento/VGV editáveis pelo gestor (overlay) + contexto do corretor (leitura) */}
          {!row.isManual && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="space-y-1">
                <Label>Empreendimento</Label>
                <Input value={empreend} onChange={(e) => setEmpreend(e.target.value)} placeholder="Nome do empreendimento" />
              </div>
              <div className="space-y-1">
                <Label>VGV</Label>
                <MoneyInput value={vgv} onCommit={setVgv} variant="field" />
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Corretor</span><span className="font-medium">{row.corretor}</span></div>
              {row.equipe !== "—" && <div className="flex justify-between"><span className="text-muted-foreground">Equipe</span><span className="font-medium">Equipe {row.equipe}</span></div>}
              {row.data && <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span className="font-medium">{formatBRT(row.data, "dd/MM/yy")}</span></div>}
              <p className="text-[11px] text-muted-foreground">Empreendimento e VGV ajustados aqui valem só para o PDN do gestor — não alteram o pipeline do corretor.</p>
            </div>
          )}

          {/* Campos manuais editáveis */}
          {row.isManual && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Empreendimento</Label>
                <Input value={empreend} onChange={(e) => setEmpreend(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>VGV</Label>
                <MoneyInput value={vgv} onCommit={setVgv} variant="field" />
              </div>
              <div className="space-y-1">
                <Label>Corretor</Label>
                <Input value={corretor} onChange={(e) => setCorretor(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status || "__none"} onValueChange={(v) => setStatus(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Sem status</SelectItem>
                {STATUS_PRESETS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Prioridade (foco do gestor)</Label>
              <Select value={prioridade || "__none"} onValueChange={(v) => setPrioridade(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem prioridade</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Próxima ação (data)</Label>
              <Input type="date" value={proxData} onChange={(e) => setProxData(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label>Próxima ação</Label>
              <PublishButton field="proxima_acao" texto={proxAcao} />
            </div>
            <Input value={proxAcao} onChange={(e) => setProxAcao(e.target.value)} placeholder="O que precisa ser feito…" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label>Observação interna</Label>
              <PublishButton field="observacao" texto={obs} />
            </div>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} className="min-h-[90px]" placeholder="Anotações do gestor (uso interno)…" />
            <p className="text-[11px] text-muted-foreground">
              "Publicar no lead" grava uma nota no histórico do lead marcada como <span className="font-medium">[Gestor · PDN]</span>. Republicar com o mesmo texto não duplica.
            </p>
          </div>

          {/* Risco manual */}
          <div className="rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={riscoManual} onChange={(e) => setRiscoManual(e.target.checked)} className="h-4 w-4" />
              Marcar em risco (gestor)
            </label>
            {riscoManual && (
              <Textarea value={riscoMotivo} onChange={(e) => setRiscoMotivo(e.target.value)} className="mt-2 min-h-[60px]" placeholder="Motivo do risco…" />
            )}
          </div>

          {/* Queda */}
          {row.caiu ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm">
              <div className="mb-2"><span className="font-medium text-red-600 dark:text-red-400">Caiu:</span> {row.motivoQueda || "sem motivo"}</div>
              <Button variant="outline" size="sm" onClick={() => { onReativar(row); onClose(); }}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reativar negócio
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => { onQueda(row); onClose(); }}>
              <TrendingDown className="mr-1.5 h-3.5 w-3.5" /> Marcar como caiu
            </Button>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { onRemove(row); onClose(); }}>
            <Trash2 className="mr-1.5 h-4 w-4" /> {row.isManual ? "Excluir" : "Remover da planilha"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
