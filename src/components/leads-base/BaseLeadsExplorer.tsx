import { useState } from "react";
import { Search, ChevronLeft, ChevronRight, Rocket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useBaseLeads,
  useEmpreendimentosCanonicos,
  usePreviewCampanhaV2,
  type BaseLeadsFiltro,
} from "@/hooks/useBaseLeads";
import { CriarCampanhaDialog } from "./CriarCampanhaDialog";
import { formatBRT } from "@/lib/brtTime";

const SITUACOES = [
  { value: "todas", label: "Todas as situações" },
  { value: "inedito", label: "Inédito (nunca trabalhado)" },
  { value: "na_oferta_ativa", label: "Já esteve na Oferta Ativa" },
  { value: "no_pipeline", label: "Já esteve no Pipeline" },
  { value: "ambos", label: "Pipeline + Oferta Ativa" },
];

const SITUACAO_LABEL: Record<string, string> = {
  inedito: "Inédito",
  na_oferta_ativa: "Oferta Ativa",
  no_pipeline: "Pipeline",
  ambos: "Pipeline + OA",
};

const JANELAS_DESCARTE = [30, 60, 90, 180, 365];

export function BaseLeadsExplorer() {
  const [filtro, setFiltro] = useState<BaseLeadsFiltro>({
    nunca_trabalhado: false,
    com_telefone: true,
    incluir_descartados: true,
    descarte_min_dias: 90,
  });
  const [page, setPage] = useState(0);
  const [busca, setBusca] = useState("");
  const [criarAberto, setCriarAberto] = useState(false);

  const { data, isLoading } = useBaseLeads(filtro, page);
  const { data: emps } = useEmpreendimentosCanonicos();
  const { data: elegiveis, isLoading: loadingElegiveis } = usePreviewCampanhaV2(
    {
      empreendimento_ids: filtro.empreendimento_canonico_id ? [filtro.empreendimento_canonico_id] : [],
      formularios: [],
      ano_min: filtro.ano_min ?? null,
      ano_max: filtro.ano_max ?? null,
      situacao: null,
      nunca_trabalhado: !!filtro.nunca_trabalhado,
      com_telefone: !!filtro.com_telefone,
      com_email: false,
      ordem_selecao: "recentes",
      incluir_descartados: filtro.incluir_descartados ?? true,
      descarte_min_dias: filtro.descarte_min_dias ?? 90,
    },
    true,
  );

  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 50;
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  const set = (patch: Partial<BaseLeadsFiltro>) => {
    setPage(0);
    setFiltro((f) => ({ ...f, ...patch }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && set({ busca })}
              onBlur={() => set({ busca })}
              placeholder="Buscar por nome, e-mail ou telefone"
              className="pl-8 h-9"
              maxLength={80}
            />
          </div>

          <Select
            value={filtro.empreendimento_canonico_id ?? "todos"}
            onValueChange={(v) => set({ empreendimento_canonico_id: v === "todos" ? null : v })}
          >
            <SelectTrigger className="h-9 w-full lg:w-[230px]">
              <SelectValue placeholder="Empreendimento" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="todos">Todos os empreendimentos</SelectItem>
              {(emps ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtro.situacao ?? "todas"}
            onValueChange={(v) => set({ situacao: v === "todas" ? null : v })}
          >
            <SelectTrigger className="h-9 w-full lg:w-[220px]">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              {SITUACOES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => setCriarAberto(true)} className="h-9 gap-1.5">
            <Rocket size={15} /> Criar campanha
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              checked={!!filtro.nunca_trabalhado}
              onCheckedChange={(c) => set({ nunca_trabalhado: !!c })}
            />
            Nunca liberado em campanha
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox checked={!!filtro.com_telefone} onCheckedChange={(c) => set({ com_telefone: !!c })} />
            Só com telefone
          </label>
          <div className="flex items-center gap-1.5">
            Período de conversão:
            <Input
              type="number"
              value={filtro.ano_min ?? ""}
              onChange={(e) => set({ ano_min: e.target.value ? Number(e.target.value) : null })}
              placeholder="2019"
              className="h-7 w-[80px]"
            />
            <span>até</span>
            <Input
              type="number"
              value={filtro.ano_max ?? ""}
              onChange={(e) => set({ ano_max: e.target.value ? Number(e.target.value) : null })}
              placeholder="2026"
              className="h-7 w-[80px]"
            />
          </div>
          <span className="ml-auto font-medium text-foreground">
            {isLoading ? "Carregando…" : `${total.toLocaleString("pt-BR")} leads`}
          </span>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-3 py-2">Lead</th>
                <th className="text-left font-semibold px-3 py-2">Contato</th>
                <th className="text-left font-semibold px-3 py-2">Empreendimento</th>
                <th className="text-left font-semibold px-3 py-2">Última conversão</th>
                <th className="text-left font-semibold px-3 py-2">Situação</th>
                <th className="text-right font-semibold px-3 py-2">Trabalhado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-t">
                    <td colSpan={6} className="px-3 py-3">
                      <div className="h-4 bg-muted animate-pulse rounded" />
                    </td>
                  </tr>
                ))}
              {!isLoading && (data?.rows.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhum lead com esses filtros.
                  </td>
                </tr>
              )}
              {(data?.rows ?? []).map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">
                    {[r.nome, r.sobrenome].filter(Boolean).join(" ") || "Sem nome"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    <div>{r.telefone || "—"}</div>
                    <div className="truncate max-w-[220px]">{r.email || ""}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.empreendimento_texto || <span className="text-muted-foreground">Sem produto</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.ultima_conversao_em ? formatBRT(r.ultima_conversao_em, "dd/MM/yyyy") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={r.situacao_crm === "inedito" ? "default" : "secondary"} className="text-[10px]">
                      {SITUACAO_LABEL[r.situacao_crm] ?? r.situacao_crm}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{r.vezes_trabalhado}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
          <span>
            Página {page + 1} de {maxPage + 1}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={14} />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= maxPage} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>

      <CriarCampanhaDialog open={criarAberto} onOpenChange={setCriarAberto} filtroInicial={filtro} />
    </div>
  );
}

export default BaseLeadsExplorer;
