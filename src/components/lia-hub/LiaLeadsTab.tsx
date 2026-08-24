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
import LiaLeadAcoesMenu from "./LiaLeadAcoesMenu";
import FiltroImovel from "./FiltroImovel";
import {
  NIVEL_META,
  origemDoReferral,
  previewMensagem,
  produtoLabel,
  produtosDeEstados,
  statusMetaLead,
  useLiaEstados,
  useLiaUltimasMensagens,
  type LiaEstado,
} from "./useLiaHub";

const PILULAS: { valor: string; rotulo: string }[] = [
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "novo", rotulo: "Novos" },
  { valor: "em_conversa", rotulo: "Em conversa" },
  { valor: "qualificado", rotulo: "Qualificados" },
  { valor: "descartado", rotulo: "Descartados" },
  { valor: "opt_out", rotulo: "Opt-out" },
  { valor: "todos", rotulo: "Todos" },
];

// cor do avatar por imóvel (a inbox fica escaneável: dá pra "ler" o produto pela cor)
const COR_PRODUTO: Record<string, string> = {
  "awa-wellness": "#3E4C7A",
  "casa-tua-canoas": "#4969FF",
  "casa-tua-porto-alegre": "#2FB0A3",
  "connect-joao-wallig": "#7A5AF0",
};
const corAvatar = (slug?: string | null) => (slug && COR_PRODUTO[slug]) || "#7A8091";
const inicial = (nome?: string | null, tel?: string | null) => {
  const s = (nome || "").trim();
  const m = s.match(/\p{L}/u);
  return m ? m[0].toUpperCase() : (tel || "?").slice(-2, -1) || "?";
};

// prioridade da inbox: quem RESPONDEU e está esperando vem primeiro.
type Grupo = "aguardando" | "conversa" | "followup";
const grupoDe = (e: LiaEstado, ultimaRole?: string): Grupo => {
  if (ultimaRole === "user") return "aguardando"; // o lead falou por último = está te esperando
  if ((e.followup_count ?? 0) > 0) return "followup"; // esfriou, entrou na cadência
  return "conversa"; // a LIA falou por último, aguardando o lead
};
const GRUPOS: { key: Grupo; label: string; hot?: boolean }[] = [
  { key: "aguardando", label: "Respondeu, aguardando você", hot: true },
  { key: "conversa", label: "Em conversa · a LIA está atendendo" },
  { key: "followup", label: "Em follow-up · esfriaram, a LIA reativa" },
];

export default function LiaLeadsTab() {
  const { data: estados, isLoading } = useLiaEstados();
  const { data: ultimas } = useLiaUltimasMensagens();

  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("ativos");
  const [origem, setOrigem] = useState("todas");
  const [nivel, setNivel] = useState("todos");
  const [produto, setProduto] = useState("todos");
  const [selecionado, setSelecionado] = useState<LiaEstado | null>(null);
  const buscaDeb = useDebounce(busca, 250);

  const origens = useMemo(() => {
    const set = new Set((estados ?? []).map((e) => origemDoReferral(e.referral)));
    return Array.from(set).sort();
  }, [estados]);
  const produtos = useMemo(() => produtosDeEstados(estados), [estados]);

  const linhas = useMemo(() => {
    const q = buscaDeb.trim().toLowerCase();
    const filtrados = (estados ?? []).filter((e) => {
      if (produto !== "todos" && (e.produto_slug ?? "") !== produto) return false;
      // "ativos" = só o que a LIA está lidando AGORA (novo + em conversa). Qualificado já foi
      // pro corretor (tem aba própria), descartado/opt-out saem daqui.
      if (status === "ativos") {
        if (e.status !== "novo" && e.status !== "em_conversa") return false;
        if (e.optout) return false;
      } else if (status !== "todos" && e.status !== status) return false;
      if (nivel !== "todos" && String(e.nivel ?? "").toLowerCase() !== nivel) return false;
      if (origem !== "todas" && origemDoReferral(e.referral) !== origem) return false;
      if (!q) return true;
      return (
        (e.nome ?? "").toLowerCase().includes(q) || (e.telefone ?? "").toLowerCase().includes(q)
      );
    });
    const tempo = (e: LiaEstado) => {
      const t = ultimas?.get(e.telefone)?.created_at ?? e.last_msg_em ?? e.last_user_at ?? e.qualificado_em ?? null;
      return t ? new Date(t).getTime() : 0;
    };
    const ordem: Record<Grupo, number> = { aguardando: 0, conversa: 1, followup: 2 };
    return filtrados
      .map((e) => ({ e, grupo: grupoDe(e, ultimas?.get(e.telefone)?.role) }))
      .sort((a, b) => {
        // na visão "ativos", primeiro por prioridade de grupo; sempre por conversa mais recente.
        if (status === "ativos" && a.grupo !== b.grupo) return ordem[a.grupo] - ordem[b.grupo];
        return tempo(b.e) - tempo(a.e);
      });
  }, [estados, buscaDeb, status, origem, nivel, produto, ultimas]);

  const agrupado = status === "ativos";
  const contagem = useMemo(() => {
    const c: Record<Grupo, number> = { aguardando: 0, conversa: 0, followup: 0 };
    for (const l of linhas) c[l.grupo]++;
    return c;
  }, [linhas]);

  // --- card de conversa (estilo WhatsApp) ---
  const Cartao = ({ e, grupo }: { e: LiaEstado; grupo: Grupo }) => {
    const meta = statusMetaLead(e);
    const ultima = ultimas?.get(e.telefone);
    const nv = String(e.nivel ?? "").toLowerCase();
    const limpo = previewMensagem(ultima?.conteudo);
    const preview =
      limpo
        ? ultima?.role === "assistant"
          ? `LIA: ${limpo}`
          : limpo
        : e.status === "novo"
          ? "1º contato enviado · aguardando resposta 💬"
          : "—";
    const naoLido = grupo === "aguardando";
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setSelecionado(e)}
        className={cn(
          "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50",
          naoLido && "bg-primary/[0.03]"
        )}
      >
        <div
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
          style={{ background: corAvatar(e.produto_slug) }}
        >
          {inicial(e.nome, e.telefone)}
          {naoLido && (
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-card bg-rose-500" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "truncate text-sm text-foreground",
                naoLido ? "font-bold" : "font-semibold"
              )}
            >
              {e.nome || "Sem nome"}
            </span>
            {e.produto_slug ? (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {produtoLabel(e.produto_slug)}
              </Badge>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-0.5 truncate text-[13px]",
              naoLido ? "font-medium text-foreground" : "text-muted-foreground"
            )}
          >
            {preview}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {formatBRT(ultima?.created_at ?? e.last_msg_em, "dd/MM HH:mm")}
            </span>
            <LiaLeadAcoesMenu estado={e} />
          </div>
          <div className="flex items-center gap-1">
            {grupo === "aguardando" ? (
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                responder
              </span>
            ) : null}
            {NIVEL_META[nv] ? (
              <Badge variant="outline" className={cn("text-[10px]", NIVEL_META[nv].cls)}>
                {NIVEL_META[nv].emoji} {NIVEL_META[nv].label}
              </Badge>
            ) : (
              !agrupado && (
                <Badge variant="outline" className={cn("text-[10px]", meta.cls)}>
                  {meta.label}
                </Badge>
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <FiltroImovel produtos={produtos} valor={produto} onChange={setProduto} />
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

      {isLoading ? (
        <Card className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </Card>
      ) : linhas.length === 0 ? (
        <Card>
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhuma conversa com esses filtros.
          </p>
        </Card>
      ) : agrupado ? (
        <div className="space-y-4">
          {GRUPOS.map((g) => {
            const itens = linhas.filter((l) => l.grupo === g.key);
            if (!itens.length) return null;
            return (
              <div key={g.key}>
                <div className="mb-1.5 flex items-center gap-2 px-1">
                  <span
                    className={cn(
                      "text-[11px] font-extrabold uppercase tracking-wider",
                      g.hot ? "text-rose-600" : "text-muted-foreground"
                    )}
                  >
                    {g.hot ? "⚡ " : ""}
                    {g.label}
                  </span>
                  <span className="text-[11px] font-bold text-muted-foreground/60">
                    {contagem[g.key]}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <Card
                  className={cn(
                    "divide-y divide-border overflow-hidden",
                    g.hot && "border-rose-200/70"
                  )}
                >
                  {itens.map((l) => (
                    <Cartao key={l.e.telefone} e={l.e} grupo={l.grupo} />
                  ))}
                </Card>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {linhas.map((l) => (
            <Cartao key={l.e.telefone} e={l.e} grupo={l.grupo} />
          ))}
        </Card>
      )}

      <LiaConversaDrawer
        estado={selecionado}
        open={!!selecionado}
        onOpenChange={(v) => !v && setSelecionado(null)}
      />
    </div>
  );
}
