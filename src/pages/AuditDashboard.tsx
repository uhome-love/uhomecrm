import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HealthScore } from "@/components/audit/HealthScore";
import { IssuesList } from "@/components/audit/IssuesList";
import { AuditLogPanel } from "@/components/audit/AuditLogPanel";
import { useAudit } from "@/hooks/useAudit";
import { useUhomeIa } from "@/hooks/useUhomeIa";
import { Shield, Play, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import type { AuditIssue } from "@/hooks/useAudit";

export default function AuditDashboard() {
  const { runAudit, loading, progress, result } = useAudit();
  const { analyze, loading: iaLoading } = useUhomeIa();
  const [iaReport, setIaReport] = useState<string | null>(null);

  const handleRun = async () => {
    toast.info("Iniciando auditoria...");
    await runAudit();
    toast.success("Auditoria concluída!");
  };

  const handleAutoFix = (issue: AuditIssue) => {
    toast.info(`Correção automática para: ${issue.title} (em breve)`);
  };

  const handleIaAnalysis = async () => {
    if (!result) {
      toast.warning("Execute a auditoria primeiro.");
      return;
    }
    const report = await analyze({
      module: "auditoria",
      prompt: `Você é o UHOME IA QA Auditor. Analise o resultado da auditoria do sistema e gere um relatório completo.

RESULTADO DA AUDITORIA:
- Health Score: ${result.healthScore}/100
- Integrações: ${result.integrationScore}%
- Duplicação: ${result.duplicationScore}%
- Consistência: ${result.consistencyScore}%
- Erros: ${result.errorScore}%
- Total de problemas: ${result.issues.length}

PROBLEMAS ENCONTRADOS:
${result.issues.map((i) => `- [${i.severity}] ${i.module}: ${i.title} — ${i.description}`).join("\n")}

Retorne:
1) Saúde geral (score + semáforo)
2) Principais duplicações
3) Principais inconsistências
4) Riscos para relatórios/CEO
5) Ações recomendadas (prioridade alta/média/baixa)
6) Correções automáticas sugeridas
7) Checklist de validação manual (2 min)`,
      context: result,
    });
    setIaReport(report);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Auditoria & Saúde do Sistema
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Valide integridade dos dados, detecte duplicações e inconsistências.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRun} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            {loading ? "Auditando..." : "Rodar Auditoria"}
          </Button>
          {result && (
            <Button variant="outline" onClick={handleIaAnalysis} disabled={iaLoading}>
              <Sparkles className="h-4 w-4 mr-2" />
              {iaLoading ? "Analisando..." : "Gerar Análise IA"}
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      {loading && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">Executando auditoria... {progress}%</p>
                <Progress value={progress} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          <HealthScore result={result} />
          <IssuesList issues={result.issues} onAutoFix={handleAutoFix} />
        </>
      )}

      {/* IA Report */}
      {iaReport && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Relatório IA de Auditoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{iaReport}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Log */}
      <AuditLogPanel />

      {/* Empty state */}
      {!result && !loading && (
        <Card>
          <CardContent className="py-16 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold mb-1">Pronto para auditar</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Clique em "Rodar Auditoria" para verificar a integridade dos dados, duplicações e consistência de métricas.
            </p>
            <Button onClick={handleRun}>
              <Play className="h-4 w-4 mr-2" /> Iniciar Auditoria
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
