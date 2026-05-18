# Disparo de Reengajamento com seleção de público

Hoje o disparo de reengajamento é fixo: só pega leads em **Descarte** marcados como `reengajavel` dentro da janela `lookback_days`. Você quer escolher o público (pipeline ativo, lista da Oferta Ativa, descartados de uma semana/mês específicos) e ver quem já recebeu.

## O que muda na tela `/central-nutricao` → Reengajamento

Adicionar um novo card **"Disparo customizado"** (acima do "Disparar agora" atual, que continua existindo como atalho para o fluxo padrão de descartados).

Estrutura do card:

```text
┌─ Disparo customizado ─────────────────────────────────────┐
│ Público:  ( ) Descartados (padrão)                         │
│           ( ) Pipeline ativo                               │
│           ( ) Lista da Oferta Ativa                        │
│                                                             │
│ [campos dinâmicos conforme escolha — ver abaixo]           │
│                                                             │
│ Período:  [De: __/__/____]  [Até: __/__/____]              │
│           Atalhos: [Hoje] [Semana] [Mês] [Últimos 30d]     │
│                                                             │
│ Empreendimento (opcional): [combobox]                      │
│                                                             │
│ ▸ Já receberam disparo:                                    │
│   (•) Excluir quem já recebeu                              │
│   ( ) Incluir todos                                        │
│   ( ) Só quem recebeu antes de [data]  (reativação)        │
│                                                             │
│ Onda: ( ) 1ª onda  ( ) 2ª onda                             │
│                                                             │
│ Limite máximo: [200]                                        │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│ Preview: 47 leads elegíveis  [🔍 Recontar]                 │
│                                                             │
│ [💬 Disparar para 47 leads]   [Cancelar]                   │
└─────────────────────────────────────────────────────────────┘
```

Campos dinâmicos por origem:

- **Descartados** — Tipo: `[Reengajáveis] [Definitivos] [Todos]`. Período filtra por `stage_changed_at`.
- **Pipeline ativo** — Multi-select de stages (Novo, Tentativa de Contato, Em Atendimento, Visita Agendada, etc.). Período filtra por `created_at` do lead. Por padrão exclui Descarte/Negócio Criado/Inativado.
- **Lista da Oferta Ativa** — Combobox de `oferta_ativa_listas` (mostra nome + empreendimento + total). Pega `oferta_ativa_leads` daquela lista. Período opcional filtra por `created_at`.

## O que muda no backend

### 1. Edge function `reengajamento-descartados-enqueue`

Aceitar payload `audience` opcional. Se ausente, mantém comportamento atual (sem regressão para o cron e botão "Disparar agora" padrão).

```ts
audience?: {
  source: 'descartados' | 'pipeline_ativo' | 'oferta_ativa_lista';
  // descartados:
  tipo_descarte?: 'reengajavel' | 'definitivo' | 'todos';
  // pipeline_ativo:
  stage_ids?: string[];
  // oferta_ativa_lista:
  lista_id?: string;
  // comum:
  periodo?: { from: string; to: string }; // ISO
  empreendimento?: string;
  dedup_mode?: 'exclude_sent' | 'include_all' | 'only_sent_before';
  dedup_cutoff?: string; // ISO — usado quando dedup_mode='only_sent_before'
  wave?: 1 | 2;
  limit?: number;
}
```

A query base muda conforme `source`, mas todo o resto (validação Meta/Evolution, throttle, pausa longa, auto-pause por quality block, batch continuation) permanece igual.

### 2. Rastreio de quem já recebeu

- **Descartados**: continua via `pipeline_leads.reengajamento_enviado_at` (já existe).
- **Pipeline ativo / Oferta Ativa**: usa `reengajamento_eventos` como fonte de verdade. Cada envio bem-sucedido insere `{ tipo: 'enviado_custom', detalhe: source, audience_source, created_at }`. Dedup ('exclude_sent') filtra leads que já têm evento desse source nos últimos 30 dias (configurável).

Sem nova tabela: aproveita `reengajamento_eventos`. Adicionar coluna `audience_source TEXT` via migration (nullable, backfill não necessário).

### 3. Endpoint de preview (contagem)

Nova edge function leve `reengajamento-audience-preview` (ou um RPC) que recebe o mesmo `audience` e retorna `{ count, sample: [{id, nome, telefone, ultima_atividade}] }` para mostrar antes do disparo. Sem efeitos colaterais.

## Tracking pós-disparo (UX)

O card "Últimos disparos" (que já existe) ganha uma coluna **Público** mostrando a origem (`Descartados`, `Pipeline: Tentativa Contato`, `Lista: Casa Tua – Mai/26`) para que você consiga auditar o que rodou para quem.

## Detalhes técnicos

- **Arquivos a editar:**
  - `src/components/central-nutricao/ReengajamentoTab.tsx` — novo card de disparo customizado + estado local + preview.
  - `supabase/functions/reengajamento-descartados-enqueue/index.ts` — parsing de `audience`, query branching, dedup, gravação de `audience_source` em `reengajamento_eventos` e `reengajamento_dispatch_runs`.
  - **Nova:** `supabase/functions/reengajamento-audience-preview/index.ts` — só conta/sample.
- **Migration:**
  - `ALTER TABLE reengajamento_eventos ADD COLUMN audience_source TEXT;`
  - `ALTER TABLE reengajamento_dispatch_runs ADD COLUMN audience_source TEXT, ADD COLUMN audience_payload JSONB;`
  - Índice parcial: `CREATE INDEX ON reengajamento_eventos (lead_id, audience_source, created_at DESC) WHERE audience_source IS NOT NULL;`
- **Compatibilidade:** se `audience` ausente → comportamento idêntico ao atual (cron continua funcionando sem mudanças).
- **Limites de segurança:** mesmo `daily_limit` global da config se aplica; preview avisa se o filtro retornar > limite.
- **Janela horária / pausa**: continuam respeitadas — disparo customizado **não** dispara fora da janela (a menos que `force=true`, que você já tem hoje).

## Fora de escopo (registro para depois)

- Agendar disparo customizado recorrente (ex.: "todo sábado dispara para visita-amanhã de Casa Tua") — pode entrar numa Fase 2.
- Salvar "públicos favoritos" para reusar — Fase 2.
- Multi-template A/B por público — Fase 2.
