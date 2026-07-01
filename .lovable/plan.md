## Objetivo

Reposicionar o widget **"Leads prestes a estagnar"** (`PreEstagnacaoCard`) no Dashboard do Corretor (`/corretor`). Hoje ele fica no topo da coluna principal, ocupando muito espaço central. Deve passar para a **coluna da direita, abaixo das tarefas de hoje**.

## Situação atual

Em `src/pages/CorretorDashboard.tsx` o layout de 2 colunas é:

```text
Coluna principal (flex-1)      Coluna lateral (280px, ≥1024px)
--------------------------     ------------------------------
PreEstagnacaoCard              TarefasHojeLateral (desktop)
CarteiraKpis
ConquistasKpis
CaminhosCards
```

No mobile (<1024px) a lateral vira um accordion abaixo dos cards.

## Mudança proposta

Editar **apenas** `src/pages/CorretorDashboard.tsx`:

1. Remover `<PreEstagnacaoCard />` do topo da coluna principal.
2. Na coluna lateral desktop (`hidden lg:block w-[280px]`), colocar o `PreEstagnacaoCard` **abaixo** do `TarefasHojeLateral variant="desktop"`, empilhados com espaçamento.
3. No bloco mobile (`lg:hidden`), colocar o `PreEstagnacaoCard` também **abaixo** do accordion de tarefas, para manter a mesma ordem (tarefas primeiro, leads a estagnar depois).

Layout resultante:

```text
Coluna principal (flex-1)      Coluna lateral (280px)
--------------------------     ----------------------
CarteiraKpis                   TarefasHojeLateral
ConquistasKpis                 PreEstagnacaoCard
CaminhosCards
```

## Observações técnicas

- O `PreEstagnacaoCard` já retorna `null` quando não há leads em risco, então não ocupa espaço quando vazio.
- O card é fluido (`w-full`), então cabe naturalmente na largura de 280px da lateral.
- Nenhuma lógica de dados, RPC ou regra de estagnação é alterada — mudança puramente de posicionamento/layout.
