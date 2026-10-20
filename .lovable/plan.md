# Topo do Pipeline no celular — reorganização

Do jeito que está, ainda não é o melhor topo possível. Hoje são 4 faixas antes do primeiro cliente: título, Leads/Negócios, contadores + Filtros e etapas. Os contadores ficam soltos à direita, deixando um buraco à esquerda, e "Ganhos" compete com "Novo".

## Proposta (3 faixas, estilo app do iPhone)

```text
Pipeline                    [🏆] [ + ]
[ Leads | Negócios ]  ● 49 ● 0 ● 1  [⚙]
(Novo Lead 2) (Sem Contato 4) (Qualif…) →
```

1. **Linha 1 — título e ações:** "Pipeline" grande à esquerda. À direita, dois botões redondos só com ícone: Ganhos (troféu) e Novo (+, azul). O "Novo" só com ícone combina com o "+" da barra de baixo.
2. **Linha 2 — tudo numa linha só:** Leads/Negócios à esquerda; os contadores verde/amarelo/vermelho no meio; o botão de Filtros redondo, só com ícone, à direita, com um número quando houver filtro ativo. O "?" sai do celular. A explicação passa a aparecer ao segurar o dedo nos contadores.
3. **Linha 3 — etapas:** as pílulas que já fizemos, iguais.
4. **Ao rolar a lista**, o título grande encolhe e as linhas 1 e 2 somem. Ficam só as etapas presas no topo, como no app Ajustes e no Instagram. Ao voltar ao topo, elas reaparecem.
5. Busca e filtros completos continuam abrindo ao tocar em Filtros, como hoje.

O computador não muda. Não mexe em dados nem em regras do Pipeline.

## Detalhes técnicos

- `PipelineHeader.tsx`: no celular (`sm:` para baixo) Ganhos e Novo viram botões `h-10 w-10 rounded-full` só com ícone e `aria-label`. A zona 2 fica `flex-nowrap`, os contadores no meio e o Filtros com ícone e badge. O `InfoOciosidade`/"?" fica `hidden sm:inline-flex`.
- Recolher ao rolar: `PipelineMobileView` avisa a direção da rolagem da lista, via callback ou um estado pequeno compartilhado. O header aplica `max-h-0 opacity-0` com transição nas zonas 1 e 2 só no celular. As etapas continuam sticky.
- Validar no iPhone virtual (393x841) só olhando: topo parado, rolando e com filtro ativo. Conferir também que o desktop está igual.
