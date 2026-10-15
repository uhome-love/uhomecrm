# Saúde do CRM: deixar claro de onde vêm os "9 clientes para atualizar"

## O que encontrei (Rafaela Campos)
O número 9 está certo, mas a frase confunde. A conta da saúde (77,5% = 31 em dia de 40 ativos) trata como "para atualizar" tudo o que não está verde:
- **1 desatualizado** (vermelho): Elisete Montevani Ferreira.
- **8 em atenção** (amarelo): Silvia Vieira Munchen, Dai Santos, Yndira Lara, Alexandra Tuffani, Genison, Rosieli Marins, Vanessa Lobato e Vanilda Pinto Cordeiro.

O botão leva ao filtro "desatualizado" do Pipeline, que mostra só o vermelho. Por isso ela vê 1 lá e 9 na Minha rotina.

## O que muda (só texto e link; a regra dos 80% fica igual)
- No quadro **Saúde do CRM** e no botão da Roleta, em vez de "9 clientes para atualizar", vai aparecer:
  **"1 desatualizado · 8 em atenção"**. Cada parte é clicável e abre o filtro certo do Pipeline ("desatualizado" ou "atenção").
- Embaixo, uma frase curta: "Atualize os dois para voltar a 80%."
- Se um dos dois for zero, ele não aparece.

## Validação
- Abrir a Minha rotina no preview e conferir que os números batem com os filtros do Pipeline (1 e 8 no caso da Rafaela), sem alterar dados.

## Detalhes técnicos
- `crm_saude_corretor` / `roleta_performance_status`: incluir no retorno a contagem separada de `ambar` e `vermelho` (hoje só vem `a_atualizar` somado). É uma mudança só de leitura, sem mexer no cálculo do percentual nem no gate. Feita em 1 migração.
- `useRoletaPerformanceStatus`: tipar os campos novos.
- `MinhaEvolucaoKpis` e `RoletaTurnoCard`: mostrar as duas contagens com links `/pipeline-leads?filtro=atrasado` (vermelho) e `?filtro=sem_tarefa` (atenção).
