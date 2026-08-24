import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatBRT } from "@/lib/brtTime";
import LiaLeadAcoesMenu from "./LiaLeadAcoesMenu";
import {
  NIVEL_META,
  origemDoReferral,
  partirMensagem,
  produtoLabel,
  statusMetaLead,
  useLiaConversa,
  type LiaEstado,
} from "./useLiaHub";

const COR_PRODUTO: Record<string, string> = {
  "awa-wellness": "#3E4C7A",
  "casa-tua-canoas": "#4969FF",
  "casa-tua-porto-alegre": "#2FB0A3",
  "connect-joao-wallig": "#7A5AF0",
};
const corAvatar = (slug?: string | null) => (slug && COR_PRODUTO[slug]) || "#7A8091";
const inicial = (nome?: string | null, tel?: string | null) => {
  const m = (nome || "").trim().match(/\p{L}/u);
  return m ? m[0].toUpperCase() : (tel || "?").slice(-2, -1) || "?";
};

/** Painel de conversa inline (desktop): a conversa aberta ao lado da lista, estilo WhatsApp,
 * com a ficha do lead à direita. No mobile a conversa continua abrindo pelo drawer. */
export default function LiaConversaPane({ estado }: { estado: LiaEstado }) {
  const { data: mensagens, isLoading } = useLiaConversa(estado.telefone);
  const meta = statusMetaLead(estado);
  const nv = String(estado.nivel ?? "").toLowerCase();
  const fu = estado.followup_count ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* cabeçalho */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
          style={{ background: corAvatar(estado.produto_slug) }}
        >
          {inicial(estado.nome, estado.telefone)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-foreground">{estado.nome || "Sem nome"}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{estado.telefone}</span>
            {estado.produto_slug ? (
              <Badge variant="secondary" className="text-[10px]">
                {produtoLabel(estado.produto_slug)}
              </Badge>
            ) : null}
            <Badge variant="outline" className={cn("text-[10px]", meta.cls)}>
              {meta.label}
            </Badge>
          </div>
        </div>
        <LiaLeadAcoesMenu estado={estado} />
      </header>

      {/* corpo: conversa + ficha */}
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1fr_240px]">
        <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto bg-muted/20 px-4 py-4">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : !mensagens?.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sem mensagens ainda.</p>
          ) : (
            (mensagens ?? []).map((m, i) => {
              const isUser = m.role === "user";
              const partes = partirMensagem(m.conteudo);
              if (!partes.length) return null;
              return (
                <div key={i} className={cn("flex flex-col gap-1", isUser ? "items-start" : "items-end")}>
                  {partes.map((p, j) => (
                    <div
                      key={j}
                      className={cn(
                        "max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                        isUser
                          ? "rounded-bl-sm bg-card text-foreground"
                          : "rounded-br-sm bg-primary text-primary-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{p}</p>
                      {j === partes.length - 1 && (
                        <span
                          className={cn(
                            "mt-1 block text-[10px]",
                            isUser ? "text-muted-foreground" : "text-primary-foreground/75"
                          )}
                        >
                          {formatBRT(m.created_at, "dd/MM HH:mm")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* ficha do lead */}
        <aside className="hidden overflow-y-auto border-l border-border p-4 xl:block">
          <h4 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
            Ficha do lead
          </h4>
          <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3 text-[13px]">
            <Linha k="Imóvel" v={estado.produto_slug ? produtoLabel(estado.produto_slug) : "—"} />
            <Linha k="Status" v={meta.label} />
            <Linha
              k="Temperatura"
              v={NIVEL_META[nv] ? `${NIVEL_META[nv].emoji} ${NIVEL_META[nv].label}` : "—"}
            />
            <Linha k="Origem" v={origemDoReferral(estado.referral)} />
            <Linha k="Follow-ups" v={`${fu} de 4 toques`} />
          </div>
          {estado.agendou ? (
            <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-[13px]">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                Sinalizou agenda
              </div>
              <p className="mt-1 text-foreground">{estado.agendamento || "quer conhecer"}</p>
            </div>
          ) : null}
          {!estado.lead_id ? (
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Ainda sem lead no pipeline — a LIA cria o lead ao qualificar e repassa pro corretor do imóvel.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Linha({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-semibold text-foreground">{v}</span>
    </div>
  );
}
