## Reorganização da página Presença — UX/UI

Só mudanças visuais/de layout. Nenhuma alteração em backend, hooks, RPCs, regras de elegibilidade ou triggers.

### 1. Renomear a página

- Título passa de **"Central de Presença"** para **"Presença"**.
- Sidebar: item "Presença Roleta" vira **"Presença"** (mesma rota `/roleta/presenca`).
- Subtítulo curto: "Validação por turno, histórico e auditoria."

### 2. Aba "Hoje" — encurtar drasticamente cada corretor

Hoje cada corretor ocupa um card grande com 2–3 linhas verticais (uma por turno). Vamos para **uma linha por corretor**, com os turnos em colunas lado a lado. Isso reduz a altura em ~70%.

Layout novo por linha (desktop ≥ md):

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [avatar] Nome do corretor        │ Manhã: [chip] [Chegou/Saiu]           │
│          🎯 Roleta (se cred.)    │ Tarde: [chip] [Chegou/Saiu]           │
│                                  │ Noturna: [chip] [Chegou/Saiu]  (cond.)│
└──────────────────────────────────────────────────────────────────────────┘
```

- Coluna esquerda fixa (avatar + nome + selo Roleta compacto).
- Coluna direita: 2 (ou 3) mini-blocos horizontais por turno, cada um com label "M/T/N", chip de estado e botão de ação. Turno ativo destacado com borda `primary/30`.
- Mobile (< md): cai para o layout atual empilhado (avatar em cima, turnos abaixo em coluna). Sem regressão em telefone.

Refatoração: `CorretorRow` em `PresencaRoletaPanel.tsx` passa a renderizar grid `md:grid-cols-[minmax(180px,220px)_1fr]`; `TurnoLinha` recebe variante `compact` que usa `flex` horizontal em vez de linha cheia.

### 3. Aba "Hoje" — agrupar por equipe (escopo CEO/Diretora)

Quando `scope === "ceo"`, agrupar as linhas por gestor em blocos colapsáveis.

- Header do grupo: nome do gestor + contador "X na empresa / Y total" do turno ativo.
- Padrão: expandidos.
- Ordenados por nome do gestor; corretores sem gestor entram em bloco "Sem equipe" no fim.

Para isso o hook `usePresencaCorretoresDia` precisa de um campo extra `gerente_id` + `gerente_nome` por corretor (uma query a `team_members` + `profiles` do gestor). É a única mudança de dados — leitura pura, sem migração.

No escopo gestor a UI ignora o agrupamento (todos já são do time dele).

### 4. Barra de resumo do topo

Substituir o retângulo cinza atual por uma faixa mais leve e informativa em `flex`:

- Turno ativo · Na empresa: **N / Total** · Faltas hoje: N · Saíram: N
- Fora de janela: mostra só "Presença de hoje · N corretores" (mantém).

### 5. Ajustes menores nas outras abas

- **Histórico**: manter tabela, mas nas primeiras colunas usar avatar+nome compactos e adicionar "Equipe" para CEO/Diretora (já existe como "Gestor" — só renomear header para "Equipe").
- **Auditoria**: sem mudanças estruturais; só usar o mesmo chip de estado do "Hoje" para consistência visual.

### 6. Arquivos tocados

- `src/pages/PresencaRoleta.tsx` — título/subtítulo, grupos por equipe na aba Hoje.
- `src/components/roleta/PresencaRoletaPanel.tsx` — `CorretorRow` em linha, `TurnoLinha` variante compacta, faixa de resumo, opção `groupByTeam`.
- `src/hooks/usePresencaCorretoresDia.ts` — incluir `gerente_id` e `gerente_nome` (query extra em `team_members`+`profiles`).
- `src/components/layout/Sidebar.tsx` + `src/config/pageRegistry.ts` — label "Presença".

### Fora de escopo

- Nenhuma mudança em regras de elegibilidade, RPCs, triggers, `roleta_presencas`, `useRoletaPresencas`.
- Nenhuma mudança nos widgets/dashboards do corretor, gestor e CEO — só na página `/roleta/presenca`.