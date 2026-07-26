## Fase 1A — Execução v3 (final, com as duas correções aprovadas)

Ordem rígida. Parar no gate do piloto (passo 5).

### 1. Migration A — canônico em `visitas` e `negocios` (schema-only)
- `ALTER TABLE public.visitas ADD COLUMN empreendimento_canonico_id UUID REFERENCES public.empreendimentos_canonicos(id)`.
- `ALTER TABLE public.negocios ADD COLUMN empreendimento_canonico_id UUID REFERENCES public.empreendimentos_canonicos(id)`.
- Índice btree em cada coluna.
- Trigger `BEFORE INSERT OR UPDATE OF empreendimento` em cada tabela, chamando `resolver_empreendimento_canonico(NULL, NULL, NULL, NULL, NEW.empreendimento, NULL)`. Idempotente: só preenche quando `empreendimento_canonico_id IS NULL`.
- Sem `CHECK` de `cancel_reason`. Sem backfill.

### 2. Migration B — `finalizar_tentativa_v2` com ponte do Aproveitado
Corpo atual da função comentado no topo do arquivo (rollback rápido). No branch `resultado = 'com_interesse'`:

- Normalizar telefone via `public.normalize_telefone()`.
- **Correção 1 — dedup alinhado ao índice único parcial:**
  - Telefone: `WHERE telefone_normalizado = :tel AND aceite_status <> 'descartado'`.
  - E-mail: `WHERE lower(email) = lower(:email) AND aceite_status <> 'descartado'`.
  - Sem filtro por `arquivado` e sem filtro por `stage_id`. A constraint é a fonte de verdade — se ela permite inserir, a ponte insere; se ela bloqueia, a ponte deduplica. Isso preserva o comportamento pretendido do reengajamento (descartado libera o telefone, mesmo antes do auto-archive de 24h) e evita 23505 em leads ativos em stages terminais como Ganho.
- Ramo `exists` (lead encontrado por telefone OU e-mail sob o predicado acima): retorna `pipeline_status='exists'` com o `pipeline_lead_id`. **Não escreve nada** no lead encontrado (sem observação, sem interesse, sem feedback). Contexto da ligação fica em `oferta_ativa_tentativas` + `oa_events`.
- Ramo `created` (nenhum match): `INSERT` em `pipeline_leads` com:
  - `origem = 'Oferta Ativa'`.
  - `corretor_id = p_corretor_id` (parâmetro da função). Comparação com `auth.uid()` só para **logar** divergência em `ops_events`, nunca para sobrescrever.
  - `empreendimento` copiado como texto de `oferta_ativa_leads.empreendimento`. O `trg_pl_empreendimento_canonico` resolve o canônico sozinho.
  - `interesse_tipo` e `feedback` estruturados em observação inicial.
  - Retorna `pipeline_status='created'` com o `pipeline_lead_id`.
- Idempotência: se `idempotency_key` já existir em `oferta_ativa_tentativas`, retorna a resposta anterior sem reprocessar a ponte.
- Sub-bloco `EXCEPTION` isolado envolvendo apenas a ponte (`unique_violation`, `not_null_violation`, `foreign_key_violation`, `others`): captura → grava em `ops_events` com schema real (`fn='finalizar_tentativa_v2'`, `level='error'`, `category='bridge_aproveitado'`, `message` sempre não-nulo via `COALESCE`, `ctx` com `tentativa_id`/`telefone_hash`/`p_corretor_id`) dentro de um sub-sub-bloco que engole erro de log. A gravação da tentativa principal segue.

### 3. Testes da ponte
Todos em transação com `ROLLBACK`, exceto os dois casos reais (`created` e `exists`) que serão validados com lead de teste dedicado.

- **created** (lead de teste real): telefone inédito → `pipeline_status='created'`, lead novo com `corretor_id = p_corretor_id`.
- **exists** (lead de teste real): telefone que já bate um `pipeline_leads` com `aceite_status <> 'descartado'` → `pipeline_status='exists'`. Verificar via snapshot do lead antes/depois que **nenhuma coluna mudou** (`updated_at` inclusive).
- **idempotência**: repetir a mesma chamada com o mesmo `idempotency_key` → retorna a resposta cacheada, sem novo `INSERT` em `pipeline_leads`.
- **Correção 2 — failed com log:** dentro de uma transação de teste:
  1. `UPDATE public.pipeline_stages SET ativo = false;` (23 linhas, lock instantâneo).
  2. Chamar `finalizar_tentativa_v2` com `com_interesse` e telefone inédito.
  3. A ponte não encontra stage ativa, tenta `INSERT` com `stage_id` NULL, cai no handler.
  4. Verificar: `oferta_ativa_tentativas` gravou a tentativa normalmente; `ops_events` tem 1 linha com `fn='finalizar_tentativa_v2'`, `category='bridge_aproveitado'`, `message` não-nulo.
  5. `ROLLBACK`.

### 4. Op2 — backfill de `visitas` e `negocios`
- `UPDATE public.visitas SET empreendimento = empreendimento WHERE empreendimento_canonico_id IS NULL AND empreendimento IS NOT NULL` em lotes de 500 via cursor. Dispara o trigger da Migration A.
- Idem `public.negocios`.
- Reportar: total antes/depois de `empreendimento_canonico_id IS NULL`, e a lista dos textos que não resolveram para nenhum canônico.

### 5. Op1 / Piloto 4a — 50 linhas de `pipeline_leads` **[GATE]**
- Snapshot pré (CSV): `id, complexidade_score, oportunidade_score` das 50 candidatas mais antigas com `empreendimento IS NOT NULL AND empreendimento_canonico_id IS NULL`.
- `UPDATE` das 50 setando `empreendimento = empreendimento` para acionar `trg_pl_empreendimento_canonico`.
- **Nota mecânica:** `trg_calcular_complexidade` e `trg_calcular_oportunidade` são `BEFORE INSERT OR UPDATE` sem `OF` nem `WHEN` — vão disparar. O piloto **mede** esse efeito, não o evita. Sem `session_replication_role=replica` no cardápio (desabilita FKs e exige superuser).
- Snapshot pós.
- Relatório: distribuição dos deltas de `complexidade_score` e `oportunidade_score` (média, mediana, p95, quantidade de linhas com |delta| > 20 pontos), + quantos `empreendimento_canonico_id` ficaram preenchidos.
- **PARAR aqui.** Backfill dos ~1.001 restantes só após aprovação do relatório.

### Fora de escopo desta fase
- `CHECK` de `cancel_reason` + dropdown de no-show na UI (lista canônica vem ao chat antes).
- Trigger e backfill de `primeiro_contato_em` / SLA humano.
- Higiene dos 4 `corretor_id` órfãos e documentação da precedência de `resolver_empreendimento_canonico` (backlog).

### Janela e teto
Migration A + Migration B no mesmo dia, dentro de 08–19h BRT. Ops (3, 4, 5) são via insert tool ou `UPDATE`s, não contam no teto.

### Entregável final
- Contagem antes/depois de `empreendimento_canonico_id` em `visitas` e `negocios`, + textos não resolvidos.
- Log dos 4 casos da ponte: `created`, `exists` com prova de não-escrita no lead, idempotência, `failed` com `ops_events` gravado.
- Relatório do piloto de 50 leads. **Parada obrigatória** aqui.
