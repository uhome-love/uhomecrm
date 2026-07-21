
# Plano — Simplificar Central de Tarefas (só Lead)

Escopo restrito a `src/pages/MinhasTarefas.tsx`. Módulos de Negócios (Meus Negócios, drawer do negócio) continuam intactos — lá as tarefas de negócio seguem existindo.

## Mudanças

1. **Remover o dialog "Qual tipo de tarefa?"** (linhas 1296-1329)
   - Botão "➕ Nova Tarefa" (linha 924) passa a abrir DIRETO o dialog de nova tarefa de lead (`setShowNovaTarefa(true)`), sem passar por `showTipoSelector`.
   - Remover state `showTipoSelector` e imports não usados.

2. **Remover o dialog "Nova Tarefa de Negócio"** inteiro (linhas 1331–~1420) e todo o wiring:
   - State: `showNovaTarefaNegocio`, `selectedNegocioId`, `selectedNegocioNome`, `negocioSearch`, query `negocio-search-tarefas`.
   - Branch `if (categoria === "negocios")` em `handleCriarTarefa` (linhas 623-654) — some junto.
   - Insert em `negocios_tarefas` (linhas 855 e 638) — some.

3. **Remover a aba "Tarefas de Negócios"** (linhas 930-940)
   - Remover o wrapper de tabs `Leads vs Negócios` inteiro (fica só a lista de leads, sem o toggle).
   - State `categoria` e todas as ramificações `categoria === "negocios"` viram morto:
     - Query `negociosTarefas` (linhas 423-…) — remover.
     - `activeTarefas` volta a ser só `tarefas`.
     - Filtros que checavam `categoria` (linhas 532, 568, 587, 912, 1065, 1069, 1424) — simplificar para o caminho "leads".

4. **Presets/fluxo atual do popup "Nova Tarefa de Lead" continuam iguais** — busca de lead, chips de preset por etapa, tipo, data, hora, observação, sync de `flag_status`. Foi validado na frente anterior; não mexer.

## Verificação do fluxo (o que fica)

Fluxo único após a mudança:
1. Usuário clica **➕ Nova Tarefa** → abre direto o dialog de tarefa de lead.
2. Busca o lead → chips de preset aparecem se a etapa tiver (Qualificação/Aquecimento/Negociação).
3. Escolhe preset (ou "Outro (livre)") → preenche tipo/data/hora/observação.
4. Clica "Criar Tarefa" → insere em `pipeline_tarefas` e, se houver `syncFlagKey`, atualiza `flag_status` do lead.
5. Aba única: só "Minhas Tarefas" (de leads). Tabs de período (Hoje/Amanhã/Atrasadas/Desatualizados/Todas) permanecem.

## Fora de escopo

- Tarefas de negócio no drawer do negócio (`NegocioDetailModal`) e em `MeusNegocios` — permanecem.
- Tabela `negocios_tarefas` no banco — não remover; ainda usada por outros módulos.
- `MinhaAgendaWidget` — se listar tarefas de negócio, fica como está (não foi pedido).

## Arquivo alterado

- `src/pages/MinhasTarefas.tsx` — única edição.

## Validação ao vivo

- `/minhas-tarefas` → clicar "Nova Tarefa" abre direto o popup de lead (sem escolha de tipo).
- Aba única no header (sem toggle Leads/Negócios).
- Criar tarefa em lead da Qualificação → chip aparece, preenche campos, salva, `flag_status` sincroniza.
- Cancelar sem alterar leads reais.
