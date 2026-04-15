import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { resolveRoute, type ResolvedRoute } from "@/config/pageRegistry";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";

const MAX_TABS = 8;
const STORAGE_KEY = "uhome_tabs_v1";

export interface Tab {
  id: string;
  label: string;
  icon: string;
  path: string;
  closable: boolean;
  componentKey: string;
  pattern?: string;
  noPadding?: boolean;
}

interface TabContextValue {
  tabs: Tab[];
  activeTabId: string;
  openTab: (path: string, skipNav?: boolean) => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
}

const TabContext = createContext<TabContextValue | null>(null);

export function useTabContext() {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error("useTabContext must be inside TabProvider");
  return ctx;
}

// ─── Persistence ─────────────────────────────────────────────────────────────
function saveToStorage(tabs: Tab[], activeTabId: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeTabId }));
  } catch {}
}

function loadFromStorage(): { tabs: Tab[]; activeTabId: string } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Array.isArray(data.tabs) && typeof data.activeTabId === "string") {
      // Remove ghost tabs from legacy "/" route
      const cleaned = data.tabs.filter((t: any) => t.path !== "/" && t.path !== "/index.html" && t.path !== "/index");
      const activeStillExists = cleaned.some((t: any) => t.id === data.activeTabId);
      return {
        tabs: cleaned,
        activeTabId: activeStillExists ? data.activeTabId : (cleaned[0]?.id ?? ""),
      };
    }
  } catch {}
  return null;
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function TabProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { roles, loading: roleLoading } = useUserRole();

  // Initialize from storage or empty
  const stored = useRef(loadFromStorage());
  const [tabs, setTabs] = useState<Tab[]>(stored.current?.tabs ?? []);
  const [activeTabId, setActiveTabId] = useState(stored.current?.activeTabId ?? "");

  // Refs for avoiding stale closures
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeRef = useRef(activeTabId);
  activeRef.current = activeTabId;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const rolesRef = useRef(roles);
  rolesRef.current = roles;

  /** Check if user has access to a route based on its roles config */
  const hasAccess = useCallback((resolved: ResolvedRoute): boolean => {
    // No roles defined = open to all authenticated users
    if (!resolved.roles || resolved.roles.length === 0) return true;
    // Admin always has access
    if (rolesRef.current.includes("admin")) return true;
    return resolved.roles.some((r) => rolesRef.current.includes(r as AppRole));
  }, []);

  // Clean stored tabs that the user no longer has access to
  useEffect(() => {
    if (roleLoading || roles.length === 0) return;
    const currentTabs = tabsRef.current;
    const filtered = currentTabs.filter((tab) => {
      const resolved = resolveRoute(tab.path.split("?")[0].split("#")[0]);
      if (!resolved) return true; // keep unknown tabs
      return hasAccess(resolved);
    });
    if (filtered.length !== currentTabs.length) {
      setTabs(filtered);
      if (!filtered.some((t) => t.id === activeRef.current) && filtered.length > 0) {
        setActiveTabId(filtered[0].id);
        navigateRef.current(filtered[0].path, { replace: true });
      }
    }
  }, [roleLoading, roles, hasAccess]);

  // Persist on change
  useEffect(() => {
    saveToStorage(tabs, activeTabId);
  }, [tabs, activeTabId]);

  // ── openTab ────────────────────────────────────────────────────────────────
  const openTab = useCallback((path: string, skipNav = false) => {
    const pathname = path.split("?")[0].split("#")[0];
    const resolved = resolveRoute(pathname);
    if (!resolved) return;

    // Role gate: redirect unauthorized users to their home
    if (!hasAccess(resolved)) {
      if (!skipNav) navigateRef.current("/", { replace: true });
      return;
    }

    const currentTabs = tabsRef.current;
    const existingIdx = currentTabs.findIndex((t) => t.id === resolved.key);

    if (existingIdx >= 0) {
      // Tab already open — activate it
      if (activeRef.current !== resolved.key) {
        setActiveTabId(resolved.key);
        if (!skipNav) navigateRef.current(path);
      }
      return;
    }

    // Build new tab
    const newTab: Tab = {
      id: resolved.key,
      label: resolved.label,
      icon: resolved.icon,
      path,
      closable: resolved.closable !== false,
      componentKey: resolved.componentKey,
      pattern: resolved.pattern,
      noPadding: resolved.noPadding,
    };

    let newTabs = [...currentTabs, newTab];
    // Enforce max
    while (newTabs.length > MAX_TABS) {
      const oldest = newTabs.findIndex((t) => t.closable && t.id !== resolved.key);
      if (oldest >= 0) newTabs.splice(oldest, 1);
      else break;
    }

    setTabs(newTabs);
    setActiveTabId(resolved.key);
    if (!skipNav) navigateRef.current(path);
  }, []);

  // ── closeTab ───────────────────────────────────────────────────────────────
  const closeTab = useCallback((tabId: string) => {
    const current = tabsRef.current;
    const idx = current.findIndex((t) => t.id === tabId);
    if (idx < 0 || !current[idx].closable) return;

    const newTabs = current.filter((t) => t.id !== tabId);
    setTabs(newTabs);

    if (activeRef.current === tabId && newTabs.length > 0) {
      const nextIdx = Math.min(idx, newTabs.length - 1);
      const next = newTabs[nextIdx];
      setActiveTabId(next.id);
      navigateRef.current(next.path);
    }
  }, []);

  // ── activateTab ────────────────────────────────────────────────────────────
  const activateTab = useCallback((tabId: string) => {
    const tab = tabsRef.current.find((t) => t.id === tabId);
    if (!tab) return;
    setActiveTabId(tabId);
    navigateRef.current(tab.path);
  }, []);

  // ── URL → Tab sync (handles browser back/forward, direct URL entry) ────────
  const syncingRef = useRef(false);
  useEffect(() => {
    if (syncingRef.current || roleLoading) return;
    syncingRef.current = true;

    const fullPath = location.pathname + location.search;
    const pathname = location.pathname;

    // "/" only exists for redirect — never create a tab for it
    if (pathname === "/" || pathname === "/index.html" || pathname === "/index") return;

    const resolved = resolveRoute(pathname);

    if (resolved) {
      // Role gate on URL sync
      if (!hasAccess(resolved)) {
        navigateRef.current("/", { replace: true });
        requestAnimationFrame(() => { syncingRef.current = false; });
        return;
      }

      const existing = tabsRef.current.find((t) => t.id === resolved.key);
      if (existing) {
        if (activeRef.current !== resolved.key) {
          setActiveTabId(resolved.key);
        }
      } else {
        // Open as new tab without navigating (URL already correct)
        openTab(fullPath, true);
      }
    }

    // Reset sync guard after this render
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, [location.pathname, openTab, roleLoading, hasAccess]);

  return (
    <TabContext.Provider value={{ tabs, activeTabId, openTab, closeTab, activateTab }}>
      {children}
    </TabContext.Provider>
  );
}
