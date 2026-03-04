import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import HomeDashboard from "./pages/HomeDashboard";
import GestorDashboard from "./pages/GestorDashboard";
import CorretorDashboard from "./pages/CorretorDashboard";
import AdminPanel from "./pages/AdminPanel";
import CheckpointGerente from "./pages/CheckpointGerente";
import CeoDashboard from "./pages/CeoDashboard";
import ScriptsGenerator from "./pages/ScriptsGenerator";
import RelatorioCorretor from "./pages/RelatorioCorretor";
import FunilDashboard from "./pages/FunilDashboard";
import ForecastDashboard from "./pages/ForecastDashboard";
import PdnDashboard from "./pages/PdnDashboard";
import MarketingDashboard from "./pages/MarketingDashboard";
import RankingComercial from "./pages/RankingComercial";
import AuditDashboard from "./pages/AuditDashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <HomeDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestao"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <GestorDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/corretor"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CorretorDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkpoint"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CheckpointGerente />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ceo"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CeoDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/scripts"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ScriptsGenerator />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/relatorios"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <RelatorioCorretor />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/funil"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <FunilDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/previsao"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ForecastDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pdn"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <PdnDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/marketing"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <MarketingDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ranking"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <RankingComercial />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AdminPanel />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/auditoria"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AuditDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
