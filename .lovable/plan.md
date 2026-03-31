

# Plano de Nutrição e Reativação da Base de Leads

## Contexto Atual

O sistema já possui infraestrutura robusta:
- **Motor 1 (cron-smart-nurturing)**: Match noturno — varre leads parados há 7+ dias, busca imóveis no Typesense, cria vitrine e envia via WhatsApp template
- **Motor 2 (cron-nurturing-sequencer)**: Executa sequências agendadas (D0, D2, D5) por etapa do funil
- **Mailgun**: E-mail marketing com batch cron, templates e tracking de eventos
- **WhatsApp Campaign Dispatcher**: Disparos em lote com templates Meta
- **Sweep Descartados**: Move leads descartados para listas de Oferta Ativa
- **Templates de Sequência**: Boas-vindas, reengajamento, pós-visita, lembrete de proposta

## O Que Falta (Gaps Identificados)

1. **Leads descartados não são reativados** — o sweep apenas move para OA, mas não dispara nutrição automática
2. **Leads "sem contato" não recebem sequência agressiva** — ficam esperando o corretor agir
3. **Leads parados em qualificação** não recebem conteúdo de valor (site novo, vitrines)
4. **E-mail não é usado como canal complementar** — toda nutrição é apenas WhatsApp
5. **Não há cadência multicanal** — WhatsApp D0 → Email D2 → WhatsApp D5

---

## Plano de Implementação

### 1. Criar Sequências de Reativação por Segmento

Três novas sequências automáticas no `SequenceTemplates.tsx`:

**A) Leads Sem Contato (etapa: sem_contato, 48h+ parado)**
```text
D0: WhatsApp template → "Oi {nome}, separei imóveis para você!"
D2: E-mail com vitrine personalizada (Mailgun)
D5: WhatsApp template → "Última chance! Condições especiais..."
D7: Notifica gerente → avaliar descarte ou redistribuição
```

**B) Leads Parados em Qualificação (72h+ sem ação)**
```text
D0: WhatsApp → Vitrine automática via cron-smart-nurturing (já existe)
D3: E-mail → "Conheça nosso site novo" + link vitrine
D6: WhatsApp template → Novo match de imóveis
D10: Alerta gerente → lead não respondeu nenhuma tentativa
```

**C) Leads Descartados (reativação da base fria)**
```text
D0: E-mail → "Novidades no mercado" + vitrine genérica por perfil
D3: WhatsApp template → "Oi {nome}, temos novos imóveis na sua região"
D7: Se clicou/abriu → redistribuir via roleta como lead quente
D7: Se não interagiu → manter na OA, tentar novamente em 30 dias
```

### 2. Criar Edge Function `reactivate-cold-leads`

Nova Edge Function que:
- Busca leads descartados nas listas de OA (últimos 90 dias)
- Cruza com `lead_property_profiles` para buscar perfil
- Faz match no Typesense (mesma lógica do cron-smart-nurturing)
- Cria vitrine e agenda sequência multicanal (WhatsApp + Email)
- Registra em `lead_nurturing_sequences` com `stage_tipo: "reativacao"`
- Roda via cron semanal (1x por semana, domingo à noite)

### 3. Adicionar Canal E-mail ao Sequencer

Atualizar `cron-nurturing-sequencer` para suportar `canal: "email"`:
- Quando `canal === "email"`, usar `mailgun-send` em modo single
- Template HTML com link da vitrine e imóveis em destaque
- Criar 3 templates de e-mail responsivos:
  - `reativacao-vitrine`: Vitrine personalizada com imóveis
  - `novidades-mercado`: Novidades + link do site novo
  - `ultimo-lembrete`: Urgência + CTA para WhatsApp

### 4. Dashboard de Reativação (CEO/Gerente)

Adicionar aba no `NurturingDashboard`:
- Total de leads reativados vs tentados
- Taxa de abertura de e-mail (via Mailgun webhook)
- Taxa de clique em vitrine
- Leads que responderam WhatsApp → redistribuídos
- Filtro por empreendimento e período

### 5. Gatilho Inteligente de Redistribuição

Quando um lead descartado/frio interage (clica na vitrine, responde WhatsApp):
- Cancelar steps pendentes da sequência
- Marcar `status: "reativado"` no `lead_nurturing_sequences`
- Criar novo lead no pipeline OU reativar o existente
- Encaminhar para roleta de distribuição
- Notificar corretor: "Lead reativado pela IA"

---

## Resumo Técnico

| Item | Arquivo/Recurso | Ação |
|------|-----------------|------|
| 3 novas sequências | `SequenceTemplates.tsx` | Adicionar templates |
| Edge Function reativação | `supabase/functions/reactivate-cold-leads/` | Criar |
| Suporte a e-mail no sequencer | `cron-nurturing-sequencer/index.ts` | Editar |
| 3 templates HTML e-mail | `_shared/mailgun-campaigns.ts` ou templates dedicados | Criar |
| Dashboard reativação | `NurturingDashboard.tsx` | Expandir |
| Gatilho de redistribuição | `whatsapp-webhook` + `site-events` | Editar |
| Cron semanal | SQL `cron.schedule` | Criar |
| Migration: campo `stage_tipo` | Adicionar valor `reativacao` | Migration |

## Guardrails
- Manter intervalo mínimo de 15 dias entre nutrições do mesmo lead
- Limite de 200 leads/dia para WhatsApp (rate limit Meta)
- Respeitar opt-out / números inválidos
- E-mails só para leads com e-mail válido
- Não tocar em leads com negócio ativo

