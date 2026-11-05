# Fechar o "Novo cadastro" para pessoas de fora

## O que encontrei
- A tela de entrada tem a opção "Novo cadastro" aberta a qualquer pessoa.
- Quem se cadastra ganha automaticamente o papel de **corretor** (regra automática no banco), ou seja, pode acessar o CRM como se fosse da equipe.
- A direção já tem um jeito próprio de criar usuários (tela Usuários, que cria a conta pelo servidor). Esse caminho continua funcionando.

## O que será feito
1. **Desligar o cadastro público** nas configurações de acesso: ninguém consegue criar conta sozinho, nem por fora da tela.
2. **Remover o botão "Novo cadastro"** da tela de entrada; fica só "Entrar" e "Esqueci a senha", com aviso "Acesso liberado pela gestão da Uhome".
3. **Parar de dar papel de corretor automaticamente**: a conta só recebe papel quando criada pela tela Usuários (que já define o papel).
4. **Limpar os cadastros estranhos**: listo para você todas as contas criadas pelo link público que não pertencem à equipe (sem papel definido pela gestão, sem leads, sem time). Você confirma quais remover — nada é apagado sem sua aprovação.

## O que não muda
- Usuários atuais continuam entrando normalmente.
- Criação de corretor pela tela Usuários continua igual.
- Roleta, leads e distribuição não são tocados.

## Validação
- Tentar criar conta pelo site: deve ser recusado.
- Criar um usuário de teste pela tela Usuários: deve funcionar com o papel escolhido; depois excluir o teste.
- Conferir login de um usuário existente.

## Detalhes técnicos
- Auth: `disable_signup=true` (mantendo demais opções atuais).
- `Auth.tsx`: remover modo signup.
- Trigger `handle_new_user_role` em auth.users: remover/neutralizar; confirmar que `create-broker-user` insere `user_roles` explicitamente antes (ajustar se não inserir).
- Relatório read-only de contas sem vínculo (team_members, pipeline_leads, criação via admin) para sua decisão.
