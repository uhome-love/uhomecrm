import { Users, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiPicker } from "@/components/leads-base/campanha/MultiPicker";

export type OrdemBase = "recentes" | "antigos" | "aleatorio";

/** Contrato único do filtro da Base Única (front → edge → RPC). */
export interface BaseUnicaFiltro {
  empreendimento_ids: string[];
  formularios: string[];
  ano_min: number | null;
  ano_max: number | null;
  ordem_selecao: OrdemBase;
  excluir_pipeline_ativo: boolean;
  excluir_ganho: boolean;
  excluir_descartados: boolean;
  excluir_oa: boolean;
  excluir_ja_disparado: boolean;
}

export const BASE_UNICA_FILTRO_PADRAO: BaseUnicaFiltro = {
  empreendimento_ids: [],
  formularios: [],
  ano_min: null,
  ano_max: null,
  ordem_selecao: "recentes",
  excluir_pipeline_ativo: true,
  excluir_ganho: true,
  excluir_descartados: false,
  excluir_oa: true,
  excluir_ja_disparado: true,
};

interface Props {
  filtro: BaseUnicaFiltro;
  onChange: (patch: Partial<BaseUnicaFiltro>) => void;
  empreendimentos: Array<{ id: string; nome: string }>;
  formularios: Array<{ formulario: string; total_leads: number }>;
  contagens?: {
    removidos_pipeline_ativo?: number;
    removidos_ganho?: number;
    removidos_descartados?: number;
    removidos_oferta_ativa?: number;
    duplicados_removidos?: number;
    mantidos_pipeline_ativo?: number;
    mantidos_ganho?: number;
    mantidos_descartados?: number;
  } | null;
}

function n(v?: number) {
  return typeof v === "number" && v > 0 ? v.toLocaleString("pt-BR") : null;
}

function Switchable({
  checked, onCheckedChange, label, removidos, mantidos,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  removidos?: number;
  mantidos?: number;
}) {
  const rem = n(removidos);
  const man = n(mantidos);
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} />
      <span>{label}</span>
      {checked && rem && (
        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 tabular-nums">−{rem}</Badge>
      )}
      {!checked && man && (
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 tabular-nums">{man} mantidos</Badge>
      )}
    </label>
  );
}

export default function BaseUnicaFiltros({ filtro, onChange, empreendimentos, formularios, contagens }: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 p-3">
      <Label className="text-xs flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5" /> Base única de leads
      </Label>
      <p className="text-[10px] text-muted-foreground">
        Público-mãe: todo mundo que já entrou algum dia. Opt-out e sem telefone sempre saem; o resto você decide abaixo.
      </p>

      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Empreendimento</Label>
          <MultiPicker
            items={empreendimentos.map((e) => ({ id: e.id, nome: e.nome }))}
            value={filtro.empreendimento_ids}
            onChange={(v) => onChange({ empreendimento_ids: v })}
            placeholder="Todos os empreendimentos"
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Formulário de origem</Label>
          <MultiPicker
            items={formularios.map((f) => ({ id: f.formulario, nome: f.formulario, hint: String(f.total_leads) }))}
            value={filtro.formularios}
            onChange={(v) => onChange({ formularios: v })}
            placeholder="Todos os formulários"
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Safra (ano)</Label>
          <div className="flex items-center gap-1.5">
            <Input
              type="number" placeholder="de" className="h-9"
              value={filtro.ano_min ?? ""}
              onChange={(e) => onChange({ ano_min: e.target.value ? Number(e.target.value) : null })}
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="number" placeholder="até" className="h-9"
              value={filtro.ano_max ?? ""}
              onChange={(e) => onChange({ ano_max: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Ordem de seleção</Label>
          <Select value={filtro.ordem_selecao} onValueChange={(v) => onChange({ ordem_selecao: v as OrdemBase })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recentes">Mais recentes primeiro</SelectItem>
              <SelectItem value="antigos">Mais antigos primeiro</SelectItem>
              <SelectItem value="aleatorio">Aleatório</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border bg-background/70 p-2.5 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Higiene / exclusões</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Switchable
            checked={filtro.excluir_pipeline_ativo}
            onCheckedChange={(v) => onChange({ excluir_pipeline_ativo: v })}
            label="Excluir quem está no pipeline ativo"
            removidos={contagens?.removidos_pipeline_ativo}
            mantidos={contagens?.mantidos_pipeline_ativo}
          />
          <Switchable
            checked={filtro.excluir_ganho}
            onCheckedChange={(v) => onChange({ excluir_ganho: v })}
            label="Excluir quem já é cliente (Ganho)"
            removidos={contagens?.removidos_ganho}
            mantidos={contagens?.mantidos_ganho}
          />
          <Switchable
            checked={filtro.excluir_descartados}
            onCheckedChange={(v) => onChange({ excluir_descartados: v })}
            label="Excluir descartados / Caiu"
            removidos={contagens?.removidos_descartados}
            mantidos={contagens?.mantidos_descartados}
          />
          <Switchable
            checked={filtro.excluir_oa}
            onCheckedChange={(v) => onChange({ excluir_oa: v })}
            label="Excluir quem está em campanha de Oferta Ativa"
            removidos={contagens?.removidos_oferta_ativa}
          />
          <Switchable
            checked={filtro.excluir_ja_disparado}
            onCheckedChange={(v) => onChange({ excluir_ja_disparado: v })}
            label="Excluir quem já recebeu disparo"
            removidos={contagens?.duplicados_removidos}
          />
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked disabled />
            Opt-out e sem telefone (sempre)
          </span>
        </div>

        {!filtro.excluir_pipeline_ativo && (
          <div className="flex gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[10px] text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Você vai falar com leads que estão em atendimento no pipeline. Isso pode atropelar o corretor
              responsável e duplicar contato — use só se for intencional.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
