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
const PdnDashboard = lazy(() => import("./pages/PdnDashboard"));
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

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// Helper to wrap a page with layout + auth + role protection
function ProtectedPage({ children, roles }: { children: React.ReactNode; roles?: ("admin" | "gestor" | "corretor")[] }) {
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
            {/* Acessível a todos os autenticados */}
            <Route path="/" element={<ProtectedPage><HomeDashboard /></ProtectedPage>} />

            {/* Gestão Comercial — gestor + admin */}
            <Route path="/checkpoint" element={<ProtectedPage roles={["gestor", "admin"]}><CheckpointGerente /></ProtectedPage>} />
            <Route path="/pdn" element={<ProtectedPage roles={["gestor", "admin"]}><PdnDashboard /></ProtectedPage>} />
            <Route path="/central-dados" element={<ProtectedPage roles={["gestor", "admin"]}><CentralDados /></ProtectedPage>} />
            <Route path="/scripts" element={<ProtectedPage><ScriptsGenerator /></ProtectedPage>} />
            <Route path="/gestao" element={<ProtectedPage roles={["admin"]}><GestorDashboard /></ProtectedPage>} />
            <Route path="/relatorios" element={<ProtectedPage roles={["gestor", "admin"]}><RelatorioCorretor /></ProtectedPage>} />
            <Route path="/ranking" element={<ProtectedPage roles={["gestor", "admin", "corretor"]}><RankingComercial /></ProtectedPage>} />
            <Route path="/meu-time" element={<ProtectedPage roles={["gestor", "admin"]}><MeuTime /></ProtectedPage>} />
            <Route path="/oferta-ativa" element={<ProtectedPage roles={["gestor", "admin"]}><OfertaAtiva /></ProtectedPage>} />
            <Route path="/pipeline" element={<ProtectedPage><PipelineKanban /></ProtectedPage>} />
            <Route path="/escala-diaria" element={<ProtectedPage roles={["gestor", "admin"]}><EscalaDiaria /></ProtectedPage>} />

            {/* Corretor — todos autenticados */}
            <Route path="/corretor" element={<ProtectedPage><CorretorDashboard /></ProtectedPage>} />
            <Route path="/agenda-visitas" element={<ProtectedPage><AgendaVisitas /></ProtectedPage>} />
            <Route path="/corretor/resumo" element={<ProtectedPage><CorretorResumo /></ProtectedPage>} />
            <Route path="/corretor/ranking-equipes" element={<ProtectedPage><RankingEquipe /></ProtectedPage>} />
            <Route path="/homi" element={<ProtectedPage><HomiAssistant /></ProtectedPage>} />
            <Route path="/homi-gerente" element={<ProtectedPage roles={["gestor", "admin"]}><HomiGerencial /></ProtectedPage>} />
            <Route path="/meus-negocios" element={<ProtectedPage><MeusNegocios /></ProtectedPage>} />

            {/* Busca de Leads / Higienização — gestor + admin */}
            <Route path="/busca-leads" element={<ProtectedPage roles={["gestor", "admin"]}><BuscaLeads /></ProtectedPage>} />
            <Route path="/configuracoes" element={<ProtectedPage><Configuracoes /></ProtectedPage>} />

            {/* CEO / Admin only */}
            <Route path="/ceo" element={<ProtectedPage roles={["admin"]}><CeoDashboard /></ProtectedPage>} />
            <Route path="/marketing" element={<ProtectedPage roles={["admin"]}><MarketingDashboard /></ProtectedPage>} />
            <Route path="/auditoria" element={<ProtectedPage roles={["admin"]}><AuditDashboard /></ProtectedPage>} />
            <Route path="/admin" element={<ProtectedPage roles={["admin"]}><AdminPanel /></ProtectedPage>} />

            <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
