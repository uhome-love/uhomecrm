import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
// @ts-ignore - QueryClient is exported in @tanstack/react-query v5
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { DateFilterProvider } from "@/contexts/DateFilterContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import { TabProvider } from "@/contexts/TabContext";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Retry wrapper for lazy imports — handles stale chunk errors after deployments
function lazyRetry(factory: () => Promise<any>) {
  return lazy(() =>
    factory().catch((err) => {
      const key = "chunk_reload";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return new Promise(() => {});
      }
      sessionStorage.removeItem(key);
      throw err;
    })
  );
}

// Only public/unprotected pages need lazy imports here
// All protected pages are loaded via pageRegistry.ts
const Auth = lazyRetry(() => import("./pages/Auth"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const Welcome = lazyRetry(() => import("./pages/Welcome"));
const VisitaConfirmacao = lazyRetry(() => import("./pages/VisitaConfirmacao"));
const ReferralPage = lazyRetry(() => import("./pages/ReferralPage"));
const VitrinePage = lazyRetry(() => import("./pages/VitrinePage"));
const ImovelPage = lazyRetry(() => import("./pages/ImovelPage"));
const WhatsAppLanding = lazyRetry(() => import("./pages/WhatsAppLanding"));
const PrivacidadePage = lazyRetry(() => import("./pages/PrivacidadePage"));
const CasaTuaLanding = lazyRetry(() => import("./pages/CasaTuaLanding"));
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <DateFilterProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes — no auth required */}
              <Route path="/auth" element={<Suspense fallback={<PageLoader />}><Auth /></Suspense>} />
              <Route path="/welcome" element={<Suspense fallback={<PageLoader />}><Welcome /></Suspense>} />
              <Route path="/visita/:token" element={<Suspense fallback={<PageLoader />}><VisitaConfirmacao /></Suspense>} />
              <Route path="/indica/:codigo" element={<Suspense fallback={<PageLoader />}><ReferralPage /></Suspense>} />
              <Route path="/vitrine/:id" element={<Suspense fallback={<PageLoader />}><VitrinePage /></Suspense>} />
              <Route path="/imovel/:codigo" element={<Suspense fallback={<PageLoader />}><ImovelPage /></Suspense>} />
              <Route path="/wa" element={<Suspense fallback={<PageLoader />}><WhatsAppLanding /></Suspense>} />
              <Route path="/wa/*" element={<Suspense fallback={<PageLoader />}><WhatsAppLanding /></Suspense>} />
              <Route path="/privacidade" element={<Suspense fallback={<PageLoader />}><PrivacidadePage /></Suspense>} />
              <Route path="/casatua" element={<Suspense fallback={<PageLoader />}><CasaTuaLanding /></Suspense>} />
              <Route path="/placar-do-dia" element={<Suspense fallback={<PageLoader />}><PlacarDoDia /></Suspense>} />

              {/* Redirects */}
              <Route path="/fechamento-day" element={<Navigate to="/placar-do-dia" replace />} />
              <Route path="/gestao" element={<Navigate to="/gerente/dashboard" replace />} />

              {/* All authenticated routes — rendered via Chrome-style tab system */}
              <Route path="/*" element={
                <ProtectedRoute>
                  <TabProvider>
                    <AppLayout />
                  </TabProvider>
                </ProtectedRoute>
              } />
            </Routes>
          </BrowserRouter>
        </DateFilterProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
