import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { DateFilterProvider } from "@/contexts/DateFilterContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";
import AppLayout from "@/components/AppLayout";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
const PagadoriaSolicitacoes = lazy(() => import("./pages/PagadoriaSolicitacoes"));
const ComissoesPage = lazy(() => import("./pages/ComissoesPage"));
const MarketingCentral = lazy(() => import("./pages/MarketingCentral"));
const HomiAna = lazy(() => import("./pages/HomiAna"));
const TarefasPage = lazy(() => import("./pages/TarefasPage"));
const BackofficeCentral = lazy(() => import("./pages/BackofficeCentral"));
const MinhasTarefas = lazy(() => import("./pages/MinhasTarefas"));
const MinhasVitrines = lazy(() => import("./pages/MinhasVitrines"));
const BaseConhecimento = lazy(() => import("./pages/BaseConhecimento"));
const TemplatesComunicacao = lazy(() => import("./pages/TemplatesComunicacao"));
const AcademiaPage = lazy(() => import("./pages/AcademiaPage"));
const AcademiaTrilhaPage = lazy(() => import("./pages/AcademiaTrilhaPage"));
const AcademiaAulaPage = lazy(() => import("./pages/AcademiaAulaPage"));
const AcademiaGerenciarPage = lazy(() => import("./pages/AcademiaGerenciarPage"));
const GerenteDashboard = lazy(() => import("./pages/GerenteDashboard"));
const RoletaLeads = lazy(() => import("./pages/RoletaLeads"));
const ImoveisPage = lazy(() => import("./pages/ImoveisPage"));
const VitrinePage = lazy(() => import("./pages/VitrinePage"));
const ImovelPage = lazy(() => import("./pages/ImovelPage"));
const PosVendas = lazy(() => import("./pages/PosVendas"));
const MelnickDay = lazy(() => import("./pages/MelnickDay"));
const OrygemCampanha = lazy(() => import("./pages/OrygemCampanha"));
const MegaCyrela = lazy(() => import("./pages/MegaCyrela"));
const VendasRealizadas = lazy(() => import("./pages/VendasRealizadas"));
const AnunciosNoAr = lazy(() => import("./pages/AnunciosNoAr"));
const IntegracaoJetimob = lazy(() => import("./pages/IntegracaoJetimob"));
const CadastrosPage = lazy(() => import("./pages/CadastrosPage"));

// RH pages
const RhDashboard = lazy(() => import("./pages/RhDashboard"));
const RhRecrutamento = lazy(() => import("./pages/RhRecrutamento"));
const RhConversas = lazy(() => import("./pages/RhConversas"));
const RhSalaReuniao = lazy(() => import("./pages/RhSalaReuniao"));
const RhEntrevistas = lazy(() => import("./pages/RhEntrevistas"));
const DevAIPage = lazy(() => import("./pages/DevAIPage"));
const AlertasPage = lazy(() => import("./pages/AlertasPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min default cache
      gcTime: 1000 * 60 * 5,    // 5 min garbage collection
      refetchOnWindowFocus: false,
      refetchIntervalInBackground: false, // stop all polling when tab is inactive
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
function ProtectedPage({ children, roles }: { children: React.ReactNode; roles?: ("admin" | "gestor" | "corretor" | "backoffice" | "rh")[] }) {
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
        <DateFilterProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Suspense fallback={<PageLoader />}><Auth /></Suspense>} />
            <Route path="/welcome" element={<Suspense fallback={<PageLoader />}><Welcome /></Suspense>} />
            <Route path="/visita/:token" element={<Suspense fallback={<PageLoader />}><VisitaConfirmacao /></Suspense>} />
            <Route path="/indica/:codigo" element={<Suspense fallback={<PageLoader />}><ReferralPage /></Suspense>} />
            <Route path="/vitrine/:id" element={<Suspense fallback={<PageLoader />}><VitrinePage /></Suspense>} />
            <Route path="/imovel/:codigo" element={<Suspense fallback={<PageLoader />}><ImovelPage /></Suspense>} />
            {/* Acessível a todos os autenticados */}
            <Route path="/" element={<ProtectedPage><ErrorBoundary module="home-dashboard"><HomeDashboard /></ErrorBoundary></ProtectedPage>} />

            {/* Gestão Comercial — gestor + admin */}
            <Route path="/gerente/dashboard" element={<ProtectedPage roles={["gestor", "admin"]}><ErrorBoundary module="gerente-dashboard"><GerenteDashboard /></ErrorBoundary></ProtectedPage>} />
            <Route path="/central-do-gerente" element={<ProtectedPage roles={["gestor", "admin"]}><ErrorBoundary module="checkpoint"><CheckpointGerente /></ErrorBoundary></ProtectedPage>} />
            
            <Route path="/central-dados" element={<ProtectedPage roles={["gestor", "admin"]}><ErrorBoundary module="central-dados"><CentralDados /></ErrorBoundary></ProtectedPage>} />
            <Route path="/scripts" element={<ProtectedPage><ErrorBoundary module="scripts"><ScriptsGenerator /></ErrorBoundary></ProtectedPage>} />
            <Route path="/gestao" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="gestao"><GestorDashboard /></ErrorBoundary></ProtectedPage>} />
            <Route path="/relatorios" element={<ProtectedPage roles={["gestor", "admin"]}><ErrorBoundary module="relatorios"><RelatorioCorretor /></ErrorBoundary></ProtectedPage>} />
            <Route path="/ranking" element={<ProtectedPage><ErrorBoundary module="ranking"><RankingEquipe /></ErrorBoundary></ProtectedPage>} />
            <Route path="/meu-time" element={<ProtectedPage roles={["gestor", "admin"]}><ErrorBoundary module="meu-time"><MeuTime /></ErrorBoundary></ProtectedPage>} />
            <Route path="/oferta-ativa" element={<ProtectedPage><ErrorBoundary module="oferta-ativa"><OfertaAtiva /></ErrorBoundary></ProtectedPage>} />
            <Route path="/roleta" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="roleta"><RoletaLeads /></ErrorBoundary></ProtectedPage>} />
            <Route path="/marketplace" element={<ProtectedPage><ErrorBoundary module="marketplace"><MarketplaceScripts /></ErrorBoundary></ProtectedPage>} />
            <Route path="/pipeline-leads" element={<ProtectedPage><ErrorBoundary module="pipeline"><PipelineKanban /></ErrorBoundary></ProtectedPage>} />
            <Route path="/escala-diaria" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="escala-diaria"><EscalaDiaria /></ErrorBoundary></ProtectedPage>} />
            <Route path="/disponibilidade" element={<ProtectedPage roles={["gestor", "admin"]}><ErrorBoundary module="disponibilidade"><DisponibilidadePage /></ErrorBoundary></ProtectedPage>} />
            <Route path="/automacoes" element={<ProtectedPage roles={["gestor", "admin"]}><ErrorBoundary module="automacoes"><AutomacoesPage /></ErrorBoundary></ProtectedPage>} />
            <Route path="/templates-comunicacao" element={<ProtectedPage roles={["gestor", "admin"]}><ErrorBoundary module="templates-comunicacao"><TemplatesComunicacao /></ErrorBoundary></ProtectedPage>} />

            {/* Corretor — todos autenticados */}
            <Route path="/corretor" element={<ProtectedPage><ErrorBoundary module="corretor-dashboard"><CorretorDashboard /></ErrorBoundary></ProtectedPage>} />
            <Route path="/aceite" element={<ProtectedPage><ErrorBoundary module="aceite-leads"><AceiteLeads /></ErrorBoundary></ProtectedPage>} />
            <Route path="/minhas-tarefas" element={<ProtectedPage><ErrorBoundary module="minhas-tarefas"><MinhasTarefas /></ErrorBoundary></ProtectedPage>} />
            <Route path="/minhas-vitrines" element={<ProtectedPage><ErrorBoundary module="minhas-vitrines"><MinhasVitrines /></ErrorBoundary></ProtectedPage>} />
            <Route path="/corretor/call" element={<ProtectedPage><ErrorBoundary module="corretor-call"><CorretorCall /></ErrorBoundary></ProtectedPage>} />
            <Route path="/agenda-visitas" element={<ProtectedPage><ErrorBoundary module="agenda-visitas"><AgendaVisitas /></ErrorBoundary></ProtectedPage>} />
            <Route path="/corretor/resumo" element={<ProtectedPage><ErrorBoundary module="corretor-resumo"><CorretorResumo /></ErrorBoundary></ProtectedPage>} />
            <Route path="/corretor/ranking-equipes" element={<ProtectedPage><ErrorBoundary module="corretor-ranking"><RankingEquipe /></ErrorBoundary></ProtectedPage>} />
            <Route path="/conquistas" element={<ProtectedPage><ErrorBoundary module="conquistas"><Conquistas /></ErrorBoundary></ProtectedPage>} />
            <Route path="/academia" element={<ProtectedPage><ErrorBoundary module="academia"><AcademiaPage /></ErrorBoundary></ProtectedPage>} />
            <Route path="/academia/trilha/:trilhaId" element={<ProtectedPage><ErrorBoundary module="academia-trilha"><AcademiaTrilhaPage /></ErrorBoundary></ProtectedPage>} />
            <Route path="/academia/aula/:aulaId" element={<ProtectedPage><ErrorBoundary module="academia-aula"><AcademiaAulaPage /></ErrorBoundary></ProtectedPage>} />
            <Route path="/academia/gerenciar" element={<ProtectedPage roles={["gestor", "admin"]}><ErrorBoundary module="academia-gerenciar"><AcademiaGerenciarPage /></ErrorBoundary></ProtectedPage>} />
            <Route path="/onboarding" element={<ProtectedPage><ErrorBoundary module="onboarding"><Onboarding /></ErrorBoundary></ProtectedPage>} />
            <Route path="/homi" element={<ProtectedPage><ErrorBoundary module="homi"><HomiAssistant /></ErrorBoundary></ProtectedPage>} />
            <Route path="/homi-gerente" element={<ProtectedPage roles={["gestor", "admin"]}><ErrorBoundary module="homi-gerente"><HomiGerencial /></ErrorBoundary></ProtectedPage>} />
            <Route path="/homi-ceo" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="homi-ceo"><HomiCeo /></ErrorBoundary></ProtectedPage>} />
            <Route path="/homi/base-conhecimento" element={<ProtectedPage roles={["admin", "gestor"]}><ErrorBoundary module="base-conhecimento"><BaseConhecimento /></ErrorBoundary></ProtectedPage>} />
            <Route path="/pipeline-negocios" element={<ProtectedPage><ErrorBoundary module="negocios"><MeusNegocios /></ErrorBoundary></ProtectedPage>} />
            <Route path="/vendas-realizadas" element={<ProtectedPage><ErrorBoundary module="vendas-realizadas"><VendasRealizadas /></ErrorBoundary></ProtectedPage>} />
            <Route path="/pos-vendas" element={<ProtectedPage><ErrorBoundary module="pos-vendas"><PosVendas /></ErrorBoundary></ProtectedPage>} />
            <Route path="/imoveis" element={<ProtectedPage><ErrorBoundary module="imoveis"><ImoveisPage /></ErrorBoundary></ProtectedPage>} />
            <Route path="/melnick-day" element={<ProtectedPage><ErrorBoundary module="melnick-day"><MelnickDay /></ErrorBoundary></ProtectedPage>} />
            <Route path="/orygem-60" element={<ProtectedPage><ErrorBoundary module="orygem-60"><OrygemCampanha /></ErrorBoundary></ProtectedPage>} />
            <Route path="/mega-cyrela" element={<ProtectedPage><ErrorBoundary module="mega-cyrela"><MegaCyrela /></ErrorBoundary></ProtectedPage>} />
            <Route path="/anuncios" element={<ProtectedPage><ErrorBoundary module="anuncios"><AnunciosNoAr /></ErrorBoundary></ProtectedPage>} />

            {/* Busca de Leads / Higienização — gestor + admin */}
            <Route path="/busca-leads" element={<ProtectedPage roles={["gestor", "admin"]}><ErrorBoundary module="busca-leads"><BuscaLeads /></ErrorBoundary></ProtectedPage>} />
            <Route path="/configuracoes" element={<ProtectedPage><ErrorBoundary module="configuracoes"><Configuracoes /></ErrorBoundary></ProtectedPage>} />
            <Route path="/notificacoes" element={<ProtectedPage><ErrorBoundary module="notificacoes"><Notificacoes /></ErrorBoundary></ProtectedPage>} />

            {/* Alertas — gestor + admin */}
            <Route path="/alertas" element={<ProtectedPage roles={["gestor", "admin"]}><ErrorBoundary module="alertas"><AlertasPage /></ErrorBoundary></ProtectedPage>} />

            {/* CEO / Admin only */}
            <Route path="/ceo" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="ceo-dashboard"><CeoDashboard /></ErrorBoundary></ProtectedPage>} />
            <Route path="/marketing" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="marketing"><MarketingDashboard /></ErrorBoundary></ProtectedPage>} />
            <Route path="/auditoria" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="auditoria"><AuditDashboard /></ErrorBoundary></ProtectedPage>} />
            <Route path="/admin" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="admin"><AdminPanel /></ErrorBoundary></ProtectedPage>} />
            <Route path="/integracao" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="integracao"><IntegracaoJetimob /></ErrorBoundary></ProtectedPage>} />
            <Route path="/dev-ai" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="dev-ai"><DevAIPage /></ErrorBoundary></ProtectedPage>} />

            {/* Backoffice — Ana Paula */}
            <Route path="/backoffice" element={<ProtectedPage roles={["backoffice", "admin"]}><ErrorBoundary module="backoffice"><BackofficeDashboard /></ErrorBoundary></ProtectedPage>} />
            <Route path="/backoffice/pagadorias" element={<ProtectedPage roles={["backoffice", "admin"]}><ErrorBoundary module="backoffice-pagadorias"><PagadoriasPage /></ErrorBoundary></ProtectedPage>} />
            <Route path="/backoffice/solicitacoes-pagadoria" element={<ProtectedPage roles={["backoffice", "admin"]}><ErrorBoundary module="backoffice-solicitacoes"><PagadoriaSolicitacoes /></ErrorBoundary></ProtectedPage>} />
            <Route path="/backoffice/comissoes" element={<ProtectedPage roles={["backoffice", "admin"]}><ErrorBoundary module="backoffice-comissoes"><ComissoesPage /></ErrorBoundary></ProtectedPage>} />
            <Route path="/backoffice/marketing" element={<ProtectedPage roles={["backoffice", "admin"]}><ErrorBoundary module="backoffice-marketing"><MarketingCentral /></ErrorBoundary></ProtectedPage>} />
            <Route path="/backoffice/homi-ana" element={<ProtectedPage roles={["backoffice", "admin"]}><ErrorBoundary module="homi-ana"><HomiAna /></ErrorBoundary></ProtectedPage>} />
            <Route path="/backoffice/tarefas" element={<ProtectedPage roles={["backoffice", "admin"]}><ErrorBoundary module="backoffice-tarefas"><BackofficeCentral /></ErrorBoundary></ProtectedPage>} />
            <Route path="/backoffice/cadastros" element={<ProtectedPage roles={["backoffice", "admin"]}><ErrorBoundary module="backoffice-cadastros"><CadastrosPage /></ErrorBoundary></ProtectedPage>} />

            {/* RH — Carol */}
            <Route path="/rh" element={<ProtectedPage roles={["rh", "admin"]}><ErrorBoundary module="rh"><RhDashboard /></ErrorBoundary></ProtectedPage>} />
            <Route path="/rh/recrutamento" element={<ProtectedPage roles={["rh", "admin"]}><ErrorBoundary module="rh-recrutamento"><RhRecrutamento /></ErrorBoundary></ProtectedPage>} />
            <Route path="/rh/entrevistas" element={<ProtectedPage roles={["rh", "admin"]}><ErrorBoundary module="rh-entrevistas"><RhEntrevistas /></ErrorBoundary></ProtectedPage>} />
            <Route path="/rh/conversas" element={<ProtectedPage roles={["rh", "admin"]}><ErrorBoundary module="rh-conversas"><RhConversas /></ErrorBoundary></ProtectedPage>} />
            <Route path="/rh/sala-reuniao" element={<ProtectedPage roles={["rh", "admin"]}><ErrorBoundary module="rh-sala-reuniao"><RhSalaReuniao /></ErrorBoundary></ProtectedPage>} />


            <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
          </Routes>
        </BrowserRouter>
        </DateFilterProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
