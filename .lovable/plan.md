# Marcar visita no próprio nome (CEO, diretora e gerentes)

## O que aconteceu
A visita do Renan Figueiró (sábado 17/10, 13h31) foi salva, mas ficou no nome do **Bruno Schuler**, e não no seu. O lead é seu. O motivo: a lista "Corretor" da tela de visita mostra só corretores das equipes. Você, a Gabrielle e os gerentes não aparecem nela, então era preciso escolher outra pessoa.

## O que muda
1. Na lista "Corretor" da tela de visita (marcar e editar), aparece no topo a opção **"Eu mesmo (nome · cargo)"** para CEO, diretora e gerentes.
2. Quando o lead é seu, essa opção já vem **marcada sozinha**. Quando o lead é de um corretor, vem marcado o dono do lead.
3. Ao editar uma visita que está no seu nome, o campo mostra seu nome, e não fica mais em branco.
4. Fica tudo igual para corretores, nas regras da Roleta e na contagem de visitas dos corretores.
5. **Visita do Renan:** passo para o seu nome, se você autorizar.

## Validação
- Abrir "Marcar visita" com sua conta em um lead de teste e conferir "Eu mesmo" já marcado. Salvar, ver a visita no seu nome e apagar o teste.
- Conferir com a conta de um gerente que ele também aparece e consegue salvar no próprio nome.

## Detalhes técnicos
- `VisitaForm.tsx`: adicionar o usuário atual (nome/cargo de `profiles`) como primeira opção quando `isManager`. O valor padrão de `corretor_id` passa a ser o `corretor_id` do lead selecionado, ou `user.id` quando o lead é do próprio usuário. Mostrar o nome atual mesmo se ele não estiver em `team_members`.
- `useVisitas.createVisita`: `corretor_id === user.id` já é aceito sem a checagem de equipe. `gerente_id` passa a ser o próprio usuário quando a pessoa é gerente, ou nulo para CEO/diretora, porque ela não está em `team_members`.
- Sem migration e sem mudança de RLS. A visita do Renan (`38e0d889…`) é corrigida com um UPDATE de `corretor_id`, só depois da sua autorização.
