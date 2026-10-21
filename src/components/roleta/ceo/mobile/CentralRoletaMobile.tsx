import { useMemo, useState, type ReactNode } from "react";
import { RefreshCw, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoleta, getCurrentWindowInfo } from "@/hooks/useRoleta";
import { useRoletaStatus } from "@/hooks/useRoletaStatus";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FilaLinhaDeslizavel } from "./FilaLinhaDeslizavel";

type RoletaApi = ReturnType<typeof useRoleta>;

export interface SubAba { value: string; label: string; grupo: string }

interface Props {
  roleta: RoletaApi;
  onIncluir: () => void;
  outrasAbas: SubAba[];
  renderConteudo: (sub: string) => ReactNode;
}

const PRINCIPAIS = [
  { value: "board", label: "Ao vivo" },
  { value: "pendentes", label: "Pendentes" },
  { value: "bloqueados", label: "Bloqueados" },
];

export function CentralRoletaMobile({ roleta, onIncluir, outrasAbas, renderConteudo }: Props) {
  const { fila, credenciamentos, segmentos, submitting, aprovarCredenciamento, recusarCredenciamento, removerDaFila } = roleta;
  const { data: st } = useRoletaStatus();
  const windowInfo = getCurrentWindowInfo();
  const [sub, setSub] = useState("board");
  const [maisAberto, setMaisAberto] = useState(false);
  const [verPedidos, setVerPedidos] = useState(false);
  const [tirar, setTirar] = useState<{ id: string; nome: string } | null>(null);

  const pendentes = credenciamentos.filter((c) => c.status === "pendente");
  const filaUnica = useMemo(() => {
    const visto = new Set<string>();
    return [...fila]
      .sort((a, b) => a.posicao - b.posicao)
      .filter((f) => (visto.has(f.corretor_id) ? false : (visto.add(f.corretor_id), true)));
  }, [fila]);

  const kpis = [
    { l: "na fila", v: filaUnica.length },
    { l: "distribuídos", v: st?.distribuidos_hoje ?? 0 },
    { l: "aceite", v: `${st?.taxa_aceite ?? 0}%`, cls: "text-emerald-600 dark:text-emerald-400" },
    { l: "Fila CEO", v: st?.fila_ceo ?? 0, cls: (st?.fila_ceo ?? 0) > 0 ? "text-amber-600" : "" },
    { l: "esperando aceite", v: st?.aguardando_aceite ?? 0 },
  ];
  const outraAtiva = outrasAbas.find((a) => a.value === sub);

  return (
    <div className="-m-4 min-h-full bg-muted/30 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-[30px] font-bold tracking-tight">Roleta</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => roleta.reload()} aria-label="Atualizar" className="flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-sm">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button type="button" onClick={onIncluir} className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">+ Incluir</button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{windowInfo.emoji} {windowInfo.descricao}</p>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {kpis.map((k) => (
          <div key={k.l} className="min-w-[104px] shrink-0 rounded-2xl bg-card px-3 py-2.5 shadow-sm">
            <b className={cn("block text-[22px] tabular-nums", k.cls)}>{k.v}</b>
            <span className="text-[11px] text-muted-foreground">{k.l}</span>
          </div>
        ))}
      </div>

      {pendentes.length > 0 && (
        <button type="button" onClick={() => setVerPedidos(true)} className="mt-3 flex w-full items-center justify-between rounded-2xl bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm">
          <span><b>{pendentes.length} {pendentes.length === 1 ? "pedido" : "pedidos"}</b> para aprovar</span>
          <span className="flex items-center font-semibold text-primary">Ver <ChevronRight className="h-4 w-4" /></span>
        </button>
      )}

      <div className="mt-4 flex rounded-xl bg-muted p-1">
        {PRINCIPAIS.map((a) => (
          <button key={a.value} type="button" onClick={() => setSub(a.value)}
            className={cn("flex-1 rounded-lg py-2 text-[13px]", sub === a.value ? "bg-card font-semibold shadow-sm" : "text-muted-foreground")}>
            {a.label}
          </button>
        ))}
        <button type="button" onClick={() => setMaisAberto(true)}
          className={cn("flex-1 truncate rounded-lg px-1 py-2 text-[13px]", outraAtiva ? "bg-card font-semibold shadow-sm" : "text-muted-foreground")}>
          {outraAtiva ? outraAtiva.label : "Mais"}
        </button>
      </div>

      <div className="mt-3">
        {sub === "board" ? (
          filaUnica.length === 0 ? (
            <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">Ninguém na fila agora</p>
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
                {filaUnica.map((f, i) => (
                  <FilaLinhaDeslizavel
                    key={f.id}
                    nome={f.corretor_nome || "Corretor"}
                    destaque={i === 0}
                    detalhe={`${i + 1}º · ${f.leads_recebidos || 0} leads`}
                    onTirar={() => setTirar({ id: f.id, nome: f.corretor_nome || "corretor" })}
                  />
                ))}
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">Deslize o nome para a esquerda para tirar da fila</p>
            </>
          )
        ) : (
          renderConteudo(sub)
        )}
      </div>

      <Drawer open={maisAberto} onOpenChange={setMaisAberto}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>Mais</DrawerTitle></DrawerHeader>
          <div className="max-h-[60vh] overflow-y-auto px-4 pb-6">
            {Array.from(new Set(outrasAbas.map((a) => a.grupo))).map((g) => (
              <div key={g} className="mb-3">
                <p className="mb-1 px-1 text-xs uppercase tracking-wide text-muted-foreground">{g}</p>
                <div className="overflow-hidden rounded-2xl bg-muted/50">
                  {outrasAbas.filter((a) => a.grupo === g).map((a) => (
                    <button key={a.value} type="button" onClick={() => { setSub(a.value); setMaisAberto(false); }}
                      className="flex w-full items-center justify-between border-b border-border/60 px-4 py-3 text-left text-[15px] last:border-0">
                      {a.label} <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={verPedidos} onOpenChange={setVerPedidos}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>Pedidos para aprovar</DrawerTitle></DrawerHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto px-4 pb-6">
            {pendentes.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nenhum pedido pendente</p>}
            {pendentes.map((c) => {
              const segs = [c.segmento_1_id, c.segmento_2_id].map((id) => segmentos.find((s) => s.id === id)?.nome).filter(Boolean).join(" · ");
              return (
                <div key={c.id} className="rounded-2xl bg-muted/50 p-3">
                  <p className="font-medium">{c.corretor_nome}</p>
                  <p className="text-xs text-muted-foreground">{c.janela}{segs ? ` · ${segs}` : ""}</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={submitting} onClick={() => aprovarCredenciamento(c.id)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                      <CheckCircle2 className="h-4 w-4" /> Aprovar
                    </button>
                    <button type="button" disabled={submitting} onClick={() => recusarCredenciamento(c.id)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-destructive/40 py-2.5 text-sm font-semibold text-destructive disabled:opacity-50">
                      <XCircle className="h-4 w-4" /> Recusar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={!!tirar} onOpenChange={(o) => !o && setTirar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tirar da fila?</AlertDialogTitle>
            <AlertDialogDescription>{tirar?.nome} para de receber leads neste turno.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (tirar) removerDaFila(tirar.id); setTirar(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Tirar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
