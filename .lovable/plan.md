# Cadastro de corretora pelo gerente (Junior Padilha) — erro "Edge Function error"

## O que foi verificado
- O Junior tem permissão de gerente (papéis `gestor` + `corretor`): a permissão não é o problema.
- Nenhum usuário novo foi criado nos últimos 2 dias: a tentativa falhou antes de criar a conta.
- Quando o sistema recusa o cadastro (ex.: senha fraca, e-mail inválido, e-mail já usado de outra forma), a função devolve "erro 500" e a tela mostra só "Edge Function error", **escondendo o motivo real**.
- A tela aceita senha com **6 caracteres**, mas o restante do sistema (edição de usuário) exige **mínimo 8**. Senha curta ou muito comum é a causa mais provável, mas ainda não está confirmada.

## O que será feito
1. A função de cadastro passa a devolver o **motivo real** em português (ex.: "Senha fraca: use no mínimo 8 caracteres, com letras e números") em vez de erro genérico.
2. A tela "Novo usuário" passa a exigir **mínimo 8 caracteres** na senha, igual à edição, com aviso embaixo do campo.
3. Teste: cadastrar um corretor de teste como gerente (senha curta → mensagem clara; senha válida → criado na equipe do gerente) e depois **apagar o usuário de teste**.
4. Pedir ao Junior para tentar de novo; se aparecer outra mensagem, ela já dirá o motivo exato.

## O que NÃO muda
- Regras de quem pode cadastrar, vínculo automático com a equipe do gerente, papéis, Roleta.

## Detalhes técnicos
- `supabase/functions/create-broker-user/index.ts` (ação `create_user`): erros de `auth.admin.createUser` (weak_password, invalid email, etc.) retornam `200 { success:false, error: <mensagem PT-BR> }`; `console.error` com o código para log.
- `src/components/team/NovoUsuarioWizard.tsx`: validação `senha.length >= 8`, `minLength={8}`, texto de ajuda; no `catch`, ler `error.context` para exibir a mensagem do servidor quando houver.
- Sem migration.
