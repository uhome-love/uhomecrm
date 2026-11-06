import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, RotateCw, Loader2, CircleCheck, CircleAlert } from "lucide-react";
import type { Cenario, Conferencia, Msg } from "../../../supabase/functions/_shared/liaLaboratorio";
import { formatBRT } from "@/lib/brtTime";

export interface Execucao {
  id: string;
  cenario_id: string;
  conversa: Msg[];
  conferencias: Conferencia[];
  sinal_final: string | null;
  passou_automatico: boolean;
  avaliacao: "ok" | "ajustar" | null;
  comentario: string | null;
  created_at: string;
  ficha_versao?: string | null;
  ficha_hash?: string | null;
}

interface Props {
  cenario: Cenario;
  execucao?: Execucao;
  rodando: boolean;
  bloqueado: boolean;
  desatualizado?: boolean;
  onRodar: () => void;
  onAvaliar: (e: Execucao, a: "ok" | "ajustar", comentario?: string) => void;
}

export default function LiaCenarioCard({ cenario, execucao, rodando, bloqueado, desatualizado, onRodar, onAvaliar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [coment, setComent] = useState("");
  const [pedindoAjuste, setPedindoAjuste] = useState(false);
  const falhas = execucao?.conferencias.filter((c) => !c.ok) ?? [];

  return (
    <Card className={execucao?.avaliacao === "ok" ? "border-primary/40" : execucao?.avaliacao === "ajustar" ? "border-destructive/40" : ""}>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{cenario.titulo}</p>
            <p className="text-[11px] text-muted-foreground">{cenario.nomeCliente} (fictício) · {cenario.produtoNome} · {cenario.motivo} · há {cenario.dias} dias</p>
            {ACAO_ESPERADA[cenario.id] && <p className="mt-1 text-[11px] text-foreground"><span className="font-medium">Ação esperada:</span> {ACAO_ESPERADA[cenario.id]}</p>}
          </div>
          {execucao?.avaliacao === "ok" && <Badge variant={desatualizado ? "outline" : "default"} className="text-[10px]">{desatualizado ? "Revalidar" : "Aprovado"}</Badge>}
          {execucao?.avaliacao === "ajustar" && <Badge variant="destructive" className="text-[10px]">Ajustar</Badge>}
          {execucao && !execucao.avaliacao && (
            <Badge variant={execucao.passou_automatico ? "secondary" : "outline"} className="text-[10px]">
              {execucao.passou_automatico ? "Conferências ok" : `${falhas.length} alerta(s)`}
            </Badge>
          )}
        </div>

        {!execucao && (
          <Button size="sm" variant="outline" onClick={onRodar} disabled={bloqueado}>
            {rodando ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RotateCw className="mr-1 h-3.5 w-3.5" />} Rodar
          </Button>
        )}

        {execucao && (
          <>
            <p className="text-[11px] text-muted-foreground">Execução: {formatBRT(execucao.created_at, "dd/MM/yyyy HH:mm")} · {execucao.ficha_versao ? `Ficha: ${formatBRT(execucao.ficha_versao, "dd/MM HH:mm")}` : "Versão de ficha não registrada"}</p>
            {desatualizado && <p className="text-xs text-warning">Reexecutar com a ficha atual antes de considerar esta aprovação vigente.</p>}
            <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => setAberto((v) => !v)}>
              {aberto ? "Esconder conversa" : "Ver conversa"}
            </Button>
            {aberto && (
              <div className="space-y-1.5 rounded-lg bg-muted/40 p-2">
                {execucao.conversa.map((m, i) => (
                  <div key={i} className={`max-w-[90%] whitespace-pre-line rounded-lg px-2.5 py-1.5 text-xs ${m.de === "lia" ? "bg-card text-foreground" : "ml-auto bg-primary/10 text-foreground"}`}>
                    <span className="mb-0.5 block text-[10px] font-semibold text-muted-foreground">{m.de === "lia" ? "Lia" : cenario.nomeCliente}{m.sinal ? ` · ${m.sinal}` : ""}</span>
                    {m.texto.replace(/\[\[\s*midia\s*:[^\]]*\]\]/gi, "📷 (envia foto)")}
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {execucao.conferencias.map((c) => (
                <span key={c.chave} title={c.detalhe} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${c.ok ? "border-border text-muted-foreground" : "border-destructive/50 text-destructive"}`}>
                  {c.ok ? <CircleCheck className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}{c.nome}
                </span>
              ))}
            </div>
            {falhas.filter((f) => f.detalhe).map((f) => <p key={f.chave} className="text-[11px] text-destructive">{f.detalhe}</p>)}
            {execucao.comentario && <p className="text-[11px] text-muted-foreground">Seu comentário: {execucao.comentario}</p>}

            {pedindoAjuste ? (
              <div className="space-y-1.5">
                <Textarea value={coment} onChange={(e) => setComent(e.target.value)} placeholder="O que a Lia deveria ter respondido?" className="min-h-16 text-xs" />
                <div className="flex gap-1.5">
                  <Button size="sm" variant="destructive" disabled={bloqueado || coment.trim().length < 5} onClick={() => { onAvaliar(execucao, "ajustar", coment.trim()); }}>Salvar ajuste</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPedindoAjuste(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" disabled={bloqueado || desatualizado} variant={execucao.avaliacao === "ok" ? "default" : "outline"} onClick={() => onAvaliar(execucao, "ok")}><Check className="mr-1 h-3.5 w-3.5" />Aprovar</Button>
                <Button size="sm" variant="outline" disabled={bloqueado} onClick={() => setPedindoAjuste(true)}><X className="mr-1 h-3.5 w-3.5" />Ajustar</Button>
                <Button size="sm" variant="ghost" onClick={onRodar} disabled={bloqueado}>
                  {rodando ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RotateCw className="mr-1 h-3.5 w-3.5" />}Rodar de novo
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
