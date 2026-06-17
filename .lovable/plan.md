## Objetivo

Criar uma área única — **Central de Usuários** (`/central-usuarios`) — para gestão completa de usuários do CRM, substituindo a gestão hoje espalhada em 3 telas (`/admin`, `/backoffice/cadastros`, `/meu-time`). Cada perfil enxerga conforme sua hierarquia:

- **Gerente** → apenas a própria equipe.
- **Diretora (Gabrielle)** → as duas equipes (via mapeamento `diretoria_equipes`).
- **CEO (admin)** → todas as equipes.

## Escopo de acesso

```text
Gerente   → team_members onde gerente_id = ele
Diretora  → equipes dos gerentes em diretoria_equipes (diretor_auth_id = ela)
CEO/admin → todos
```

## O que cada um pode fazer

| Ação | Gerente (própria equipe) | Diretora (2 equipes) | CEO |
|---|---|---|---|
| Criar corretor + editar dados | ✅ | ✅ | ✅ |
| Trocar senha | ✅ | ✅ | ✅ |
| Inativar (bloqueia login + repassa dados) | ✅ | ✅ | ✅ |
| Excluir (com repasse de dados) | ✅ | ✅ | ✅ |
| Gerenciar papéis / criar gerentes | ❌ | ❌ | ✅ |

Destino de repasse: **CEO/Diretora** podem escolher qualquer corretor; **Gerente** só corretores da própria equipe.

## Regras de Inativar e Excluir

**Inativar** = bloqueia o login no CRM, marca `profiles.ativo = false` e `team_members.status = 'inativo'`, e **na hora pede para quem repassar** leads do pipeline, negócios, tarefas e visitas futuras. Dados históricos preservados.

**Excluir** = sempre abre o fluxo "o que fazer com os dados": exige escolher um corretor destino e repassa **leads do pipeline, negócios, tarefas e visitas** para ele antes de remover o usuário. Dados pessoais sem dono (scripts, conquistas, etc.) são removidos. Não exclui ninguém sem definir o repasse.

## Telas / Fluxo (frontend)

Nova página `CentralUsuariosPage`:
- Cabeçalho com busca + filtro por equipe (visível só para diretora/CEO) + botão "Adicionar usuário".
- Lista em cards/tabela por equipe: nome, papel, email, telefone, CPF, CRECI, ID Jetimob, status (Ativo/Inativo), pendências de cadastro.
- Ações por usuário: **Editar dados**, **Trocar senha**, **Inativar/Reativar**, **Excluir**.
- **Dialog de repasse** reutilizável (usado em Inativar e Excluir): lista de corretores destino respeitando o escopo, checkboxes do que repassar (Leads / Negócios / Tarefas+Visitas), confirmação explícita.
- Diálogo de criação com: nome, email, senha, telefone, CPF, CRECI, ID Jetimob e (só CEO) papel + gerente da equipe.

Integração de navegação:
- Adicionar `/central-usuarios` ao `pageRegistry` e à sidebar, roles `["gestor", "admin"]`.
- `/meu-time` passa a abrir o dialog de criação da central (ou link direto), evitando código duplicado.
- `/admin` (AdminPanel) mantém apenas ferramentas de sistema (360dialog, Typesense); a parte de usuários passa a apontar para a central.
- `/backoffice/cadastros` continua para o backoffice, mas a edição de dados cadastrais passa a existir também na central.

## Backend

### Edge function `create-broker-user` (estender)
- **Escopo de permissão**: resolver o viewer (admin / diretora via `diretoria_equipes` / gerente) e validar que o `target_user_id` está numa equipe permitida em toda ação. Validar também que o `reassign_to` está no escopo permitido.
- Novas ações:
  - `inactivate_user`: banir login (`auth.admin.updateUserById` com `ban_duration`), `profiles.ativo=false`, `team_members.status='inativo'`, e repassar dados para `reassign_to`.
  - `reactivate_user`: remover ban, `ativo=true`, `status='ativo'`.
  - `delete_user` (reescrever): receber `reassign_to` obrigatório; **repassar** em vez de apagar:
    - `pipeline_leads.corretor_id` → novo corretor
    - `negocios` (corretor_id = profiles.id e gerente_id = auth) → novo corretor
    - `pipeline_tarefas` / `tarefas` / `visitas` → novo corretor
    - `oferta_ativa_leads` em atendimento → liberado/repassado
    - só então remover dados pessoais (scripts, conquistas, briefings) + roles + profile + auth user.

### Função SQL (security definer)
`list_manageable_users(viewer)` retornando, conforme o escopo do viewer: user_id, nome, email, telefone, cpf, creci, jetimob_user_id, role, equipe, gerente_nome, ativo, status. Usada pela nova página (evita lógica de escopo no client).

## Detalhes técnicos

- Repasse considera o mapeamento de IDs (algumas tabelas usam `profiles.id`, outras `auth.users.id`) — resolver o profile do destino antes de atualizar (mesmo padrão já usado no `delete_user` atual).
- Ban de login via `ban_duration: "876000h"` (inativar) e `"none"` (reativar).
- Migration para `list_manageable_users` com `GRANT EXECUTE ... TO authenticated` e checagem interna de papéis.
- Sem novos secrets; usa o `SUPABASE_SERVICE_ROLE_KEY` já existente na função.

## Fora de escopo
- Não altera regras de roleta, comissões ou pipeline além do repasse de `corretor_id`.
- Não cria um novo `app_role` "diretor" — a diretora continua identificada por `diretoria_equipes` + papel `gestor`.