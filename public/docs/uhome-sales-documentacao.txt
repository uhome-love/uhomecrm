# 📋 UHome Sales — Documentação Completa do Sistema

**Versão:** Março 2026  
**Plataforma:** Aplicação Web (React + Vite + TypeScript)  
**Backend:** Lovable Cloud (Supabase)  
**Região:** Porto Alegre, RS — Brasil  

---

## 1. VISÃO GERAL

O **UHome Sales** é uma plataforma de gestão comercial completa para o mercado imobiliário, desenvolvida para a operação da **Uhome** em Porto Alegre. O sistema gerencia todo o ciclo de vida do lead — desde a captação até o pós-venda — com inteligência artificial embarcada, gamificação, e dashboards em tempo real para todos os níveis hierárquicos.

### 1.1 Objetivos do Sistema
- Centralizar a operação comercial imobiliária em uma única plataforma
- Automatizar processos de distribuição, acompanhamento e recuperação de leads
- Fornecer visibilidade em tempo real para CEO, gestores e corretores
- Aumentar a conversão através de IA, scripts inteligentes e coaching automatizado
- Gamificar a operação para engajamento da equipe

---

## 2. PERFIS DE USUÁRIO (ROLES)

O sistema utiliza controle de acesso baseado em papéis (RBAC) com 5 perfis:

| Role | Descrição | Dashboard Principal |
|------|-----------|-------------------|
| **admin** | CEO / Diretor — acesso total | `/ceo` |
| **gestor** | Gerente de equipe | `/gerente/dashboard` |
| **corretor** | Corretor de imóveis | `/corretor` |
| **backoffice** | Equipe administrativa | `/backoffice` |
| **rh** | Recursos Humanos / Recepção | `/rh` |

### 2.1 Permissões por Role

**Admin (CEO):**
- Acesso total a todos os módulos
- Roleta de Leads, Escala Diária, Integrações
- HOMI CEO (IA gerencial)
- Painel de Usuários, Auditoria
- Marketing Dashboard, Dev AI

**Gestor:**
- Central do Gerente (Checkpoint)
- Meu Time, Pipeline de Leads/Negócios
- Rankings, Relatórios 1:1
- HOMI Gerente, Templates, Academia (gerenciar)
- Busca de Leads, Disponibilidade

**Corretor:**
- Minha Rotina (Dashboard pessoal)
- Pipeline de Leads/Negócios, Agenda de Visitas
- Oferta Ativa (Ligações), Aceite de Leads
- Meu Desempenho, Rankings, Conquistas
- HOMI Assistente, Academia, Scripts

**Backoffice:**
- Dashboard operacional
- Tarefas & Marketing
- Pagadorias, Solicitações, Cadastros
- HOMI Ana (assistente IA)

**RH:**
- Dashboard RH
- Candidatos, Entrevistas
- Conversas 1:1, Sala de Reunião

---

## 3. MÓDULOS DO SISTEMA

### 3.1 🏠 Dashboard CEO (`/ceo`)
Visão executiva consolidada com:
- KPIs gerais: VGV Gerado/Assinado, Leads, Visitas, Propostas
- Comparativo mensal e por equipe
- Ranking de corretores e equipes
- Funil comercial completo
- Metas por gerente (`ceo_metas_mensais`)

### 3.2 📊 Dashboard do Gerente (`/gerente/dashboard`)
Painel gerencial com métricas do time:
- Performance do time no período
- Visitas marcadas vs realizadas
- Ligações e aproveitamento (Oferta Ativa)
- Presença e disponibilidade

### 3.3 👤 Dashboard do Corretor (`/corretor`)
Rotina diária do corretor:
- Tarefas do dia, Leads pendentes
- Métricas pessoais (ligações, visitas, VGV)
- Briefing diário gerado por IA (HOMI)
- Motivação do dia

### 3.4 📋 Central do Gerente / Checkpoint (`/central-do-gerente`)
Sistema de acompanhamento diário:
- Checkpoint por corretor (presença, metas, resultados)
- Metas diárias: ligações, aproveitados, visitas
- Resultados reais vs metas planejadas
- Observações do dia e do gerente
- Coach IA integrado para feedback

**Tabelas:** `checkpoints`, `checkpoint_lines`, `checkpoint_diario`

### 3.5 🔄 Roleta de Leads (`/roleta`)
Sistema automático de distribuição de leads:
- Credenciamento por segmento e janela (manhã/tarde/noturna)
- Fila dinâmica com algoritmo de distribuição
- Aprovação de credenciamento pelo CEO
- Histórico de distribuição
- Escalação automática de leads não aceitos

**Tabelas:** `roleta_credenciamentos`, `distribuicao_escala`, `distribuicao_historico`, `corretor_disponibilidade`

### 3.6 📌 Pipeline de Leads (`/pipeline-leads`)
Kanban visual para gestão de leads:
- Etapas configuráveis (`pipeline_stages`)
- Score dinâmico (0-100) por lead
- Tarefas automáticas por etapa (Playbooks)
- Alertas de SLA (10 min resposta padrão)
- Leads "desatualizados" com indicador visual
- Normalização de telefone via trigger
- Histórico de movimentações

**Tabelas:** `pipeline_leads`, `pipeline_stages`, `pipeline_historico`, `pipeline_tarefas`, `pipeline_segmentos`

### 3.7 💼 Pipeline de Negócios (`/pipeline-negocios`)
Gestão de negociações e vendas:
- Fases: Proposta → Negociação → Documentação → Assinado → Vendido
- VGV Estimado e Final
- Rateio 50/50 em parcerias (`pipeline_parcerias`)
- Data de assinatura para contabilização

**Tabelas:** `negocios`

### 3.8 📞 Oferta Ativa (`/oferta-ativa` | `/corretor/call`)
Sistema de prospecção telefônica:
- Listas de contatos personalizadas
- Registro de tentativas e resultados
- Sessões de coaching com métricas
- Feedback IA pós-sessão
- Listas customizadas com filtros

**Tabelas:** `oferta_ativa_listas`, `oferta_ativa_tentativas`, `coaching_sessions`, `custom_lists`, `custom_list_sessions`

### 3.9 📅 Agenda de Visitas (`/agenda-visitas`)
Gestão de visitas a imóveis:
- Marcação, confirmação e realização
- Status: marcada, confirmada, realizada, reagendada, cancelada, no_show
- Confirmação via WhatsApp (link público)
- Integração com Pipeline de Leads

**Tabela:** `visitas`

### 3.10 ✅ Aceite de Leads (`/aceite`)
Fluxo de aceite/rejeição de leads distribuídos:
- Leads com timer de expiração
- Aceite ou rejeição com motivo
- Escalação automática se não aceito

### 3.11 🏆 Rankings (`/ranking`)
Sistema de ranking ponderado:
- **Prospecção (20%):** Ligações, aproveitados
- **Gestão (30%):** Pontos por avanço no pipeline (Contato=5, Qualificação=10, V.Marcada=30, V.Realizada=50)
- **Vendas (40%):** VGV assinado, propostas
- **Eficiência (10%):** Taxas de conversão

**Períodos:** Dia, Semana, Mês, Custom

### 3.12 📈 Relatórios 1:1 (`/relatorios`)
Relatórios individuais por corretor:
- Gerados por IA com análise contextual
- Métricas detalhadas do período
- Score de performance
- Observações do gerente

**Tabela:** `corretor_reports`

### 3.13 🏅 Conquistas e Gamificação (`/conquistas`)
Sistema de gamificação:
- Badges e conquistas desbloqueáveis
- Níveis por pontuação (XP)
- Notificação de novas conquistas
- Avatar gamificado

**Tabelas:** `corretor_conquistas`, `corretor_motivations`

### 3.14 🤖 HOMI — Assistentes IA
Suite de assistentes inteligentes:

| Assistente | Rota | Público | Função |
|-----------|------|---------|--------|
| HOMI Assistente | `/homi` | Corretor | Dúvidas sobre imóveis, scripts, objeções |
| HOMI Gerente | `/homi-gerente` | Gestor | Análise de time, coaching, estratégia |
| HOMI CEO | `/homi-ceo` | Admin | Visão executiva, decisões estratégicas |
| HOMI Ana | `/backoffice/homi-ana` | Backoffice | Suporte operacional/financeiro |

**Recursos:**
- Base de conhecimento customizável (`homi_documents`, `homi_chunks`)
- Histórico de conversas (`homi_conversations`)
- Briefing diário automático (`homi_briefing_diario`)
- Busca semântica por embeddings

### 3.15 🏫 Academia (`/academia`)
Plataforma de treinamento:
- Trilhas de aprendizado com aulas
- Quiz e checklist por aula
- Progresso e certificados
- XP como recompensa

**Tabelas:** `academia_trilhas`, `academia_aulas`, `academia_progresso`, `academia_quiz`, `academia_certificados`

### 3.16 🏢 Imóveis (`/imoveis`)
Catálogo de imóveis:
- Integração com Jetimob (sincronização)
- Fichas de empreendimento customizáveis
- Overrides visuais (fotos, plantas, descrições)
- Radar de imóveis por perfil do lead

**Tabelas:** `empreendimento_fichas`, `empreendimento_overrides`

### 3.17 📢 Anúncios no Ar (`/anuncios`)
Gestão de materiais de marketing:
- Materiais por empreendimento e segmento
- Upload de imagens, PDFs, vídeos

**Tabela:** `anuncio_materiais`

### 3.18 🎯 Campanhas Comerciais
Campanhas temporárias com páginas dedicadas:
- **Melnick Day** (`/melnick-day`) — Campanha MCMV
- **Orygem 60 Dias** (`/orygem-60`) — Campanha Médio-Alto
- **Mega da Cyrela 2026** (`/mega-cyrela`) — Campanha Premium

### 3.19 📤 Vitrine Digital (`/minhas-vitrines`)
Landing pages personalizadas por corretor:
- Link público compartilhável
- Catálogo de imóveis selecionados
- Captura de leads via formulário

### 3.20 🔗 Indicações (`/indica/:codigo`)
Sistema de referral:
- Código único por corretor
- Página pública para indicações
- Rastreamento de conversão

### 3.21 💰 Pós-Vendas (`/pos-vendas`)
Acompanhamento pós-venda:
- Status de documentação
- Timeline do negócio
- Tarefas pendentes

### 3.22 📊 Central de Marketing (`/marketing`)
Dashboard de marketing (Admin):
- Investimento em mídia, CPL
- Funil de conversão
- Análise IA de campanhas

**Tabela:** `funnel_entries`

### 3.23 💼 Backoffice (`/backoffice`)
Área administrativa:
- **Pagadorias:** Controle financeiro
- **Comissões:** Faixas de comissão por VGV
- **Cadastros:** Gestão de registros
- **Tarefas & Marketing:** Central operacional

**Tabelas:** `backoffice_tasks`, `comissao_faixas`

### 3.24 👥 RH & Recepção (`/rh`)
Área de Recursos Humanos:
- **Recrutamento:** Gestão de candidatos
- **Entrevistas:** Agendamento e acompanhamento
- **Conversas 1:1:** Registro de feedbacks
- **Sala de Reunião:** Reserva de espaços

### 3.25 🔍 Busca de Leads (`/busca-leads`)
Busca avançada na base de leads:
- Filtros por nome, telefone, empreendimento
- Higienização de base

### 3.26 ⚙️ Configurações (`/configuracoes`)
Configurações do usuário:
- Perfil, avatar, dados pessoais
- Notificações push (PWA)
- Preferências

### 3.27 📝 Auditoria (`/auditoria`)
Log completo de ações do sistema:
- Quem fez o quê, quando
- Módulo, ação, antes/depois

**Tabela:** `audit_log`

---

## 4. INTEGRAÇÕES

### 4.1 Jetimob
- Sincronização de leads (`jetimob-sync`)
- Proxy para API (`jetimob-proxy`)
- Mapeamento de campanhas (`jetimob_campaign_map`)
- Controle de leads processados (`jetimob_processed`)

### 4.2 WhatsApp
- Envio de mensagens via 360Dialog (`whatsapp-360dialog`)
- Notificações automáticas (`whatsapp-notificacao`)
- Confirmação de visitas via WhatsApp

### 4.3 Meta Ads / TikTok
- Recebimento de leads via webhook:
  - `receive-meta-lead` (Facebook/Instagram)
  - `receive-tiktok-lead` (TikTok)
  - `receive-landing-lead` (Landing Pages)

### 4.4 Typesense (Busca)
- Indexação de dados (`typesense-sync`)
- Busca rápida (`typesense-search`)
- Administração (`typesense-admin`)

### 4.5 Push Notifications (PWA)
- Geração de chaves VAPID (`generate-vapid`)
- Envio de push (`send-push`)
- Suporte offline (Service Worker)

---

## 5. EDGE FUNCTIONS (BACKEND)

| Função | Descrição |
|--------|-----------|
| `distribute-lead` | Motor de distribuição da roleta |
| `lead-escalation` | Escalação de leads não aceitos |
| `execute-sequences` | Execução de sequências automáticas |
| `generate-sequence` | Geração de sequências por IA |
| `generate-followup` | Geração de mensagens de follow-up |
| `generate-script` | Geração de scripts de venda |
| `generate-corretor-report` | Relatório individual do corretor |
| `generate-monthly-report` | Relatório executivo mensal |
| `generate-avatar` | Geração de avatar gamificado |
| `checkpoint-coach` | Coach IA para checkpoint |
| `oa-session-coaching` | Feedback IA pós-sessão de Oferta Ativa |
| `funnel-coach` | Análise IA do funil |
| `recovery-agent` | Agente de recuperação de leads |
| `ceo-advisor` | Advisor IA para o CEO |
| `homi-assistant` | Backend do HOMI Corretor |
| `homi-gerencial` | Backend do HOMI Gerente |
| `homi-ceo` | Backend do HOMI CEO |
| `homi-chat` | Chat genérico HOMI |
| `homi-briefing` | Geração de briefing diário |
| `homi-ana` | Backend do HOMI Backoffice |
| `notify` | Sistema de notificações |
| `parse-marketing-report` | Parser de relatórios de marketing |
| `uhome-ia-core` | Core de IA unificado |
| `visita-public` | Página pública de confirmação de visita |
| `vitrine-public` | Vitrine digital pública |
| `vitrine-og` | Open Graph da vitrine |
| `referral-public` | Página pública de indicação |
| `create-broker-user` | Criação de usuário corretor |
| `stalled-deals-notify` | Notificação de negócios parados |
| `ai-search-imoveis` | Busca inteligente de imóveis |
| `meta-ads-sync` | Sincronização Meta Ads |

---

## 6. MÉTRICAS E DEFINIÇÕES

### 6.1 Fonte de Verdade por Métrica

| Métrica | Tabela | Filtro | ID Corretor |
|---------|--------|--------|-------------|
| Ligação | `oferta_ativa_tentativas` | `created_at` no período | `auth.user_id` |
| Aproveitado | `oferta_ativa_tentativas` | `resultado = 'com_interesse'` | `auth.user_id` |
| Visita Marcada | `visitas` | `created_at` + status ≠ cancelada | `auth.user_id` |
| Visita Realizada | `visitas` | `data_visita` + status = 'realizada' | `auth.user_id` |
| Proposta | `negocios` | fase IN (proposta, negociacao, documentacao) | `profiles.id` |
| VGV Gerado | `negocios` | SUM(vgv_estimado) no período | `profiles.id` |
| VGV Assinado | `negocios` | fase IN (assinado, vendido) por `data_assinatura` | `profiles.id` |
| Presença | `checkpoint_lines` | presente, home_office, externo | `team_members.id` |
| Gestão Leads | `pipeline_historico` | Pontos por avanço de etapa | `auth.user_id` |

### 6.2 Mapeamento de IDs (CRÍTICO)

O sistema possui **dois tipos de ID** para corretores:

1. **auth.user_id** (UUID de autenticação) → usado em:
   - `pipeline_leads.corretor_id`
   - `oferta_ativa_tentativas.corretor_id`
   - `visitas.corretor_id`
   - `team_members.user_id`
   - `corretor_disponibilidade.user_id`

2. **profiles.id** (UUID de perfil) → usado em:
   - `negocios.corretor_id`
   - `checkpoint_lines.corretor_id` → via `team_members.id`

### 6.3 Pesos do Ranking
- Prospecção: **20%** (ligações, aproveitados)
- Gestão: **30%** (pontos pipeline)
- Vendas: **40%** (VGV, propostas)
- Eficiência: **10%** (taxas de conversão)

---

## 7. PORTFÓLIO DE EMPREENDIMENTOS

### 7.1 Segmento MCMV (Até R$ 500k)
- Open Bosque
- Melnick Day
- Reserva do Lago (Mário Quintana)

### 7.2 Segmento Médio-Alto (R$ 500k – R$ 900k)
- Casa Tua, Las Casas, Orygem
- Me Day, Alto Lindóia, Terrace
- Alfa, Duetto, Salzburg

### 7.3 Segmento Altíssimo (> R$ 2M)
- Lake Eyre (Cristal, R$ 2M-4M)
- Seen
- Boa Vista Country Club

### 7.4 Segmento Investimento
- Shift, Casa Bastian, Melnick Day Compactos

---

## 8. TECNOLOGIAS UTILIZADAS

### 8.1 Frontend
- **React 18** com TypeScript
- **Vite** (build tool)
- **Tailwind CSS** + shadcn/ui (design system)
- **Framer Motion** (animações)
- **TanStack React Query** (cache/estado servidor)
- **React Router DOM** (navegação)
- **Recharts** (gráficos)
- **Leaflet** (mapas)
- **PWA** (Progressive Web App com push notifications)

### 8.2 Backend (Lovable Cloud)
- **Supabase** (PostgreSQL, Auth, Storage, Edge Functions)
- **Edge Functions** (Deno/TypeScript)
- **Row Level Security** (RLS) em todas as tabelas
- **Realtime** para atualizações em tempo real

### 8.3 IA
- Modelos via Lovable AI (sem necessidade de API key)
- Google Gemini e OpenAI GPT para diferentes funções
- Embeddings para busca semântica (HOMI)

### 8.4 Integrações Externas
- Jetimob (CRM imobiliário)
- WhatsApp 360Dialog
- Meta Ads API
- TikTok Lead Ads
- Typesense (busca)

---

## 9. ARQUITETURA DE SEGURANÇA

- **Autenticação:** Email + senha via Supabase Auth
- **Autorização:** RBAC via tabela `user_roles` + função `has_role()`
- **RLS:** Políticas em todas as tabelas sensíveis
- **Roles em tabela separada:** Nunca no perfil do usuário
- **Edge Functions:** JWT verification configurável
- **Audit Log:** Registro completo de ações

---

## 10. FLUXOS PRINCIPAIS

### 10.1 Fluxo do Lead
```
Captação (Meta/TikTok/Landing/Jetimob/Manual)
    ↓
Roleta de Distribuição (por segmento + janela)
    ↓
Aceite pelo Corretor (timer de expiração)
    ↓
Pipeline de Leads (Kanban com etapas)
    ↓
Visita Marcada → Confirmação WhatsApp → Realizada
    ↓
Pipeline de Negócios (Proposta → Negociação → Documentação)
    ↓
Assinatura / Venda
    ↓
Pós-Vendas
```

### 10.2 Fluxo de Recuperação
```
Lead Inativo (sem contato, parou de responder, etc.)
    ↓
Recovery Agent (IA analisa e classifica)
    ↓
Score de Recuperação (0-100)
    ↓
Oferta Ativa (ligação de prospecção)
    ↓
Reativação no Pipeline
```

### 10.3 Rotina Diária do Corretor
```
1. Login → Briefing HOMI
2. Checkpoint (metas do dia)
3. Sessão de Oferta Ativa (ligações)
4. Gestão do Pipeline (tarefas, leads)
5. Visitas agendadas
6. Atualização de negócios
7. Aceite de novos leads (roleta)
```

---

## 11. ROTAS DO SISTEMA

### Públicas (sem autenticação)
| Rota | Página |
|------|--------|
| `/auth` | Login / Cadastro |
| `/welcome` | Boas-vindas |
| `/visita/:token` | Confirmação de visita (público) |
| `/indica/:codigo` | Página de indicação (público) |
| `/vitrine/:id` | Vitrine digital (público) |

### Autenticadas (todos os roles)
| Rota | Página |
|------|--------|
| `/` | Home Dashboard |
| `/corretor` | Dashboard Corretor |
| `/pipeline-leads` | Pipeline Kanban |
| `/pipeline-negocios` | Pipeline Negócios |
| `/agenda-visitas` | Agenda de Visitas |
| `/oferta-ativa` | Oferta Ativa |
| `/aceite` | Aceite de Leads |
| `/ranking` | Rankings |
| `/conquistas` | Conquistas |
| `/scripts` | Gerador de Scripts |
| `/academia` | Academia |
| `/homi` | HOMI Assistente |
| `/configuracoes` | Configurações |
| `/notificacoes` | Notificações |
| `/imoveis` | Catálogo de Imóveis |
| `/vendas-realizadas` | Vendas Realizadas |
| `/pos-vendas` | Pós-Vendas |

### Gestor + Admin
| Rota | Página |
|------|--------|
| `/central-do-gerente` | Checkpoint |
| `/gerente/dashboard` | Dashboard Gerente |
| `/meu-time` | Gestão do Time |
| `/relatorios` | Relatórios 1:1 |
| `/busca-leads` | Busca de Leads |
| `/homi-gerente` | HOMI Gerente |
| `/disponibilidade` | Disponibilidade |
| `/templates-comunicacao` | Templates |

### Admin Only
| Rota | Página |
|------|--------|
| `/ceo` | Dashboard CEO |
| `/roleta` | Roleta de Leads |
| `/escala-diaria` | Escala Diária |
| `/marketing` | Central de Marketing |
| `/admin` | Painel de Usuários |
| `/auditoria` | Auditoria |
| `/integracao` | Integração Jetimob |
| `/homi-ceo` | HOMI CEO |
| `/dev-ai` | Dev AI |

### Backoffice
| Rota | Página |
|------|--------|
| `/backoffice` | Dashboard |
| `/backoffice/pagadorias` | Pagadorias |
| `/backoffice/solicitacoes-pagadoria` | Solicitações |
| `/backoffice/comissoes` | Comissões |
| `/backoffice/tarefas` | Tarefas & Marketing |
| `/backoffice/homi-ana` | HOMI Ana |
| `/backoffice/cadastros` | Cadastros |

### RH
| Rota | Página |
|------|--------|
| `/rh` | Dashboard RH |
| `/rh/recrutamento` | Candidatos |
| `/rh/entrevistas` | Entrevistas |
| `/rh/conversas` | Conversas 1:1 |
| `/rh/sala-reuniao` | Sala de Reunião |

---

## 12. CONTATO E SUPORTE

- **Plataforma:** [uhomeia.lovable.app](https://uhomeia.lovable.app)
- **Assistente IA:** HOMI (disponível em cada perfil)
- **Suporte Técnico:** Via plataforma Lovable

---

*Documento gerado automaticamente em Março/2026. Para atualizações, consulte o código-fonte do sistema.*
