import type { ReactNode } from "react";
import {
  LayoutGrid, Target, KanbanSquare, CalendarDays, Home, Phone, Search,
  TrendingUp, Bot, BotMessageSquare, Users, UsersRound, UserPlus, GraduationCap,
  Wallet, ListTodo, CheckSquare, Database, BarChart3, BarChart2, Award, UserCheck,
  FolderOpen, RefreshCw, FileSignature, AlarmClock, Calculator, CalendarCheck,
  Crosshair, MessageSquare, ClipboardList, Building2, PieChart, Video, LineChart,
} from "lucide-react";

export type NavItem = { label: string; path: string; icon: ReactNode; badge?: string | number };
export type NavGroup = { title: string; items: NavItem[] };
export type UserRole = "admin" | "diretor" | "gestor" | "corretor" | "backoffice" | "rh";

/** Grupo sem título: itens mais usados, sempre visíveis no topo. */
export const GRUPO_TOPO = "";
/** Grupos que começam recolhidos (uso baixo). */
export const GRUPOS_RECOLHIDOS = ["Apoio"];

const i = (C: typeof LayoutGrid) => <C size={15} strokeWidth={1.6} />;

const it = {
  agenda: { label: "Agenda", path: "/minhas-tarefas", icon: i(ListTodo) },
  tarefas: { label: "Tarefas", path: "/tarefas", icon: i(CheckSquare) },
  pipeline: { label: "Pipeline", path: "/pipeline-leads", icon: i(KanbanSquare) },
  visitas: { label: "Visitas", path: "/agenda-visitas", icon: i(CalendarDays) },
  oaGestao: { label: "Oferta Ativa", path: "/oferta-ativa", icon: i(Phone) },
  estagnados: { label: "Leads estagnados", path: "/leads-estagnados", icon: i(AlarmClock) },
  roleta: { label: "Roleta", path: "/roleta", icon: i(Target) },
  busca: { label: "Busca de leads", path: "/busca-leads", icon: i(Search) },
  vendas: { label: "Vendas", path: "/vendas-realizadas", icon: i(TrendingUp) },
  intermediacao: { label: "Intermediação", path: "/intermediacao", icon: i(FileSignature) },
  financeiro: { label: "Financeiro", path: "/financeiro", icon: i(Wallet) },
  usuarios: { label: "Usuários", path: "/meu-time", icon: i(UsersRound) },
  presenca: { label: "Presença", path: "/roleta/presenca", icon: i(CalendarCheck) },
  foco: { label: "Foco Corretores", path: "/foco-corretores", icon: i(Crosshair) },
  candidatos: { label: "Recrutamento", path: "/rh/recrutamento", icon: i(UserPlus) },
  relatorios: { label: "Relatórios", path: "/raio-x", icon: i(BarChart3) },
  placar: { label: "Placar do Dia", path: "/placar-do-dia", icon: i(Award) },
  marketing: { label: "Central de Marketing", path: "/dados-anuncios", icon: i(LineChart) },
  reengajamento: { label: "Reengajamento", path: "/central-nutricao", icon: i(RefreshCw) },
  lia: { label: "Lia", path: "/admin/lia-hub", icon: i(MessageSquare) },
  base: { label: "Base única", path: "/base-leads", icon: i(Database) },
  imoveis: { label: "Imóveis", path: "/imoveis", icon: i(Home) },
  materiais: { label: "Materiais", path: "/materiais", icon: i(FolderOpen) },
  academia: { label: "Academia", path: "/academia", icon: i(GraduationCap) },
  homi: { label: "Falar com HOMI", path: "/homi", icon: i(Bot) },
  homiGerente: { label: "HOMI Gerente", path: "/homi-gerente", icon: i(BotMessageSquare) },
  templates: { label: "Templates", path: "/templates-comunicacao", icon: i(ClipboardList) },
  simulador: { label: "Simulador", path: "/simulador-financiamento", icon: i(Calculator) },
};

export const NAV_BY_ROLE: Record<UserRole, NavGroup[]> = {
  admin: [
    { title: GRUPO_TOPO, items: [{ label: "Dashboard", path: "/ceo", icon: i(LayoutGrid) }, it.pipeline, it.agenda, it.tarefas, it.visitas] },
    { title: "Vendas", items: [it.oaGestao, it.estagnados, it.roleta, it.busca] },
    { title: "Negócios", items: [it.vendas, it.intermediacao, it.financeiro] },
    { title: "Time", items: [it.usuarios, it.presenca, it.foco, it.candidatos, it.relatorios] },
    { title: "Marketing", items: [it.marketing, it.reengajamento, it.lia, it.base] },
    { title: "Apoio", items: [it.imoveis, it.materiais, it.academia, it.homi, it.simulador] },
  ],
  diretor: [
    { title: GRUPO_TOPO, items: [{ label: "Dashboard", path: "/ceo", icon: i(LayoutGrid) }, it.pipeline, it.agenda, it.tarefas, it.visitas] },
    { title: "Vendas", items: [it.oaGestao, it.estagnados, it.busca] },
    { title: "Negócios", items: [it.vendas, it.intermediacao, it.financeiro] },
    { title: "Time", items: [it.usuarios, it.presenca, it.foco, it.placar, it.candidatos, it.relatorios] },
    { title: "Marketing", items: [it.marketing, it.lia] },
    { title: "Apoio", items: [it.imoveis, it.materiais, it.academia, it.homi, it.homiGerente, it.templates, it.simulador] },
  ],
  gestor: [
    { title: GRUPO_TOPO, items: [{ label: "Dashboard", path: "/gerente/cockpit", icon: i(LayoutGrid) }, it.pipeline, it.agenda, it.tarefas, it.visitas] },
    { title: "Vendas", items: [it.oaGestao, it.estagnados, it.busca] },
    { title: "Negócios", items: [it.vendas, it.intermediacao] },
    { title: "Time", items: [
      { label: "Meu time", path: "/meu-time", icon: i(Users) }, it.presenca, it.foco,
      { label: "Meus candidatos", path: "/gerente/candidatos", icon: i(UserPlus) }, it.relatorios,
    ] },
    { title: "Apoio", items: [it.imoveis, it.materiais, it.academia, it.homi, it.homiGerente, it.templates, it.simulador] },
  ],
  corretor: [
    { title: GRUPO_TOPO, items: [
      { label: "Início", path: "/corretor", icon: i(LayoutGrid) },
      { label: "Aceite de leads", path: "/aceite", icon: i(UserCheck) },
      it.pipeline, it.agenda, it.tarefas, it.visitas,
      { label: "Oferta Ativa", path: "/corretor/call", icon: i(Phone) },
    ] },
    { title: "Negócios", items: [it.vendas, { label: "Meus resultados", path: "/raio-x", icon: i(BarChart2) }] },
    { title: "Apoio", items: [it.imoveis, it.materiais, { label: "Minhas vitrines", path: "/minhas-vitrines", icon: i(Building2) }, it.simulador, it.homi, it.academia] },
  ],
  // ── BACKOFFICE ────────────────────────────────────────────────────────────
  backoffice: [
    {
      title: "Principal",
      items: [
        { label: "Dashboard",          path: "/backoffice",                       icon: <LayoutGrid   size={15} strokeWidth={1.5} /> },
        { label: "Tarefas",            path: "/backoffice/tarefas",               icon: <ListTodo     size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Financeiro",
      items: [
        { label: "Pagadorias",         path: "/backoffice/pagadorias",            icon: <Wallet       size={15} strokeWidth={1.5} /> },
        { label: "Solicitações",       path: "/backoffice/solicitacoes-pagadoria",icon: <ClipboardList size={15} strokeWidth={1.5} /> },
        { label: "Comissões",          path: "/backoffice/comissoes",             icon: <PieChart     size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Operações",
      items: [
        { label: "Cadastros",          path: "/backoffice/cadastros",             icon: <Database     size={15} strokeWidth={1.5} /> },
        { label: "HOMI Ana",           path: "/backoffice/homi-ana",             icon: <Bot          size={15} strokeWidth={1.5} /> },
      ],
    },
  ],

  // ── RH ────────────────────────────────────────────────────────────────────
  rh: [
    {
      title: "Principal",
      items: [
        { label: "Dashboard RH",       path: "/rh",                icon: <LayoutGrid   size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Recrutamento",
      items: [
        { label: "Candidatos",         path: "/rh/recrutamento",   icon: <Users        size={15} strokeWidth={1.5} /> },
        
      ],
    },
    {
      title: "Gestão",
      items: [
        { label: "Conversas 1:1",      path: "/rh/conversas",      icon: <MessageSquare size={15} strokeWidth={1.5} /> },
        { label: "Sala de reunião",    path: "/rh/sala-reuniao",   icon: <Video        size={15} strokeWidth={1.5} /> },
      ],
    },
  ],
};
