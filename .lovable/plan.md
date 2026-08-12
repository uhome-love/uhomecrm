# Roleta: a regra que você quer x a regra que roda hoje

## A regra que entendi de você

1. Em cada turno, o lead de um produto só vai para quem está **ativo na roleta daquele turno e habilitado no produto**.
2. Dentro desse grupo, distribuição **igual, um a um** (9 leads / 3 pessoas = 3 para cada).
3. Quem **perde o aceite** (timeout/recusa) devolve o lead, que vai para o **próximo da fila**.
4. **Fila do CEO** disparada manualmente segue exatamente a mesma regra — só para quem está ativo na roleta naquele momento.
5. Na **tarde**, o contador **não zera**: leva em conta o que a pessoa já recebeu de manhã. Na **noite**, leva em conta manhã + tarde. Paridade acumulada no dia.

## O que já é assim hoje (confirmado no motor `distribuir_lead_atomico`)

- Item 1: sim. Só entram credenciados aprovados no turno, com `na_roleta = true`, e alocados ao produto.
- Item 2: sim, dentro do turno e do produto. O critério de escolha é "quem tem menos leads **desse produto neste turno de hoje**", desempatando por quem recebeu há mais tempo.
- Item 3: sim. No timeout o lead volta a ser distribuído excluindo quem perdeu o aceite (`p_exclude_auth_user_id`), e vai para o próximo.
- Item 4: parcialmente. A Fila do CEO chama o mesmo motor, então respeita "ativo na roleta". Mas ela dispara com `force`, o que permite cair no pote por **segmento** (fora dos alocados ao produto) quando não há alocado ativo. Precisa decidir se isso continua ou se vira "só ativos + habilitados no produto".

## O que **não** é assim hoje (a causa do desequilíbrio)

**Item 5 não existe.** O contador é reiniciado a cada turno **e** é separado por produto. Ninguém olha quanto a pessoa já recebeu no dia.

Consequências reais medidas em 10–11/08:
- Thalia 26 e Douglas 24 distribuições em 2 dias, contra 1–8 da maioria.
- Na noite de 10/08, o grupo ativo de Casa Tua Porto Alegre tinha só 2 pessoas (Douglas e Thalia): alternaram certinho 1 a 1 e somaram ~20 leads.
- Quem está em 2 produtos e credenciado nos 3 turnos entra em vários grupos ao mesmo tempo e soma tudo.
- 135 leads foram para a Fila do CEO por "nenhum alocado ativo no produto" no mesmo período.

## Exemplo prático (como funciona hoje x como ficaria)

Manhã, Casa Tua Porto Alegre, ativos: Douglas, Thalia, Junior. Entram 9 leads.

```text
MANHÃ (hoje e depois igual — já funciona)
lead 1 Douglas | lead 2 Thalia | lead 3 Junior
lead 4 Douglas | lead 5 Thalia | lead 6 Junior
lead 7 Douglas | lead 8 Thalia | lead 9 Junior
=> 3 / 3 / 3

Se Thalia perde o aceite do lead 5:
o lead 5 volta e vai para o próximo com menos leads (Junior, depois Douglas).
Thalia continua contando 2 no turno, então tende a receber o próximo lead novo.
```

Tarde, entram 6 leads, agora ativos: Douglas, Thalia, Junior, Paula (Paula não fez a manhã).

```text
HOJE (contador zera no turno)
lead 1 Douglas | lead 2 Thalia | lead 3 Junior | lead 4 Paula
lead 5 Douglas | lead 6 Thalia
=> dia: Douglas 5, Thalia 5, Junior 4, Paula 1

COMO VOCÊ QUER (contador acumula no dia)
Saldo do dia ao abrir a tarde: Douglas 3, Thalia 3, Junior 3, Paula 0
lead 1 Paula (0)  | lead 2 Paula (1)  | lead 3 Paula (2)
lead 4 Douglas/Thalia/Junior conforme quem recebeu há mais tempo
lead 5 e 6 seguem completando o empate
=> dia: 4 / 4 / 4 / 3  (paridade real)
```

Noite: mesma lógica, olhando manhã + tarde somadas. Fila do CEO disparada às 15h entra na mesma conta da tarde — não é uma fila paralela.

## O que muda no sistema

- Trocar o critério de ordenação do motor: passa a ser **(1) menos leads recebidos hoje no total**, depois **(2) menos leads desse produto no turno**, depois quem recebeu há mais tempo. Hoje só existe o (2).
- Contagem do dia lida de `roleta_distribuicoes` na data BRT, sem filtro de turno nem de produto.
- Definir com você o comportamento da Fila do CEO quando ninguém alocado ao produto está ativo: (a) mandar para o pote por segmento como hoje, ou (b) segurar e avisar. Isso muda os 135 casos do período.
- Nada muda em credenciamento, elegibilidade (leads vermelhos), janelas de turno ou tempo de aceite.

## Uma pergunta antes de construir

Quando um corretor **perde o aceite**, esse lead deve continuar contando para ele no saldo do dia (para não virar estratégia deixar expirar) ou não conta?
