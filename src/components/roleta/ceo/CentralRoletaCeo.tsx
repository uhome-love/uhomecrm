import { useState, useEffect } from "react";
import { useRoleta, getCurrentWindowInfo } from "@/hooks/useRoleta";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, Target, RefreshCw, UserPlus, Clock } from "lucide-react";
import { RoletaStatusBar } from "./RoletaStatusBar";
import { RoletaOperacaoTab } from "./RoletaOperacaoTab";
import { RoletaIncluirModal } from "./RoletaIncluirModal";
import LeadsGeradosTab from "@/components/roleta/LeadsGeradosTab";
import RoletagensTab from "@/components/roleta/RoletagensTab";
import WhatsAppEntradasTab from "@/components/roleta/WhatsAppEntradasTab";
import RoletaMetricasTab from "@/components/roleta/RoletaMetricasTab";
import LeadIntelligenceTab from "@/components/roleta/LeadIntelligenceTab";
import RoletaConfigTab from "@/components/roleta/RoletaConfigTab";
import CorretoresBloqueadosPanel from "@/components/roleta/CorretoresBloqueadosPanel";
import PendingLeadsPanel from "@/components/pipeline/PendingLeadsPanel";
import DistributionDashboard from "@/components/pipeline/DistributionDashboard";

// ─── Countdown Timer ───
function CountdownTimer({ target }: { target: Date }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const diff = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return (
    <span className="font-mono font-bold text-primary">
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

// ─── Navigation config ───
interface SubTab {
  value: string;
  label: string;
}
interface NavGroup {
  key: string;
  label: string;
  subs: SubTab[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: "operacao",
    label: "Operação",
    subs: [
      { value: "board", label: "Roleta ao vivo" },
      { value: "pendentes", label: "Leads pendentes" },
      { value: "bloqueados", label: "Bloqueados" },
    ],
  },
  {
    key: "leads",
    label: "Leads",
    subs: [
      { value: "gerados", label: "Gerados" },
      { value: "roletagens", label: "Histórico" },
      { value: "perdidos", label: "Perdidos" },
      { value: "whatsapp", label: "WhatsApp" },
    ],
  },
  {
    key: "inteligencia",
    label: "Inteligência",
    subs: [
      { value: "metricas", label: "Métricas" },
      { value: "inteligencia", label: "Análise IA" },
    ],
  },
  {
    key: "config",
    label: "Config",
    subs: [
      { value: "parametros", label: "Parâmetros & Segmentos" },
      { value: "performance", label: "Performance" },
    ],
  },
];

export function CentralRoletaCeo() {
  const roleta = useRoleta();
  const { loading, fila, pendentesCount } = roleta;
  const windowInfo = getCurrentWindowInfo();

  const [activeGroup, setActiveGroup] = useState("operacao");
  const [activeSub, setActiveSub] = useState("board");
  const [showIncluirModal, setShowIncluirModal] = useState(false);

  const credenciadosAtivos = new Set(fila.map((f) => f.corretor_id)).size;

  const navigate = (group: string, sub: string) => {
    setActiveGroup(group);
    setActiveSub(sub);
  };

  const currentGroup = NAV_GROUPS.find((g) => g.key === activeGroup) ?? NAV_GROUPS[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-muted/30 p-4 md:p-6 -m-4 md:-m-6 min-h-full space-y-4">
      <PageHeader
        title="Central de Roleta"
        subtitle={`${windowInfo.emoji} ${windowInfo.descricao}`}
        icon={<Target size={18} strokeWidth={1.5} />}
        actions={
          <>
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 mr-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Próxima:</span>
              <CountdownTimer target={windowInfo.proximaTransicao} />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowIncluirModal(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1" /> Incluir
            </Button>
            <Button variant="outline" size="sm" onClick={() => roleta.reload()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
            </Button>
          </>
        }
      />

      {/* Status bar ao vivo */}
      <RoletaStatusBar
        credenciadosAtivos={credenciadosAtivos}
        pendentes={pendentesCount}
        onNavigate={navigate}
      />

      {/* Navegação em dois níveis */}
      <div className="space-y-2">
        {/* Grupos (segmented control) */}
        <div className="inline-flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
          {NAV_GROUPS.map((g) => {
            const active = g.key === activeGroup;
            const badge =
              g.key === "operacao" && pendentesCount > 0 ? pendentesCount : undefined;
            return (
              <button
                key={g.key}
                onClick={() => {
                  setActiveGroup(g.key);
                  setActiveSub(g.subs[0].value);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {g.label}
                {badge !== undefined && (
                  <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                    {badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Sub-abas do grupo ativo */}
        <div className="flex flex-wrap items-center gap-1 overflow-x-auto">
          {currentGroup.subs.map((sub) => {
            const active = sub.value === activeSub;
            return (
              <button
                key={sub.value}
                onClick={() => setActiveSub(sub.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors whitespace-nowrap",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {sub.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo */}
      <div>
        {activeSub === "board" && <RoletaOperacaoTab roleta={roleta} />}
        {activeSub === "pendentes" && <PendingLeadsPanel />}
        {activeSub === "bloqueados" && <CorretoresBloqueadosPanel />}
        {activeSub === "gerados" && <LeadsGeradosTab />}
        {activeSub === "roletagens" && <RoletagensTab view="roletagens" />}
        {activeSub === "perdidos" && <RoletagensTab view="perdidos" />}
        {activeSub === "whatsapp" && <WhatsAppEntradasTab />}
        {activeSub === "metricas" && <RoletaMetricasTab />}
        {activeSub === "inteligencia" && <LeadIntelligenceTab />}
        {activeSub === "parametros" && <RoletaConfigTab />}
        {activeSub === "performance" && <DistributionDashboard />}
      </div>

      {/* Modal de incluir — acessível de qualquer aba */}
      <RoletaIncluirModal
        roleta={roleta}
        open={showIncluirModal}
        onOpenChange={setShowIncluirModal}
      />
    </div>
  );
}
