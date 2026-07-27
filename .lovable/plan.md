
## Objetivo
Permitir clicar em uma venda na página `/vendas-realizadas` e editar os campos daquela venda (unidade, empreendimento, VGV final, data de assinatura, observação), salvando de forma persistente na tabela `negocios`.

## Escopo confirmado (leitura já feita)
- **Página**: `src/pages/VendasRealizadas.tsx` — hoje a linha da tabela NÃO é clicável; só a célula "Comissão" é editável (comissão individual do corretor logado, em `venda_comissoes`).
- **Fonte da verdade da venda**: tabela `negocios` (fase = `'vendido'`).
- **RLS de UPDATE em `negocios`** (já validado):
  - Admin ✅
  - Gestor ✅
  - Dono da venda (via `can_access_negocio`, cobre corretor titular + parceiro) ✅

Nenhuma migration nova é necessária. É refactor de frontend + um hook de update.

## Mockup primeiro (fase 0 — obrigatório antes do build)
Antes de qualquer código, entrego mockup HTML/print de:
1. Linha da lista com hover "✏️ Editar" e área clicável.
2. Drawer "Editar venda" (à direita), com os campos abaixo e botões Cancelar / Salvar.

Só sigo pro build depois da sua aprovação do mockup.

## O que vira editável no drawer
| Campo | Tipo | Regra |
|---|---|---|
| Cliente | texto | editável |
| Empreendimento | texto + autocomplete (usa `empreendimentos_canonicos` como as outras telas) | obrigatório |
| Unidade | texto livre (ex: `Torre 2 · Apto 1203`) | obrigatório |
| VGV final | moeda BRL | obrigatório; se editar, atualiza também `vgv_estimado` como fallback quando estiver vazio |
| Data de assinatura | date | obrigatório; mantida no mês corrente para não sumir do relatório |
| Observação da venda | textarea | opcional |

Campos **fora do escopo desta edição** (mantêm o que já são):
- `fase` (continua `vendido` — não muda por aqui).
- `corretor_id` / `gerente_id` / parceria (mudança de titularidade é fluxo separado).
- Comissão individual (segue no `ComissaoCell` da tabela, sem duplicar no drawer).

## Quem pode editar
Segue a RLS que já existe — sem inventar regra nova:
- **Admin / Gestor**: pode editar qualquer venda da lista.
- **Corretor**: só a própria venda (titular ou parceiro).
- Se o usuário logado não tem permissão, a linha abre em **modo somente leitura** (drawer sem botão Salvar).

## Fluxo de UI
```text
Lista de vendas
   │  clique na linha  ──►  Drawer "Editar venda" (direita)
   │                        ├─ campos preenchidos
   │                        ├─ [Cancelar]  [Salvar alterações]
   │                        └─ ao salvar: toast + invalidateQueries(["vendas-realizadas"])
   └─ ícone ✏️ visível no hover pra deixar claro que é clicável
```

## Persistência
- Um único `UPDATE` em `public.negocios` pelas colunas do drawer.
- Registrar histórico opcional em `negocios_atividades` (tipo `edicao_manual`) só se você quiser rastro — **por padrão do plano: SIM**, para ficar auditável ("Lucas editou unidade de X → Y em dd/mm hh:mm").
- Invalida caches: `vendas-realizadas`, `pdn-*`, `pipeline-*` (as 3 telas que leem `negocios`).

## Arquivos a tocar (build, depois do mockup aprovado)
- **Novo**: `src/components/vendas/EditarVendaDrawer.tsx` — drawer com formulário + Zod validation.
- **Novo**: `src/hooks/useEditarVenda.ts` — mutation com invalidação cross-tela.
- **Editar**: `src/pages/VendasRealizadas.tsx`
  - Linha da tabela: `onClick` abre drawer (com `stopPropagation` no `ComissaoCell` pra não conflitar).
  - Ícone ✏️ no hover em desktop; card mobile ganha a mesma ação.
  - Passar `canEdit` calculado a partir do papel + ownership.

Nada de mudança em outras telas nesta fase.

## Validação (fase final, ao vivo no preview)
1. Admin edita uma venda de outro corretor → salva OK, aparece atualizada em `/vendas-realizadas`, `/pdn` e no drawer do lead em `/pipeline-leads`.
2. Corretor edita a própria venda → OK.
3. Corretor tenta abrir venda de outro → drawer abre em modo leitura, sem botão Salvar.
4. Editar data de assinatura para outro mês → venda sai do filtro do mês atual (comportamento esperado).
5. Cancelar não persiste nada.
6. Histórico em `negocios_atividades` registrado (se mantivermos o rastro).

## O que NÃO faço nesta fase
- Não mudo fase / status / parceria.
- Não crio migration.
- Não mexo em `venda_comissoes` (comissão continua na célula da tabela).
- Não altero PDN nem Pipeline — apenas herdam a atualização via invalidação de cache.
