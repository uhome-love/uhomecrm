## Problema confirmado

Existem 2 leads com o mesmo número (51) 99687-5848 no pipeline:

| Lead | Corretor | Origem | Telefone normalizado | Criado |
|---|---|---|---|---|
| Eduardo Russo (Casa Tua) | William Ferreira | Oferta Ativa | `5551996875848` (13 díg.) | 20/05/2026 |
| Eduardo (Cobertura P. Alegre) | Eliézer Clós | site_uhome | `51996875848` (11 díg.) | 14/07/2026 |

**Causa raiz:** a função `normalize_telefone` do banco só remove não-dígitos, **não retira o DDI 55**. Quando a Oferta Ativa gravou `+5551996875848`, ficou com 13 dígitos; o site normaliza com `slice(-11)` e ficou com 11. O dedup do `crm-webhook` faz `.eq('telefone_normalizado', '51996875848')` — comparação exata — então não encontra o registro de 13 dígitos e cria um lead novo.

A auditoria do banco mostra que isso não é caso isolado:
- 4.886 leads com 11 dígitos
- 2.511 leads com 13 dígitos (DDI colado)
- 599 com 10, além de outros comprimentos residuais

Qualquer lead cadastrado por uma fonte "13 díg." vira duplicado quando reentra por uma fonte "11 díg." (e vice-versa). Foi o que aconteceu com o Eduardo.

## Correção proposta

### 1. Padronizar `telefone_normalizado` para 11 dígitos (BR)

Migration:
- Reescrever `public.normalize_telefone(raw text)` para: remover não-dígitos → se começar com `55` e tiver 12 ou 13 dígitos, retirar o `55` → retornar como veio (10 ou 11 díg.).
- Backfill: `UPDATE pipeline_leads SET telefone_normalizado = normalize_telefone(telefone)` (o trigger `trg_normalize_phone` recalcula em novos writes).
- Aplicar a mesma normalização em `oferta_ativa_leads`, `leads`, `leads_backup` (colunas equivalentes) para manter consistência entre módulos que também deduplicam por telefone.
- Criar índice `CREATE INDEX IF NOT EXISTS idx_pipeline_leads_tel_norm ON pipeline_leads (telefone_normalizado)` (se ainda não existir) para acelerar dedup.

### 2. Deduplicar de forma resiliente no `crm-webhook`

Em `supabase/functions/crm-webhook/index.ts`:
- Trocar o dedup exato por uma comparação por sufixo: buscar leads onde `telefone_normalizado` termina com os últimos 10-11 dígitos do telefone recebido (`.ilike('%<sufixo>')` ou RPC dedicado). Isso resolve o problema mesmo se sobrar algum resíduo com DDI.
- Se houver mais de um match, pegar o **mais recente ativo** (não arquivado) e logar `requer_revisao_dedup=true` para revisão manual.
- Se o lead existente já tem corretor, **NÃO mover para "Novo Lead"** nem trocar corretor. Apenas:
  - Registrar o novo interesse em `lead_imoveis_indicados` (imóvel novo) e/ou apender uma linha em `observacoes` com data/imóvel/página.
  - Manter `stage_id`, `corretor_id` e `aceite_status` atuais.
  - Disparar notificação para o corretor atual: "Novo interesse do lead X: <imóvel> — via site".
- Manter o fluxo atual de criação/roleta apenas quando não houver match.

### 3. Aplicar a mesma dedup em outras entradas

Auditar e alinhar `receive-landing-lead`, `receive-rdstation-lead`, `receive-imovelweb-lead`, `receive-tiktok-lead`, `receive-meta-lead` para todos usarem a mesma função utilitária de dedup por sufixo, evitando repetir o bug em outros canais.

### 4. Merge dos dois leads existentes do Eduardo

Ação pontual (SQL manual, com aprovação):
- Manter o registro do William (`1cbb0408…`) como canônico.
- Copiar o interesse do lead do Eliézer (`180b6fde…`) para `lead_imoveis_indicados` do lead canônico e apender em `observacoes` a linha "[Site uhome.com.br] Interesse novo: Cobertura Residencial 3Q Porto Alegre (14/07/2026)".
- Inativar/arquivar o lead do Eliézer com `motivo_descarte='duplicado_merge'` para sair do board dele.
- Disparar notificação para o William avisando do novo interesse.

### 5. Validação

- Recontar `SELECT length(telefone_normalizado), count(*) …` após backfill — deve zerar as faixas 12/13/14+.
- Simular payload do site com o telefone `+5551996875848` e confirmar que o webhook retorna `is_existing=true` e não cria novo lead.
- Conferir no /pipeline do William que aparece o novo interesse; conferir no /pipeline do Eliézer que o lead sumiu; conferir notificação recebida.
- Rodar linter e checar que nenhum outro receive-* mantém dedup exato.

## Detalhes técnicos

Assinatura final da função:

```sql
CREATE OR REPLACE FUNCTION public.normalize_telefone(raw text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH d AS (SELECT regexp_replace(coalesce(raw,''), '\D', '', 'g') AS x)
  SELECT CASE
    WHEN x = '' THEN NULL
    WHEN length(x) IN (12,13) AND left(x,2)='55' THEN substr(x,3)
    ELSE x
  END FROM d;
$$;
```

Helper para dedup (Deno):
```ts
const suf = norm.slice(-10); // 10 díg cobre 10 e 11
const { data } = await supabase
  .from('pipeline_leads')
  .select('id, corretor_id, stage_id, aceite_status, arquivado')
  .ilike('telefone_normalizado', `%${suf}`)
  .eq('arquivado', false)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
```

## Fora do escopo

- Não vou reescrever a UI do pipeline nem os módulos de Oferta Ativa/Nutrição.
- Não vou alterar regras de roleta/segmentação.
- Não vou mexer em fluxos de reengajamento.