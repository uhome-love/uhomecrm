import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BANCOS, DATA_REFERENCIA_TAXAS, FONTE_TAXAS } from "@/lib/bancosFinanciamento";
import { RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface Resultado {
  precisaRevisar?: boolean;
  idadeDias?: number | null;
  mensagem?: string;
  selic?: { valor: number; data: string | null } | null;
}

export function AtualizarTaxasDialog() {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function verificar() {
    setLoading(true);
    setErro(null);
    setRes(null);
    try {
      const { data, error } = await supabase.functions.invoke("verificar-taxas-financiamento", {
        body: {
          dataReferencia: DATA_REFERENCIA_TAXAS,
          bancos: BANCOS.map((b) => ({ nome: b.nome, taxaAnual: b.taxaAnual })),
        },
      });
      if (error) throw error;
      setRes(data);
    } catch (e: any) {
      setErro(e?.message ?? "Não foi possível verificar as taxas agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar taxas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Verificação de taxas</DialogTitle>
          <DialogDescription>
            Confere se as taxas do simulador estão dentro do período de auditoria e consulta a Selic atual no Banco Central.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Auditoria atual</span>
              <Badge variant="secondary">{DATA_REFERENCIA_TAXAS}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Fonte: {FONTE_TAXAS}</p>
          </div>

          <Button onClick={verificar} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? "Verificando..." : "Verificar agora"}
          </Button>

          {erro && <p className="text-danger-500 text-xs">{erro}</p>}

          {res && (
            <div
              className={`rounded-lg border p-3 ${
                res.precisaRevisar ? "border-warning-300 bg-warning-50/40" : "border-success-300 bg-success-50/40"
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {res.precisaRevisar ? (
                  <><AlertTriangle className="h-4 w-4 text-warning-600" /> Revisar taxas</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 text-success-600" /> Taxas atualizadas</>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{res.mensagem}</p>
              {typeof res.idadeDias === "number" && (
                <p className="text-xs text-muted-foreground mt-1">Idade da auditoria: {res.idadeDias} dias.</p>
              )}
              {res.selic && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selic meta atual: <strong>{res.selic.valor}% a.a.</strong>
                  {res.selic.data ? ` (BCB, ${res.selic.data})` : ""}
                </p>
              )}
              {res.precisaRevisar && (
                <p className="text-xs mt-2">
                  Para atualizar as taxas oficialmente, peça ao time de tecnologia para revisar os valores em
                  <code className="mx-1 rounded bg-muted px-1">bancosFinanciamento.ts</code> — assim a simulação
                  continua 100% auditada.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
