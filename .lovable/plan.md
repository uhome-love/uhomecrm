# Plano de ajustes rápidos na PDN

## Contexto
Após validação ponta a ponta no preview como CEO, a PDN está funcional e integrada ao pipeline, mas foram identificados 4 ajustes urgentes de UX e robustez.

## Ajustes propostos

### 1. Ocultar VGV quando zerado na Visita Realizada
- **Onde:** `src/pages/PdnGestor.tsx` (linhas dos cards da planilha e `PdnCard.tsx` do Kanban).
- **O quê:** quando `row.vgv === 0`, exibir `—` em vez de `R$ 0`.
- **Por quê:** a etapa "Visita Realizada" tem naturalmente VGV ainda não definido; mostrar R$ 0 polui a leitura e desvaloriza os KPIs.
- **Escopo:** apenas apresentação, nenhuma mudança no banco.

### 2. Placeholder de data em formato brasileiro no drawer
- **Onde:** `src/components/pdn/drawer/PdnTabAcao.tsx` (input de data da próxima ação).
- **O que:** forçar placeholder e máscara para `dd/mm/aaaa` (BRT), alinhado ao restante do CRM.
- **Escopo:** frontend apenas.

### 3. Substituir "Remover da planilha" por ação de regredir etapa
- **Onde:** `src/pages/PdnGestor.tsx` (linha 1058) e `src/components/pdn/kanban/PdnCard.tsx`.
- **O que:**
  - Trocar o ícone de lixeira por um botão/ícone de regressão (ex: `Undo2` ou `TrendingDown`).
  - Ao clicar, abrir confirmação: "Regredir [Nome] de [Etapa atual] para [Etapa anterior]?"
  - Se confirmar, chamar `onMudarEtapa` para a etapa anterior do PDN e enviar notificação automática ao corretor via `pdnSyncEngine.notifyBroker`.
  - Manter a funcionalidade de "Remover da planilha" apenas para linhas manuais (`isManual`), onde de fato é exclusão.
- **Por quê:** o gestor quer sinalizar ao corretor que o lead visitou e ainda não evoluiu para negócio, sem perder o histórico.
- **Escopo:** componente + notificação; sem migração de dados.

### 4. Corrigir warning de DOM nesting (`<button>` dentro de `<button>`)
- **Onde:** `src/pages/PdnGestor.tsx` no `GrupoBloco` (header do grupo da planilha que envolve `ColumnsMenu`).
- **O que:** o header do grupo é um `button` (para expandir/colapsar) e dentro dele fica o `ColumnsMenu`, que também é um `button`. Trocar o header do grupo para `div` com `role="button"` ou mover o `ColumnsMenu` para fora do botão de colapso.
- **Escopo:** apenas estrutura HTML; nenhuma mudança de comportamento.

## Não está no escopo
- Não mexer na integração bidirecional com pipeline.
- Não alterar o chatbot global (é fora do escopo da PDN).
- Não alterar a lógica de resumo por corretor, apenas posicionamento será revisado se necessário após os ajustes acima.

## Validação
Após build, validar no preview:
1. Cards de Visita Realizada com VGV zerado exibem `—`.
2. Drawer de lead mostra placeholder de data no formato `dd/mm/aaaa`.
3. Botão de regredir etapa aparece no lugar da lixeira, e o corretor recebe notificação.
4. Console não mostra mais warning de `validateDOMNesting` na PDN.