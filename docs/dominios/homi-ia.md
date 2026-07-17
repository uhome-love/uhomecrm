# Domínio 5 — HOMI (IA)

> **HOMI = camada de IA do CRM.** Rebranding interno de "assistant" para "HOMI"; múltiplas edge functions especializadas por persona/contexto, todas usando Lovable AI Gateway (Gemini/GPT/Claude sem chave direta).

---

## 1. Propósito de negócio

Prover assistente conversacional e automação inteligente em vários pontos do sistema: qualificação automática de leads, sugestões de próxima ação para corretor, análise de conversas, briefing diário, coach para gestor, insights para CEO, e criação de conteúdo para Marketing.

---

## 2. Tabelas envolvidas

- `homi_conversations` (12 col, 4 policies) — histórico de chats HOMI por usuário. Volume 30d: **82 conversas**.
- `homi_documents` (12 col, 4 policies) — documentos base de conhecimento (empresa).
- `homi_chunks` (6 col, 2 policies) — chunks vetorizados (RAG).
- `homi_alerts` (10 col, 2 policies) — alertas gerados por IA.
- `homi_briefing_diario` (11 col, 4 policies) — briefing pré-computado.
- `ai_calls` (17 col, 3 policies) — chamadas telefônicas IA (ElevenLabs)
- `ai_call_sessions` (11 col, 1 policy)
- `ia_call_results` (11 col, 1 policy)

### RLS
- `homi_conversations`: user vê a própria; admin tudo.
- `homi_documents`/`homi_chunks`: leitura para todos autenticados; write só admin (base de conhecimento é global).

---

## 3. Fluxo e as personas

```
┌──────────────────────────────────────────────────────────────────┐
│                    LOVABLE AI GATEWAY                             │
│  https://ai.gateway.lovable.dev/v1/chat/completions               │
│  Modelos: google/gemini-2.5-flash-lite, gemini-2.5-flash,         │
│           gemini-2.5-pro, gpt-5, claude-*                         │
│  Sem key direta — usa LOVABLE_API_KEY (env)                       │
└──────────────────────────────────────────────────────────────────┘
                        ▲
                        │ chamadas
┌───────────────────────┴────────────────────────────────────────┐
│                                                                  │
│  homi-chat        — chat genérico (default)                      │
│  homi-assistant   — assistente contextual dentro do lead         │
│  homi-copilot     — sugestão em WhatsApp/atendimento (15 msgs)   │
│  homi-gerencial   — gestor: análise de time, alertas             │
│  homi-ceo         — CEO: KPIs, forecast, direção                 │
│  homi-ana         — Ana Paula (Marketing): conteúdo/campanhas    │
│  homi-briefing    — briefing diário automático (cron)            │
│  homi-focus-suggestion — sugestão de próximo lead em foco        │
│  homi-personalizar-mensagem — reescreve msg no tom do corretor   │
│  ceo-advisor      — pergunta livre para direção                  │
│  funnel-coach     — coach de funil por corretor                  │
│  checkpoint-coach — coach nas metas diárias                      │
│  auto-one-on-one  — gera relatório 1:1 mensal                    │
│  generate-corretor-report                                        │
│  generate-monthly-report                                         │
│  generate-followup / generate-script / generate-sequence         │
│  parse-marketing-report — extrai KPIs de PDF                     │
│  lead-intelligence-insights                                      │
│  recovery-agent                                                  │
│  uhome-ia-core    — orquestrador base (radar de oportunidade)    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**RAG**: `_shared/enterprise-knowledge.ts` carrega conhecimento do DB (`homi_documents` + `homi_chunks`) e formata por persona:
- `formatForMarketing()` — para `homi-ana`
- outras variantes por função
- fallback estático se DB indisponível

**Voz outbound (ai_calls)**
```
UI → twilio-ai-call → Twilio TwiML → ElevenLabs
                     twilio-ai-twiml (voice loop)
                     twilio-ai-status (callback status)
                     elevenlabs-webhook (transcrição)
                     ia-call-result (finaliza + grava)
```

---

## 4. Componentes e hooks

- `src/contexts/HomiContext.tsx` — contexto global de sessão HOMI
- `src/components/HomiGreeting.tsx`
- `src/components/homi/*` — UI de chat
- `src/pages/HomiAna.tsx`, `src/pages/HomiCeo.tsx`
- Hooks: `useHomiActions`, `useHomiAlerts`, `useUhomeIa`
- `src/lib/focusSuggestions.ts`, `focusTelemetry.ts` — integração com Modo Foco

---

## 5. Detalhes de cada function

| Function | Persona/uso | Modelo (visto no código) | Sistema prompt (resumo) |
|---|---|---|---|
| `homi-chat` | Default (chat livre) | Gemini 2.5 flash | Assistente CRM UHome |
| `homi-assistant` | Dentro do lead | Gemini flash | Contexto do lead injetado |
| `homi-copilot` | WhatsApp inbox | Gemini 2.5 flash | 15 últimas msgs, tom UHome |
| `homi-gerencial` | Gestor | Gemini flash | KPIs da equipe |
| `homi-ceo` | CEO | Gemini pro | Visão executiva; puxa `ceo_metas_mensais`, `executive_reports` |
| `homi-ana` | Ana Paula (Marketing) | Gemini flash | Empreendimentos + calendário; formata para Reels/Insta/TikTok |
| `homi-briefing` | Cron manhã | Gemini flash | Briefing de tarefas do dia |
| `homi-focus-suggestion` | Modo Foco | Gemini flash lite | Escolhe próximo lead |
| `homi-personalizar-mensagem` | Reescrever msg | Gemini flash lite | Ajusta tom |
| `ceo-advisor` | Q&A CEO | Gemini pro | KPIs + docs |
| `funnel-coach` | Funil por corretor | Gemini flash | Diagnóstico simples |
| `checkpoint-coach` | Metas diárias | Gemini flash | Coach 1:1 |
| `auto-one-on-one` | Relatório 1:1 | Gemini flash | Mensal |
| `generate-corretor-report` | Relatório individual | Gemini flash | — |
| `generate-monthly-report` | Relatório mensal | Gemini flash | — |
| `generate-followup` | Msg follow-up | Gemini flash lite | — |
| `generate-script` | Script ligação | Gemini flash | — |
| `generate-sequence` | Sequência de nutrição | Gemini flash | — |
| `parse-marketing-report` | Extrair KPIs de PDF | Gemini flash + Vision | — |
| `lead-intelligence-insights` | Insights por lead | Gemini flash | — |
| `recovery-agent` | Recuperar descartados | Gemini flash | — |
| `uhome-ia-core` | Radar oportunidade | Gemini flash | Base de todas |

**Diferença real entre chat/copilot/assistant/gerencial/ceo/ana**: contexto injetado no system prompt e os dados que a função busca antes de chamar o LLM. O modelo LLM em si é similar (Gemini flash/lite majoritariamente). `homi-ana` e `homi-ceo` são as mais especializadas.

**Custo/orçamento**: não há budget explícito nem contador de tokens visível no schema. Não há tabela `ai_usage` ou `ai_budget`. Custo é rastreado só pelo Lovable AI Gateway dashboard.

---

## 6. Regras não óbvias

- **`_shared/ai-helpers.ts`** centraliza chamada, CORS e error handling. Todas as funções usam `withCorsAndErrorHandling`.
- **`enterprise-knowledge.ts`** tem 3 níveis: DB → parcial → fallback estático. Sempre retorna algo.
- **HOMI Copilot analisa exatamente 15 msgs** (mem://ai/homi-copilot-automacao). Não configurável.
- **`homi-ana` conhece empreendimentos "de cor"** — knowledge é carregado do DB (`empreendimento_fichas`, `empreendimento_overrides`).
- **Auto-reply IA (`whatsapp-ai-reply`)** qualifica sem fazer promessa imediata (mem://features/whatsapp/ai-auto-reply-and-monitoring).
- **`ai_replied=true` em pipeline_leads** marca que IA já respondeu — evita loop.
- **HOMI Alerts cacheados 4h em sessão** (mem://features/pipeline/modo-foco-criterios).

---

## 7. Decisões de design

- Todas as funções migraram para `_shared/ai-helpers.ts` na "Phase 1" (visto no header de `homi-ana/index.ts`: *"Phase 1: Migrated to shared helpers. Phase 2: Enterprise knowledge loaded from DB via enterprise-knowledge helper."*).
- Preferência por Gemini Flash Lite para custo — Pro só onde estratégico (CEO).
- Lovable AI Gateway em vez de chaves diretas (política do produto).

---

## 8. Dependências

**Consome de:** tudo (é camada transversal). Base de conhecimento em `empreendimento_fichas`, `empreendimento_overrides`, `pipeline_leads`, `visitas`, `negocios`.

**Produz para:** `pipeline_atividades` (sugestões), `homi_alerts`, `homi_briefing_diario`, `homi_conversations`, `ai_calls`.

---

## 9. Perguntas em aberto

1. Não há tabela `ai_usage` / contador de tokens — como é feito controle de custo?
2. 82 conversas HOMI em 30 dias — é baixo para o número de usuários (~25 corretores + gerentes). Adoção real?
3. `recovery-agent` e `ceo-advisor` — separado do `homi-ceo`/`recovery` porquê?
4. `homi-briefing` roda em cron? Qual horário? Não vi cron_health entry.
5. `uhome-ia-core` — é usado hoje ou foi substituído por `homi-*`?
6. Base de conhecimento (`homi_documents`) — quem mantém? Última atualização?
7. Auto-reply IA (`whatsapp-ai-reply`) — está ligada em produção agora? Não há flag clara.
8. `homi-ana` — foi projetada só para Ana Paula (pessoa nomeada). Se ela sair, vira `homi-marketing`?
