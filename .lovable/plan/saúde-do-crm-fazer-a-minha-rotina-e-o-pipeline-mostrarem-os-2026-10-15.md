# Saúde do CRM: fazer a Minha rotina e o Pipeline mostrarem os mesmos números

## O que encontrei (Rafaela Campos)
Os dois lugares contam clientes diferentes.

| | Minha rotina (regra da Roleta) | Pipeline |
|---|---|---|
| Desatualizado (vermelho) | 1 (Elisete) | 1 |
| Atenção (amarelo) | 8 | 10 |
| Em dia (verde) | 31 | 42 |

- **+2 em atenção no Pipeline:** Arthur Lake e Omar Garcia são parcerias em que ela é parceira. O Pipeline mostra esses clientes, mas a regra dos 80% conta só a carteira própria dela.
- **+11 em dia no Pipeline:** 2 parcerias em dia e 9 clientes estagnados, que o Pipeline do corretor pinta de verde, mas que a regra deixa fora da conta.
- **"9 para atualizar"** na Minha rotina = 1 vermelho + 8 amarelos. O botão abre só o filtro vermelho, por isso ela vê 1.

## O que muda (só tela; a regra dos 80% e o cálculo continuam iguais)
1. **Minha rotina:** em vez de "9 clientes para atualizar", vai aparecer **"1 desatualizado · 8 em atenção"**. Cada número abre o filtro certo do Pipeline. Se um deles for zero, não aparece.
2. **Pipeline (visão do corretor):** os estagnados deixam de contar como "em dia" na bolinha verde. Eles continuam sem filtro próprio para o corretor.
3. **Pipeline, ícone de ajuda (?):** uma frase explicando: "A saúde da Roleta conta só seus clientes próprios. Parcerias aparecem aqui, mas não entram nos 80%."

Assim, os números da carteira própria batem nos dois lugares, e a diferença das parcerias fica explicada.

## Validação
- No preview, conferir com os dados da Rafaela: Minha rotina com 1 e 8, e Pipeline sem os estagnados no verde. Nada de dados é alterado.

## Detalhes técnicos
- Migração (1, só leitura): `crm_saude_corretor` passa a retornar também `ambar` e `vermelho` separados. `roleta_performance_status` repassa esses valores. O percentual e o gate não mudam.
- `useRoletaPerformanceStatus`: tipar os campos novos. `MinhaEvolucaoKpis` e `RoletaTurnoCard` usam links `?filtro=atrasado` e `?filtro=sem_tarefa`.
- Contagem das pílulas do Pipeline: excluir `estagnado` do `em_dia` quando o chip de estagnado não aparece (visão do corretor). Ajustar o texto do tooltip de ajuda.
