import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MultiPicker } from "./MultiPicker";
import type { CampanhaFiltroV2, PreviewV2 } from "@/hooks/useBaseLeads";
import { formatBRT } from "@/lib/brtTime";

const ORDENS = [
  { v: "recentes", label: "Mais recentes" },
  { v: "antigos", label: "Mais antigos" },
  { v: "aleatorio", label: "Aleatório" },
] as const;

export function PassoPublico({
  filtro,
  set,
  emps,
  forms,
  preview,
  loading,
  limite,
}: {
  filtro: CampanhaFiltroV2;
  set: (p: Partial<CampanhaFiltroV2>) => void;
  emps: { id: string; nome: string }[];
  forms: { formulario: string; total_leads: number }[];
  preview?: PreviewV2;
  loading: boolean;
  limite: number;
}) {
  const total = preview?.total ?? 0;
  const removidosAtivos = preview?.removidos_ativos ?? 0;
  const removidosInativados = preview?.removidos_inativados ?? 0;
  const removidosDescarte = preview?.removidos_descarte_recente ?? 0;
  const removidosOa = preview?.removidos_oa ?? 0;
  const liberados = Math.min(total, limite);
  const anoAtual = new Date().getFullYear();
  const JANELAS = [30, 60, 90, 180, 365];
  const janelaPersonalizada = !JANELAS.includes(filtro.descarte_min_dias);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Empreendimentos</Label>
          <MultiPicker
            items={emps.map((e) => ({ id: e.id, nome: e.nome }))}
            value={filtro.empreendimento_ids}
            onChange={(v) => set({ empreendimento_ids: v })}
            placeholder="Buscar empreendimento…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Formulários de origem</Label>
          <MultiPicker
            items={forms.map((f) => ({ id: f.formulario, nome: f.formulario, hint: String(f.total_leads) }))}
            value={filtro.formularios}
            onChange={(v) => set({ formularios: v })}
            placeholder="Buscar formulário…"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Safra (ano da última conversão)</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            className="w-24"
            placeholder="de"
            value={filtro.ano_min ?? ""}
            onChange={(e) => set({ ano_min: e.target.value ? Number(e.target.value) : null })}
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="number"
            className="w-24"
            placeholder="até"
            value={filtro.ano_max ?? ""}
            onChange={(e) => set({ ano_max: e.target.value ? Number(e.target.value) : null })}
          />
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => set({ ano_min: anoAtual - 1, ano_max: null })}>
              {anoAtual - 1}+
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => set({ ano_min: anoAtual - 3, ano_max: anoAtual - 2 })}>
              {anoAtual - 3}–{anoAtual - 2}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => set({ ano_min: null, ano_max: anoAtual - 4 })}>
              Mais antigos
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
              onClick={() => set({ ano_min: null, ano_max: null })}>
              Limpar
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Ordem de seleção</Label>
        <div className="flex flex-wrap gap-1.5">
          {ORDENS.map((o) => (
            <Button
              key={o.v}
              type="button"
              size="sm"
              variant={filtro.ordem_selecao === o.v ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => set({ ordem_selecao: o.v })}
            >
              {o.label}
            </Button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          A Oferta Ativa é reengajamento de base fria: quem já existe no CRM (ativo, descartado ou arquivado) e quem
          já está numa fila de Oferta Ativa é removido automaticamente.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={filtro.com_telefone} onCheckedChange={(c) => set({ com_telefone: !!c })} />
          Somente com telefone
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={filtro.com_email} onCheckedChange={(c) => set({ com_email: !!c })} />
          Somente com e-mail
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={filtro.nunca_trabalhado} onCheckedChange={(c) => set({ nunca_trabalhado: !!c })} />
          Apenas nunca liberados em campanha
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={filtro.incluir_descartados}
            onCheckedChange={(c) => set({ incluir_descartados: !!c })}
          />
          Incluir leads descartados
        </label>
      </div>

      {filtro.incluir_descartados && (
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs font-normal text-muted-foreground">
            Só descartados há mais de
          </Label>
          {JANELAS.map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={filtro.descarte_min_dias === d ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => set({ descarte_min_dias: d })}
            >
              {d} dias
            </Button>
          ))}
          <Input
            type="number"
            min={0}
            className="h-7 w-24"
            placeholder="personalizado"
            value={janelaPersonalizada ? filtro.descarte_min_dias : ""}
            onChange={(e) => set({ descarte_min_dias: Number(e.target.value || 0) })}
          />
        </div>
      )}

      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Elegíveis para a campanha</span>
          <span className="font-medium">{loading ? "…" : total.toLocaleString("pt-BR")}</span>
        </div>
        {(removidosAtivos > 0 || removidosInativados > 0 || removidosDescarte > 0 || removidosOa > 0) && (
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <div className="font-medium uppercase tracking-wide text-[10px]">Removidos pela higiene</div>
            <div className="flex items-center justify-between">
              <span>Com lead ativo no pipeline</span>
              <span className="font-mono">{removidosAtivos.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Inativados (definitivo/arquivado)</span>
              <span className="font-mono">{removidosInativados.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>
                {filtro.incluir_descartados
                  ? `Descartados há menos de ${filtro.descarte_min_dias} dias`
                  : "Descartados (todos)"}
              </span>
              <span className="font-mono">{removidosDescarte.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Já em fila de Oferta Ativa</span>
              <span className="font-mono">{removidosOa.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Serão liberados</span>
          <span className="font-semibold text-primary">{liberados.toLocaleString("pt-BR")}</span>
        </div>

        {(preview?.amostra?.length ?? 0) > 0 && (
          <div className="mt-2 border-t pt-2">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Amostra dos primeiros
            </p>
            <div className="max-h-36 overflow-y-auto space-y-1">
              {preview!.amostra.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">
                    {[a.nome, a.sobrenome].filter(Boolean).join(" ") || "Sem nome"}
                    <span className="text-muted-foreground"> · {a.empreendimento_texto ?? "—"}</span>
                  </span>
                  <Badge variant="outline" className="shrink-0 text-[10px] font-mono">
                    {a.ultima_conversao_em ? formatBRT(a.ultima_conversao_em, "dd/MM/yy") : "—"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PassoPublico;
