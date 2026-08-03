# Lote 2 — QW-F: shell de abas respeita a query string

Escopo: **um único arquivo**, `src/contexts/TabContext.tsx`. Nenhuma página, hook, dado, CSS ou deploy.

## Causa raiz (confirmada no código)

`openTab` identifica a aba pelo `resolved.key` (derivado só do pathname). Quando a aba já existe e **já é a ativa**, a função faz `return` sem navegar e sem atualizar o `path` guardado no tab. Abrir `/materiais?emp=X` estando em `/materiais?emp=Y` não muda nada — nem URL, nem estado. A mesma classe de bug atinge `?tab`, `?secao`, `?status`.

Como o `AppLayout` mantém todas as abas montadas e as páginas leem os parâmetros da URL, basta a URL mudar para o painel reagir.

## (a) Diff conceitual

### `openTab(path, skipNav)` — bloco "aba já existe"

Hoje:
1. Se a aba já é a ativa → `return` (nada acontece).
2. Se não é a ativa → ativa e navega para `path`.

Passa a ser:
1. Localiza a aba existente e compara o `path` recebido (já normalizado) com `tab.path` guardado.
2. Se forem diferentes, atualiza o array de abas trocando **apenas** o `path` daquela aba (`setTabs` com map imutável); as demais propriedades (id, label, icon, closable, componentKey, pattern, noPadding) ficam idênticas.
3. Se a aba não é a ativa, `setActiveTabId(resolved.key)`.
4. Navega quando `!skipNav` **e** (a aba não era a ativa **ou** o `path` mudou). Se nada mudou (mesma aba, mesmo path), não navega — evita entradas duplicadas no histórico.
5. `return`.

Também: `openTab` passa a declarar `hasAccess` nas dependências do `useCallback` (hoje o array está vazio; `hasAccess` é estável, então não muda comportamento — apenas correção de lint).

### Efeito URL → Tab

Hoje, quando a rota resolve para uma aba já aberta, o efeito só faz `setActiveTabId` se ela não for a ativa; o `tab.path` guardado nunca é sincronizado.

Passa a ser: no ramo `if (existing)`, além de ativar a aba quando necessário, compara `existing.path` com o `normalizedFullPath` atual e, se diferente, atualiza o `path` da aba via `setTabs` (map imutável). **Não navega** nesse efeito — a URL já é a correta, aqui só se espelha estado.

Nada mais muda: `closeTab`, `activateTab`, MAX_TABS, role-gate, normalização de rotas legadas, redirect de `/`, persistência — tudo intacto.

## (b) Como o loop de navegação é evitado

Três guardas somadas:

1. **O efeito URL→Tab nunca navega quando a rota já é válida.** Ele só faz `setActiveTabId`/`setTabs` (estado), então não realimenta `location`.
2. **`openTab` só navega quando algo realmente mudou** (`path` diferente ou aba diferente). Navegar para a mesma URL vira no-op.
3. **`syncingRef` continua ativo**: quando o efeito precisa navegar (redirect de `/`, normalização legada, role-gate), ele marca a flag e a libera no `requestAnimationFrame` seguinte, ignorando o disparo de `location` que ele mesmo causou.

Sequência típica: clique na sidebar → `openTab` atualiza `tab.path` + `navigate` → `location` muda → efeito roda, encontra a aba, vê que `existing.path` já é igual ao `normalizedFullPath` → nenhum `setState`, nenhuma navegação → fim.

## (c) Matriz de regressão (validada ao vivo no preview)

| # | Cenário | Esperado |
|---|---|---|
| 1 | Trocar entre abas na TabBar | Ativa a aba e restaura a URL com a query guardada |
| 2 | Back/forward do browser | Aba correta ativa, URL e painel coerentes, sem loop |
| 3 | `/materiais?emp=X` com a aba Materiais já ativa | URL muda e o painel troca de empreendimento |
| 4 | Trocar `?emp` pela navegação interna da tela | URL e conteúdo acompanham |
| 5 | Role-gate/redirect (`/` → home do papel; rota sem permissão) | Comportamento inalterado |
| 6 | sessionStorage (`uhome_tabs_v1`) | `tab.path` persistido com a query mais recente; reload restaura ela |
| 7 | MAX_TABS (8) e `closeTab` | Descarte da mais antiga e fechamento com foco na vizinha, inalterados |
| 8 | `?tab` / `?secao` / `?status` (Central de Relatórios, Configurações, Pipeline) | Trocam a URL e o conteúdo estando a aba ativa |
| 9 | Rotas legadas (`/pipeline` → `/pipeline-leads`, `/visitas` → `/agenda-visitas`) | Normalização segue funcionando, sem loop |

## (d) Riscos

- **Histórico do browser mais verboso**: trocar query dentro da mesma aba agora empilha entradas. Mitigado por só navegar quando o path muda; se incomodar, dá para usar `replace` em troca de query na mesma aba (não incluído neste lote).
- **Re-render extra** da lista de abas quando o path muda (array novo). Impacto desprezível; a `TabBar` só exibe label/ícone.
- **Páginas que lêem a query só na montagem** (em vez de `useSearchParams`) continuariam presas — não é regressão, e o conserto seria na página, fora do escopo. Se algum caso aparecer no teste 8, reporto sem tocar no arquivo.

## (e) Confirmação de escopo

Só `src/contexts/TabContext.tsx` muda. **Não vou tocar** em `src/components/AppLayout.tsx` nem em `src/config/pageRegistry.ts` — se durante a validação ficar claro que um deles é necessário, paro e pergunto antes. Nenhuma página (incluindo `MateriaisPage.tsx`), hook, query, RPC, migration, `index.css` ou deploy.
