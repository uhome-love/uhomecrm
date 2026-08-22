# Descartar e excluir contatos no Hub da LIA

Adiciona duas ações no Hub da LIA (abas **Leads e conversas** e **Kanban**), visíveis **apenas para o CEO (admin)**:

- **Descartar** — marca o contato como descartado na LIA, com motivo no padrão do CRM.
- **Excluir** — apaga definitivamente os dados da LIA daquele telefone (estado + conversas + follow-ups).

Nada é alterado no pipeline: o lead do CRM continua exatamente como está.

## Comportamento

### Descartar (modal, padrão CRM)
- Mesmo visual do modal de descarte do pipeline (`DiscardLeadDialog`): seleção de motivo a partir da lista canônica (`src/lib/discardReasons.ts`), campo livre quando "Outro".
- Grava em `lia_estado`: `status = 'descartado'`, `descartado_em = agora`, `motivo` no formato canônico `Descartado: <motivo>` (helper `buildMotivoDescarte`).
- O contato passa a aparecer na coluna **Descartados** do Kanban e no filtro **Descartados** da lista — onde já existe o botão **Retomar**.

### Excluir (modal de confirmação destrutivo)
- Confirmação explícita com o nome/telefone do contato e aviso de que é irreversível.
- Apaga, nessa ordem, todos os registros daquele telefone: `lia_followups`, `lia_conversas`, `lia_estado`.
- Não toca em `pipeline_leads`, atividades nem histórico do CRM.

### Permissão
- Ambos os botões só são renderizados quando o usuário tem role `admin` (CEO). Diretor e demais perfis não veem as ações.
- No banco, apenas `admin` recebe permissão de DELETE — a proteção não depende só da interface.

## Onde aparece

- **Leads e conversas**: menu de ações (⋯) em cada linha (desktop e mobile), sem alterar o clique que abre a conversa.
- **Kanban**: mesmo menu ⋯ no canto do card, com `stopPropagation` para não abrir o drawer.

## Detalhes técnicos

1. **Migration** (somente policies):
   - `CREATE POLICY` de `DELETE` para `admin` em `lia_estado`, `lia_conversas` e `lia_followups` (esta última já tem policy `ALL` para admin/diretor; será restringida a admin apenas para DELETE se necessário, sem quebrar o acesso atual).
   - `GRANT DELETE` a `authenticated` nessas três tabelas (RLS continua restringindo a admin).
2. **Novos componentes** em `src/components/lia-hub/`:
   - `LiaDescartarDialog.tsx` — reaproveita `discardReasons` + `buildMotivoDescarte`.
   - `LiaExcluirDialog.tsx` — confirmação destrutiva.
   - `LiaLeadAcoesMenu.tsx` — menu ⋯ compartilhado pelas duas abas, oculto para não-admin (`useUserRole`).
3. **Hooks** em `useLiaHub.ts`: `useLiaDescartar` e `useLiaExcluir`, ambos invalidando `["lia-hub"]` e com toast de sucesso/erro.
4. **Integração**: `LiaLeadsTab.tsx` (linhas mobile e tabela desktop) e `LiaKanbanTab.tsx` (card).

## Validação

Após o build: abrir `/admin/lia-hub` como CEO, descartar um contato de teste (conferir que ele vai para Descartados e que o motivo aparece no padrão `Descartado: …`), excluir esse mesmo contato e confirmar que sumiu das duas abas; confirmar que o lead correspondente no pipeline permanece intacto.
