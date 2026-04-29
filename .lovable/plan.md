# Migrar 302 descartados → Oferta Ativa + Ordenação por Recência

## Objetivo

1. **Mover os leads em descarte para Oferta Ativa**, criando/alimentando uma lista por empreendimento (Casa Tua, Open Bosque, Las Casas, Connect JW, etc.).
2. **Adicionar ordenação por data** (mais recente / mais antigo / padrão) na fila de discagem.
3. **Sinalizar visualmente "Lead novo"** (entrou nos últimos 7 dias) para gerar adesão dos corretores.

## Contexto encontrado

**Descartados elegíveis** (`pipeline_leads` com `motivo_descarte IS NOT NULL` e `arquivado=false`): 141 visíveis hoje no banco — você mencionou 302; vou usar o universo completo dos descartados ativos no momento da execução.

**Distribuição por empreendimento** (top): Casa Tua 15+, Open Bosque 7, Las Casas 4, Connect JW 4, Avulso ImovelWeb 3, Orygem/Vértice/Lake Eyre/Golden Lake/High Garden Iguatemi (1 cada).

**Listas Oferta Ativa existentes**: já há listas "liberadas" por empreendimento (Casa Tua, Open Bosque, Connect JW, Boa Vista, Vista Menino Deus, etc.). Vamos **reaproveitar** quando existirem e **criar** novas só para empreendimentos sem lista.

**Hook da fila** (`useOfertaAtiva.ts`): hoje ordena por `tentativas_count ASC` (sem desempate por data). `useOALeads` usa `created_at ASC` fixo. Não há controle de ordem na UI.

---

## Parte 1 — Migração dos descartados

### Regras

- **Origem**: `pipeline_leads` onde `motivo_descarte IS NOT NULL AND arquivado=false`.
- **Destino**: `oferta_ativa_leads`, agrupados por `empreendimento`.
- **Lista de destino**:
  - Se já existir lista `liberada` ou `ativa` para o empreendimento → reaproveita.
  - Se não existir → cria nova: `"{Empreendimento} - Descartados Recuperados"`, `status='liberada'`, `cooldown_dias=7`, `max_tentativas=3`, `campanha='Descartados Recuperados'`.
  - Empreendimento `NULL` → entra na lista existente "Leads não aproveitados - Abril 2026".
- **Anti-duplicidade**: não insere se `telefone_normalizado` já existe na lista de destino.
- **Mapeamento**: nome, telefone, telefone2, email, empreendimento, campanha, origem=`pipeline`, `data_lead = pipeline_leads.created_at::date`, `motivo_descarte`, `observacoes` herda + `[Migrado do pipeline em DD/MM/AAAA]`, `status='na_fila'`, `tentativas_count=0`.
- **Após migrar**: recount de `oferta_ativa_listas.total_leads`.
- **Não apaga** o lead do pipeline — apenas espelha em Oferta Ativa.

---

## Parte 2 — Ordenação por recência na UI

### Campo de "recência"

`oferta_ativa_leads.data_lead` (já preenchido com a data original do lead). Fallback: `created_at`.

### Mudanças no hook `useOfertaAtiva.ts`

`useOAFila(listaId, sortMode)` e `useOALeads(listaId, sortMode)` aceitam novo parâmetro:
- `'recente'` (novo default): `tentativas_count ASC, data_lead DESC` — leads novos primeiro dentro do mesmo nº de tentativas.
- `'antigo'`: `tentativas_count ASC, data_lead ASC`.
- `'padrao'`: comportamento atual (só `tentativas_count ASC`).

### UI de discagem (`DialingMode.tsx` / `DialingModeWithScript.tsx`)

- **Toggle de ordenação** no topo do painel da fila:
  ```text
  [ Mais recentes ▼ ]  [ Mais antigos ]  [ Padrão ]
  ```
- Persiste escolha em `localStorage` (`oa-sort-mode`).
- **Badge "🔥 Novo"** ao lado do nome quando `data_lead >= now() - 7 days`.
- **Header da lista**: "X leads novos esta semana" como gancho.

### `CampaignManager.tsx` (lista de listas)

- Badge nas cards: **"+N novos esta semana"** (verde) calculado por `data_lead >= now() - 7 days AND status='na_fila'`.
- Ordenação default das cards por "leads novos" desc — listas com material novo aparecem primeiro.

---

## Parte 3 — Detalhes técnicos

### SQL de migração (via insert tool, em 3 passos)

1. **Criar listas faltantes** (uma por empreendimento sem lista ativa).
2. **Inserir leads**:
```sql
INSERT INTO oferta_ativa_leads (lista_id, nome, telefone, telefone2, email,
  telefone_normalizado, empreendimento, campanha, origem, data_lead,
  motivo_descarte, observacoes, status, tentativas_count)
SELECT
  COALESCE(
    (SELECT id FROM oferta_ativa_listas
     WHERE empreendimento = pl.empreendimento AND status IN ('liberada','ativa')
     ORDER BY updated_at DESC LIMIT 1),
    '912fa784-8434-4699-9239-846d791d46c6'  -- fallback "Leads não aproveitados"
  ),
  pl.nome, pl.telefone, pl.telefone2, pl.email, pl.telefone_normalizado,
  pl.empreendimento, pl.campanha, 'pipeline', pl.created_at::date,
  pl.motivo_descarte,
  COALESCE(pl.observacoes,'') || E'\n[Migrado do pipeline em ' || to_char(now(),'DD/MM/YYYY') || ']',
  'na_fila', 0
FROM pipeline_leads pl
WHERE pl.motivo_descarte IS NOT NULL AND pl.arquivado = false
  AND NOT EXISTS (
    SELECT 1 FROM oferta_ativa_leads oal
    WHERE oal.telefone_normalizado = pl.telefone_normalizado
      AND oal.lista_id = (SELECT id FROM oferta_ativa_listas
                          WHERE empreendimento = pl.empreendimento
                          AND status IN ('liberada','ativa')
                          ORDER BY updated_at DESC LIMIT 1)
  );
```
3. **Recount** `total_leads`.

### Arquivos alterados

- `src/hooks/useOfertaAtiva.ts` — `sortMode` em `useOAFila` e `useOALeads`.
- `src/components/oferta-ativa/DialingMode.tsx` — toggle + badge "Novo".
- `src/components/oferta-ativa/DialingModeWithScript.tsx` — mesmo toggle.
- `src/components/oferta-ativa/CampaignManager.tsx` — badge "+N novos" + ordenação por novidade.
- `src/pages/CorretorCall.tsx` — passa `sortMode` do localStorage para os hooks.

### Memória

`mem://features/oferta-ativa/sort-by-recency` — documenta novo default `'recente'` e regra "lead novo = data_lead últimos 7 dias".

---

## Fora do escopo

- Não apagar/arquivar leads do pipeline (apenas espelhar).
- Não mexer em cooldown/locks/scoring da fila — só ordenação de exibição.
- Sem nova rota.
</parameter>
<parameter name="summary">Migrar 302 descartados para listas de Oferta Ativa por empreendimento + adicionar ordenação por recência com badge "Lead novo" para gerar adesão dos corretores