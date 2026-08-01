import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface IdentidadeState {
  nome: string;
  observacao: string;
  template_id: string | null;
  limite: number;
  expira: string;
  max_tentativas: number;
  cooldown_dias: number;
}

function expiracaoEm(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(23, 59, 0, 0);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function PassoIdentidade({
  state,
  set,
  templates,
}: {
  state: IdentidadeState;
  set: (p: Partial<IdentidadeState>) => void;
  templates: { id: string; nome: string; empreendimento: string | null }[];
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="camp-nome">Nome da campanha</Label>
        <Input id="camp-nome" value={state.nome} onChange={(e) => set({ nome: e.target.value })} maxLength={120} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="camp-obs">Objetivo / orientação para o time</Label>
        <Textarea
          id="camp-obs"
          rows={2}
          placeholder="Ex.: base fria de 2024 — foco em remarcar visita, oferecer condição de lançamento."
          value={state.observacao}
          onChange={(e) => set({ observacao: e.target.value })}
          maxLength={500}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Roteiro / script</Label>
        <Select
          value={state.template_id ?? "nenhum"}
          onValueChange={(v) => set({ template_id: v === "nenhum" ? null : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sem roteiro específico" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="nenhum">Sem roteiro específico</SelectItem>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nome}
                {t.empreendimento ? ` · ${t.empreendimento}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="camp-limite">Limite de leads</Label>
          <Input
            id="camp-limite"
            type="number"
            min={1}
            max={5000}
            value={state.limite}
            onChange={(e) => set({ limite: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="camp-expira">Expira em</Label>
          <Input
            id="camp-expira"
            type="datetime-local"
            value={state.expira}
            onChange={(e) => set({ expira: e.target.value })}
          />
          <div className="flex gap-1.5 pt-0.5">
            {[1, 3, 7].map((d) => (
              <Button
                key={d}
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => set({ expira: expiracaoEm(d) })}
              >
                {d === 1 ? "24h" : `${d} dias`}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="camp-tent">Máx. tentativas por lead</Label>
          <Input
            id="camp-tent"
            type="number"
            min={1}
            max={10}
            value={state.max_tentativas}
            onChange={(e) => set({ max_tentativas: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="camp-cool">Cooldown (dias)</Label>
          <Input
            id="camp-cool"
            type="number"
            min={0}
            max={365}
            value={state.cooldown_dias}
            onChange={(e) => set({ cooldown_dias: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
      </div>
    </div>
  );
}

export { expiracaoEm };
export default PassoIdentidade;
