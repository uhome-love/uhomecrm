## Contexto

Regra fechada para a **Noturna** (e reforçada agora): é benefício automático. Assim que o CEO aprova o credenciamento da roleta noturna, o turno da noite já aparece como **Presente** no painel. Não existe botão de Presente, Faltou ou Saiu na noturna — nem para o gestor, nem para o corretor.

Hoje o painel ainda mostra "SEM MARCAR" + botões Presente/Faltou na coluna Noturna (screenshot), e o `mostrarNoturna` ainda tem uma condição legada baseada em presença de manhã + tarde. Precisa ajustar.

## Escopo (só UI de Seg-Sex; não mexer em sáb/dom, cron, backend, RPC, nem outras etapas)

Arquivo único: `src/components/roleta/PresencaRoletaPanel.tsx`.

### 1. `TurnoChip` — Noturna vira info-only e "Presente" automático

- Se `turno === "noturna"`:
  - **Nunca** renderizar os botões `Presente`, `Faltou`, `Saiu` (adicionar `&& turno !== "noturna"` nos três `show*`).
  - Forçar o estado exibido como `"na_empresa"` (rótulo verde **PRESENTE**) sempre que `credenciado === true`, independentemente de existir row em `roleta_presenca`. Isso reflete: aprovou credenciamento → presença auto.
- Manhã e Tarde continuam iguais (botões normais).

### 2. `CorretorRow` — Noturna aparece só para credenciados

- Trocar:
  ```
  const mostrarNoturna = elegívelNoturna || credenciadoNoturna;
  ```
  por:
  ```
  const mostrarNoturna = credenciadoNoturna;
  ```
- Remover as variáveis `presencaManha`, `presencaTarde`, `elegívelNoturna` (não usadas mais).
- Não-credenciado na noturna: linha da noturna simplesmente não aparece.

### 3. Banner e stats — não contar noturna como pendência

- Confirmar em `getRegimeDoDia` (`src/lib/roletaPresenca.ts`) que, em Seg-Sex, `turnosMarcaveis` traz apenas `manha` e `tarde`. Se `noturna` estiver ali, remover. É isso que impede o banner "N corretores sem marcação" de crescer por conta da noturna.
- `stats` do turno ativo já conta `credenciado` como `na_empresa` — nada muda.

## Validação (preview `/roleta/presenca`, hoje segunda)

1. Abrir com um corretor credenciado na noturna aprovado (ex.: Andressa, Billy, Eliézer no screenshot).
2. Coluna **Noturna** deve mostrar apenas o chip **PRESENTE** verde + ícone 🎯. Sem botão nenhum.
3. Corretor sem credenciamento noturna aprovado: a coluna Noturna some para ele.
4. Colunas **Manhã** e **Tarde** continuam com Presente/Faltou/Saiu conforme regra atual.
5. Banner amarelo "N corretores sem marcação" só conta pendências de manhã e tarde.

Sem mudanças em backend, cron, RPCs, fim-de-semana ou fluxo do corretor.