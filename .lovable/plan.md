# Trazer o Eliézer Clós de volta

## O que encontrei
- O cadastro do Eliézer está **inativo**, e na equipe do Bruno ele aparece como **inativo** desde 16/11.
- O papel dele continua o mesmo: corretor.
- Só **2 leads** foram marcados como "Era do Eliézer": Guilherme Silveira e Roberto. Os dois estão com o Bruno, **arquivados** e sem decisão tomada.
- Antes de passar qualquer outro lead, preciso confirmar no histórico se mais algum saiu dele na inativação. Ele já recebeu outros leads da Roleta ao longo do tempo, mas isso não prova que eles foram tirados dele.

## O que vou fazer
1. **Liberar o acesso:** reativar o cadastro e o login do Eliézer pela mesma ação que o painel de usuários já usa. Ele continua com a mesma senha.
2. **Voltar para a equipe do Bruno:** a equipe dele volta a constar como ativa.
3. **Devolver os leads:** Guilherme Silveira e Roberto voltam para o Eliézer, saem do arquivo e retornam à etapa em que estavam. O selo "Era do Eliézer · decidir" sai do Bruno.
4. **Conferir o histórico:** procuro outros leads que tenham saído dele em 15/11 e 16/11. Se aparecer mais algum, te mostro a lista antes de devolver.
5. **Roleta:** não credencio o Eliézer automaticamente. Ele entra sozinho, como sempre, desde que passe pelas regras de visitas e de CRM.

## Como vou validar
- Login do Eliézer liberado e os 2 leads na carteira dele, conferidos no computador e no celular (390px).
- Os dois leads somem da lista "Herdados para decidir" do Bruno.

## Detalhes técnicos
- profiles.ativo=true e team_members.status='ativo' (user_id cd3bd7ae…), com o login liberado via admin_update_profile.
- Os 2 leads: corretor_id = Eliézer, arquivado=false e herdado_* limpos. O trigger de reentrada zera os relógios, que é o comportamento esperado.
- Só alteração de dados, sem migration.
