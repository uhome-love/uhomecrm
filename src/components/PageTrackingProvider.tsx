import { usePageTracking } from "@/hooks/usePageTracking";

/** Wrapper inerte que apenas ativa o hook global de page tracking. */
export function PageTrackingProvider({ children }: { children: React.ReactNode }) {
  usePageTracking();
  return <>{children}</>;
}
