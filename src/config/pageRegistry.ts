import { lazy } from "react";

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
  "gerente-dashboard": lazyRetry(() => import("@/pages/GerenteDashboard")),
  checkpoint: lazyRetry(() => import("@/pages/CheckpointGerente")),
  "central-dados": lazyRetry(() => import("@/pages/CentralDados")),
  scripts: lazyRetry(() => import("@/pages/ScriptsGenerator")),
  relatorios: lazyRetry(() => import("@/pages/RelatorioCorretor")),
  ranking: lazyRetry(() => import("@/pages/RankingEquipe")),
  "meu-time": lazyRetry(() => import("@/pages/MeuTime")),
  "oferta-ativa": lazyRetry(() => import("@/pages/OfertaAtiva")),
  roleta: lazyRetry(() => import("@/pages/RoletaLeads")),
  marketplace: lazyRetry(() => import("@/pages/MarketplaceScripts")),
  pipeline: lazyRetry(() => import("@/pages/PipelineKanban")),
  "escala-diaria": lazyRetry(() => import("@/pages/EscalaDiaria")),
  disponibilidade: lazyRetry(() => import("@/pages/DisponibilidadePage")),
  automacoes: lazyRetry(() => import("@/pages/AutomacoesPage")),
  templates: lazyRetry(() => import("@/pages/TemplatesComunicacao")),
  aceite: lazyRetry(() => import("@/pages/AceiteLeads")),
  "minhas-tarefas": lazyRetry(() => import("@/pages/MinhasTarefas")),
  "minhas-vitrines": lazyRetry(() => import("@/pages/MinhasVitrines")),
  "corretor-call": lazyRetry(() => import("@/pages/CorretorCall")),
  "agenda-visitas": lazyRetry(() => import("@/pages/AgendaVisitas")),
  conquistas: lazyRetry(() => import("@/pages/Conquistas")),
  progresso: lazyRetry(() => import("@/pages/CorretorProgresso")),
  academia: lazyRetry(() => import("@/pages/AcademiaPage")),
  "academia-trilha": lazyRetry(() => import("@/pages/AcademiaTrilhaPage")),
  "academia-aula": lazyRetry(() => import("@/pages/AcademiaAulaPage")),
  "academia-gerenciar": lazyRetry(() => import("@/pages/AcademiaGerenciarPage")),
  onboarding: lazyRetry(() => import("@/pages/Onboarding")),
  homi: lazyRetry(() => import("@/pages/HomiAssistant")),
  "homi-gerente": lazyRetry(() => import("@/pages/HomiGerencial")),
  "homi-ceo": lazyRetry(() => import("@/pages/HomiCeo")),
  "base-conhecimento": lazyRetry(() => import("@/pages/BaseConhecimento")),
  negocios: lazyRetry(() => import("@/pages/MeusNegocios")),
  "vendas-realizadas": lazyRetry(() => import("@/pages/VendasRealizadas")),
  "pos-vendas": lazyRetry(() => import("@/pages/PosVendas")),
  imoveis: lazyRetry(() => import("@/pages/ImoveisPage")),
  "orygem-60": lazyRetry(() => import("@/pages/OrygemCampanha")),
  "busca-leads": lazyRetry(() => import("@/pages/BuscaLeads")),
  configuracoes: lazyRetry(() => import("@/pages/Configuracoes")),
  "config-whatsapp": lazyRetry(() => import("@/pages/ConfiguracoesWhatsApp")),
  "links-site": lazyRetry(() => import("@/pages/LinksSite")),
  notificacoes: lazyRetry(() => import("@/pages/Notificacoes")),
  whatsapp: lazyRetry(() => import("@/pages/WhatsAppInbox")),
  marketing: lazyRetry(() => import("@/pages/MarketingDashboard")),
  auditoria: lazyRetry(() => import("@/pages/AuditDashboard")),
  admin: lazyRetry(() => import("@/pages/AdminPanel")),
  integracao: lazyRetry(() => import("@/pages/IntegracaoJetimob")),
  "dev-ai": lazyRetry(() => import("@/pages/DevAIPage")),
  "diagnostico-site": lazyRetry(() => import("@/pages/DiagnosticoSite")),
  "disparador-whatsapp": lazyRetry(() => import("@/pages/WhatsAppCampaignDispatcher")),
  "email-marketing": lazyRetry(() => import("@/pages/EmailMarketingPage")),
  "disparador-ligacoes": lazyRetry(() => import("@/pages/DisparadorLigacoesIA")),
  "campanhas-voz": lazyRetry(() => import("@/pages/CampanhasVoz")),
  "central-nutricao": lazyRetry(() => import("@/pages/CentralNutricao")),
  nutricao: lazyRetry(() => import("@/pages/NutricaoPage")),
  "relatorio-semanal": lazyRetry(() => import("@/pages/RelatorioSemanal")),
  backoffice: lazyRetry(() => import("@/pages/BackofficeDashboard")),
  pagadorias: lazyRetry(() => import("@/pages/PagadoriasPage")),
  "pagadoria-solicitacoes": lazyRetry(() => import("@/pages/PagadoriaSolicitacoes")),
  comissoes: lazyRetry(() => import("@/pages/ComissoesPage")),
  "marketing-central": lazyRetry(() => import("@/pages/MarketingCentral")),
  "homi-ana": lazyRetry(() => import("@/pages/HomiAna")),
  "backoffice-central": lazyRetry(() => import("@/pages/BackofficeCentral")),
  cadastros: lazyRetry(() => import("@/pages/CadastrosPage")),
  rh: lazyRetry(() => import("@/pages/RhDashboard")),
  "rh-recrutamento": lazyRetry(() => import("@/pages/RhRecrutamento")),
  "rh-entrevistas": lazyRetry(() => import("@/pages/RhEntrevistas")),
  "rh-conversas": lazyRetry(() => import("@/pages/RhConversas")),
  "rh-sala-reuniao": lazyRetry(() => import("@/pages/RhSalaReuniao")),
  "import-brevo": lazyRetry(() => import("@/pages/ImportBrevoContacts")),
  "gestao-whatsapp": lazyRetry(() => import("@/pages/GestaoWhatsAppDashboard")),
};

// ─── ROUTE → TAB CONFIG ──────────────────────────────────────────────────────
export const ROUTE_TO_TAB: Record<string, TabRouteConfig> = {
  "/":                      { key: "home",                 label: "Home",                icon: "LayoutGrid",    closable: false },
  "/corretor":              { key: "corretor",             label: "Minha Rotina",        icon: "LayoutGrid",    closable: false },
  "/ceo":                   { key: "ceo",                  label: "Dashboard CEO",       icon: "LayoutGrid",    closable: false, roles: ["admin"] },
  "/gerente/dashboard":     { key: "gerente-dashboard",    label: "Dashboard",           icon: "LayoutGrid",    closable: false, roles: ["gestor", "admin"] },
  "/backoffice":            { key: "backoffice",           label: "Dashboard BO",        icon: "LayoutGrid",    closable: false, roles: ["backoffice", "admin"] },
  "/rh":                    { key: "rh",                   label: "Dashboard RH",        icon: "LayoutGrid",    closable: false, roles: ["rh", "admin"] },
  "/central-do-gerente":    { key: "checkpoint",           label: "Central Gerente",     icon: "CheckCircle",   roles: ["gestor", "admin"] },
  "/central-dados":         { key: "central-dados",        label: "Central Dados",       icon: "Database",      roles: ["gestor", "admin"] },
  "/scripts":               { key: "scripts",              label: "Scripts",             icon: "Lightbulb" },
  "/relatorios":            { key: "relatorios",           label: "Relatórios 1:1",      icon: "FileText",      roles: ["gestor", "admin"] },
  "/ranking":               { key: "ranking",              label: "Rankings",            icon: "Star" },
  "/meu-time":              { key: "meu-time",             label: "Meu Time",            icon: "Users",         roles: ["gestor", "admin"] },
  "/oferta-ativa":          { key: "oferta-ativa",         label: "Oferta Ativa",        icon: "Phone" },
  "/roleta":                { key: "roleta",               label: "Roleta",              icon: "Target",        roles: ["admin"] },
  "/marketplace":           { key: "marketplace",          label: "Marketplace",         icon: "Lightbulb" },
  "/pipeline-leads":        { key: "pipeline",             label: "Pipeline",            icon: "AlignLeft" },
  "/escala-diaria":         { key: "escala-diaria",        label: "Escala Diária",       icon: "Clock",         roles: ["admin"] },
  "/disponibilidade":       { key: "disponibilidade",      label: "Disponibilidade",     icon: "Clock",         roles: ["gestor", "admin"] },
  "/automacoes":            { key: "automacoes",           label: "Automações",          icon: "GitBranch",     roles: ["admin"] },
  "/templates-comunicacao": { key: "templates",            label: "Templates",           icon: "ClipboardList", roles: ["gestor", "admin"] },
  "/aceite":                { key: "aceite",               label: "Aceite de Leads",     icon: "UserCheck" },
  "/minhas-tarefas":        { key: "minhas-tarefas",       label: "Tarefas",             icon: "ListTodo" },
  "/minhas-vitrines":       { key: "minhas-vitrines",      label: "Vitrines",            icon: "Building2" },
  "/corretor/call":         { key: "corretor-call",        label: "Oferta Ativa",        icon: "Phone" },
  "/agenda-visitas":        { key: "agenda-visitas",       label: "Agenda Visitas",      icon: "CalendarDays" },
  "/conquistas":            { key: "conquistas",           label: "Conquistas",          icon: "Trophy" },
  "/progresso":             { key: "progresso",            label: "Progresso",           icon: "Target" },
  "/academia":              { key: "academia",             label: "Academia",            icon: "GraduationCap" },
  "/academia/gerenciar":    { key: "academia-gerenciar",   label: "Gerenciar Academia",  icon: "GraduationCap", roles: ["gestor", "admin"] },
  "/onboarding":            { key: "onboarding",           label: "Onboarding",          icon: "Lightbulb" },
  "/homi":                  { key: "homi",                 label: "HOMI",                icon: "Bot" },
  "/homi-gerente":          { key: "homi-gerente",         label: "HOMI Gerente",        icon: "Bot",           roles: ["gestor", "admin"] },
  "/homi-ceo":              { key: "homi-ceo",             label: "HOMI CEO",            icon: "Bot",           roles: ["admin"] },
  "/homi/base-conhecimento":{ key: "base-conhecimento",    label: "Base HOMI",           icon: "BookOpen",      roles: ["admin", "gestor"] },
  "/pipeline-negocios":     { key: "negocios",             label: "Negócios",            icon: "BarChart3" },
  "/vendas-realizadas":     { key: "vendas-realizadas",    label: "Vendas",              icon: "TrendingUp" },
  "/pos-vendas":            { key: "pos-vendas",           label: "Pós-Vendas",          icon: "Heart" },
  "/imoveis":               { key: "imoveis",              label: "Imóveis",             icon: "Home" },
  "/orygem-60":             { key: "orygem-60",            label: "Orygem 60",           icon: "Megaphone" },
  "/busca-leads":           { key: "busca-leads",          label: "Busca Leads",         icon: "Search",        roles: ["gestor", "admin"] },
  "/configuracoes":         { key: "configuracoes",        label: "Configurações",       icon: "Settings" },
  "/configuracoes/whatsapp":{ key: "config-whatsapp",      label: "Meu WhatsApp",        icon: "Smartphone",    roles: ["corretor", "admin"] },
  "/links-site":            { key: "links-site",           label: "Meus Links",          icon: "Link2" },
  "/notificacoes":          { key: "notificacoes",         label: "Notificações",        icon: "BellRing" },
  "/whatsapp":              { key: "whatsapp",             label: "WhatsApp",            icon: "MessageSquare", roles: ["corretor", "gestor", "admin"], noPadding: true },
  "/marketing":             { key: "marketing",            label: "Marketing",           icon: "Zap",           roles: ["admin"] },
  "/auditoria":             { key: "auditoria",            label: "Auditoria",           icon: "ShieldCheck",   roles: ["admin"] },
  "/admin":                 { key: "admin",                label: "Admin",               icon: "Users",         roles: ["admin"] },
  "/integracao":            { key: "integracao",           label: "Integração",          icon: "Layers",        roles: ["admin"] },
  "/dev-ai":                { key: "dev-ai",               label: "Dev AI",              icon: "Lightbulb",     roles: ["admin"] },
  "/admin/diagnostico-site":{ key: "diagnostico-site",     label: "Diagnóstico",         icon: "Database",      roles: ["admin"] },
  "/disparador-whatsapp":   { key: "disparador-whatsapp",  label: "Disparador WA",       icon: "MessageSquare", roles: ["admin"] },
  "/email-marketing":       { key: "email-marketing",      label: "Email Marketing",     icon: "Mail",          roles: ["admin"] },
  "/disparador-ligacoes-ia":{ key: "disparador-ligacoes",  label: "Disparador IA",       icon: "Phone",         roles: ["admin"] },
  "/campanhas-voz":         { key: "campanhas-voz",        label: "Campanhas Voz",       icon: "Phone",         roles: ["admin"] },
  "/central-nutricao":      { key: "central-nutricao",     label: "Central Nutrição",    icon: "Mail",          roles: ["admin"] },
  "/nutricao":              { key: "nutricao",             label: "Nutrição",            icon: "Zap",           roles: ["admin", "gestor"] },
  "/relatorio-semanal":     { key: "relatorio-semanal",    label: "Relatório Semanal",   icon: "FileText",      roles: ["admin", "gestor", "corretor"] },
  "/backoffice/pagadorias":           { key: "pagadorias",             label: "Pagadorias",          icon: "Wallet",        roles: ["backoffice", "admin"] },
  "/backoffice/solicitacoes-pagadoria":{ key: "pagadoria-solicitacoes", label: "Solicitações",        icon: "ClipboardList", roles: ["backoffice", "admin"] },
  "/backoffice/comissoes":            { key: "comissoes",              label: "Comissões",           icon: "PieChart",      roles: ["backoffice", "admin"] },
  "/backoffice/marketing":            { key: "marketing-central",      label: "Marketing Central",   icon: "Megaphone",     roles: ["backoffice", "admin"] },
  "/backoffice/homi-ana":             { key: "homi-ana",               label: "HOMI Ana",            icon: "Bot",           roles: ["backoffice", "admin"] },
  "/backoffice/tarefas":              { key: "backoffice-central",     label: "Tarefas BO",          icon: "ListTodo",      roles: ["backoffice", "admin"] },
  "/backoffice/cadastros":            { key: "cadastros",              label: "Cadastros",           icon: "Database",      roles: ["backoffice", "admin"] },
  "/rh/recrutamento":       { key: "rh-recrutamento",      label: "Candidatos",          icon: "Users",         roles: ["rh", "admin"] },
  "/rh/entrevistas":        { key: "rh-entrevistas",       label: "Entrevistas",         icon: "Briefcase",     roles: ["rh", "admin"] },
  "/rh/conversas":          { key: "rh-conversas",         label: "Conversas 1:1",       icon: "MessageSquare", roles: ["rh", "admin"] },
  "/rh/sala-reuniao":       { key: "rh-sala-reuniao",      label: "Sala de Reunião",     icon: "Video",         roles: ["rh", "admin"] },
  "/import-brevo-contacts": { key: "import-brevo",         label: "Import Brevo",        icon: "Database",      roles: ["admin"] },
  "/gestor/whatsapp-dashboard": { key: "gestao-whatsapp", label: "Gestão WhatsApp",     icon: "BarChart2",     roles: ["gestor", "admin"] },
};

// ─── DYNAMIC ROUTES ──────────────────────────────────────────────────────────
const DYNAMIC_PATTERNS: Array<{
  regex: RegExp;
  pattern: string;
  componentKey: string;
  config: (m: RegExpMatchArray) => Omit<TabRouteConfig, "pattern">;
}> = [
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
