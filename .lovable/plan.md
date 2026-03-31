

# Plano Completo — Automação e Nutrição de Leads Event-Driven

## O que já existe

- **cron-nurturing-sequencer**: Executa steps pendentes (WhatsApp + Email via Mailgun)
- **reactivate-cold-leads**: Varredura semanal por segmento, agenda sequências fixas
- **twilio-ai-call**: Ligações individuais ElevenLabs + Twilio (CEO)
- **elevenlabs-webhook**: Processa transcrições e resultados de chamadas
- **DisparadorLigacoesIA**: Página de discagem sequencial
- **NurturingDashboard**: Painel com abas Visão Geral e Reativação
- **SequenceTemplates**: Templates de sequências (boas-vindas, reengajamento, etc.)
- **whatsapp-webhook / mailgun-webhook / site-events**: Webhooks já recebem eventos

## O que será construído

### Fase 1 — Estado Central + Lead Scoring (Fundação)

**Migration**: Criar tabela `lead_nurturing_state` com campos de estado, scoring, último evento, próximo step e metadata. Índices em `proximo_step_at` e `pipeline_lead_id`.

**Edge Function `nurturing-orchestrator`**: Cérebro central event-driven.
- Recebe eventos de qualquer canal (WhatsApp lido, email aberto, vitrine vista, voz atendida, lead parado)
- Consulta `lead_nurturing_state` do lead
- Aplica tabela de scoring (+1 entregue, +3 lido, +15 respondeu, +10 vitrine, +20 voz atendida, -50 opt-out)
- Decide próxima ação baseado no score (30+ = notificar corretor, 15-29 = WhatsApp, 5-14 = multicanal, 0-4 = só email/voz, <0 = parar)
- Agenda próximo step ou cancela sequência se lead respondeu
- Registra tudo no histórico

**Alterações nos webhooks existentes**: `whatsapp-webhook`, `mailgun-webhook` e `site-events` passam a chamar o orquestrador via fetch interno quando detectam interações relevantes (msg lida, email aberto, vitrine visualizada).

### Fase 2 — Cadências Inteligentes Baseadas em Comportamento

**Refatorar `cron-nurturing-sequencer`**: Em vez de executar cegamente steps por dia, consulta `lead_nurturing_state` para checar score e último evento. Se lead já interagiu, pula ou adapta o step.

**Refatorar `reactivate-cold-leads`**: Ao agendar sequências, cria também o registro em `lead_nurturing_state`. Implementa lógica de horário inteligente (WhatsApp 8-21h, Email 7-22h, Voz 9-20h BRT). Steps fora da janela são reagendados.

**3 cadências atualizadas** em `SequenceTemplates.tsx`:
- **Sem Contato Agressivo**: D0 WA → D1 Email → D3 WA (condicional) → D5 Voz → D7 Alerta → D10 Email → D14 Descarte
- **Qualificação Parada**: D0 WA → D2 Email → D4 WA (adaptativo por score) → D7 Voz → D10 Alerta → D14 Email
- **Reativação Fria**: D0 Email → D3 WA (só se abriu email) → D7 Voz → D10 Email (só se interagiu) → D14 Avaliação score

**Lógica de fallback entre canais**: WA falhou 24h → Email. Email não abriu 48h → sugerir voz. Voz não atendeu → WA imediato "Tentamos te ligar".

### Fase 3 — Campanhas de Voz IA em Lote

**Migration**: Criar tabelas `voice_campaigns` e `voice_call_logs` com campos de resultados agregados, transcrição, sentimento e próximo passo.

**Edge Function `voice-campaign-launcher`**:
- Recebe lista de lead_ids + template de campanha
- Valida horário (9-20h BRT, seg-sex)
- Processa em batches de 50 com intervalo de 30s entre ligações
- Usa `twilio-ai-call` existente como base, adaptado para lote
- Atualiza `voice_campaigns` com progresso em tempo real

**Atualizar `elevenlabs-webhook`**: Quando recebe resultado de ligação de campanha, atualiza `voice_call_logs` e chama o orquestrador para ajustar score e próximo step do lead.

**Templates de agente ElevenLabs**: 4 templates em pt-BR (reativação, novidades, confirmação interesse, convite visita) com persona HOMI gaúcha e regras de opt-out.

### Fase 4 — Dashboard CEO Completo

**Nova rota `/ceo/campanhas-voz`**: Interface para criar,