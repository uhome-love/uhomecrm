import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Shield, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import type { AuditResult } from "@/hooks/useAudit";

function getColor(score: number) {
  if (score >= 90) return "text-green-500";
  if (score >= 70) return "text-yellow-500";
  return "text-red-500";
}
function getBg(score: number) {
  if (score >= 90) return "bg-green-500/10";
  if (score >= 70) return "bg-yellow-500/10";
  return "bg-red-500/10";
}
function getLabel(score: number) {
  if (score >= 90) return "Saudável";
  if (score >= 70) return "Atenção";
  return "Crítico";
}

export function HealthScore({ result }: { result: AuditResult }) {
  const scores = [
    { label: "Integrações", value: result.integrationScore },
    { label: "Duplicação", value: result.duplicationScore },
    { label: "Consistência", value: result.consistencyScore },
    { label: "Erros/Logs", value: result.errorScore },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {/* Main score */}
      <Card className={`md:col-span-2 ${getBg(result.healthScore)} border-none`}>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <div className={`text-6xl font-bold ${getColor(result.healthScore)}`}>
            {result.healthScore}
          </div>
          <div className={`text-sm font-semibold mt-1 ${getColor(result.healthScore)}`}>
            {getLabel(result.healthScore)}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Health Score</p>
          <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-green-500" />{result.stats.passed} OK</span>
            <span className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />{result.stats.warnings} Avisos</span>
            <span className="flex items-center gap-1"><XCircle className="h-3.5 w-3.5 text-red-500" />{result.stats.errors} Erros</span>
          </div>
        </CardContent>
      </Card>

      {/* Sub-scores */}
      <div className="md:col-span-3 grid grid-cols-2 gap-3">
        {scores.map((s) => (
          <Card key={s.label}>
            <CardContent className="py-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                <span className={`text-sm font-bold ${getColor(s.value)}`}>{s.value}%</span>
              </div>
              <Progress value={s.value} className="h-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
