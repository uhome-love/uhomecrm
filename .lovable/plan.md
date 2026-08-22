# Descartar, inativar e excluir contatos no Hub da LIA

Adiciona ações no Hub da LIA (abas **Leads e conversas** e **Kanban**), visíveis **apenas para o CEO (admin)**:

- **Descartar / Inativar** — um único modal, igual ao do pipeline, com escolha do destino.
- **Excluir** — apaga definitivamente os dados da LIA daquele telefone (estado + conversas + follow-ups).

Nada é alterado no pipeline: o lead do CRM continua exatamente como está.

## Comportamento

### Descartar / Inativar (modal, padrão CRM)
- Mesmo modal do pipeline (`DiscardLeadDialog`): motivo da lista canônica (`src/lib/discardReasons.ts`), campo livre em "Outro", e o seletor **"O que fazer com o lead?"** com as duas opções do CRM:
  - **🔄 Descartar (reengajável)** — `status = 'descartado'`, `descartado_em = agora`, `motivo = "Descartado: <motivo>"`. Vai para a coluna **Descartados**, onde já existe o botão **Retomar**.
  - **⛔ Inativar definitivo** — `status = 'descartado'`, `optout = true`, `descartado_em = agora`, `motivo = "Inativado: <motivo>"`. Some do fluxo ativo, aparece na coluna **Opt-out** e não recebe mais follow-up da LIA.
- Motivos disponíveis mudam conforme o destino, como no pipeline (`DISCARD_REASONS_REENGAJAVEL` / `DISCARD_REASONS_DEFINITIVO`), com prefixo montado por `buildMotivoDescarte`.
- Ao inativar, follow-ups pendentes daquele telefone são cancelados (`lia_followups.status = 'cancelado'`) para a LIA não continuar mandando mensagem.

### Excluir (modal de confirmação destrutivo)
- Confirmação explícita com o nome/telefone do contato e aviso de que é irreversível.
- Apaga, nessa ordem, todos os registros daquele telefone: `lia_followups`, `lia_conversas`, `lia_estado`.
- Não toca em `pipeline_leads`, atividades nem histórico do CRM.

### Permissão
- Todos os botões só são renderizados quando o usuário tem role `admin` (CEO). Diretor e demais perfis não veem as ações.
- No banco, apenas `admin` recebe permissão de DELETE — a proteção não depende só da interface.


## Onde aparece

- **Leads e conversas**: menu de ações (⋯) em cada linha (desktop e mobile), sem alterar o clique que abre a conversa.
- **Kanban**: mesmo menu ⋯ no canto do card, com `stopPropagation` para não abrir o drawer.

## Detalhes técnicos

1. **Migration** (somente policies):
   - `CREATE POLICY` de `DELETE` para `admin` em `lia_estado`, `lia_conversas` e `lia_followups` (esta última já tem policy `ALL` para admin/diretor; será restringida a admin apenas para DELETE se necessário, sem quebrar o acesso atual).
   - `GRANT DELETE` a `authenticated` nessas três tabelas (RLS continua restringindo a admin).
2. **Novos componentes** em `src/components/lia-hub/`:
   - `LiaDescartarDialog.tsx` — espelho do `DiscardLeadDialog` do pipeline (motivo + destino reengajável/definitivo), reaproveitando `discardReasons` + `buildMotivoDescarte`.
   - `LiaExcluirDialog.tsx` — confirmação destrutiva.
   - `LiaLeadAcoesMenu.tsx` — menu ⋯ compartilhado pelas duas abas, oculto para não-admin (`useUserRole`).
3. **Hooks** em `useLiaHub.ts`: `useLiaDescartar` (recebe `tipo: reengajavel | definitivo`) e `useLiaExcluir`, ambos invalidando `["lia-hub"]` e com toast de sucesso/erro.
4. **Integração**: `LiaLeadsTab.tsx` (linhas mobile e tabela desktop) e `LiaKanbanTab.tsx` (card).

## Validação

Após o build: abrir `/admin/lia-hub` como CEO, descartar um contato de teste (vai para **Descartados**, motivo `Descartado: …`), inativar outro (vai para **Opt-out**, motivo `Inativado: …`, follow-ups cancelados), excluir esse contato e confirmar que sumiu das duas abas; confirmar que o lead correspondente no pipeline permanece intacto e que um usuário não-admin não vê as ações.

