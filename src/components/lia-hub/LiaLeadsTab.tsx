import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRT } from "@/lib/brtTime";
import { useDebounce } from "@/hooks/useDebounce";
import LiaConversaDrawer from "./LiaConversaDrawer";
import {
  NIVEL_META,
  STATUS_META,
  origemDoReferral,
  useLiaEstados,
  useLiaUltimasMensagens,
  type LiaEstado,
} from "./useLiaHub";

const PILULAS: { valor: string; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "novo", rotulo: "Novos" },
  { valor: "em_conversa", rotulo: "Em conversa" },
  { valor: "qualificado", rotulo: "Qualificados" },
  { valor: "descartado", rotulo: "Descartados" },
  { valor: "opt_out", rotulo: "Opt-out" },
];

export default function LiaLeadsTab() {
  const { data: estados, isLoading } = useLiaEstados();
  const { data: ultimas } = useLiaUltimasMensagens();

  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("todos");
  const [origem, setOrigem] = useState("todas");
  const [nivel, setNivel] = useState("todos");
  const [selecionado, setSelecionado] = useState<LiaEstado | null>(null);
  const buscaDeb = useDebounce(busca, 250);

  const origens = useMemo(() => {
    const set = new Set((estados ?? []).map((e) => origemDoReferral(e.referral)));
    return Array.from(set).sort();
  }, [estados]);

  const linhas = useMemo(() => {
    const q = buscaDeb.trim().toLowerCase();
    return (estados ?? []).filter((e) => {
      if (status !== "todos" && e.status !== status) return false;
      if (nivel !== "todos" && String(e.nivel ?? "").toLowerCase() !== nivel) return false;
      if (origem !== "todas" && origemDoReferral(e.referral) !== origem) return false;
      if (!q) return true;
      return (
        (e.nome ?? "").toLowerCase().includes(q) || (e.telefone ?? "").toLowerCase().includes(q)
      );
    });
  }, [estados, buscaDeb, status, origem, nivel]);

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone…"
            className="pl-9 text-base lg:text-sm"
          />
        </div>
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PILULAS.map((p) => (
            <Button
              key={p.valor}
              size="sm"
              className="shrink-0"
              variant={status === p.valor ? "default" : "outline"}
              onClick={() => setStatus(p.valor)}
            >
              {p.rotulo}
            </Button>
          ))}
        </div>
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Button
            size="sm"
            className="shrink-0"
            variant={nivel === "todos" ? "default" : "outline"}
            onClick={() => setNivel("todos")}
          >
            Todas temperaturas
          </Button>
          {(["quente", "morno", "frio"] as const).map((n) => (
            <Button
              key={n}
              size="sm"
              className={cn("shrink-0", nivel === n && NIVEL_META[n].cls)}
              variant={nivel === n ? "secondary" : "outline"}
              onClick={() => setNivel(n)}
            >
              {NIVEL_META[n].emoji} {NIVEL_META[n].label}
            </Button>
          ))}
        </div>
        <Select value={origem} onValueChange={setOrigem}>
          <SelectTrigger className="w-full lg:w-56">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
            {origens.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : linhas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhum contato com esses filtros.
          </p>
        ) : (
          <>
          <div className="divide-y divide-border lg:hidden">
            {linhas.map((e) => {
              const meta = STATUS_META[e.status ?? ""] ?? {
                label: e.status ?? "—",
                cls: "bg-muted text-muted-foreground border-border",
              };
              const ultima = ultimas?.get(e.telefone);
              return (
                <button
                  key={e.telefone}
                  type="button"
                  onClick={() => setSelecionado(e)}
                  className="w-full px-3 py-3 text-left transition-colors active:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">
                        {e.nome || "Sem nome"}
                      </div>
                      <div className="text-xs text-muted-foreground">{e.telefone}</div>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatBRT(ultima?.created_at ?? e.last_msg_em, "dd/MM HH:mm")}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                    {ultima?.conteudo ?? "—"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={cn("text-[10px]", meta.cls)}>
                      {meta.label}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {origemDoReferral(e.referral)}
                    </Badge>
                    {e.status === "qualificado" && NIVEL_META[String(e.nivel ?? "").toLowerCase()] ? (
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", NIVEL_META[String(e.nivel).toLowerCase()].cls)}
                      >
                        {NIVEL_META[String(e.nivel).toLowerCase()].emoji}{" "}
                        {NIVEL_META[String(e.nivel).toLowerCase()].label}
                      </Badge>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left font-semibold">Contato</th>
                  <th className="px-4 py-2 text-left font-semibold">Origem</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                  <th className="px-4 py-2 text-left font-semibold">Última mensagem</th>
                  <th className="px-4 py-2 text-right font-semibold">Quando</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((e) => {
                  const meta = STATUS_META[e.status ?? ""] ?? {
                    label: e.status ?? "—",
                    cls: "bg-muted text-muted-foreground border-border",
                  };
                  const ultima = ultimas?.get(e.telefone);
                  return (
                    <tr
                      key={e.telefone}
                      onClick={() => setSelecionado(e)}
                      className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground">{e.nome || "Sem nome"}</div>
                        <div className="text-xs text-muted-foreground">{e.telefone}</div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {origemDoReferral(e.referral)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={cn(meta.cls)}>
                            {meta.label}
                          </Badge>
                          {e.status === "qualificado" && NIVEL_META[String(e.nivel ?? "").toLowerCase()] ? (
                            <Badge
                              variant="outline"
                              className={cn("text-[10px]", NIVEL_META[String(e.nivel).toLowerCase()].cls)}
                            >
                              {NIVEL_META[String(e.nivel).toLowerCase()].emoji}{" "}
                              {NIVEL_META[String(e.nivel).toLowerCase()].label}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="max-w-[320px] truncate px-4 py-2.5 text-muted-foreground">
                        {ultima?.conteudo ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-muted-foreground">
                        <div className="flex items-center justify-end gap-1">
                          {formatBRT(ultima?.created_at ?? e.last_msg_em, "dd/MM HH:mm")}
                          <LiaLeadAcoesMenu estado={e} />
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>

      <LiaConversaDrawer
        estado={selecionado}
        open={!!selecionado}
        onOpenChange={(v) => !v && setSelecionado(null)}
      />
    </div>
  );
}
