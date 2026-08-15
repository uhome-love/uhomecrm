import { lazy } from "react";

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
      // Allow a fresh retry if the last reload was >30s ago (different page/chunk)
      if (now - last > 30_000) {
        sessionStorage.setItem(key, String(now));
        // Cache-bust: force browser to refetch index.html and chunks
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

export interface TabRouteConfig {
  key: string;
  label: string;
  icon: string; // PascalCase lucide icon name
  roles?: string[];
  closable?: boolean; // default true
  noPadding?: boolean;
  pattern?: string; // for dynamic routes
}

// ─── LAZY PAGE COMPONENTS ─────────────────────────────────────────────────────
export const PAGE_COMPONENTS: Record<string, React.LazyExoticComponent<any>> = {
  home: lazyRetry(() => import("@/pages/HomeDashboard")),
  corretor: lazyRetry(() => import("@/pages/CorretorDashboard")),
  ceo: lazyRetry(() => import("@/pages/CeoDashboard")),
  diretora: lazyRetry(() => import("@/pages/DiretoraDashboard")),
  "gerente-cockpit": lazyRetry(() => import("@/pages/GerenteCockpit")),
  "produtividade": lazyRetry(() => import("@/pages/Produtividade")),
  
  checkpoint: lazyRetry(() => import("@/pages/CheckpointGerente")),
  scripts: lazyRetry(() => import("@/pages/ScriptsGenerator")),
  relatorios: lazyRetry(() => import("@/pages/RelatorioCorretor")),
  // "ranking" (Central de Performance) foi absorvido pela Central de Relatórios — ver "report-center".
  "ranking-legado": lazyRetry(() => import("@/pages/RankingEquipe")),
  "meu-time": lazyRetry(() => import("@/pages/MeuTime")),
  "oferta-ativa": lazyRetry(() => import("@/pages/OfertaAtiva")),
  "base-leads": lazyRetry(() => import("@/pages/BaseLeadsPage")),
  "oferta-ativa-ao-vivo": lazyRetry(() => import("@/pages/OfertaAtivaAoVivo")),
  roleta: lazyRetry(() => import("@/pages/RoletaLeads")),
  marketplace: lazyRetry(() => import("@/pages/MarketplaceScripts")),
  pipeline: lazyRetry(() => import("@/pages/PipelineKanban")),
  
  
  templates: lazyRetry(() => import("@/pages/TemplatesComunicacao")),
  aceite: lazyRetry(() => import("@/pages/AceiteLeads")),
  "minhas-tarefas": lazyRetry(() => import("@/pages/AgendaCorretor")),
  "minhas-vitrines": lazyRetry(() => import("@/pages/MinhasVitrines")),
  "corretor-call": lazyRetry(() => import("@/pages/CorretorCall")),
  "agenda-visitas": lazyRetry(() => import("@/pages/AgendaVisitas")),
  academia: lazyRetry(() => import("@/pages/AcademiaPage")),
  "academia-trilha": lazyRetry(() => import("@/pages/AcademiaTrilhaPage")),
  "academia-aula": lazyRetry(() => import("@/pages/AcademiaAulaPage")),
  "academia-gerenciar": lazyRetry(() => import("@/pages/AcademiaGerenciarPage")),
  onboarding: lazyRetry(() => import("@/pages/Onboarding")),
  homi: lazyRetry(() => import("@/pages/HomiWorkspace")),
  "homi-gerente": lazyRetry(() => import("@/pages/HomiGerencial")),
  "base-conhecimento": lazyRetry(() => import("@/pages/BaseConhecimento")),
  
  "vendas-realizadas": lazyRetry(() => import("@/pages/VendasRealizadas")),
  
  imoveis: lazyRetry(() => import("@/pages/ImoveisShell")),
  "busca-leads": lazyRetry(() => import("@/pages/BuscaLeads")),
  configuracoes: lazyRetry(() => import("@/pages/Configuracoes")),
  
  notificacoes: lazyRetry(() => import("@/pages/Notificacoes")),
  auditoria: lazyRetry(() => import("@/pages/AuditDashboard")),
  admin: lazyRetry(() => import("@/pages/AdminPanel")),
  integracao: lazyRetry(() => import("@/pages/IntegracaoJetimob")),
  
  "diagnostico-site": lazyRetry(() => import("@/pages/DiagnosticoSite")),
  "disparador-whatsapp": lazyRetry(() => import("@/pages/WhatsAppCampaignDispatcher")),
  "central-nutricao": lazyRetry(() => import("@/pages/CentralNutricao")),
  "relatorio-semanal": lazyRetry(() => import("@/pages/RelatorioSemanal")),
  "relatorio-origem-performance": lazyRetry(() => import("@/pages/RelatorioOrigemPerformancePage")),
  rh: lazyRetry(() => import("@/pages/RhDashboard")),
  "rh-recrutamento": lazyRetry(() => import("@/pages/RhRecrutamento")),
  "recrutamento-acompanhamento": lazyRetry(() => import("@/pages/RecrutamentoAcompanhamento")),
  "gerente-candidatos": lazyRetry(() => import("@/pages/GerenteCandidatos")),
  
  "rh-conversas": lazyRetry(() => import("@/pages/RhConversas")),
  "rh-sala-reuniao": lazyRetry(() => import("@/pages/RhSalaReuniao")),
  "import-brevo": lazyRetry(() => import("@/pages/ImportBrevoContacts")),
  "report-center": lazyRetry(() => import("@/pages/CentralRelatorios")),
  materiais: lazyRetry(() => import("@/pages/MateriaisPage")),
  "materiais-analytics": lazyRetry(() => import("@/pages/MateriaisAnalytics")),
  intermediacao: lazyRetry(() => import("@/pages/IntermediacaoPage")),
  "leads-estagnados": lazyRetry(() => import("@/pages/LeadsEstagnados")),
  "simulador-financiamento": lazyRetry(() => import("@/pages/SimuladorFinanciamento")),
  "presenca-roleta": lazyRetry(() => import("@/pages/PresencaRoleta")),
  "foco-corretores": lazyRetry(() => import("@/pages/FocoCorretores")),
  "lia-hub": lazyRetry(() => import("@/pages/admin/LiaHub")),
};

// ─── ROUTE → TAB CONFIG ──────────────────────────────────────────────────────
export const ROUTE_TO_TAB: Record<string, TabRouteConfig> = {
  "/":                      { key: "home",                 label: "Home",                icon: "LayoutGrid",    closable: false },
  "/corretor":              { key: "corretor",             label: "Minha Rotina",        icon: "LayoutGrid",    closable: false },
  "/ceo":                   { key: "ceo",                  label: "Dashboard CEO",       icon: "LayoutGrid",    closable: false, roles: ["admin", "diretor"] },
  "/diretora":              { key: "diretora",             label: "Dashboard",           icon: "LayoutGrid",    closable: false, roles: ["diretor", "admin"] },
  
  "/admin/lia-hub":         { key: "lia-hub",              label: "LIA · Uhome",         icon: "Bot",           roles: ["admin", "diretor"] },
  "/gerente/cockpit":       { key: "gerente-cockpit",      label: "Dashboard",           icon: "LayoutGrid",    closable: false, roles: ["gestor", "admin", "diretor"] },
  "/produtividade":         { key: "produtividade",        label: "Produtividade",       icon: "Activity",      roles: ["gestor", "admin", "diretor"] },
  "/rh":                    { key: "rh",                   label: "Dashboard RH",        icon: "LayoutGrid",    closable: false, roles: ["rh", "admin"] },
  "/central-do-gerente":    { key: "checkpoint",           label: "Central Gerente",     icon: "CheckCircle",   roles: ["gestor", "admin", "diretor"] },
  "/relatorios":            { key: "relatorios",           label: "Relatórios 1:1",      icon: "FileText",      roles: ["gestor", "admin", "diretor"] },
  // "/ranking" e "/performance" → redirect para /central-relatorios (App.tsx)

  "/performance-legado":    { key: "ranking-legado",       label: "Performance (legado)", icon: "Star",         roles: ["admin"] },

  "/meu-time":              { key: "meu-time",             label: "Meu Time",            icon: "Users",         roles: ["gestor", "admin", "diretor"] },
  "/oferta-ativa":          { key: "oferta-ativa",         label: "Oferta Ativa",        icon: "Phone" },
  "/base-leads":            { key: "base-leads",           label: "Base Única de Leads", icon: "Database",      roles: ["admin", "diretor"] },
  "/oferta-ativa-ao-vivo":  { key: "oferta-ativa-ao-vivo", label: "Mutirão Inteligente", icon: "Radio",         noPadding: true },
  "/roleta":                { key: "roleta",               label: "Roleta",              icon: "Target",        roles: ["admin"] },
  "/marketplace":           { key: "marketplace",          label: "Marketplace",         icon: "Lightbulb" },
  "/pipeline":              { key: "pipeline",             label: "Pipeline",            icon: "AlignLeft",     noPadding: true },
  "/pipeline-leads":        { key: "pipeline",             label: "Pipeline",            icon: "AlignLeft",     noPadding: true },
  
  
  "/templates-comunicacao": { key: "templates",            label: "Templates",           icon: "ClipboardList", roles: ["gestor", "admin", "diretor"] },
  "/aceite":                { key: "aceite",               label: "Aceite de Leads",     icon: "UserCheck" },
  "/minhas-tarefas":        { key: "minhas-tarefas",       label: "Agenda",  icon: "ListTodo" },
  "/minhas-vitrines":       { key: "minhas-vitrines",      label: "Vitrines",            icon: "Building2" },
  "/corretor/call":         { key: "corretor-call",        label: "Oferta Ativa",        icon: "Phone" },
  "/visitas":               { key: "agenda-visitas",       label: "Visitas",      icon: "CalendarDays" },
  "/agenda-visitas":        { key: "agenda-visitas",       label: "Visitas",      icon: "CalendarDays" },
  "/academia":              { key: "academia",             label: "Academia",            icon: "GraduationCap" },
  // "/academia/gerenciar" virou aba do hub /academia?tab=gerenciar (redirect em App.tsx)
  "/onboarding":            { key: "onboarding",           label: "Onboarding",          icon: "Lightbulb" },
  "/homi":                  { key: "homi",                 label: "HOMI",                icon: "Bot",           noPadding: true },
  "/homi-gerente":          { key: "homi-gerente",         label: "HOMI Gerente",        icon: "Bot",           roles: ["gestor", "admin", "diretor"] },
  // "/pipeline-negocios" desativado — negócios agora vivem no Pipeline de Leads (lente Negócios). Redirect em App.tsx.
  "/vendas-realizadas":     { key: "vendas-realizadas",    label: "Vendas",              icon: "TrendingUp" },
  
  "/imoveis":               { key: "imoveis",              label: "Imóveis",             icon: "Home" },
  "/busca-leads":           { key: "busca-leads",          label: "Busca Leads",         icon: "Search",        roles: ["gestor", "admin", "diretor"] },
  "/configuracoes":         { key: "configuracoes",        label: "Configurações",       icon: "Settings" },
  
  "/notificacoes":          { key: "notificacoes",         label: "Notificações",        icon: "BellRing" },
  "/auditoria":             { key: "auditoria",            label: "Auditoria",           icon: "ShieldCheck",   roles: ["admin"] },
  "/admin":                 { key: "admin",                label: "Admin",               icon: "Users",         roles: ["admin"] },
  "/integracao":            { key: "integracao",           label: "Integração",          icon: "Layers",        roles: ["admin"] },
  
  "/admin/diagnostico-site":{ key: "diagnostico-site",     label: "Diagnóstico",         icon: "Database",      roles: ["admin"] },
  "/disparador-whatsapp":   { key: "disparador-whatsapp",  label: "Disparador WA",       icon: "MessageSquare", roles: ["admin"] },
  "/central-nutricao":      { key: "central-nutricao",     label: "Reengajamento",       icon: "RefreshCw",     roles: ["admin"] },
  "/relatorio-semanal":     { key: "relatorio-semanal",    label: "Relatório Semanal",   icon: "FileText",      roles: ["admin", "gestor", "corretor", "diretor"] },
  "/rh/recrutamento":       { key: "rh-recrutamento",      label: "Candidatos",          icon: "Users",         roles: ["rh", "admin", "diretor"] },
  "/gerente/candidatos":    { key: "gerente-candidatos",   label: "Meus Candidatos",     icon: "Users",         roles: ["gestor", "admin"] },
  "/recrutamento/acompanhamento": { key: "recrutamento-acompanhamento", label: "Recrutamento", icon: "BarChart3", roles: ["admin", "diretor"] },
  
  "/rh/conversas":          { key: "rh-conversas",         label: "Conversas 1:1",       icon: "MessageSquare", roles: ["rh", "admin"] },
  "/rh/sala-reuniao":       { key: "rh-sala-reuniao",      label: "Sala de Reunião",     icon: "Video",         roles: ["rh", "admin"] },
  "/import-brevo-contacts": { key: "import-brevo",         label: "Import Brevo",        icon: "Database",      roles: ["admin"] },
  "/central-relatorios":        { key: "report-center",     label: "Performance",  icon: "BarChart2",     roles: ["admin", "gestor", "corretor", "diretor"], noPadding: true },
  "/dados-anuncios":                { key: "relatorio-origem-performance", label: "Central de Marketing", icon: "BarChart2", roles: ["admin", "gestor", "diretor"], noPadding: true },
  "/relatorio-performance-origem":  { key: "relatorio-origem-performance", label: "Central de Marketing", icon: "BarChart2", roles: ["admin", "gestor", "diretor"], noPadding: true },
  "/materiais":             { key: "materiais",            label: "Materiais",           icon: "FolderOpen" },
  "/materiais/analytics":   { key: "materiais-analytics",  label: "Analytics Materiais", icon: "BarChart3",     roles: ["gestor", "admin", "diretor"] },
  "/intermediacao":         { key: "intermediacao",        label: "Intermediação",       icon: "FileSignature", roles: ["admin", "gestor", "diretor"] },
  "/leads-estagnados":      { key: "leads-estagnados",     label: "Leads Estagnados",    icon: "AlarmClock",    roles: ["admin", "gestor", "diretor"] },
  "/simulador-financiamento": { key: "simulador-financiamento", label: "Simulador Financiamento", icon: "Calculator" },
  "/roleta/presenca":       { key: "presenca-roleta",      label: "Presença",     icon: "CalendarCheck", roles: ["admin", "gestor", "diretor"] },
  "/foco-corretores":       { key: "foco-corretores",      label: "Foco Corretores",     icon: "Target",        roles: ["admin", "gestor", "diretor"] },
};

// ─── DYNAMIC ROUTES ──────────────────────────────────────────────────────────
const DYNAMIC_PATTERNS: Array<{
  regex: RegExp;
  pattern: string;
  componentKey: string;
  config: (m: RegExpMatchArray) => Omit<TabRouteConfig, "pattern">;
}> = [
  {
    regex: /^\/homi\/c\/(.+)$/,
    pattern: "/homi/c/:threadId",
    componentKey: "homi",
    config: () => ({ key: "homi", label: "HOMI", icon: "Bot", noPadding: true }),
  },
  {
    regex: /^\/academia\/trilha\/(.+)$/,
    pattern: "/academia/trilha/:trilhaId",
    componentKey: "academia-trilha",
    config: (m) => ({ key: `academia-trilha-${m[1]}`, label: "Trilha", icon: "GraduationCap" }),
  },
  {
    regex: /^\/academia\/aula\/(.+)$/,
    pattern: "/academia/aula/:aulaId",
    componentKey: "academia-aula",
    config: (m) => ({ key: `academia-aula-${m[1]}`, label: "Aula", icon: "GraduationCap" }),
  },
];

export interface ResolvedRoute extends TabRouteConfig {
  componentKey: string;
}

export function resolveRoute(pathname: string): ResolvedRoute | null {
  const staticRoute = ROUTE_TO_TAB[pathname];
  if (staticRoute) return { ...staticRoute, componentKey: staticRoute.key };

  for (const d of DYNAMIC_PATTERNS) {
    const m = pathname.match(d.regex);
    if (m) {
      const cfg = d.config(m);
      return { ...cfg, componentKey: d.componentKey, pattern: d.pattern };
    }
  }

  return null;
}
