import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, X, FlaskConical } from "lucide-react";
import { CENARIOS_LABORATORIO, RECUPERA_CONFIG } from "@/lia/recupera";

type Nota = "ok" | "ajustar";
const CHAVE = "lia-laboratorio-revisao";

function lerRevisao(): Record<string, Nota> {
  try { return JSON.parse(localStorage.getItem(CHAVE) ?? "{}"); } catch { return {}; }
}

export default function LiaLaboratorioTab() {
  const [rev, setRev] = useState<Record<string, Nota>>(lerRevisao);
  const total = CENARIOS_LABORATORIO.reduce((s, g) => s + g.itens.length, 0);
  const aprovados = Object.values(rev).filter((v) => v === "ok").length;

  const marcar = (item: string, nota: Nota) => {
    const novo = { ...rev, [item]: rev[item] === nota ? undefined : nota } as Record<string, Nota>;
    Object.keys(novo).forEach((k) => novo[k] === undefined && delete novo[k]);
    setRev(novo);
    localStorage.setItem(CHAVE, JSON.stringify(novo));
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <FlaskConical className="h-6 w-6 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Validação do cérebro da Lia</p>
            <p className="text-xs text-muted-foreground">
              Converse como cliente em cada cenário e marque se a resposta ficou certa. A recuperação só liga com 100% aprovado.
            </p>
            <Progress value={(aprovados / total) * 100} className="mt-2 h-1.5" />
            <p className="mt-1 text-[11px] text-muted-foreground">{aprovados} de {total} aprovados</p>
          </div>
          <Button asChild size="sm"><Link to="/lia-teste">Abrir conversa de teste</Link></Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CENARIOS_LABORATORIO.map((g) => (
          <Card key={g.grupo}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{g.grupo}</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {g.itens.map((i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs">
                  <span className="flex-1 text-foreground">{i}</span>
                  <Button size="icon" variant={rev[i] === "ok" ? "default" : "outline"} className="h-7 w-7" aria-label="Aprovar" onClick={() => marcar(i, "ok")}><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant={rev[i] === "ajustar" ? "destructive" : "outline"} className="h-7 w-7" aria-label="Ajustar" onClick={() => marcar(i, "ajustar")}><X className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Modelo de IA</CardTitle>
          <CardDescription className="text-xs">Recomendação por custo-benefício.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-xl border border-border p-3">
            <Badge className="mb-1 text-[10px]">Conversa</Badge>
            <p className="font-semibold text-foreground">{RECUPERA_CONFIG.modeloConversa}</p>
            <p className="text-muted-foreground">Rápido, barato e bom em português. Responde o dia a dia.</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <Badge variant="secondary" className="mb-1 text-[10px]">Decisão</Badge>
            <p className="font-semibold text-foreground">{RECUPERA_CONFIG.modeloDecisao}</p>
            <p className="text-muted-foreground">Só para decidir "quente → Roleta" e escrever o resumo ao corretor.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
