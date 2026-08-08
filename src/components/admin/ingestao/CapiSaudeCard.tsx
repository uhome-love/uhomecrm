import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Radio } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";
import type { CapiSaude } from "@/hooks/useCapiSaude";

interface Props {
  data?: CapiSaude;
  loading?: boolean;
}

export function CapiSaudeCard({ data, loading }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          Rastreamento Meta (CAPI)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Cobertura do identificador do anúncio (7d) · eventos e bloqueios (24h)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !data ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Leads Meta com ID</p>
                <p className="text-2xl font-bold">
                  {data.coberturaMeta.pct}
                  <span className="text-sm font-normal">%</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.coberturaMeta.comId}/{data.coberturaMeta.total} em 7 dias
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Bloqueados (24h)</p>
                <p className="text-2xl font-bold">{data.bloqueios24h.total}</p>
                <p className="text-xs text-muted-foreground">sem identificador</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Bloqueio suspeito</p>
                <p
                  className={`text-2xl font-bold ${
                    data.bloqueios24h.recentesMeta > 3 ? "text-destructive" : ""
                  }`}
                >
                  {data.bloqueios24h.recentesMeta}
                </p>
                <p className="text-xs text-muted-foreground">lead novo de Meta</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Ganhos 7d (total)</p>
                <p className="text-2xl font-bold">{data.venda7d.ganhosTotal}</p>
                <p className="text-xs text-muted-foreground">vendas no CRM</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Ganhos elegíveis</p>
                <p className="text-2xl font-bold">{data.venda7d.ganhosElegiveis}</p>
                <p className="text-xs text-muted-foreground">lead com ID de anúncio</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Eventos Venda 7d</p>
                <p
                  className={`text-2xl font-bold ${
                    data.venda7d.semEvento > 0 ? "text-destructive" : ""
                  }`}
                >
                  {data.venda7d.eventos}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.venda7d.semEvento > 0
                    ? `${data.venda7d.semEvento} venda(s) sem evento`
                    : "escada completa"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Autoteste da guarda</p>
              {data.selftest.resultado === "falhou" ? (
                <p className="text-sm font-medium text-destructive">
                  Guarda FALHOU no último teste
                </p>
              ) : data.selftest.resultado === "nao_aplicavel" ? (
                <p className="text-sm text-muted-foreground">
                  Sem caso para testar (nenhum lead sem identificador)
                </p>
              ) : data.selftest.resultado === "passou" ? (
                <p
                  className={`text-sm font-medium ${
                    data.selftest.em &&
                    Date.now() - new Date(data.selftest.em).getTime() > 48 * 3600_000
                      ? "text-destructive"
                      : ""
                  }`}
                >
                  Guarda testada ✓
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Ainda não executado</p>
              )}
              {data.selftest.em && (
                <p className="text-xs text-muted-foreground">
                  Último teste: {formatBRT(data.selftest.em, "dd/MM HH:mm")}
                </p>
              )}

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Eventos enfileirados nas últimas 24h
              </p>
              {data.eventos24h.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento em 24h.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.eventos24h.map((e) => (
                    <Badge key={e.event_name} variant="secondary">
                      {e.event_name}: {e.total}
                    </Badge>
                  ))}
                </div>
              )}
              {data.ultimoEvento && (
                <p className="text-xs text-muted-foreground">
                  Último evento: {formatBRT(data.ultimoEvento, "dd/MM HH:mm")}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
