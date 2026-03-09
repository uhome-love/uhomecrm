import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";
import AppLayout from "@/components/AppLayout";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy load all pages including Auth and NotFound
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Lazy load all pages
const HomeDashboard = lazy(() => import("./pages/HomeDashboard"));
const GestorDashboard = lazy(() => import("./pages/GestorDashboard"));
const CorretorDashboard = lazy(() => import("./pages/CorretorDashboard"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const CheckpointGerente = lazy(() => import("./pages/CheckpointGerente"));
const CeoDashboard = lazy(() => import("./pages/CeoDashboard"));
const ScriptsGenerator = lazy(() => import("./pages/ScriptsGenerator"));
const RelatorioCorretor = lazy(() => import("./pages/RelatorioCorretor"));
const CentralDados = lazy(() => import("./pages/CentralDados"));

const MarketingDashboard = lazy(() => import("./pages/MarketingDashboard"));
const RankingComercial = lazy(() => import("./pages/RankingComercial"));
const AuditDashboard = lazy(() => import("./pages/AuditDashboard"));
const OfertaAtiva = lazy(() => import("./pages/OfertaAtiva"));
const MeuTime = lazy(() => import("./pages/MeuTime"));
const CorretorResumo = lazy(() => import("./pages/CorretorResumo"));
const RankingEquipe = lazy(() => import("./pages/RankingEquipe"));
const HomiAssistant = lazy(() => import("./pages/HomiAssistant"));
const HomiGerencial = lazy(() => import("./pages/HomiGerencial"));
const HomiCeo = lazy(() => import("./pages/HomiCeo"));
const BuscaLeads = lazy(() => import("./pages/BuscaLeads"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const AgendaVisitas = lazy(() => import("./pages/AgendaVisitas"));
const MeusNegocios = lazy(() => import("./pages/MeusNegocios"));
const PipelineKanban = lazy(() => import("./pages/PipelineKanban"));
const EscalaDiaria = lazy(() => import("./pages/EscalaDiaria"));
const Welcome = lazy(() => import("./pages/Welcome"));

const DisponibilidadePage = lazy(() => import("./pages/DisponibilidadePage"));
const AutomacoesPage = lazy(() => import("./pages/AutomacoesPage"));
const Notificacoes = lazy(() => import("./pages/Notificacoes"));
const VisitaConfirmacao = lazy(() => import("./pages/VisitaConfirmacao"));
const ReferralPage = lazy(() => import("./pages/ReferralPage"));
const Conquistas = lazy(() => import("./pages/Conquistas"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const MarketplaceScripts = lazy(() => import("./pages/MarketplaceScripts"));
const CorretorCall = lazy(() => import("./pages/CorretorCall"));
const AceiteLeads = lazy(() => import("./pages/AceiteLeads"));

// Backoffice pages
const BackofficeDashboard = lazy(() => import("./pages/BackofficeDashboard"));
const PagadoriasPage = lazy(() => import("./pages/PagadoriasPage"));
const ComissoesPage = lazy(() => import("./pages/ComissoesPage"));
const MarketingCentral = lazy(() => import("./pages/MarketingCentral"));
const HomiAna = lazy(() => import("./pages/HomiAna"));
const TarefasPage = lazy(() => import("./pages/TarefasPage"));
const MinhasTarefas = lazy(() => import("./pages/MinhasTarefas"));
const BaseConhecimento = lazy(() => import("./pages/BaseConhecimento"));
const TemplatesComunicacao = lazy(() => import("./pages/TemplatesComunicacao"));
const AcademiaPage = lazy(() => import("./pages/AcademiaPage"));
const AcademiaTrilhaPage = lazy(() => import("./pages/AcademiaTrilhaPage"));
const AcademiaAulaPage = lazy(() => import("./pages/AcademiaAulaPage"));
const AcademiaGerenciarPage = lazy(() => import("./pages/AcademiaGerenciarPage"));
const GerenteDashboard = lazy(() => import("./pages/GerenteDashboard"));
const RoletaLeads = lazy(() => import("./pages/RoletaLeads"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min default cache
      gcTime: 1000 * 60 * 5,    // 5 min garbage collection
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// Helper to wrap a page with layout + auth + role protection
function ProtectedPage({ children, roles }: { children: React.ReactNode; roles?: ("admin" | "gestor" | "corretor" | "backoffice")[] }) {
  if (roles) {
    return (
      <RoleProtectedRoute allowedRoles={roles}>
        <AppLayout>
          <Suspense fallback={<PageLoader />}>{children}</Suspense>
        </AppLayout>
      </RoleProtectedRoute>
    );
  }
  return (
    <ProtectedRoute>
      <AppLayout>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </AppLayout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Suspense fallback={<PageLoader />}><Auth /></Suspense>} />
            <Route path="/welcome" element={<Suspense fallback={<PageLoader />}><Welcome /></Suspense>} />
            <Route path="/visita/:token" element={<Suspense fallback={<PageLoader />}><VisitaConfirmacao /></Suspense>} />
            <Route path="/indica/:codigo" element={<Suspense fallback={<PageLoader />}><ReferralPage /></Suspense>} />
            {/* Acessível a todos os autenticados */}
            <Route path="/" element={<ProtectedPage><HomeDashboard /></ProtectedPage>} />

            {/* Gestão Comercial — gestor + admin */}
            <Route path="/gerente/dashboard" element={<ProtectedPage roles={["gestor", "admin"]}><GerenteDashboard /></ProtectedPage>} />
            <Route path="/checkpoint" element={<ProtectedPage roles={["gestor", "admin"]}><CheckpointGerente /></ProtectedPage>} />
            <Route path="/pdn" element={<ProtectedPage roles={["gestor", "admin"]}><PdnDashboard /></ProtectedPage>} />
            <Route path="/central-dados" element={<ProtectedPage roles={["gestor", "admin"]}><CentralDados /></ProtectedPage>} />
            <Route path="/scripts" element={<ProtectedPage><ScriptsGenerator /></ProtectedPage>} />
            <Route path="/gestao" element={<ProtectedPage roles={["admin"]}><GestorDashboard /></ProtectedPage>} />
            <Route path="/relatorios" element={<ProtectedPage roles={["gestor", "admin"]}><RelatorioCorretor /></ProtectedPage>} />
            <Route path="/ranking" element={<ProtectedPage><RankingEquipe /></ProtectedPage>} />
            <Route path="/meu-time" element={<ProtectedPage roles={["gestor", "admin"]}><MeuTime /></ProtectedPage>} />
            <Route path="/oferta-ativa" element={<ProtectedPage><OfertaAtiva /></ProtectedPage>} />
            <Route path="/roleta" element={<ProtectedPage roles={["admin"]}><RoletaLeads /></ProtectedPage>} />
            <Route path="/marketplace" element={<ProtectedPage><MarketplaceScripts /></ProtectedPage>} />
            <Route path="/pipeline" element={<ProtectedPage><PipelineKanban /></ProtectedPage>} />
            <Route path="/escala-diaria" element={<ProtectedPage roles={["admin"]}><EscalaDiaria /></ProtectedPage>} />
            <Route path="/disponibilidade" element={<ProtectedPage roles={["gestor", "admin"]}><DisponibilidadePage /></ProtectedPage>} />
            <Route path="/automacoes" element={<ProtectedPage roles={["gestor", "admin"]}><AutomacoesPage /></ProtectedPage>} />
            <Route path="/templates-comunicacao" element={<ProtectedPage roles={["gestor", "admin"]}><TemplatesComunicacao /></ProtectedPage>} />

            {/* Corretor — todos autenticados */}
            <Route path="/corretor" element={<ProtectedPage><CorretorDashboard /></ProtectedPage>} />
            <Route path="/aceite" element={<ProtectedPage><AceiteLeads /></ProtectedPage>} />
            <Route path="/minhas-tarefas" element={<ProtectedPage><MinhasTarefas /></ProtectedPage>} />
            <Route path="/corretor/call" element={<ProtectedPage><CorretorCall /></ProtectedPage>} />
            <Route path="/agenda-visitas" element={<ProtectedPage><AgendaVisitas /></ProtectedPage>} />
            <Route path="/corretor/resumo" element={<ProtectedPage><CorretorResumo /></ProtectedPage>} />
            <Route path="/corretor/ranking-equipes" element={<ProtectedPage><RankingEquipe /></ProtectedPage>} />
            <Route path="/conquistas" element={<ProtectedPage><Conquistas /></ProtectedPage>} />
            <Route path="/academia" element={<ProtectedPage><AcademiaPage /></ProtectedPage>} />
            <Route path="/academia/trilha/:trilhaId" element={<ProtectedPage><AcademiaTrilhaPage /></ProtectedPage>} />
            <Route path="/academia/aula/:aulaId" element={<ProtectedPage><AcademiaAulaPage /></ProtectedPage>} />
            <Route path="/academia/gerenciar" element={<ProtectedPage roles={["gestor", "admin"]}><AcademiaGerenciarPage /></ProtectedPage>} />
            <Route path="/onboarding" element={<ProtectedPage><Onboarding /></ProtectedPage>} />
            <Route path="/homi" element={<ProtectedPage><HomiAssistant /></ProtectedPage>} />
            <Route path="/homi-gerente" element={<ProtectedPage roles={["gestor", "admin"]}><HomiGerencial /></ProtectedPage>} />
            <Route path="/homi-ceo" element={<ProtectedPage roles={["admin"]}><HomiCeo /></ProtectedPage>} />
            <Route path="/homi/base-conhecimento" element={<ProtectedPage roles={["admin", "gestor"]}><BaseConhecimento /></ProtectedPage>} />
            <Route path="/meus-negocios" element={<ProtectedPage><MeusNegocios /></ProtectedPage>} />
            <Route path="/pos-vendas" element={<ProtectedPage roles={["gestor", "admin"]}><PosVendas /></ProtectedPage>} />

            {/* Busca de Leads / Higienização — gestor + admin */}
            <Route path="/busca-leads" element={<ProtectedPage roles={["gestor", "admin"]}><BuscaLeads /></ProtectedPage>} />
            <Route path="/configuracoes" element={<ProtectedPage><Configuracoes /></ProtectedPage>} />
            <Route path="/notificacoes" element={<ProtectedPage><Notificacoes /></ProtectedPage>} />

            {/* CEO / Admin only */}
            <Route path="/ceo" element={<ProtectedPage roles={["admin"]}><CeoDashboard /></ProtectedPage>} />
            <Route path="/marketing" element={<ProtectedPage roles={["admin"]}><MarketingDashboard /></ProtectedPage>} />
            <Route path="/auditoria" element={<ProtectedPage roles={["admin"]}><AuditDashboard /></ProtectedPage>} />
            <Route path="/admin" element={<ProtectedPage roles={["admin"]}><AdminPanel /></ProtectedPage>} />

            {/* Backoffice — Ana Paula */}
            <Route path="/backoffice" element={<ProtectedPage roles={["backoffice", "admin"]}><BackofficeDashboard /></ProtectedPage>} />
            <Route path="/backoffice/pagadorias" element={<ProtectedPage roles={["backoffice", "admin"]}><PagadoriasPage /></ProtectedPage>} />
            <Route path="/backoffice/comissoes" element={<ProtectedPage roles={["backoffice", "admin"]}><ComissoesPage /></ProtectedPage>} />
            <Route path="/backoffice/marketing" element={<ProtectedPage roles={["backoffice", "admin"]}><MarketingCentral /></ProtectedPage>} />
            <Route path="/backoffice/homi-ana" element={<ProtectedPage roles={["backoffice", "admin"]}><HomiAna /></ProtectedPage>} />
            <Route path="/backoffice/tarefas" element={<ProtectedPage roles={["backoffice", "admin"]}><TarefasPage /></ProtectedPage>} />
            

            <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
