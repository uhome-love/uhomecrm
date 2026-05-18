## Regra de negócio (consolidada)

Um lead em Descarte é elegível para receber disparo de reengajamento **a menos que** ele tenha respondido explicitamente "não quero mais". Resumo do ciclo:

| Ação do lead após disparo | Efeito |
|---|---|
| Clicou em **SIM** (botão) ou respondeu interesse | Volta para o pipeline (já existe — webhook) |
| Clicou em **"Não quero mais receber"** (botão NÃO ou opt-out) | **Inativa permanentemente** (`reengajamento_status='respondeu_nao'`) — nunca mais recebe |
| **Não clicou em nada** (silêncio, lido sem resposta, ou nem entregue) | **Continua elegível** — entra no próximo disparo |
| Lead novo descartado no CRM | **Entra automaticamente** no pool elegível assim que cai em Descarte |

Hoje o filtro `reengajamento_enviado_at IS NULL` quebra esse contrato: qualquer lead que já recebeu **um** disparo sai do pool, mesmo sem ter respondido nada.

## Diagnóstico (auditoria no banco)

Stage Descarte (`1dd66c25…`), totais atuais:

| Métrica | Valor |
|---|---|
| Total em Descarte | 2.892 |
| `reengajamento_enviado_at` preenchido | 2.393 |
| Inativados terminais (respondeu não / bloqueado / inválido / definitivo) | 773 |
| Sem telefone | 5 |
| **Elegíveis hoje (regra antiga)** | **273** |
| **Elegíveis pela regra nova** (não terminais, com telefone) | **~2.114** |

Última semana: 443 leads novos caíram em Descarte; só 273 entraram no pool — os outros 170 foram filtrados por já ter `reengajamento_enviado_at` preenchido, mesmo sem terem dito "não".

## Correção

### 1. Mudar o dedup do preview e do enqueue

Trocar o filtro `reengajamento_enviado_at IS NULL` por uma regra baseada em **resposta**, não em **envio**:

Elegível = lead em Descarte, com telefone, **e** `reengajamento_status` NÃO está em status terminal (`respondeu_nao`, `respondeu_nao_wave2`, `bloqueado`, `telefone_invalido`, `respondeu`, `reativado`) **e** `tipo_descarte` ≠ `definitivo`.

Adicionar **cooldown mínimo** para não bombardear o mesmo lead todo dia: `reengajamento_enviado_at IS NULL OR reengajamento_enviado_at < NOW() - INTERVAL '{cooldown_dias} days'`. Default `cooldown_dias = 7`, configurável na UI do disparo (slider 1–30 dias, default 7).

Arquivos afetados:
- `supabase/functions/reengajamento-audience-preview/index.ts` — bloco `descartados`
- `supabase/functions/reengajamento-descartados-enqueue/index.ts` — mesma query
- Manter a opção `dedup_mode: "exclude_sent"` antiga disponível como override "estrito" para casos manuais.

### 2. Garantir que `respondeu_nao` está marcado de verdade

Verificar (e corrigir se necessário) o `whatsapp-webhook` / `evolution-webhook`:

- Botão "Não quero mais receber" / "Não tenho interesse" / "Parar" → set `reengajamento_status = 'respondeu_nao'` no `pipeline_leads`.
- Botão "SIM" / interesse → já move para pipeline ativo (não alterar).
- Texto livre "para", "sair", "remover", "não quero", "stop", "unsubscribe" → também marca `respondeu_nao` (heurística leve, palavras isoladas).

Vou validar o que o webhook faz hoje antes de editar; se já cobre, não mexo.

### 3. UI — `DisparoCustomizadoCard`

- Adicionar slider/input "Cooldown entre disparos para o mesmo lead" (default 7 dias).
- Atualizar o painel "Conferência — Funil" com 2 linhas novas:
  - "Inativados (responderam não / bloqueados)" — excluídos permanentemente
  - "Em cooldown (recebem disparo em breve)" — excluídos temporariamente
- Texto explicativo: "Leads que não responderam ou ignoraram o disparo continuam elegíveis no próximo ciclo. Só saem do pool quem clicou em 'Não quero mais' ou foi classificado como definitivo."

### 4. Backfill

Nenhum UPDATE destrutivo necessário — a nova regra simplesmente passa a considerar elegíveis os ~1.840 leads que estavam sendo filtrados injustamente. Eles entram no próximo disparo respeitando o cooldown de 7 dias contado a partir do último envio.

## Fora de escopo

- Não criar trigger no banco para resetar `reengajamento_enviado_at` (regra antiga do plano anterior). O cooldown na query resolve.
- Não mexer em `sweep-descartados`, `tipo_descarte`, nem em status terminais existentes.
- Não tocar em `visita_amanha`, `pipeline_ativo`, `oferta_ativa_lista`.

## Detalhes técnicos

- Status terminais (lista canônica): `respondeu_nao`, `respondeu_nao_wave2`, `bloqueado`, `telefone_invalido`, `respondeu`, `reativado`.
- Query nova (pseudocódigo do preview):
  ```sql
  WHERE stage_id = '<descarte>'
    AND telefone IS NOT NULL
    AND tipo_descarte <> 'definitivo'  -- quando tipo = 'reengajavel'
    AND (reengajamento_status IS NULL OR reengajamento_status NOT IN (<terminais>))
    AND (reengajamento_enviado_at IS NULL
         OR reengajamento_enviado_at < NOW() - (cooldown_dias || ' days')::interval)
  ```
- Audience payload novo campo: `cooldown_dias` (number, default 7). `dedup_mode` continua aceito para retrocompat.
- Validação webhook: ler `whatsapp-webhook/index.ts` e `evolution-webhook/index.ts`, checar se mapeiam botão NÃO → `respondeu_nao`. Se não, adicionar.

## Arquivos

- `supabase/functions/reengajamento-audience-preview/index.ts`
- `supabase/functions/reengajamento-descartados-enqueue/index.ts`
- `supabase/functions/whatsapp-webhook/index.ts` (verificar/ajustar mapeamento de opt-out)
- `supabase/functions/evolution-webhook/index.ts` (mesma verificação)
- `src/components/central-nutricao/DisparoCustomizadoCard.tsx` (slider de cooldown + painel)
