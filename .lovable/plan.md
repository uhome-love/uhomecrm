# Roleta: regra final (por empreendimento, zerando a cada turno)

## A regra confirmada

1. Só recebe quem está **ativo na roleta do turno** e **habilitado no empreendimento** do lead.
2. Dentro desse grupo, distribuição **igual, um a um**, dentro do turno.
3. **O contador zera a cada turno.** Manhã, tarde e noite são corridas independentes — quem entra só à tarde não ganha vantagem nem desvantagem.
4. **Lead perdido (timeout/recusa) não conta** para o corretor. Só conta o que ele **aceitou**.
5. **Fila do CEO** distribui **por empreendimento**, nunca por segmento — e só entre os ativos da roleta no momento.
6. **Reengajamento** segue exatamente a mesma regra.

## Como está hoje x o que muda

| Regra | Hoje | Ação |
|---|---|---|
| Só alocados no empreendimento (entrada normal) | Já é assim | manter |
| Rodízio um a um no turno | Já é assim | manter |
| Zerar por turno | Já é assim | manter |
| Perdeu o aceite não conta | **Não** — conta tudo que foi enviado, mesmo expirado/recusado | corrigir |
| Fila do CEO por empreendimento | **Não** — dispara com `force` e cai no pote por segmento quando não há alocado ativo | corrigir |
| Reengajamento | Reativação normal já passa pelo mesmo motor (por empreendimento); o caminho que joga na Fila do CEO herda o problema acima | corrigir junto com a Fila do CEO |

Números que comprovam o item 4: nos últimos 2 dias houve 140 aceitos, 16 expirados e 1 recusado registrados em `roleta_distribuicoes`. Esses 17 perdidos estão hoje contando como "já recebeu" e empurram o corretor para o fim da fila sem ele ter ficado com o lead.

## Exemplo prático

Manhã, Casa Tua Porto Alegre, ativos: Douglas, Thalia, Junior. Entram 9 leads.

```text
lead 1 Douglas | lead 2 Thalia | lead 3 Junior
lead 4 Douglas | lead 5 Thalia | lead 6 Junior
lead 7 Douglas | lead 8 Thalia | lead 9 Junior
=> 3 / 3 / 3
```

Thalia deixa o lead 5 expirar:

```text
HOJE:   Thalia continua contando 2 do turno, mesmo sem ficar com o lead.
DEPOIS: o lead 5 volta para o próximo da fila (Junior/Douglas) e o placar de
        Thalia volta para 1 aceito — ela recebe o próximo lead novo do turno.
```

Tarde, entram 6 leads, ativos: Douglas, Thalia, Junior, Paula (Paula entrou só agora).

```text
Contador zera às 12h. Ninguém carrega saldo da manhã.
lead 1 Douglas | lead 2 Thalia | lead 3 Junior | lead 4 Paula
lead 5 Douglas | lead 6 Thalia
=> turno da tarde: 2 / 2 / 1 / 1  (Paula não pula na frente de ninguém)
```

Noite: mesma coisa, contador zera de novo às 18h30.

Fila do CEO disparada às 15h com 4 leads de Casa Tua Canoas: entra na **mesma corrida da tarde**, só entre os ativos habilitados em Casa Tua Canoas — não vai mais para o pote por segmento. Se ninguém habilitado estiver ativo, o lead fica aguardando em vez de ir para alguém de fora do empreendimento.

## Detalhes técnicos

- `public.distribuir_lead_atomico`: a subconsulta `recebidos_no_produto` passa a filtrar `rd.status = 'aceito'` (hoje conta qualquer status). O rodízio continua por produto + turno + dia BRT.
- Fila do CEO (`FilaCeoDispatchModal` → `distribute-lead`): parar de enviar `force = true`, para que o motor exija corretor alocado ao empreendimento. Quando não houver alocado ativo, o retorno continua sendo `sem_alocado_produto` e o lead permanece na fila com o motivo visível.
- Reengajamento: `reactivateDiscardedToRoleta` já usa o motor sem `force` — herda a correção automaticamente. O caminho `reativar_lead_para_fila_ceo` também, já que passa pela Fila do CEO ajustada.
- Remover o fallback por segmento apenas do caminho da Fila do CEO; o pote por segmento continua existindo para leads **sem empreendimento identificado**.
- Sem mudança em credenciamento, elegibilidade (leads vermelhos), janelas de turno ou tempo de aceite.

## Validação depois do build

1. Conferir em `distribuicao_historico` que todo registro com empreendimento vem com `pool = 'alocado'` (zero `pool = 'segmento'` vindo da Fila do CEO).
2. Simular um timeout com lead de teste e confirmar que o corretor volta para o topo da fila do turno.
3. Acompanhar um turno inteiro e conferir que a diferença entre o maior e o menor do grupo é no máximo 1.
