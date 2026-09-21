# Avisar o corretor quando o cliente responde ao disparo

## O que eu verifiquei (dados reais de hoje)

- No disparo `abertura_casa_tua_canoas_2209` houve 6 respostas "Sim". Todos os 6 já são leads
  ativos no funil, com corretor (Luiza Clós, Ebert, Jéssica França, Rafaela Sandin, Matheus Pasin).
- **Nenhum corretor foi avisado.** Não existe nenhuma notificação de reengajamento criada nos
  últimos 3 dias — nem para corretor, nem para gestor, nem pop-up.
- Três desses leads (Ana, Agnelo, AGENTE) foram marcados como "respondeu sim" e reativados,
  mas sem aviso nenhum; os outros três nem foram processados.

## Por que não avisou — 3 causas confirmadas

1. **O público do disparo foi "Base Única", não "Pipeline ativo".**
   A regra "mantém o corretor e só avisa" que ajustamos vale apenas para o público
   Pipeline ativo. Vindo da Base Única, o sistema segue o caminho antigo: manda para a
   Fila do CEO e avisa só a diretoria — nunca o corretor dono.

2. **O aviso para a diretoria também está quebrado.**
   A lista de perfis usada nesse aviso inclui um perfil "ceo" que não existe no sistema
   (os perfis válidos são admin, gestor, diretor, corretor, backoffice, rh). A consulta
   falha e nenhuma notificação é gravada. Por isso o contador está zerado.

3. **O atalho "esse lead já é seu, só avisa" quase nunca é alcançado.**
   A função do banco só usa esse atalho quando o lead está totalmente limpo; qualquer
   marca antiga de descarte manda o lead para a Fila do CEO, mesmo ele estando ativo
   com um corretor.

## O que vai ser corrigido

1. **Sempre que um cliente responder com interesse e já tiver corretor ativo, o corretor
   é avisado** — independentemente do público do disparo (Base Única, Pipeline ativo,
   lista antiga). Aviso instantâneo em pop-up, sininho e linha do tempo do lead, com o
   nome do cliente, o que ele respondeu e botão para abrir o lead.
2. **Corrigir a lista de perfis do aviso de diretoria** (trocar "ceo" por "diretor"),
   para que a Fila do CEO volte a notificar quem precisa.
3. **Avisar o corretor também no caminho da Fila do CEO** quando o lead reativado
   continuar com o mesmo dono — hoje esse caminho é mudo para ele.
4. Nada muda na atribuição: nenhum lead ativo troca de corretor nem de etapa por causa
   de uma resposta.

## Validação ao vivo (sem disparar nada)

- Simular uma resposta "Sim" de um lead de teste que já esteja no funil com corretor e
  conferir: pop-up na tela do corretor, item no sininho, registro na linha do tempo,
  mesmo corretor e mesma etapa.
- Reconferir os 6 clientes deste disparo e avisar manualmente os corretores donos
  (Luiza Clós, Ebert Silva, Jéssica França x2, Rafaela Sandin, Matheus Pasin), já que
  essas respostas se perderam.

## Detalhes técnicos

- `supabase/functions/whatsapp-webhook/index.ts`:
  - Bloco `routeToRoleta` (linha ~899): após a reativação, buscar o `corretor_id` atual do
    lead efetivo e, havendo dono, inserir `notifications` `tipo: "lead_reengajado"`,
    `dados.route = "pipeline_ativo_keep"` — não depender apenas de `already_active`.
  - Notificação de diretoria: `user_roles.in("role", ["admin","gestor","diretor"])`
    (remover `"ceo"`, valor inexistente em `app_role`, que hoje derruba a query inteira).
  - Envolver as inserções de notificação em try/catch com log em `ops_events`, para que
    uma falha futura apareça em vez de sumir.
- Sem migration e sem mudança de RLS; a RPC `reativar_base_lead_para_fila_ceo` fica como está.
- Deploy: apenas `whatsapp-webhook`.
- Reenvio manual dos 6 avisos perdidos: inserts pontuais em `notifications` para os
  corretores donos, após aprovação.
