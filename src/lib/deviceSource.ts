// Helper minimalista — usado pela telemetria do Pipeline para distinguir
// origem desktop vs mobile sem depender de useMediaQuery (chamável de utils).
export function getDeviceSource(): "desktop" | "mobile" {
  return typeof window !== "undefined" && window.innerWidth < 768
    ? "mobile"
    : "desktop";
}
