import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  useAtrioControle, useAtrioRespostas, useAtrioActions,
  useCampanhaAtrioFlag, useAtrioAudienciaPreview, useAtrioAudienciaCount,
} from "@/hooks/useCampanhaAtrio";
import { AlertTriangle, Play, RefreshCw, ShieldOff } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  aguardando: "bg-muted text-muted-foreground",
  em_curso: "bg-primary text-primary-foreground",
  pausada: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  concluida: "bg-green-500/20 text-green-700 dark:text-green-400",
};

function CardStatus({ totalAud, enviados, ondaAtual, flagOn, onToggleFlag, onParar }: {
  totalAud: number; enviados: number; ondaAtual: string; flagOn: boolean;
  onToggleFlag: (v: boolean) => void; onParar: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Status geral</span>
          <div className="flex items-center gap-2 text-sm font-normal">
            <span className={flagOn ? "text-green-600" : "text-muted-foreground"}>
              Kill switch: {flagOn ? "ATIVO" : "DESLIGADO"}
            </span>
            <Switch checked={flagOn} onCheckedChange={onToggleFlag} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold">{enviados}/{totalAud}</div>
            <div className="text-xs text-muted-foreground">enviados / audiência</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{ondaAtual}</div>
            <div className="text-xs text-muted-foreground">onda atual</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{totalAud}</div>
            <div className="text-xs text-muted-foreground">audiência total</div>
          </div>
        </div>
        <Button
          variant="destructive" size="lg" className="w-full text-base font-semibold"
          onClick={onParar}
        >
          <ShieldOff className="mr-2 h-5 w-5" /> PARAR TUDO
        </Button>
      </CardContent>
    </Card>
  );
}

export default function CampanhaAtrio() {
  const flagQ = useCampanhaAtrioFlag();
  const ctrlQ = useAtrioControle();
  const respQ = useAtrioRespostas();
  const previewQ = useAtrioAudienciaPreview();
  const audCountQ = useAtrioAudienciaCount();
  const { prepararAudiencia, iniciarOnda, pararTudo, toggleFlag } = useAtrioActions();

  const flagOn = !!flagQ.data?.flag_value;
  const ondas = ctrlQ.data || [];
  const totalAud = audCountQ.data || 0;
  const enviados = ondas.reduce((s, o) => s + o.total_enviado, 0);
  const ondaCurso = ondas.find(o => o.status === "em_curso");
  const ondaAtual = ondaCurso ? `Onda ${ondaCurso.onda}` : "—";

  const handleParar = () => {
    if (!confirm("Tem certeza? Vai desligar a flag e pausar tudo.")) return;
    pararTudo.mutate(undefined, {
      onSuccess: () => toast.success("Parado. Flag OFF, ondas pausadas."),
      onError: (e: any) => toast.error(`Erro: ${e?.message}`),
    });
  };
  const handleToggle = (v: boolean) => {
    toggleFlag.mutate(v, {
      onSuccess: () => toast.success(`Flag ${v ? "LIGADA" : "DESLIGADA"}`),
      onError: (e: any) => toast.error(`Erro: ${e?.message}`),
    });
  };
  const handlePreparar = () => {
    prepararAudiencia.mutate(undefined, {
      onSuccess: (d: any) => toast.success(`Audiência preparada: ${d?.total ?? "?"} leads`),
      onError: (e: any) => toast.error(`Erro: ${e?.message}`),
    });
  };
  const handleIniciar = (onda: number) => {
    if (!confirm(`Iniciar Onda ${onda}? Disparo controlado começa em segundos.`)) return;
    iniciarOnda.mutate(onda, {
      onSuccess: (d: any) => toast.success(`Onda ${onda} iniciada (${d?.total_a_processar} leads).`),
      onError: (e: any) => toast.error(`Erro: ${e?.message}`),
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campanha Átrio Boutique Haus</h1>
          <p className="text-sm text-muted-foreground">Disparo controlado em 3 ondas via Meta Cloud API.</p>
        </div>
        <Button variant="outline" onClick={handlePreparar} disabled={prepararAudiencia.isPending}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {totalAud > 0 ? "Audiência preparada" : "Preparar audiência"}
        </Button>
      </div>

      {totalAud === 0 && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <div className="font-semibold">Audiência ainda não preparada.</div>
              <div className="text-muted-foreground">Clique em "Preparar audiência" para selecionar e congelar os 444 leads.</div>
            </div>
          </CardContent>
        </Card>
      )}

      <CardStatus
        totalAud={totalAud} enviados={enviados} ondaAtual={ondaAtual}
        flagOn={flagOn} onToggleFlag={handleToggle} onParar={handleParar}
      />

      <Card>
        <CardHeader><CardTitle>Ondas</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          {ondas.map(o => {
            const pct = o.total_alvo > 0 ? Math.round((o.total_enviado / o.total_alvo) * 100) : 0;
            const podeIniciar =
              o.status === "aguardando" && flagOn && totalAud > 0 &&
              (o.onda === 1 || ondas.find(p => p.onda === o.onda - 1)?.status === "concluida");
            return (
              <Card key={o.onda} className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    Onda {o.onda}
                    <Badge className={STATUS_COLOR[o.status]}>{o.status}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="text-2xl font-bold">{o.total_enviado}/{o.total_alvo}</div>
                  <div className="h-2 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {o.total_erros > 0 && <span className="text-destructive">{o.total_erros} erros · </span>}
                    {o.motivo_pausa && <span className="text-yellow-600">pausa: {o.motivo_pausa}</span>}
                  </div>
                  <Button
                    size="sm" className="w-full" disabled={!podeIniciar || iniciarOnda.isPending}
                    onClick={() => handleIniciar(o.onda)}
                  >
                    <Play className="mr-2 h-3 w-3" /> Iniciar Onda {o.onda}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Últimas respostas (top 20)</CardTitle></CardHeader>
        <CardContent>
          {(respQ.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma resposta ainda.</p>
          ) : (
            <div className="space-y-2">
              {(respQ.data || []).map(r => (
                <div key={r.id} className="flex items-center justify-between text-sm border-b pb-2">
                  <div className="flex items-center gap-3">
                    <Badge variant={r.tipo_resposta === "sim" ? "default" : r.tipo_resposta === "nao" ? "destructive" : "secondary"}>
                      {r.tipo_resposta.toUpperCase()}
                    </Badge>
                    <span className="font-mono text-xs">{r.telefone}</span>
                    <span className="text-muted-foreground truncate max-w-md">{r.conteudo_resposta}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.enviado_para_roleta ? "→ roleta ✓" : "—"} · {new Date(r.recebido_em).toLocaleTimeString("pt-BR")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Preview audiência (50 primeiros)</CardTitle></CardHeader>
        <CardContent>
          {(previewQ.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem audiência preparada.</p>
          ) : (
            <div className="text-xs space-y-1 max-h-80 overflow-y-auto">
              {(previewQ.data || []).map(l => (
                <div key={l.lead_id} className="flex items-center justify-between font-mono">
                  <span>O{l.onda}·#{l.ordem} {l.nome || "—"}</span>
                  <span className="text-muted-foreground">{l.telefone_normalizado} · {l.empreendimento_origem}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
