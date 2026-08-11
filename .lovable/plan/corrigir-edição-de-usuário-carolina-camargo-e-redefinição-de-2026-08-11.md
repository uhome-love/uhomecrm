# Corrigir edição de usuário (Carolina Camargo) e redefinição de senha

## O que está acontecendo (verificado)

- A Carolina **já tem o perfil RH** cadastrado e está ativa. O acesso à página de RH depende só de ela conseguir entrar com a senha.
- O erro real vem da redefinição de senha: o backend recusou com **"Password is known to be weak and easy to guess"** (proteção contra senhas vazadas está ligada). Isso aparece nos registros de autenticação (erro 422) e no erro de tela.
- Quando a senha é recusada, a função de usuários **aborta com erro genérico** ("Edge Function returned a non-2xx status code"). Como os dados do perfil são gravados **antes** da senha, o salvamento fica pela metade e a tela mostra apenas "erro", dando a impressão de que "nada salva".
- Além disso, se a gravação do perfil falhar, o erro é **engolido** no servidor e a tela mostra "Alterações salvas" mesmo sem ter salvo.

Resumo: não é falta de permissão. São dois defeitos de fluxo — senha fraca recusada sem explicação, e erros de perfil silenciados.

## O que será feito

1. **Mensagem clara de senha fraca**
   - Traduzir a recusa para: "Essa senha é muito comum e foi recusada por segurança. Use uma senha maior, com letras, números e símbolos."
   - Exigir no mínimo 8 caracteres no formulário e mostrar dica antes de enviar.

2. **Salvamento deixa de ser tudo-ou-nada**
   - A função passa a responder com sucesso quando o perfil foi gravado, informando separadamente se a senha falhou.
   - A tela mostra: "Dados salvos, mas a senha não foi alterada: <motivo>" em vez de um erro genérico.

3. **Parar de esconder falhas do perfil**
   - Erros ao gravar perfil, e-mail ou equipe passam a ser devolvidos e exibidos na tela; só mostra "Alterações salvas" quando realmente salvou.

4. **Validação ao vivo**
   - Abrir o cadastro da Carolina no preview, salvar um dado do perfil (telefone) e confirmar persistência.
   - Definir uma senha forte para ela e confirmar sucesso; depois confirmar o acesso à página de RH.

## Detalhes técnicos

- `supabase/functions/create-broker-user/index.ts`, bloco `action === "update_user"`: coletar `profile_error`, `email_error` e `senha_error`, retornar 200 com `{ success, warnings }` quando o perfil gravou e só a senha falhou; retornar erro real quando o perfil falhar. Mapear a mensagem de senha fraca para texto em português.
- `src/components/team/UsuarioDrawer.tsx`: mínimo de 8 caracteres, texto de ajuda, e tratamento dos avisos retornados (toast de sucesso, aviso ou erro conforme o caso).
- Nada de mudança em RLS, papéis ou configuração de segurança de senha — a proteção contra senhas vazadas continua ligada.
