import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
// @ts-ignore - QueryClient is exported in @tanstack/react-query v5
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { persistOptions } from "@/lib/queryPersist";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { DateFilterProvider } from "@/contexts/DateFilterContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import { TabProvider } from "@/contexts/TabContext";
import { lazy, Suspense } from "react";
import { PageTrackingProvider } from "@/components/PageTrackingProvider";
import { Loader2 } from "lucide-react";

// Retry wrapper for lazy imports — handles stale chunk errors after deployments
function lazyRetry(factory: () => Promise<any>) {
  return lazy(() =>
    factory().catch(async (err) => {
      const msg = String(err?.message || err);
      const isChunkErr =
        /Importing a module script failed|Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError/i.test(msg);
      if (!isChunkErr) throw err;

      const key = "chunk_reload_at";
      const last = Number(sessionStorage.getItem(key) || "0");
      const now = Date.now();
      if (now - last > 30_000) {
        sessionStorage.setItem(key, String(now));
        try {
          if ("caches" in window) {
            const names = await caches.keys();
            await Promise.all(names.map((n) => caches.delete(n)));
          }
        } catch {}
        const url = new URL(window.location.href);
        url.searchParams.set("_v", String(now));
        window.location.replace(url.toString());
        return new Promise(() => {});
      }
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
const OAuthGoogleCallback = lazyRetry(() => import("./pages/OAuthGoogleCallback"));
const DiagnosticoRede = lazyRetry(() => import("./pages/admin/DiagnosticoRede"));
const TelemetriaRede = lazyRetry(() => import("./pages/admin/TelemetriaRede"));
const IngestaoPanel = lazyRetry(() => import("./pages/admin/IngestaoPanel"));
const UsoPaginasPanel = lazyRetry(() => import("./pages/admin/UsoPaginasPanel"));
const CampanhaAtrio = lazyRetry(() => import("./pages/admin/CampanhaAtrio"));

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
  <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <DateFilterProvider>
          <BrowserRouter>
            <PageTrackingProvider>
            <Routes>
              {/* Public routes — no auth required */}
              <Route path="/auth" element={<Suspense fallback={<PageLoader />}><Auth /></Suspense>} />
              <Route path="/__sim_test" element={<Suspense fallback={<PageLoader />}><div className="p-4"><SimTest /></div></Suspense>} />
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
              <Route path="/oauth/google/callback" element={<Suspense fallback={<PageLoader />}><OAuthGoogleCallback /></Suspense>} />
              <Route path="/diagnostico-rede" element={<Suspense fallback={<PageLoader />}><DiagnosticoRede /></Suspense>} />
              <Route path="/ceo/telemetria-rede" element={<Suspense fallback={<PageLoader />}><TelemetriaRede /></Suspense>} />
              <Route path="/admin/ingestao" element={<Suspense fallback={<PageLoader />}><IngestaoPanel /></Suspense>} />
              <Route path="/admin/uso-paginas" element={<Suspense fallback={<PageLoader />}><UsoPaginasPanel /></Suspense>} />
              <Route path="/admin/campanha-atrio" element={<Suspense fallback={<PageLoader />}><CampanhaAtrio /></Suspense>} />

              {/* Redirects */}
              <Route path="/fechamento-day" element={<Navigate to="/placar-do-dia" replace />} />
              <Route path="/gestao" element={<Navigate to="/gerente/dashboard" replace />} />
              <Route path="/index" element={<Navigate to="/" replace />} />
              <Route path="/index.html" element={<Navigate to="/" replace />} />
              <Route path="/relatorio-semanal" element={<Navigate to="/central-relatorios?visao=executivo" replace />} />
              <Route path="/relatorios" element={<Navigate to="/central-relatorios?visao=um-a-um" replace />} />
              <Route path="/relatorios-1-1" element={<Navigate to="/central-relatorios?secao=geral" replace />} />
              <Route path="/links-site" element={<Navigate to="/imoveis?view=links" replace />} />
              <Route path="/disponibilidade" element={<Navigate to="/roleta" replace />} />

              {/* All authenticated routes — rendered via Chrome-style tab system */}
              <Route path="/*" element={
                <ProtectedRoute>
                  <TabProvider>
                    <AppLayout />
                  </TabProvider>
                </ProtectedRoute>
              } />
            </Routes>
            </PageTrackingProvider>
          </BrowserRouter>
        </DateFilterProvider>
      </AuthProvider>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
