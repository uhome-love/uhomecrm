## O que vai ser construído

Disparo de campanha **"Visita Amanhã"** para os leads ativos do pipeline nas etapas **Sem Contato, Contato Iniciado, Busca e Aquecimento** (~1.663 leads com telefone), via WhatsApp Meta oficial (mesma infra do Casa Tua), com botões de resposta rápida.

Reaproveita 100% do padrão já provado da ferramenta de reengajamento (Meta dispatcher, throttle 60-180s, pausa longa a cada 6 envios, auto-pausa em caso de bloqueio Meta). **NÃO toca em nada existente.**

## Modelo de mensagem (você submete no Meta — antes do disparo)

```text
Nome:      visita_amanha_v1
Categoria: MARKETING
Idioma:    Português (BR) — pt_BR

CORPO:
Oi {{1}}, tudo bem? 👋

Amanhã é um belo dia para você conhecer pessoalmente o imóvel
que tanto te interessou. Como já estávamos conversando por aqui,
queria ver se você tem disponibilidade para uma visita amanhã.

Posso reservar um horário pra você?

BOTÕES (Quick Reply — 2 botões):
  [ Sim, quero visitar ]
  [ Agora não ]
```

Após aprovação Meta, eu já deixo o nome do template (`visita_amanha_v1`) configurado no painel.

## Comportamento

**Disparo:**
- Hoje, em lote único, respeitando janela 09h-20h BRT
- Throttle: delay 60-180s entre envios, pausa 3-8min a cada 6 envios (anti-ban)
- Auto-pausa se Meta sinalizar bloqueio de qualidade (5 falhas seguidas)
- Idempotência: lead que já recebeu este disparo **não recebe de novo**

**Resposta "Sim, quero visitar":**
1. Cria notificação push + sino para o `corretor_id` dono do lead
2. Registra evento no histórico do lead (visível no modal/drawer)
3. Cria badge `🔥 Quer visitar amanhã` no card do pipeline
4. **NÃO** muda etapa, **NÃO** repassa lead

**Resposta "Agora não":**
1. Apenas registra no histórico do lead (`visita_amanha_negativa`)
2. Sem notificação ao corretor (evita ruído)
3. **NÃO** muda etapa, **NÃO** arquiva

**Resposta livre (texto qualquer):**
- Cai no fluxo normal do WhatsApp Inbox (já existe)
- Histórico ainda registra a interação como vinda da campanha

## Arquitetura técnica

```text
┌─────────────────────────────────┐
│ Central de Nutrição → nova aba  │
│ "Disparo Visita Amanhã"         │
│ [ Configurar ] [ Disparar agora ]│
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ EDGE: visita-amanha-enqueue     │  (clone enxuto do reengajamento)
│ - Lê visita_amanha_config       │
│ - Query leads elegíveis         │
│ - Loop: sendMetaTemplate()      │
│ - Throttle + auto-pausa         │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ Meta Cloud API                  │
│ template visita_amanha_v1       │
└──────────────┬──────────────────┘
               │   (resposta do lead)
               ▼
┌─────────────────────────────────┐
│ EDGE: whatsapp-webhook (existe) │
│ + handler novo:                 │
│   detecta button_reply de       │
│   visita_amanha → executa       │
│   ação Sim/Não                  │
└─────────────────────────────────┘
```

### Migrations (1 tabela + 1 coluna)

```sql
-- Tabela de controle (config + histórico de disparos)
CREATE TABLE public.visita_amanha_disparos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_lead_id uuid REFERENCES pipeline_leads(id) ON DELETE CASCADE,
  wamid text,
  phone text,
  status text DEFAULT 'sent', -- sent | sim | nao | failed
  resposta_at timestamptz,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (pipeline_lead_id) -- idempotência: 1 lead = 1 disparo
);

-- Config singleton
CREATE TABLE public.visita_amanha_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean DEFAULT true,
  paused boolean DEFAULT false,
  meta_template_name text DEFAULT 'visita_amanha_v1',
  meta_template_language text DEFAULT 'pt_BR',
  daily_limit int DEFAULT 500,
  delay_min_seconds int DEFAULT 60,
  delay_max_seconds int DEFAULT 180,
  pausa_longa_a_cada int DEFAULT 6,
  horario_inicio time DEFAULT '09:00',
  horario_fim time DEFAULT '20:00',
  stages_alvo text[] DEFAULT ARRAY['Sem Contato','Contato Iniciado','Busca','Aquecimento'],
  updated_at timestamptz DEFAULT now()
);

-- Flag visual no card
ALTER TABLE public.pipeline_leads
  ADD COLUMN visita_amanha_resposta text; -- null | 'sim' | 'nao'

-- RLS: gerente/CEO veem tudo, corretor só os seus
ALTER TABLE visita_amanha_disparos ENABLE ROW LEVEL SECURITY;
ALTER TABLE visita_amanha_config ENABLE ROW LEVEL SECURITY;
-- policies: read/write para gerente/CEO via has_role()
```

### Arquivos novos

- `supabase/functions/visita-amanha-enqueue/index.ts` — dispatcher
- `src/components/central-nutricao/VisitaAmanhaTab.tsx` — UI (configurar + disparar + ver progresso)
- `src/components/pipeline/VisitaAmanhaBadge.tsx` — badge `🔥 Quer visitar amanhã` no card

### Arquivos editados (mínimo)

- `supabase/functions/whatsapp-webhook/index.ts` — adicionar handler de `button_reply` para template `visita_amanha_v1` (Sim → notificação + histórico + flag; Não → só histórico)
- `src/pages/CentralNutricao.tsx` — adicionar nova aba
- `src/components/pipeline/PipelineCard.tsx` — exibir badge quando `visita_amanha_resposta = 'sim'`

### Notificação ao corretor (Sim)

Reusa o sistema já existente:
- INSERT em `notifications` (sino) com tipo `visita_amanha_sim`
- Chamada à edge `send-push` (push web)
- Mensagem: *"⚡ {nome} quer visitar amanhã! Entre em contato para marcar o horário."*

### Histórico no modal do lead

INSERT em `lead_eventos` (tabela já usada pelo drawer do lead):
- `tipo: 'visita_amanha_resposta'`
- `descricao: '✅ Cliente respondeu SIM ao convite de visita amanhã'` ou `'❌ Cliente respondeu: agora não'`

## Fluxo de uso (você)

1. Submete o template `visita_amanha_v1` no Meta WhatsApp Manager
2. Aguarda aprovação (geralmente ~1h)
3. Vai em **Central de Nutrição → Visita Amanhã → Disparar agora**
4. Acompanha o progresso (enviados/falhas/respostas em tempo real)
5. Conforme as respostas chegam, corretores recebem push/sino e o card do pipeline ganha o badge

## Por que não toca em nada existente

- Tabela e edge function NOVAS — zero risco no fluxo do reengajamento Casa Tua atual
- Webhook só ganha um `if (templateName === 'visita_amanha_v1')` no início — fluxo legado intacto
- Pipeline UI só exibe badge a mais — quando `visita_amanha_resposta` for null, nada muda
