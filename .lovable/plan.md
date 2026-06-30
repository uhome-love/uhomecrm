## Problema

O widget "Leads prestes a estagnar" **já existe** no dashboard do corretor (`/corretor`), renderizado acima dos KPIs da carteira (`PreEstagnacaoCard`). Ele aparece vazio para a Adriana (e some da tela) porque a regra atual exclui qualquer lead com **tarefa futura agendada** — e todos os leads dela perto do limite têm follow-ups marcados. Resultado: o corretor nunca enxerga os leads que estão envelhecendo.

## Objetivo

Mostrar os leads por **data real de estagnação**, ordenados do mais urgente ao menos urgente, dentro de uma **janela de 5 dias**. Leads com tarefa futura deixam de ser invisíveis: a **data da próxima tarefa** passa a ser o gatilho de urgência (é o momento decisivo — se o corretor não agir naquele dia, o lead caminha para estagnar).

## Como o "prazo real" é calculado

Para cada lead do corretor (nas etapas que estagnam: Contato Iniciado 15d, Busca 15d, Aquecimento 30d; ignorando estagnados, arquivados, com negócio, pós-venda e em parceria ativa):

```text
prazo_real =
  • se já está em AVISO de 48h  → usa o prazo final (estagnado_prazo_em)   [mais urgente]
  • senão, se tem TAREFA FUTURA → data da próxima tarefa (vence + 1 dia)
  • senão (sem tarefa)          → última ação + limite da etapa
```

O widget lista os leads cujo `prazo_real` cai **dentro dos próximos 5 dias** (incluindo os já vencidos/no limite), ordenados pela data mais próxima primeiro.

Validação com os dados reais da Adriana: passa de **0** para **31 leads** listados, com badges "estagna hoje / 1d / 2d / 3d" e os em aviso destacados em vermelho.

## Mudanças

### 1. Banco — RPC `get_corretor_pre_estagnacao`
- `DROP` + `CREATE` da função (a assinatura de retorno muda: adiciona `dias_para_estagnar int`).
- Implementa o cálculo de `prazo_real` acima e filtra `prazo_real <= now() + 5 dias`.
- `categoria`: `em_aviso` (aviso de 48h ativo) ou `proximo`.
- Mantém `SECURITY DEFINER` e o filtro por `auth.uid()` (cada corretor vê só os seus). Nenhuma mudança de tabela, RLS ou schema além da função.

### 2. Frontend — `src/components/corretor/PreEstagnacaoCard.tsx`
- Adiciona `dias_para_estagnar` à interface e usa-o no badge: "estagna hoje", "1d", "2d"… e "aviso final" para os em aviso.
- Ordenação já vem pronta da RPC (por urgência); mantém os 5 primeiros + "Ver todos" → `/pipeline?risco=estagnacao`.
- Ajuste de texto do subtítulo para refletir prazo (ex.: "X leads precisam de ação nos próximos 5 dias").

Nenhuma mudança no motor de estagnação em si (crons, `processar_estagnacao_pipeline`, cadência) — apenas a RPC de leitura do widget e o componente visual.
