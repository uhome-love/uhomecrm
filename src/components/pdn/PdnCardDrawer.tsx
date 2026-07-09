import { useEffect, useState } from "react";
import { type PdnRow } from "@/hooks/usePdn";
import { fmtMoney } from "@/lib/fmtMoney";
import { formatBRT } from "@/lib/brtTime";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, TrendingDown, RotateCcw, AlertTriangle } from "lucide-react";
import type { PdnSavePatch } from "./PdnKanban";
import { MoneyInput } from "./MoneyInput";

const STATUS_PRESETS = [
  "Aguardando docs", "Em aprovação", "Negociando", "Proposta", "Follow up",
  "Em confecção", "Gerado", "Assinado",
];

export function PdnCardDrawer({
  row, onClose, onSave, onUpdateManual, onRemove, onQueda, onReativar,
}: {
  row: PdnRow | null;
  onClose: () => void;
  onSave: (row: PdnRow, patch: PdnSavePatch) => void;
  onUpdateManual: (overrideId: string, patch: Record<string, any>) => void;
  onRemove: (row: PdnRow) => void;
  onQueda: (row: PdnRow) => void;
  onReativar: (row: PdnRow) => void;
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
    setVgv(row.vgv ? String(row.vgv) : "");
    setCorretor(row.corretor === "—" ? "" : row.corretor);
  }, [row]);

  if (!row) return null;

  const save = () => {
    onSave(row, {
      status, observacoes: obs, proximaAcao: proxAcao, proximaAcaoData: proxData,
      prioridade: (prioridade as PdnRow["prioridade"]) || "",
      riscoManual, riscoMotivo,
      // Empreendimento/VGV também são editáveis para negócios do pipeline (overlay do gestor)
      ...(row.isManual ? {} : { empreendimento: empreend, vgv: Number(vgv) || 0 }),
    });
    if (row.isManual && row.overrideId) {
      onUpdateManual(row.overrideId, {
        nome, empreendimento: empreend || null, vgv: Number(vgv) || 0, corretor: corretor || null,
      });
    }
    onClose();
  };

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
          {/* Empreendimento/VGV editáveis pelo gestor (overlay) + contexto do corretor (leitura) */}
          {!row.isManual && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="space-y-1">
                <Label>Empreendimento</Label>
                <Input value={empreend} onChange={(e) => setEmpreend(e.target.value)} placeholder="Nome do empreendimento" />
              </div>
              <div className="space-y-1">
                <Label>VGV</Label>
                <Input type="number" value={vgv} onChange={(e) => setVgv(e.target.value)} placeholder="0" />
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
                <Input type="number" value={vgv} onChange={(e) => setVgv(e.target.value)} />
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
            <Label>Próxima ação</Label>
            <Input value={proxAcao} onChange={(e) => setProxAcao(e.target.value)} placeholder="O que precisa ser feito…" />
          </div>

          <div className="space-y-1">
            <Label>Observação interna</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} className="min-h-[90px]" placeholder="Anotações do gestor (uso interno)…" />
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
