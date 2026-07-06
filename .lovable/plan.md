# Mostrador de leads da Roleta: números reais de distribuição

## Objetivo
Hoje o número "X leads" na página Roleta conta **todos** os leads que entraram na carteira do corretor no dia (roleta + manual + repasse interno + backfill + campanha direta), o que dá uma falsa impressão de desequilíbrio (ex.: Douglas aparece com 8, mas a roleta só entregou 2 pra ele).

O mostrador passa a mostrar **apenas o que a roleta realmente distribuiu**, no formato:

```text
5 distribuídos · 4 aceitos
2 fora da roleta
```

- **Distribuídos** = quantos leads a roleta entregou ao corretor hoje (independe de aceite).
- **Aceitos** = desses, quantos ele aceitou.
- **Fora da roleta** = leads que entraram na carteira hoje por outra via (manual, repasse interno, backfill, campanha direta) — mostrados à parte, em texto menor/discreto, como referência.

## Fonte de verdade
`distribuicao_historico` é a única fonte confiável do que passou pela roleta (a coluna `roleta_distribuido_em` está praticamente vazia e **não** deve ser usada). O cálculo é feito **por lead**, casando os eventos do mesmo lead:

- Evento `acao = 'distribuido'` → carrega `segmento_id` (permite quebra por segmento).
- Evento `acao = 'aceito'` para o mesmo `pipeline_lead_id` + `corretor_id` → conta como aceito (o segmento vem do evento de distribuição correspondente).
- "Fora da roleta" = leads que o corretor possui hoje (`pipeline_leads.corretor_id` + `distribuido_em >= início do dia BRT`) que **não** têm evento de distribuição da roleta para ele.

Nada de mudança no banco, na lógica de distribuição ou na ordem da fila (o "Próximo" continua por `ultima_distribuicao_at`). É só troca do que o mostrador exibe.

## Mudanças

### 1. `src/hooks/useRoleta.ts` — função `loadFila`
- Adicionar uma consulta a `distribuicao_historico` do dia (BRT), trazendo `pipeline_lead_id, corretor_id, segmento_id, acao`.
- Montar, por lead distribuído via roleta: o corretor (auth id), o segmento (do evento `distribuido`) e se houve `aceito` para aquele lead+corretor.
- Agregar por **(corretor auth_id + segmento_id)**:
  - `distribuidos_roleta`
  - `aceitos_roleta`
- Agregar por **corretor (global)**: `fora_roleta` = (leads possuídos hoje) − (leads distribuídos via roleta para ele). Reaproveita a consulta a `pipeline_leads` que já existe na função.
- No `enriched.map`, preencher os novos campos por linha da fila usando o `auth_id` do corretor (via `profiles.user_id`, já carregado) + `segmento_id` da linha.
- Manter a ordenação atual por `ultima_distribuicao_at`.

### 2. `src/hooks/useRoleta.ts` — tipo `RoletaFilaItem` (~linha 229)
Adicionar campos:
- `distribuidos_roleta: number`
- `aceitos_roleta: number`
- `fora_roleta: number`

(Manter `leads_recebidos` para não quebrar outros usos, mas ele deixa de ser exibido na Operação.)

### 3. `src/components/roleta/ceo/RoletaOperacaoTab.tsx` (~linha 211)
Trocar o bloco `{f.leads_recebidos || 0} leads` por:
- Linha principal: `{f.distribuidos_roleta} distribuídos · {f.aceitos_roleta} aceitos`.
- Abaixo, em texto menor e discreto (muted), apenas quando `fora_roleta > 0`: `{f.fora_roleta} fora da roleta`.
- Ajuste leve de layout do item da fila para caber as duas linhas à direita (o botão de remover `UserX` continua igual).

## Escopo / não-objetivos
- Não altera a distribuição, o credenciamento, as janelas nem a ordem da fila.
- Não cria migration nem mexe em RLS.
- A visão do corretor (`RoletaCorretorView`) e o painel `V4PanelRoleta` ficam como estão (podem ser alinhados depois, se você quiser, num passo separado).

## Validação
Conferir na tela que, para hoje, Douglas aparece com ~2 distribuídos (não 8) e o excedente vai para "fora da roleta"; Rafaela aparece com 1 distribuído · 0 aceitos (o lead que ela deixou dar timeout). Cruzar 2–3 corretores com a `distribuicao_historico` do dia para bater os números.
