import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
// @ts-ignore - QueryClient is exported in @tanstack/react-query v5
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

// Retry wrapper for lazy imports — handles stale chunk errors after deployments
function lazyRetry(factory: () => Promise<any>) {
  return lazy(() =>
    factory().catch((err) => {
      // If chunk failed to load, try a hard reload once
      const key = "chunk_reload";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return new Promise(() => {}); // never resolves — page will reload
      }
      sessionStorage.removeItem(key);
      throw err;
    })
  );
}

// Lazy load all pages including Auth and NotFound
const Auth = lazyRetry(() => import("./pages/Auth"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));

// Lazy load all pages
const HomeDashboard = lazyRetry(() => import("./pages/HomeDashboard"));
const GestorDashboard = lazyRetry(() => import("./pages/GestorDashboard"));
const CorretorDashboard = lazyRetry(() => import("./pages/CorretorDashboard"));
const AdminPanel = lazyRetry(() => import("./pages/AdminPanel"));
const CheckpointGerente = lazyRetry(() => import("./pages/CheckpointGerente"));
const CeoDashboard = lazyRetry(() => import("./pages/CeoDashboard"));
const ScriptsGenerator = lazyRetry(() => import("./pages/ScriptsGenerator"));
const RelatorioCorretor = lazyRetry(() => import("./pages/RelatorioCorretor"));
const CentralDados = lazyRetry(() => import("./pages/CentralDados"));

const MarketingDashboard = lazyRetry(() => import("./pages/MarketingDashboard"));
const RankingComercial = lazyRetry(() => import("./pages/RankingComercial"));
const AuditDashboard = lazyRetry(() => import("./pages/AuditDashboard"));
const OfertaAtiva = lazyRetry(() => import("./pages/OfertaAtiva"));
const MeuTime = lazyRetry(() => import("./pages/MeuTime"));
const CorretorResumo = lazyRetry(() => import("./pages/CorretorResumo"));
const RankingEquipe = lazyRetry(() => import("./pages/RankingEquipe"));
const HomiAssistant = lazyRetry(() => import("./pages/HomiAssistant"));
const HomiGerencial = lazyRetry(() => import("./pages/HomiGerencial"));
const HomiCeo = lazyRetry(() => import("./pages/HomiCeo"));
const BuscaLeads = lazyRetry(() => import("./pages/BuscaLeads"));
const Configuracoes = lazyRetry(() => import("./pages/Configuracoes"));
const AgendaVisitas = lazyRetry(() => import("./pages/AgendaVisitas"));
const MeusNegocios = lazyRetry(() => import("./pages/MeusNegocios"));
const PipelineKanban = lazyRetry(() => import("./pages/PipelineKanban"));
const EscalaDiaria = lazyRetry(() => import("./pages/EscalaDiaria"));
const Welcome = lazyRetry(() => import("./pages/Welcome"));

const DisponibilidadePage = lazyRetry(() => import("./pages/DisponibilidadePage"));
const AutomacoesPage = lazyRetry(() => import("./pages/AutomacoesPage"));
const Notificacoes = lazyRetry(() => import("./pages/Notificacoes"));
const VisitaConfirmacao = lazyRetry(() => import("./pages/VisitaConfirmacao"));
const ReferralPage = lazyRetry(() => import("./pages/ReferralPage"));
const Conquistas = lazyRetry(() => import("./pages/Conquistas"));
const Onboarding = lazyRetry(() => import("./pages/Onboarding"));
const MarketplaceScripts = lazyRetry(() => import("./pages/MarketplaceScripts"));
const CorretorCall = lazyRetry(() => import("./pages/CorretorCall"));
const CorretorProgresso = lazyRetry(() => import("./pages/CorretorProgresso"));
const AceiteLeads = lazyRetry(() => import("./pages/AceiteLeads"));

// Backoffice pages
const BackofficeDashboard = lazyRetry(() => import("./pages/BackofficeDashboard"));
const PagadoriasPage = lazyRetry(() => import("./pages/PagadoriasPage"));
const PagadoriaSolicitacoes = lazyRetry(() => import("./pages/PagadoriaSolicitacoes"));
const ComissoesPage = lazyRetry(() => import("./pages/ComissoesPage"));
const MarketingCentral = lazyRetry(() => import("./pages/MarketingCentral"));
const HomiAna = lazyRetry(() => import("./pages/HomiAna"));
const TarefasPage = lazyRetry(() => import("./pages/TarefasPage"));
const BackofficeCentral = lazyRetry(() => import("./pages/BackofficeCentral"));
const MinhasTarefas = lazyRetry(() => import("./pages/MinhasTarefas"));
const MinhasVitrines = lazyRetry(() => import("./pages/MinhasVitrines"));
const BaseConhecimento = lazyRetry(() => import("./pages/BaseConhecimento"));
const TemplatesComunicacao = lazyRetry(() => import("./pages/TemplatesComunicacao"));
const AcademiaPage = lazyRetry(() => import("./pages/AcademiaPage"));
const AcademiaTrilhaPage = lazyRetry(() => import("./pages/AcademiaTrilhaPage"));
const AcademiaAulaPage = lazyRetry(() => import("./pages/AcademiaAulaPage"));
const AcademiaGerenciarPage = lazyRetry(() => import("./pages/AcademiaGerenciarPage"));
const GerenteDashboard = lazyRetry(() => import("./pages/GerenteDashboard"));
const RoletaLeads = lazyRetry(() => import("./pages/RoletaLeads"));
const ImoveisPage = lazyRetry(() => import("./pages/ImoveisPageNew"));
const VitrinePage = lazyRetry(() => import("./pages/VitrinePage"));
const ImovelPage = lazyRetry(() => import("./pages/ImovelPage"));
const PosVendas = lazyRetry(() => import("./pages/PosVendas"));
const MelnickDay = lazyRetry(() => import("./pages/MelnickDay"));
const MelnickMetas = lazyRetry(() => import("./pages/MelnickMetas"));
const OrygemCampanha = lazyRetry(() => import("./pages/OrygemCampanha"));
const MegaCyrela = lazyRetry(() => import("./pages/MegaCyrela"));
const VendasRealizadas = lazyRetry(() => import("./pages/VendasRealizadas"));
const RelatorioSemanal = lazyRetry(() => import("./pages/RelatorioSemanal"));
const AnunciosNoAr = lazyRetry(() => import("./pages/AnunciosNoAr"));
const IntegracaoJetimob = lazyRetry(() => import("./pages/IntegracaoJetimob"));
const CadastrosPage = lazyRetry(() => import("./pages/CadastrosPage"));
const DiagnosticoSite = lazyRetry(() => import("./pages/DiagnosticoSite"));
const LinksSite = lazyRetry(() => import("./pages/LinksSite"));

// RH pages
const RhDashboard = lazyRetry(() => import("./pages/RhDashboard"));
const RhRecrutamento = lazyRetry(() => import("./pages/RhRecrutamento"));
const RhConversas = lazyRetry(() => import("./pages/RhConversas"));
const RhSalaReuniao = lazyRetry(() => import("./pages/RhSalaReuniao"));
const RhEntrevistas = lazyRetry(() => import("./pages/RhEntrevistas"));
const DevAIPage = lazyRetry(() => import("./pages/DevAIPage"));

const MelnickDayLanding = lazyRetry(() => import("./pages/MelnickDayLanding"));
const WhatsAppLanding = lazyRetry(() => import("./pages/WhatsAppLanding"));
const CampaignAnalyticsPage = lazyRetry(() => import("./pages/CampaignAnalyticsPage"));
const ImportBrevoContacts = lazyRetry(() => import("./pages/ImportBrevoContacts"));
const PrivacidadePage = lazyRetry(() => import("./pages/PrivacidadePage"));
const WhatsAppCampaignDispatcher = lazyRetry(() => import("./pages/WhatsAppCampaignDispatcherPage"));
const EmailMarketingPage = lazyRetry(() => import("./pages/EmailMarketingPage"));
const DisparadorLigacoesIA = lazyRetry(() => import("./pages/DisparadorLigacoesIA"));
const PlacarDoDia = lazyRetry(() => import("./pages/PlacarDoDia"));

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
             <Route path="/melnickday" element={<Suspense fallback={<PageLoader />}><MelnickDayLanding /></Suspense>} />
             <Route path="/md" element={<Suspense fallback={<PageLoader />}><MelnickDayLanding /></Suspense>} />
              <Route path="/wa" element={<Suspense fallback={<PageLoader />}><WhatsAppLanding /></Suspense>} />
              <Route path="/wa/*" element={<Suspense fallback={<PageLoader />}><WhatsAppLanding /></Suspense>} />
             <Route path="/import-brevo-contacts" element={<Suspense fallback={<PageLoader />}><ImportBrevoContacts /></Suspense>} />
              <Route path="/privacidade" element={<Suspense fallback={<PageLoader />}><PrivacidadePage /></Suspense>} />
              <Route path="/placar-do-dia" element={<Suspense fallback={<PageLoader />}><PlacarDoDia /></Suspense>} />
              <Route path="/fechamento-day" element={<Suspense fallback={<PageLoader />}><PlacarDoDia /></Suspense>} />
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
            <Route path="/automacoes" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="automacoes"><AutomacoesPage /></ErrorBoundary></ProtectedPage>} />
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
            <Route path="/progresso" element={<ProtectedPage><ErrorBoundary module="progresso"><CorretorProgresso /></ErrorBoundary></ProtectedPage>} />
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
            <Route path="/links-site" element={<ProtectedPage><ErrorBoundary module="links-site"><LinksSite /></ErrorBoundary></ProtectedPage>} />
            <Route path="/notificacoes" element={<ProtectedPage><ErrorBoundary module="notificacoes"><Notificacoes /></ErrorBoundary></ProtectedPage>} />


            {/* CEO / Admin only */}
            <Route path="/ceo" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="ceo-dashboard"><CeoDashboard /></ErrorBoundary></ProtectedPage>} />
            <Route path="/relatorio-semanal" element={<ProtectedPage roles={["admin", "gestor", "corretor"]}><ErrorBoundary module="relatorio-semanal"><RelatorioSemanal /></ErrorBoundary></ProtectedPage>} />
            <Route path="/marketing" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="marketing"><MarketingDashboard /></ErrorBoundary></ProtectedPage>} />
            <Route path="/auditoria" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="auditoria"><AuditDashboard /></ErrorBoundary></ProtectedPage>} />
            <Route path="/admin" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="admin"><AdminPanel /></ErrorBoundary></ProtectedPage>} />
            <Route path="/integracao" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="integracao"><IntegracaoJetimob /></ErrorBoundary></ProtectedPage>} />
            <Route path="/dev-ai" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="dev-ai"><DevAIPage /></ErrorBoundary></ProtectedPage>} />
            <Route path="/admin/diagnostico-site" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="diagnostico-site"><DiagnosticoSite /></ErrorBoundary></ProtectedPage>} />
            <Route path="/campaign-analytics" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="campaign-analytics"><CampaignAnalyticsPage /></ErrorBoundary></ProtectedPage>} />
            <Route path="/disparador-whatsapp" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="disparador-whatsapp"><WhatsAppCampaignDispatcher /></ErrorBoundary></ProtectedPage>} />
            <Route path="/email-marketing" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="email-marketing"><EmailMarketingPage /></ErrorBoundary></ProtectedPage>} />
            <Route path="/disparador-ligacoes-ia" element={<ProtectedPage roles={["admin"]}><ErrorBoundary module="disparador-ligacoes-ia"><DisparadorLigacoesIA /></ErrorBoundary></ProtectedPage>} />
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
