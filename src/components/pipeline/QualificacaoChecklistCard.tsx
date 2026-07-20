import { useMemo, useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Pencil, ClipboardList, ListChecks, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { PipelineLead } from "@/hooks/usePipeline";
import {
  QUALIFICACAO_STATUS_ATEND,
  QUALIFICACAO_TIPOLOGIAS,
  QUALIFICACAO_FAIXAS,
  QUALIFICACAO_FORMAS_PAGAMENTO,
  QUALIFICACAO_PRAZOS,
  QUALIFICACAO_BAIRROS_UHOME,
} from "./PipelineStageTransitionPopup";
import {
  willClampVisitaDate,
  type DataOverride,
} from "@/lib/qualificacaoTaskEngine";

interface Props {
  lead: PipelineLead;
  onSaved?: () => void;
}

function labelOf(options: { value: string; label: string }[], v?: string | null): string | null {
  if (!v) return null;
  return options.find(o => o.value === v)?.label || v;
}

function ChipDisplay({ label, value, empty }: { label: string; value: string | null; empty: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {value ? (
        <span className="inline-block self-start text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
          {value}
        </span>
      ) : (
        <span className="text-[11px] text-muted-foreground italic">{empty}</span>
      )}
    </div>
  );
}

/**
 * Card "Etapa da qualificação" — pills clicáveis (2026-07-20 simplificado).
 * Clicar numa pill agora faz APENAS: gravar flag_status.status_atendimento no lead,
 * chamar onSaved() e disparar `pipeline-reload`. Sem cancelar tarefas, sem criar
 * tarefa, sem popover, sem date picker. A criação da próxima tarefa passou a ser
 * 100% manual (via popup de conclusão de tarefa ou botão "Nova tarefa").
 */
export function QualificacaoEtapaCard({ lead, onSaved }: Props) {
  const flag = (lead.flag_status || {}) as Record<string, any>;
  const currentStatus = (flag.status_atendimento as string) || "";
  const [saving, setSaving] = useState<string | null>(null);

  const steps = Object.entries(QUALIFICACAO_STATUS_ATEND) as [string, string][];
  const currentIdx = steps.findIndex(([k]) => k === currentStatus);

  const handleClick = async (statusKey: string) => {
    if (saving || statusKey === currentStatus) return;
    setSaving(statusKey);
    try {
      const nextFlag = { ...(lead.flag_status || {}), status_atendimento: statusKey };
      const { error } = await supabase
        .from("pipeline_leads")
        .update({ flag_status: nextFlag } as any)
        .eq("id", lead.id);
      if (error) throw error;
      toast.success("Status atualizado");
      onSaved?.();
      window.dispatchEvent(new CustomEvent("pipeline-reload"));
    } catch (err) {
      console.error("[QualificacaoEtapaCard] save error:", err);
      toast.error("Erro ao atualizar status");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <ListChecks className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold">Etapa da qualificação</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {steps.map(([key, label], idx) => {
          const isCurrent = key === currentStatus;
          const isDone = currentIdx >= 0 && idx < currentIdx;
          const isSaving = saving === key;
          let cls = "bg-background hover:bg-muted border-border text-foreground";
          if (isCurrent) cls = "bg-primary text-primary-foreground border-primary shadow-sm";
          else if (isDone) cls = "bg-muted/50 border-border text-muted-foreground line-through opacity-70 hover:opacity-100";
          return (
            <button
              key={key}
              type="button"
              disabled={!!saving}
              onClick={() => handleClick(key)}
              className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-all ${cls} ${saving && !isSaving ? "opacity-50" : ""}`}
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isDone ? (
                <Check className="h-3 w-3" />
              ) : null}
              {label}
            </button>
          );
        })}
      </div>
      {!currentStatus && (
        <p className="text-[11px] text-muted-foreground italic">
          Clique em uma etapa para registrar o status do atendimento.
        </p>
      )}
    </div>
  );
}


/**
 * Mini seletor "Hoje / Amanhã / Escolher data" + horário para a pill
 * "Alinhando visita". Reusado no card e no popup de conclusão de tarefa.
 *
 * Emite `onPick(dt, hora)` — hora sempre presente (default "10:00").
 * Se a data custom passar do teto de 7 dias, mostra aviso ("ajustado para dd/mm")
 * mas ainda envia o valor original — o clamp real acontece no motor.
 */
export function VisitaDatePicker({
  onPick,
  disabled,
  variant = "default",
}: {
  onPick: (dt: DataOverride, hora: string) => void;
  disabled?: boolean;
  /** "confirmar-visita" = 3 botões em linha + horário abaixo, sem "Escolher data" separado. */
  variant?: "default" | "confirmar-visita";
}) {
  const [customDate, setCustomDate] = useState("");
  const [hora, setHora] = useState("10:00");
  const [showCustom, setShowCustom] = useState(false);

  const clampInfo = willClampVisitaDate(customDate);
  const adjustedShort = clampInfo.adjustedTo
    ? clampInfo.adjustedTo.split("-").slice(1).reverse().join("/")
    : null;

  if (variant === "confirmar-visita") {
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-foreground">A visita é pra quando?</div>
        <div className="grid grid-cols-3 gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={disabled}
            onClick={() => { setShowCustom(false); onPick("hoje", hora); }}>
            Hoje
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={disabled}
            onClick={() => { setShowCustom(false); onPick("amanha", hora); }}>
            Amanhã
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={disabled}
            onClick={() => setShowCustom((v) => !v)}>
            Escolher
          </Button>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Horário</Label>
          <Input type="time" value={hora} onChange={(e) => setHora(e.target.value || "10:00")}
            className="h-7 text-[11px]" disabled={disabled} />
        </div>
        {showCustom && (
          <div className="space-y-1">
            <div className="flex gap-1.5">
              <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)}
                className="h-7 text-[11px]" disabled={disabled} />
              <Button size="sm" className="h-7 text-[11px]"
                disabled={disabled || !/^\d{4}-\d{2}-\d{2}$/.test(customDate)}
                onClick={() => onPick(customDate, hora)}>
                OK
              </Button>
            </div>
            {clampInfo.clamped && adjustedShort && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                Máximo 7 dias — ajustado para {adjustedShort}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-foreground">Quando é a visita?</div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          disabled={disabled}
          onClick={() => onPick("hoje", hora)}
        >
          Hoje
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          disabled={disabled}
          onClick={() => onPick("amanha", hora)}
        >
          Amanhã
        </Button>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Horário</Label>
        <Input
          type="time"
          value={hora}
          onChange={(e) => setHora(e.target.value || "10:00")}
          className="h-7 text-[11px]"
          disabled={disabled}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Escolher data</Label>
        <div className="flex gap-1.5">
          <Input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="h-7 text-[11px]"
            disabled={disabled}
          />
          <Button
            size="sm"
            className="h-7 text-[11px]"
            disabled={disabled || !/^\d{4}-\d{2}-\d{2}$/.test(customDate)}
            onClick={() => onPick(customDate, hora)}
          >
            OK
          </Button>
        </div>
        {clampInfo.clamped && adjustedShort && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            Máximo 7 dias — ajustado para {adjustedShort}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Card "Perfil do lead" — mantém o popover com Editar. 5 campos:
 * tipologia, faixa de valor, forma de pagamento, prazo de decisão, bairros.
 */
export function PerfilLeadCard({ lead, onSaved }: Props) {
  const initialTipologia = ((lead.flag_status || {}) as any).tipologia as string || "";
  const initialFaixa = ((lead as any).faixa_valor as string) || "";
  const initialForma = ((lead as any).forma_pagamento as string) || "";
  const initialPrazo = ((lead as any).prazo_decisao as string) || "";
  const initialBairroRaw = ((lead as any).bairro_regiao as string) || "";

  const initialBairros = useMemo(
    () => initialBairroRaw.split(",").map(s => s.trim()).filter(Boolean).filter(b => QUALIFICACAO_BAIRROS_UHOME.includes(b)),
    [initialBairroRaw],
  );
  const initialOutro = useMemo(
    () => initialBairroRaw.split(",").map(s => s.trim()).filter(Boolean).filter(b => !QUALIFICACAO_BAIRROS_UHOME.includes(b)).join(", "),
    [initialBairroRaw],
  );

  const [editing, setEditing] = useState(false);
  const [tipologia, setTipologia] = useState(initialTipologia);
  const [faixa, setFaixa] = useState(initialFaixa);
  const [forma, setForma] = useState(initialForma);
  const [prazo, setPrazo] = useState(initialPrazo);
  const [bairros, setBairros] = useState<string[]>(initialBairros);
  const [outroOn, setOutroOn] = useState(!!initialOutro);
  const [outro, setOutro] = useState(initialOutro);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setTipologia(initialTipologia);
    setFaixa(initialFaixa);
    setForma(initialForma);
    setPrazo(initialPrazo);
    setBairros(initialBairros);
    setOutroOn(!!initialOutro);
    setOutro(initialOutro);
  }, [editing, initialTipologia, initialFaixa, initialForma, initialPrazo, initialBairros, initialOutro]);

  const filled = [
    tipologia,
    faixa,
    forma,
    prazo,
    (bairros.length > 0 || (outroOn && outro.trim())) ? "x" : "",
  ].filter(Boolean).length;
  const total = 5;

  const tipologiaLabel = labelOf(QUALIFICACAO_TIPOLOGIAS, tipologia);
  const faixaLabel = labelOf(QUALIFICACAO_FAIXAS, faixa);
  const formaLabel = labelOf(QUALIFICACAO_FORMAS_PAGAMENTO, forma);
  const prazoLabel = labelOf(QUALIFICACAO_PRAZOS, prazo);
  const bairroDisplay = [
    ...bairros,
    ...(outroOn && outro.trim() ? [outro.trim()] : []),
  ].join(", ") || null;

  const toggleBairro = (b: string) => setBairros(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const bairroFinal = [
        ...bairros,
        ...(outroOn && outro.trim() ? [outro.trim()] : []),
      ].join(", ");

      const nextFlag: Record<string, any> = { ...(lead.flag_status || {}) };
      if (tipologia) nextFlag.tipologia = tipologia; else delete nextFlag.tipologia;

      const updates: Record<string, any> = {
        flag_status: nextFlag,
        faixa_valor: faixa || null,
        forma_pagamento: forma || null,
        prazo_decisao: prazo || null,
        bairro_regiao: bairroFinal || null,
      };
      const { error } = await supabase.from("pipeline_leads").update(updates as any).eq("id", lead.id);
      if (error) throw error;

      toast.success("Perfil do lead atualizado");
      setEditing(false);
      onSaved?.();
      window.dispatchEvent(new CustomEvent("pipeline-reload"));
    } catch (err) {
      console.error("[PerfilLeadCard] save error:", err);
      toast.error("Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold">Perfil do lead</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filled === total ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : filled === 0 ? "bg-muted text-muted-foreground border border-border" : "bg-amber-500/10 text-amber-600 border border-amber-500/20"}`}>
            {filled}/{total} preenchido
          </span>
        </div>
        <Popover open={editing} onOpenChange={setEditing}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] gap-1">
              <Pencil className="h-3 w-3" />
              Editar
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            collisionPadding={16}
            className="w-[360px] p-0 flex flex-col max-h-[min(70vh,var(--radix-popover-content-available-height))]"
          >
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <ChipEditor label="Tipologia" value={tipologia} onChange={setTipologia} options={QUALIFICACAO_TIPOLOGIAS} />
              <ChipEditor label="Faixa de valor" value={faixa} onChange={setFaixa} options={QUALIFICACAO_FAIXAS} />
              <ChipEditor label="Forma de pagamento" value={forma} onChange={setForma} options={QUALIFICACAO_FORMAS_PAGAMENTO} />
              <ChipEditor label="Prazo de decisão" value={prazo} onChange={setPrazo} options={QUALIFICACAO_PRAZOS} />

              <div>
                <Label className="text-xs mb-1.5 block">Região / Bairros</Label>
                <div className="flex flex-wrap gap-1.5">
                  {QUALIFICACAO_BAIRROS_UHOME.map(b => {
                    const active = bairros.includes(b);
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => toggleBairro(b)}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"}`}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Checkbox id="pl-outro" checked={outroOn} onCheckedChange={(v) => setOutroOn(!!v)} />
                  <Label htmlFor="pl-outro" className="text-[11px] cursor-pointer">Outro bairro</Label>
                </div>
                {outroOn && (
                  <Input value={outro} onChange={e => setOutro(e.target.value)} className="h-8 text-xs mt-1.5" placeholder="Digite o(s) bairro(s), separados por vírgula" />
                )}
              </div>
            </div>

            <div className="shrink-0 flex justify-end gap-2 border-t bg-background px-3 py-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Salvar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {filled === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">
          Nenhum campo preenchido ainda. Clique em <span className="font-medium">Editar</span> para completar o perfil.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <ChipDisplay label="Tipologia" value={tipologiaLabel} empty="—" />
          <ChipDisplay label="Faixa de valor" value={faixaLabel} empty="—" />
          <ChipDisplay label="Pagamento" value={formaLabel} empty="—" />
          <ChipDisplay label="Prazo" value={prazoLabel} empty="—" />
          <div className="col-span-2">
            <ChipDisplay label="Bairros" value={bairroDisplay} empty="—" />
          </div>
        </div>
      )}
    </div>
  );
}

/** Compat: default export renders both cards empilhados. */
export default function QualificacaoChecklistCard({ lead, onSaved }: Props) {
  return (
    <div className="space-y-2">
      <QualificacaoEtapaCard lead={lead} onSaved={onSaved} />
      <PerfilLeadCard lead={lead} onSaved={onSaved} />
    </div>
  );
}

function ChipEditor({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <Label className="text-xs mb-1.5 block">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(active ? "" : o.value)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
