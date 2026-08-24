import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import LiaConversaPane from "./LiaConversaPane";
import LiaLeadAcoesMenu from "./LiaLeadAcoesMenu";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  NIVEL_META,
  origemDoReferral,
  previewMensagem,
  produtoLabel,
  produtosDeEstados,
  statusMetaLead,
  useLiaEstados,
  useLiaPipelineLeads,
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

// prioridade da inbox: quem RESPONDEU e está esperando vem primeiro; qualificados ficam por último
// (mas visíveis, com o corretor pra quem foram).
type Grupo = "aguardando" | "conversa" | "followup" | "qualificado";
const grupoDe = (e: LiaEstado, ultimaRole?: string): Grupo => {
  if (e.status === "qualificado") return "qualificado"; // já foi pro corretor / Fila CEO
  if (ultimaRole === "user") return "aguardando"; // o lead falou por último = está te esperando
  if ((e.followup_count ?? 0) > 0) return "followup"; // esfriou, entrou na cadência
  return "conversa"; // a LIA falou por último, aguardando o lead
};
const ORDEM_GRUPO: Record<Grupo, number> = { aguardando: 0, conversa: 1, followup: 2, qualificado: 3 };
const GRUPOS: { key: Grupo; label: string; hot?: boolean; ok?: boolean }[] = [
  { key: "aguardando", label: "Respondeu, aguardando você", hot: true },
  { key: "conversa", label: "Em conversa · a LIA está atendendo" },
  { key: "followup", label: "Em follow-up · esfriaram, a LIA reativa" },
  { key: "qualificado", label: "Qualificados · foram pro corretor / Fila CEO", ok: true },
];

export default function LiaLeadsTab() {
  const { data: estados, isLoading } = useLiaEstados();
  const { data: ultimas } = useLiaUltimasMensagens();
  const { data: pipeline } = useLiaPipelineLeads();

  // mapa telefone(8 últimos) -> pra onde o lead qualificado foi (corretor que assumiu, ou Fila CEO)
  const destinoPorTel = useMemo(() => {
    const m = new Map<string, { corretor: string | null; assumido: boolean }>();
    const leads = pipeline?.leads ?? [];
    const corretores = pipeline?.corretores;
    for (const l of leads) {
      if (!l.telefone) continue;
      const l8 = String(l.telefone).replace(/\D/g, "").slice(-8);
      const corretor = l.corretor_id ? corretores?.get(l.corretor_id) ?? null : null;
      m.set(l8, { corretor, assumido: l.aceite_status === "aceito" });
    }
    return m;
  }, [pipeline]);
  const destinoDe = (tel: string) => destinoPorTel.get(String(tel).replace(/\D/g, "").slice(-8));

  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("todos");
  const [origem, setOrigem] = useState("todas");
  const [nivel, setNivel] = useState("todos");
  const [produto, setProduto] = useState("todos");
  const [selecionado, setSelecionado] = useState<LiaEstado | null>(null);
  const buscaDeb = useDebounce(busca, 250);
  const isMobile = useIsMobile();

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
        // "ativos" = o que a LIA está lidando + os qualificados (pra você ver pra onde foram).
        // Descartado/opt-out saem daqui.
        if (e.status !== "novo" && e.status !== "em_conversa" && e.status !== "qualificado") return false;
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
    return filtrados
      .map((e) => ({ e, grupo: grupoDe(e, ultimas?.get(e.telefone)?.role) }))
      .sort((a, b) => {
        // na visão "ativos", primeiro por prioridade de grupo; sempre por conversa mais recente.
        if (status === "ativos" && a.grupo !== b.grupo) return ORDEM_GRUPO[a.grupo] - ORDEM_GRUPO[b.grupo];
        return tempo(b.e) - tempo(a.e);
      });
  }, [estados, buscaDeb, status, origem, nivel, produto, ultimas]);

  const agrupado = status === "ativos";
  const contagem = useMemo(() => {
    const c: Record<Grupo, number> = { aguardando: 0, conversa: 0, followup: 0, qualificado: 0 };
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
            {grupo === "qualificado"
              ? (() => {
                  const d = destinoDe(e.telefone);
                  return d?.corretor ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-300 text-[10px] font-semibold text-emerald-700"
                    >
                      ✅ {d.corretor}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-300 text-[10px] font-semibold text-amber-700"
                    >
                      ⏳ Fila CEO
                    </Badge>
                  );
                })()
              : NIVEL_META[nv] ? (
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
    <div className="space-y-3">
      {/* Barra de filtros única e compacta: busca | imóvel · status · origem | temperatura.
          Uma linha só no desktop, aproveitando a largura; embrulha com elegância no mobile. */}
      <Card className="flex flex-wrap items-center gap-2 p-2">
        <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[180px] sm:max-w-[300px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome ou telefone…"
            className="h-9 pl-9 text-base sm:text-sm"
          />
        </div>

        {produtos.length > 1 ? (
          <Select value={produto} onValueChange={setProduto}>
            <SelectTrigger className="h-9 w-auto min-w-[128px] gap-1.5 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os imóveis</SelectItem>
              {produtos.map((slug) => (
                <SelectItem key={slug} value={slug}>
                  {produtoLabel(slug)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-auto min-w-[116px] gap-1.5 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PILULAS.map((p) => (
              <SelectItem key={p.valor} value={p.valor}>
                {p.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={origem} onValueChange={setOrigem}>
          <SelectTrigger className="h-9 w-auto min-w-[116px] gap-1.5 text-sm">
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

        {/* Temperatura: segmentado clicável. Clicar de novo no ativo limpa (volta pra todas). */}
        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
          {(["quente", "morno", "frio"] as const).map((n) => {
            const ativo = nivel === n;
            return (
              <button
                key={n}
                type="button"
                title={`Filtrar ${NIVEL_META[n].label}`}
                onClick={() => setNivel(ativo ? "todos" : n)}
                className={cn(
                  "flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-colors",
                  ativo
                    ? cn("shadow-sm", NIVEL_META[n].cls)
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                )}
              >
                <span>{NIVEL_META[n].emoji}</span>
                <span className="hidden md:inline">{NIVEL_META[n].label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="lg:grid lg:grid-cols-[minmax(0,400px)_1fr] lg:items-start lg:gap-4">
        <div className="space-y-4 lg:max-h-[74vh] lg:overflow-y-auto lg:pr-1">
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
                      g.hot ? "text-rose-600" : g.ok ? "text-emerald-600" : "text-muted-foreground"
                    )}
                  >
                    {g.hot ? "⚡ " : g.ok ? "✅ " : ""}
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
                    g.hot && "border-rose-200/70",
                    g.ok && "border-emerald-200/70"
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

        </div>

        {/* desktop: a conversa abre inline ao lado (estilo WhatsApp), com a ficha do lead */}
        <div className="hidden lg:sticky lg:top-4 lg:block">
          <Card className="flex h-[74vh] flex-col overflow-hidden">
            {selecionado ? (
              <LiaConversaPane estado={selecionado} />
            ) : (
              <div className="grid h-full place-items-center p-8 text-center">
                <div className="text-sm text-muted-foreground">
                  <div className="mb-1 text-3xl">💬</div>
                  Selecione uma conversa à esquerda pra ver as mensagens e a ficha do lead.
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* mobile: a conversa abre em tela cheia (drawer); no desktop usa o painel ao lado */}
      <LiaConversaDrawer
        estado={selecionado}
        open={isMobile && !!selecionado}
        onOpenChange={(v) => !v && setSelecionado(null)}
      />
    </div>
  );
}
