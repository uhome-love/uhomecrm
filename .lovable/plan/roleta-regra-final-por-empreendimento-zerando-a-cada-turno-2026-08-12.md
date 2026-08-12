# Roleta: regra final (por empreendimento, zerando a cada turno)

## A regra confirmada

1. Só recebe quem está **ativo na roleta do turno** e **habilitado no empreendimento** do lead.
2. Dentro desse grupo, distribuição **igual, um a um**, dentro do turno.
3. **O contador zera a cada turno.** Manhã, tarde e noite são corridas independentes.
4. **Para a fila de distribuição, recebeu conta** — mesmo que o corretor deixe expirar ou recuse. Quem recebeu vai para o fim da fila do turno. O filtro "só aceito" vale **apenas para os gráficos de leads aceitos do Dashboard CEO**.
5. **Fila do CEO** distribui **por empreendimento**, nunca por segmento — e só entre os ativos da roleta no momento.
6. **Reengajamento** segue exatamente a mesma regra.
7. **Fila do CEO tem um número único** em todas as telas.

## Como está hoje x o que muda

| Regra | Hoje | Ação |
|---|---|---|
| Só alocados no empreendimento (entrada normal) | Já é assim | manter |
| Rodízio um a um no turno | Já é assim | manter |
| Zerar por turno | Já é assim | manter |
| Recebido conta na fila (mesmo perdido) | Já é assim | **manter** (mudou em relação à versão anterior deste plano) |
| Gráfico de aceitos no Dashboard CEO | Mistura envio com aceite | corrigir: contar só `aceito` |
| Fila do CEO por empreendimento | **Não** — dispara com `force` e cai no pote por segmento quando não há alocado ativo | corrigir |
| Reengajamento | Reativação normal já passa pelo mesmo motor; o caminho da Fila do CEO herda o problema acima | corrigir junto |
| Número da Fila do CEO | **Diverge**: hoje a Central de Roleta mostra **10** e o Dashboard CEO mostra **6** | unificar em **6** |

### Por que 10 x 6

A Central de Roleta conta todo lead `pendente_distribuicao` sem corretor, **incluindo arquivados** (4 leads velhos). O Dashboard CEO e o modal de disparo já ignoram arquivados. A verdade única é a do modal de disparo: **sem corretor + pendente de distribuição + não arquivado**.

## Exemplo prático

Manhã, Casa Tua Porto Alegre, ativos: Douglas, Thalia, Junior. Entram 9 leads.

```text
lead 1 Douglas | lead 2 Thalia | lead 3 Junior
lead 4 Douglas | lead 5 Thalia | lead 6 Junior
lead 7 Douglas | lead 8 Thalia | lead 9 Junior
=> 3 / 3 / 3
```

Thalia deixa o lead 5 expirar: o lead volta para a fila e vai para o próximo da vez, mas **Thalia continua contando 2 recebidos** no turno — ela não fura fila por ter perdido. No Dashboard CEO, o gráfico de aceitos mostra 2 para Douglas, 2 para Junior e 1 para Thalia.

Tarde (contador zera às 12h), ativos: Douglas, Thalia, Junior, Paula. Entram 6 leads.

```text
lead 1 Douglas | lead 2 Thalia | lead 3 Junior | lead 4 Paula
lead 5 Douglas | lead 6 Thalia
=> tarde: 2 / 2 / 1 / 1  (Paula não pula na frente de ninguém)
```

Fila do CEO disparada às 15h com 4 leads de Casa Tua Canoas: entra na **mesma corrida da tarde**, só entre os ativos habilitados em Casa Tua Canoas. Se ninguém habilitado estiver ativo, o lead **fica aguardando** com o motivo visível, em vez de ir para alguém de fora do empreendimento.

## Detalhes técnicos

- `public.distribuir_lead_atomico`: **sem alteração** na subconsulta `recebidos_no_produto` — continua contando qualquer status (recebeu = conta). Rodízio segue por produto + turno + dia BRT.
- Fila do CEO (`src/components/pipeline/FilaCeoDispatchModal.tsx` → edge function `distribute-lead`): parar de enviar `force = true`. Sem alocado ativo, o retorno segue `sem_alocado_produto` e o lead permanece na fila com o motivo na linha.
- Fallback por segmento removido **apenas** do caminho da Fila do CEO; o pote por segmento continua para leads **sem empreendimento identificado**.
- Verdade única da Fila do CEO — mesmo filtro nos 4 pontos (`corretor_id is null` + `aceite_status = 'pendente_distribuicao'` + `arquivado = false`):
  - `src/hooks/useRoleta.ts` (leadsAcumulados) — falta `arquivado`
  - `src/hooks/useRoletaStatus.ts` (status bar da Central de Roleta) — falta `arquivado`
  - `src/components/roleta/RoletaMetricasTab.tsx` — falta `arquivado`
  - `src/pages/CeoDashboard.tsx` — já correto, serve de referência
- Gráficos de aceitos do Dashboard CEO: contar apenas registros com status/ação `aceito`, sem somar `distribuido`/`expirado`/`recusado`.
- Reengajamento: `reactivateDiscardedToRoleta` já usa o motor sem `force`; `reativar_lead_para_fila_ceo` herda a correção da Fila do CEO.
- Sem mudança em credenciamento, elegibilidade (leads vermelhos), janelas de turno ou tempo de aceite.

## Validação depois do build

1. Conferir que Central de Roleta e Dashboard CEO mostram o **mesmo número** de Fila do CEO (hoje: 6).
2. Conferir em `distribuicao_historico` que todo registro com empreendimento vem com `pool = 'alocado'` (zero `pool = 'segmento'` vindo da Fila do CEO).
3. Disparar a Fila do CEO com um empreendimento sem alocado ativo e confirmar que o lead fica na fila com o motivo visível, sem ir para fora do empreendimento.
4. Acompanhar um turno inteiro e conferir que a diferença de leads recebidos entre o maior e o menor do grupo é no máximo 1.
