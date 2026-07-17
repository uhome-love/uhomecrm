# Índice — Documentação de Domínios uhomecrm

Onboarding para IA/dev que vai trabalhar neste código. Cada arquivo abaixo cobre 9 seções: propósito, tabelas, fluxo, componentes, edge functions, regras não óbvias, decisões de design, dependências e perguntas em aberto.

## Domínios

| # | Domínio | Arquivo | Resumo (2 linhas) |
|---|---|---|---|
| 1 | Pipeline / Funil | [pipeline-funil.md](./pipeline-funil.md) | Coração do CRM. `pipeline_leads` (94 col) + 7 stages ativas + ~30 triggers. Ganho não é coluna. |
| 2 | Aquisição de Leads | [aquisicao-leads.md](./aquisicao-leads.md) | 6 canais via `receive-*-lead`. Meta backfill responde por 74%. Roleta + escala + dedup por email/telefone (ignora descartados). |
| 3 | Comunicação | [comunicacao.md](./comunicacao.md) | WhatsApp (Evolution+360dialog+WABA) em modo restrito; Email Mailgun 100% ok. 12/18 instâncias Evolution offline. |
| 4 | Nutrição/Reengajamento | [nutricao-reengajamento.md](./nutricao-reengajamento.md) | Event-driven scoring (SCORE_MAP fixo). 3 flags OFF. Central de Nutrição 100% manual desde 13/07. |
| 5 | HOMI (IA) | [homi-ia.md](./homi-ia.md) | 22 edge functions especializadas por persona. Lovable AI Gateway (Gemini). 82 conversas em 30d. |
| 6 | Imóveis & Produto | [imoveis-produto.md](./imoveis-produto.md) | Catálogo Jetimob + espelho site. Vitrines públicas. Radar lead↔imóvel. 2 catálogos coexistem. |
| 7 | Visitas | [visitas.md](./visitas.md) | 42 col, 16 policies. Confirmação por token público. **Motivo de no-show não é capturado.** |
| 8 | Pós-venda & Financeiro | [pos-venda-financeiro.md](./pos-venda-financeiro.md) | Negocios (35 col), pagadorias, comissões. Trigger de venda move stage. 3 tabelas concorrentes (negocios/oportunidades/pos_vendas). |
| 9 | Gestão & Liderança | [gestao-lideranca.md](./gestao-lideranca.md) | Dashboards gerente/CEO/diretor. PDN, forecast, ranking, checkpoint, 1:1. BRT obrigatório. |
| 10 | Gamificação & Cultura | [gamificacao-cultura.md](./gamificacao-cultura.md) | Academia, Conquistas, Pulse, Onboarding (11 passos hard-coded). **Roleta é a de distribuição — não há roleta de gamificação.** |
| 11 | Marketing | [marketing.md](./marketing.md) | Meta Ads sync, email, voz IA (Twilio+ElevenLabs), relatórios PDF via IA Vision. Melnick isolado. |
| 12 | Admin & Segurança | [admin-seguranca.md](./admin-seguranca.md) | user_roles isolado, has_role SECURITY DEFINER, 3 system_flags, RLS rollout faseado Mai/2026. |
| 13 | Automations genérico | [automations-generico.md](./automations-generico.md) | **Sem executor.** Tabela + UI existem, 0 execuções. 4 mecanismos concorrentes funcionais. |

---

## Perguntas consolidadas para o fundador

Agrupadas por urgência subjetiva do auditor. Cada bloco cita o domínio de origem.

### 🔴 Críticas (respondem risco operacional/legal)

- **[D2/D3] Meta**: `meta_backfill` responde por 74% dos leads Meta em 30d — o webhook direto está quebrado. É intencional ou bug crítico a corrigir?
- **[D3/D12] Segurança**: `evolution-webhook` público sem auth. Vulnerabilidade a corrigir ou dependência do Evolution não permite JWT?
- **[D3] WhatsApp descontinuado**: foi só desligar automações + `nutricao_enabled=false` + orientação humana, sem feature-flag por canal nem remoção de código. É essa a estratégia?
- **[D3] 12 de 18 instâncias Evolution desconectadas** — decisão de negócio (corretor saiu) ou dívida operacional?
- **[D7] Motivo de no-show não é capturado** — `cancel_reason` sempre NULL. Decisão de simplicidade ou esquecimento?
- **[D7] Incidente token público de visita (backlog 27/mai/2026)** — resolvido? `visita-public` continua `verify_jwt=false`.

### 🟡 Design/arquitetura (afetam decisões futuras)

- **[D1] 9 stages `ativo=false`** (Contato Iniciado, Busca, Pós-Visita, Visita Marcada, Visita Realizada, Possível Visita, Negócio, etc.) — versão antiga ou uso escondido? Deletar?
- **[D1] `pipeline_tipo='pos_vendas'`** (4 stages) — pipeline paralelo em uso?
- **[D1] `pipeline_playbooks` vs `pipeline_sequencias` vs `nurturing_cadencias` vs `automations`** — 4 mecanismos de "sequência". Qual é o oficial em 2026? Por que os outros não foram deletados?
- **[D1] Stage "Aprovação/Documentação"** (ordem 20, ativo=true) — fantasma no meio do funil?
- **[D2] `leads` (legado) + `leads_legado` + `leads_backup`** — aposentar oficialmente? Trigger ainda escreve em `leads`, pra quê?
- **[D2] `distribuicao_escala` vs `roleta_*`** — dois mecanismos coexistem. Regra clara de quando manda cada um?
- **[D2] Cron de redistribuição desligado em 14/05** — permanente ou temporário?
- **[D3] 3 clientes WhatsApp** (Evolution self-hosted, 360dialog, WABA) — estratégia oficial 2026?
- **[D3] `campanha_atrio_*`** — 5 tabelas + 5 funções desativadas. Deletar ou reativar?
- **[D4] `SCORE_MAP` hard-coded** em edge fn — virar tabela de config?
- **[D4] SCORE_QUENTE=30**: calibrado com dados ou palpite?
- **[D4] `nurturing_cadencias` vs `cadencia_sem_contato_passos` vs `pipeline_sequencias`** — 3 "cadências". Qual é oficial?
- **[D5] Sem tabela `ai_usage`** — como é feito controle de custo de IA?
- **[D5] `recovery-agent` e `ceo-advisor` vs `homi-ceo`/`recovery`** — separação proposital?
- **[D5] Auto-reply IA (`whatsapp-ai-reply`)** — está ligado em produção? Não há flag clara.
- **[D5] `homi-ana`** — feita para pessoa nomeada. Se ela sair, vira `homi-marketing`?
- **[D6] `imoveis_catalog` vs `properties`** — 2 catálogos. Qual é oficial?
- **[D6] `empreendimento_fichas` vs `empreendimento_overrides`** — separação clara?
- **[D6] Typesense** está ativo em produção?
- **[D8] `oportunidades` vs `negocios` vs `pos_vendas`** — 3 tabelas para o mesmo domínio comercial?
- **[D8] `pipeline_comissoes` vs `venda_comissoes`** — qual manda?
- **[D9] `melnick_*`** — cliente/parceiro específico? Genericar?
- **[D9] `checkpoints` vs `checkpoint_diario` vs `checkpoint_lines`** — três tabelas de checkpoint?
- **[D9] `relatorios_1_1` vs `one_on_one_reports`** — 2 tabelas para 1:1?
- **[D9] `funnel_entries` vs `marketing_entries`** — mesmo modelo?
- **[D10] Confirmação**: só existe UMA roleta (distribuição). Havia intenção de gamificação com mesmo nome?
- **[D10] `saved_scripts` vs `team_scripts` vs `marketplace_scripts`** — 3 fontes?
- **[D13] Automations**: implementar executor ou remover UI+tabelas de vez?

### 🟢 Curiosidades (afetam entendimento, não urgência)

- [D1] Campos `modo_conducao`, `tipo_acao`, `prioridade_acao`, `modulo_atual` — parecem vazios. Para quê foram criados?
- [D1] `is_redistribuicao`, `motivo_redistribuicao`, `corretor_anterior_id` — fluxo formal ou só telemetria?
- [D2] `receive-tiktok-lead` — TikTok Ads ativo hoje?
- [D2] `crm-webhook` (genérico) — quem aponta para ele?
- [D2] Dedup ignora descartados — se cliente descarta 2x, reentra 3ª vez. É intenção?
- [D5] Base de conhecimento HOMI — quem mantém? Última atualização?
- [D5] `uhome-ia-core` — ainda usado ou substituído por `homi-*`?
- [D6] Vitrines públicas — quantas ativas em média? Expiração?
- [D6] `anuncio_materiais` — para que serve?
- [D7] `lead_site_id` vs `pipeline_lead_id` vs `lead_id` — 3 FKs para lead na tabela visitas?
- [D7] `linked_pdn_id`/`converted_to_pdn_*` — usado?
- [D7] `tipo` vs `tipo_reuniao` na tabela visitas — dois campos parecidos?
- [D7] `visita_amanha_config/disparos` vs `visita-whatsapp-confirm` — feature duplicada?
- [D8] `requer_aprovacao_ceo` — como CEO aprova? Não há tela clara.
- [D8] `intermediacoes` — usada ativamente?
- [D9] `manager_checklist`, `corretor_motivations` — quem preenche?
- [D9] `pdn_entries` (40 col) — todas colunas em uso?
- [D10] Academia — quantos completaram trilhas em 30d?
- [D10] Marketplace 4 tabelas sem edge fn — feature ativa ou draft?
- [D10] Onboarding 11 passos hard-coded — mover para DB?
- [D11] `voice_campaigns` — volume atual?
- [D11] `campaign_clicks` alimenta scoring?
- [D11] `conteudos_marketing` sync com Google Drive?
- [D11] `brevo_contacts` — one-off ou contínuo?
- [D12] `campaign_dispatch_enabled=true` mas disparo em massa desligado — flag deveria ficar `false` por clareza?
- [D12] `audit_log_atrio_22_05_2026` — deletar após backup?
- [D12] `secrets-tripwire` — dispara em quê? Última execução?
- [D12] Enum `app_role` (admin, gerente, corretor, diretor, ceo, backoffice, marketing, rh) — todos em uso?

---

## Resumo executivo para o próximo dev

1. **O pipeline (`pipeline_leads`) é o centro do sistema** — 94 colunas, ~30 triggers, tudo gira em torno.
2. **Motor de disparo em massa está DESLIGADO** por 3 flags em série (kill switches). Ver Domínio 4.
3. **HOMI = camada IA** — 22 edge functions especializadas por persona, tudo via Lovable AI Gateway (Gemini).
4. **Automations tabela existe mas sem executor.** 4 mecanismos concorrentes fazem o mesmo trabalho.
5. **Muitos schemas duplicados** (oportunidades vs negocios, 1:1 em 2 tabelas, cadências em 3, catálogo em 2, checkpoints em 3, scripts em 3). Débito estrutural histórico.
6. **BRT obrigatório em toda lógica temporal** (usar `formatBRT()`).
7. **`team_members` é fonte única de hierarquia** — nunca inventar outro caminho.
8. **RLS profundas em visitas (16 policies)** — não simplificar sem entender.
9. **Índice UNIQUE ignora descartados** — feature de reengajamento, não bug.
10. **Regras permanentes de engenharia**: máx 2 migrations/dia 08-19h BRT; arquivo >500 linhas dividir; sem `as any`; webhook público valida por token/HMAC. Ver `mem://rules/engineering/permanent-rules-2026-05`.
