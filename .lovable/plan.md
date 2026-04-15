

## Plano: WhatsApp Send via Evolution API + HOMI Copilot com Conhecimento Completo do CRM

### Problema 1 — Ebert não consegue enviar mensagem

**Causa raiz:** O `whatsapp-send` envia TODAS as mensagens pela Meta Business API (número da empresa). Mas o Ebert tem uma instância Evolution API pessoal (`uhome-b5c6344b`, status: `conectado`). As mensagens enviadas pela Meta saem de outro número — o lead não recebe no WhatsApp "normal" e o Inbox não registra corretamente.

**Solução:** O `whatsapp-send` precisa verificar se o corretor tem uma instância Evolution conectada. Se sim, enviar pela Evolution API (`POST /message/sendText/{instanceName}`). Se não, usar Meta API como fallback.

### Problema 2 — HOMI Copilot com conhecimento superficial

**Causa raiz:** O prompt atual só tem: nome, etapa, empreendimento e budget. Não sabe nada sobre os empreendimentos reais, campos do lead, tarefas pendentes, visitas, histórico de atividades, ou o contexto operacional do CRM.

**Solução:** Enriquecer a Edge Function `homi-copilot` com queries adicionais para montar um briefing completo.

---

### Alterações técnicas

**1. `supabase/functions/whatsapp-send/index.ts`** — Roteamento Evolution vs Meta

- Após autenticação, resolver `profile_id` do usuário autenticado
- Consultar `whatsapp_instancias` para esse `corretor_id`
- Se instância com `status = 'conectado'` existir:
  - Enviar via Evolution API: `POST {EVOLUTION_API_URL}/message/sendText/{instance_name}`
  - Headers: `{ apikey: EVOLUTION_API_KEY }`
  - Body: `{ number: phone, text: mensagem }`
- Se não tiver instância conectada → usar Meta API (comportamento atual)
- Usar `SUPABASE_SERVICE_ROLE_KEY` para bypass RLS na query de instâncias

**2. `supabase/functions/homi-copilot/index.ts`** — Conhecimento completo do CRM

Adicionar queries paralelas para buscar:
- **Lead completo:** todos os campos relevantes (origem, objetivo_cliente, bairro_regiao, forma_pagamento, imovel_troca, nivel_interesse, temperatura, tags, observacoes, campanha, primeiro_contato_em, dados_site)
- **Etapas do pipeline:** todas as etapas ativas com nomes reais
- **Tarefas pendentes:** últimas 5 tarefas do lead (titulo, tipo, status, vence_em)
- **Visitas:** agendadas/realizadas (data, status, empreendimento)
- **Atividades recentes:** últimas 5 atividades (tipo, titulo, data)

Reescrever o prompt para incluir:
- Perfil completo do lead com todos os dados disponíveis
- Lista real das etapas do pipeline (Novo Lead → Sem Contato → Contato Iniciado → Busca → Aquecimento → Visita → Pós-Visita → Negócio Criado → Descarte)
- Empreendimentos da empresa (Casa Tua, Open Bosque, Lake Eyre, Orygem, Las Casas, Casa Bastian, Alto Lindóia, Connect JW, Shift, High Garden Iguatemi, etc.)
- Contexto operacional: tarefas pendentes, próxima ação agendada, visitas
- Regras do CRM: quando mover etapa, quando criar tarefa, quando agendar visita
- Informações sobre ações disponíveis no sistema (mover etapa, criar tarefa, agendar visita)

**3. `src/components/whatsapp/ConversationThread.tsx`** — Guard anti-duplicação

- Adicionar `sendingRef = useRef(false)` como lock imediato no `handleSend`
- Previne race condition entre Enter + click simultâneo

**4. `src/components/whatsapp/ConversationThread.tsx`** — Tarefa mais completa

Expandir o popover de criação de tarefa:
- Tipo: Follow-up, Ligação, Enviar material, Reunião, Outro
- Descrição (textarea opcional)
- Prioridade: Normal, Alta, Urgente
- Data personalizada (date picker) além dos presets

**5. `src/components/whatsapp/HomiCopilotCard.tsx`** — Contexto bidirecional

- Manter HOMI visível mesmo após corretor enviar (não só quando última msg é `received`)
- Passar `messages` array ao invés de apenas `lastMessage` string
- Re-trigger análise quando corretor envia (com debounce)

### Resultado esperado
- Ebert e corretores com Evolution conectada enviam pelo número pessoal
- Corretores sem instância continuam usando Meta API
- HOMI conhece todo o CRM: empreendimentos, etapas, tarefas, visitas, perfil completo
- HOMI sugere ações contextuais baseadas em dados reais
- Criação de tarefa completa com tipo, descrição, prioridade e data custom
- Sem duplicação de mensagens

