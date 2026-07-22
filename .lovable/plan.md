
# Fase 2 — Planilha nível SaaS (PDN Gestor)

Antes de codar, aqui está o entendimento detalhado da Fase 2 aprovada no plano macro. Só sigo pro build depois do seu OK.

## Escopo (o que muda)

### 1. Linha inteira clicável → abre `PdnLeadDrawer`
- Hoje só o nome abre o drawer. Vou expandir: qualquer clique fora dos campos editáveis (célula de status, obs, empreendimento, vgv, select de etapa e botões de ação) abre o drawer daquela linha.
- Implementação: `onClick` na `TableRow` com guard (`event.target.closest('[data-no-row-open]')` — marco os campos editáveis e ações com esse `data-attribute`). Zero risco de clique acidental em input/select.
- Cursor `cursor-pointer` sutil na linha; hover leve `bg-muted/30`.

### 2. Ícones de ação por linha (hover)
- Coluna de ações passa a ser "revelada" no hover da linha (opacidade 0 → 100 em `group-hover`). Em mobile continua sempre visível (não usa hover).
- Sem alterar comportamento dos botões atuais (Avisar / Queda / Reativar / Remover). Só reorganização visual.
- Adiciono um novo ícone: **📢 Publicar observação no lead** (usa a mesma função `PublishButton` já existente do drawer, versão compacta ícone-only). Só aparece se `r.observacoes` tem conteúdo e ainda não foi publicado (ou hash mudou).

### 3. Colunas configuráveis
- Menu "Colunas" na toolbar do bloco (ícone `Settings2` ao lado do `+`).
- Toggle por coluna: Nome (fixo, sempre on), Data, Empreendimento, VGV, Corretor, Status, Observação.
- Persistência em `sessionStorage` por device (`pdn:cols:v1:{mobile|desktop}`). Sem tocar em banco.
- Reset "Restaurar padrão".

### 4. Seleção múltipla + barra de ação em lote
- Checkbox por linha + checkbox no header (selecionar todos do grupo).
- Barra flutuante fixa no rodapé quando há seleção: mostra "N selecionados" e ações:
  - **Publicar observação no lead em massa** (usa o mesmo publish idempotente da Fase 1 — pula linhas sem observação ou já publicadas com mesmo hash).
  - **Avisar corretor em massa** (reaproveita `avisarCorretor` já existente, mensagem padrão).
  - **Marcar como caiu em massa** (abre `QuedaDialog` compartilhado com motivo único aplicável a todos).
- Seleção some ao trocar de filtro/mês (evita ação em set inconsistente).

### 5. Ordenação por header (já existe parcialmente) + densidade + zebra
- Header sortable já existe (Nome/Data/VGV/Corretor/Status). Mantenho.
- Densidade compacta: `py-2` nas células (hoje é `py-3`). Zebra sutil (`even:bg-muted/10`).
- Sem mudança em lógica.

## O que NÃO muda nesta fase
- Hook `usePdn.ts` — nenhuma nova RPC, nenhuma migration.
- Kanban (é Fase 3).
- Drawer (Fase 1, já feito).
- RLS / permissões (Fase 7).
- Nenhum arquivo >800 linhas será refatorado agora (Fase 6).

## Arquivos afetados
- `src/pages/PdnGestor.tsx` — adiciona menu de colunas, seleção múltipla, barra de lote, linha clicável, hover reveal.
- `src/components/pdn/BulkActionBar.tsx` — **novo** (~80 linhas), barra flutuante de seleção.
- `src/components/pdn/ColumnsMenu.tsx` — **novo** (~60 linhas), popover de configuração de colunas.
- Reutiliza `PublishButton` existente do drawer para o botão de publicar por linha.

## Riscos e mitigações
- **Clique em input abrindo drawer** → `data-no-row-open` em todos os campos editáveis + ações.
- **Barra de lote poluindo mobile** → em mobile a barra aparece só quando `selecionados > 0`, versão compacta.
- **Colunas ocultas em bloco de "Caídos"** → coluna "Observação" vira "Motivo da queda" (já é hoje), respeita o toggle igual.

## Validação (ponta a ponta, no preview, antes de fechar Fase 2)
1. Clicar em qualquer parte da linha (fora dos campos) abre o drawer certo.
2. Clicar em Status/Obs/VGV/Empreendimento NÃO abre o drawer (edita inline).
3. Ocultar coluna VGV → some do header e do corpo, e persiste em reload.
4. Selecionar 3 linhas → barra aparece com 3 → publicar em massa → verificar `pipeline_anotacoes` sem duplicar (hash idempotente).
5. Selecionar 2 linhas → "marcar como caiu" em lote → ambas movem pra "Caídos" com o motivo informado.
6. Mobile: seleção múltipla + barra compacta funcionam.

---

**Confirma que esse é o entendimento correto?** Se sim, sigo para o build. Se quiser ajustar algo (ex: tirar publicar em massa, mudar quais colunas são configuráveis, etc), me diz antes.
