## Diagnóstico

A persistência de tab em `localStorage` (`uhome:pipeline-mode:{role}`) sobrescreve o default toda vez que o CEO/gestor clica em outra aba. Um clique acidental em "Kanban" basta para grudar essa escolha para sempre.

A one-shot migration v2 só corrigiu a poluição inicial — não evita reincidência. Bumpar pra v3 só adia o problema.

## Fix proposto — Default determinístico por role, sem persistência para admin/gestor

**Comportamento alvo:**
- CEO (admin) sempre abre em **Equipes**
- Gestor sempre abre em **Modo Time**
- Corretor sempre abre em **Kanban** (já era o default e só tem 2 abas relevantes)
- Dentro da sessão, navegar entre abas continua funcionando normalmente
- Recarregar / fechar e abrir → volta ao default da role

**Alterações em `src/pages/PipelineKanban.tsx`:**

1. **Remover a leitura do `localStorage`** no efeito de inicialização (linhas 121-141). Substituir por: assim que `rolesReady === true`, setar `activeTab = defaultTabForRole`. Mantém `activeTab` como `null` antes disso (loading state já cobre).
2. **Remover o efeito de persistência** (linhas 143-146) — não escreve mais no storage.
3. **Manter** o efeito de reset quando a role muda (linhas 149-155) — ainda útil para login/logout dentro da mesma sessão.
4. **Cleanup defensivo**: no mesmo efeito de inicialização, fazer `removeItem` das chaves `uhome:pipeline-mode:admin`, `:gestor`, `:corretor` e do flag `:migrated-v2` para apagar o lixo antigo (idempotente, sem custo).

**O que NÃO muda:**
- Lógica de roles, `rolesReady`, `allowedTabsForRole`
- Server-side scope filter (Fase C entregue)
- Pílulas, dropdown corretor, qualquer comportamento de Bug 1/2/3/4 anteriores
- Componente `PipelineHeader` e suas props (continua recebendo `activeTab`/`setActiveTab` igual)

## Risco

Baixo. Único efeito colateral: usuário que tinha "preferência" salva (ex.: gestor que gostava de abrir direto em Kanban) perde essa preferência. Mas isso era exatamente o comportamento que gerou o bug — então é intencional.

Se no futuro o time quiser "lembrar última aba", a implementação correta seria salvar **só quando explicitamente diferente do default** + TTL — mas isso é trabalho de outra rodada.

## Validação

- [ ] CEO abre `/pipeline-leads` → carrega em **Equipes**
- [ ] CEO clica em Kanban, navega, depois recarrega → volta em **Equipes**
- [ ] Gestor (Gabrielle) abre → carrega em **Modo Time**
- [ ] Gestor clica em Kanban, recarrega → volta em **Modo Time**
- [ ] Corretor (Adriana) abre → carrega em **Kanban** (sem regressão)
- [ ] `localStorage` limpo (chaves `uhome:pipeline-mode:*` ausentes após primeira carga)
