

## Descoberta Importante

**O `cron-nurturing-sequencer` Nao existe como edge function deployada.** Existe um cron job no pg_cron que chama essa function a cada 15 minutos, mas o codigo dela nunca foi criado. Isso significa que os ~1.200 registros `pendente` em `lead_nurturing_sequences` nunca foram processados/enviados.

A tabela `lead_nurturing_sequences` nao e uma tabela de "definicao de cadencia" — ela armazena **mensagens agendadas por lead** (cada row = 1 envio para 1 lead especifico). Um trigger (`create_nurturing_sequence`) cria essas rows quando o lead muda de etapa.

**Implicacao para o plano:** Nao faz sentido "inserir cadencias" nessa tabela — ela e de execucao, nao de template. Precisamos de uma **nova tabela de definicoes de cadencia** e adaptar o trigger de descarte para criar as rows de execucao.

---

## Plano Revisado

### Tarefa 1 — Nova tabela `nurturing_cadencias` (definicoes de cadencia)

Criar tabela para armazenar os templates de cadencia:

```
nurturing_cadencias
- id (uuid, PK)
- stage_tipo (text) — ex: 'descarte_reengajamento'
- step_number (int)
- delay_dias (int)
- canal (text) — 'whatsapp' | 'email'
- template_name (text)
- descricao (text)
- is_active (bool, default true)
- created_at, updated_at
```

Inserir as 10 rows das 2 cadencias solicitadas (5 passos cada).

### Tarefa 2 — Limpeza do banco

- DELETE `lead_nurturing_state` (apenas 2 registros existem, ambos sem uso real)
- DELETE `lead_nurturing_sequences` WHERE status = 'pendente' (limpar ~1.200 rows que nunca foram processadas)
- Manter rows com status 'enviado' ou 'cancelado' como historico

### Tarefa 3 — Criar edge function `cron-nurturing-sequencer`

Esta e a peca que falta. Criar a edge function que:
1. Consulta `lead_nurturing_sequences` WHERE status = 'pendente' AND scheduled_at <= now()
2. Para cada row, envia via WhatsApp (chama `whatsapp-send`) ou email (chama `mailgun-send`)
3. Atualiza status para 'enviado' ou 'erro'
4. Se for o ultimo passo da cadencia, marca `lead_nurturing_state.status = 'encerrado'`

O cron job no pg_cron ja existe e chama essa function a cada 15 minutos.

### Tarefa 4 — Trigger para descarte: criar rows de execucao

Alterar o trigger `create_nurturing_sequence` (ou criar um novo) para:
- Quando `pipeline_leads.stage_id` mudar para o stage de Descarte E `tipo_descarte = 'reengajavel'`:
  - Consultar `nurturing_cadencias` WHERE stage_tipo = 'descarte_reengajamento'
  - Inserir rows em `lead_nurturing_sequences` com `scheduled_at = now() + (delay_dias * interval '1 day')`
  - Criar row em `lead_nurturing_state`

### Tarefa 5 — Pagina `/nutricao` com 3 abas

**Rota:** `/nutricao`, acessivel para admin e gestor. Adicionar ao sidebar abaixo de "Central de Nutricao".

**Aba "Cadencias":**
- Lista cadencias de `nurturing_cadencias` agrupadas por `stage_tipo`
- Timeline vertical com step_number, delay, icone do canal, template_name
- Edicao inline de delay e template_name
- Botao "+ Novo passo"

**Aba "Leads em Nutricao":**
- Tabela com join de `lead_nurturing_state` + `pipeline_leads` + `team_members`
- Colunas: nome, corretor, equipe, stage_tipo, passo atual, proximo envio, status
- Filtros: equipe, status, stage_tipo
- Acoes: Pausar, Encerrar, Ver historico
- Contador no topo

**Aba "Historico de Envios":**
- Query em `lead_nurturing_sequences` WHERE sent_at IS NOT NULL
- Colunas: data, lead, canal, template, status
- Filtros por periodo e canal

### Nao sera alterado
- `nurturing-orchestrator` (continua processando eventos de scoring)
- `cron-smart-nurturing` (continua como esta)
- Nenhuma outra pagina ou componente

---

## Detalhe Tecnico

**Arquitetura completa:**
```text
nurturing_cadencias (definicoes)
        |
        v
trigger de descarte → lead_nurturing_sequences (execucao por lead)
                              |
                              v
                    cron-nurturing-sequencer (a cada 15min)
                              |
                    ┌─────────┴──────────┐
                    v                    v
              whatsapp-send        mailgun-send
```

**RLS:** `nurturing_cadencias` — policy para authenticated users com role admin/gestor via `has_role()`.

