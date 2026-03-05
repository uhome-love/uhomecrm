import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardCheck, BarChart3, CheckSquare, Bell, AlertTriangle, CheckCircle } from "lucide-react";
import homiMascot from "@/assets/homi-mascot.png";
import CheckpointDaily from "@/components/checkpoint/CheckpointDaily";
import CheckpointReports from "@/components/checkpoint/CheckpointReports";
import CoachPanel from "@/components/checkpoint/CoachPanel";
import ManagerChecklist from "@/components/checkpoint/ManagerChecklist";
import MetasMensaisProgress from "@/components/checkpoint/MetasMensaisProgress";
import CheckpointAproveitados from "@/components/checkpoint/CheckpointAproveitados";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface CheckpointReminder {
  totalCorretores: number;
  preenchidos: number;
  pendentes: string[];
  checkpointExists: boolean;
}

export default function CheckpointGerente() {
  const [activeTab, setActiveTab] = useState("checkpoint");
  const { user } = useAuth();
  const [nome, setNome] = useState("");
  const [reminder, setReminder] = useState<CheckpointReminder | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.nome) setNome(data.nome.split(" ")[0]);
    });

    // Check today's checkpoint status for reminders
    const checkReminder = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: team } = await supabase.from("team_members").select("id, nome").eq("gerente_id", user.id).eq("status", "ativo");
      if (!team || team.length === 0) { setReminder(null); return; }

      const { data: cp } = await supabase.from("checkpoints").select("id, status").eq("gerente_id", user.id).eq("data", today).maybeSingle();

      if (!cp) {
        setReminder({ totalCorretores: team.length, preenchidos: 0, pendentes: team.map(t => t.nome), checkpointExists: false });
        return;
      }

      if (cp.status === "fechado") { setReminder(null); return; }

      const { data: lines } = await supabase.from("checkpoint_lines").select("corretor_id, real_ligacoes, real_visitas_marcadas, real_visitas_realizadas, real_propostas").eq("checkpoint_id", cp.id);
      
      const filledCorretors = new Set((lines || []).filter(l => 
        l.real_ligacoes != null || l.real_visitas_marcadas != null || l.real_visitas_realizadas != null || l.real_propostas != null
      ).map(l => l.corretor_id));

      const pendentes = team.filter(t => !filledCorretors.has(t.id)).map(t => t.nome);
      setReminder({ totalCorretores: team.length, preenchidos: filledCorretors.size, pendentes, checkpointExists: true });
    };
    checkReminder();
  }, [user]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {nome ? (
            <>Olá <span className="text-primary">{nome}</span>, bem-vindo(a) ao <span className="text-primary">Uhome Gestão e IA</span></>
          ) : (
            <>Checkpoint do <span className="text-primary">Gerente</span></>
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestão diária do time comercial com metas, resultados e IA
        </p>
      </div>

      {/* Daily reminder notification */}
      {reminder && reminder.pendentes.length > 0 && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${
          !reminder.checkpointExists 
            ? "bg-destructive/5 border-destructive/20" 
            : "bg-warning/5 border-warning/20"
        }`}>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
            !reminder.checkpointExists ? "bg-destructive/10" : "bg-warning/10"
          }`}>
            {!reminder.checkpointExists ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <Bell className="h-4 w-4 text-warning" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground">
              {!reminder.checkpointExists 
                ? "⚠️ Checkpoint de hoje ainda não foi criado!" 
                : `📋 ${reminder.preenchidos}/${reminder.totalCorretores} corretores com resultados preenchidos`
              }
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {reminder.pendentes.length === reminder.totalCorretores 
                ? "Nenhum corretor foi preenchido ainda hoje. Clique na aba Checkpoint para começar."
                : <>Pendentes: <span className="font-medium text-foreground">{reminder.pendentes.join(", ")}</span></>
              }
            </p>
          </div>
        </div>
      )}

      {reminder && reminder.pendentes.length === 0 && reminder.checkpointExists && (
        <div className="flex items-center gap-3 p-3 rounded-xl border bg-success/5 border-success/20">
          <CheckSquare className="h-4 w-4 text-success" />
          <p className="text-sm font-medium text-success">✅ Todos os corretores foram preenchidos hoje!</p>
        </div>
      )}

      <MetasMensaisProgress />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="checkpoint" className="gap-1.5 text-xs py-2">
            <ClipboardCheck className="h-3.5 w-3.5" /> Checkpoint
          </TabsTrigger>
          <TabsTrigger value="aproveitados" className="gap-1.5 text-xs py-2">
            <CheckCircle className="h-3.5 w-3.5" /> Aproveitados
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1.5 text-xs py-2">
            <BarChart3 className="h-3.5 w-3.5" /> Relatórios
          </TabsTrigger>
          <TabsTrigger value="coach" className="gap-1.5 text-xs py-2">
            <img src={homiMascot} alt="Homi" className="h-4 w-4 object-contain" /> Coach IA
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1.5 text-xs py-2">
            <CheckSquare className="h-3.5 w-3.5" /> Checklist
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checkpoint" className="mt-4">
          <CheckpointDaily />
        </TabsContent>
        <TabsContent value="aproveitados" className="mt-4">
          <CheckpointAproveitados />
        </TabsContent>
        <TabsContent value="relatorios" className="mt-4">
          <CheckpointReports />
        </TabsContent>
        <TabsContent value="coach" className="mt-4">
          <CoachPanel />
        </TabsContent>
        <TabsContent value="checklist" className="mt-4">
          <ManagerChecklist />
        </TabsContent>
      </Tabs>
    </div>
  );
}
