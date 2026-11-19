# Lead pelo link do corretor vai direto para ele

## O que acontece hoje
- O Paulo Amaral entrou pelo link da Larissa (`/c/larissa-barbosa`). O site mandou essa origem só dentro dos dados do site; o campo "atribuído para" chegou vazio.
- O CRM cria o cartão sempre "pendente de distribuição", sem corretor, então a Roleta entregou para a Luiza.

## O que muda
1. Quando um lead do site chegar com página/entrada `/c/<slug>/...` (ou "atribuído para" preenchido), o CRM procura o corretor pelo slug do perfil (ex.: `larissa-barbosa` → Larissa Barbosa).
2. Se achar um corretor **ativo**, o cartão nasce já com ele (aceito, sem passar pela Roleta), marcado como "link do corretor", e ele recebe o aviso normal de lead novo.
3. Se o slug não existir ou o corretor estiver inativo, segue a Roleta normal, como hoje.
4. Lead que já existe (mesmo telefone) com outro dono: **não muda de dono**; só registra a nota "Voltou pelo link de [corretor]".
5. Na linha do tempo, a entrada mostra "Origem: Link da Larissa Barbosa" em vez de "Direto".

Nada mais muda na Roleta, nas etapas ou nas outras regras.

## Validação
- Teste com dados fictícios dentro de transação revertida: slug válido → vai para o corretor; slug inválido/inativo → Roleta; lead existente → dono mantido.
- Paulo Amaral já está com a Larissa (repasse de hoje); nada a alterar nele.

## Técnico
- Ajustar `sync_site_lead_to_pipeline()`: resolver corretor por `NEW.atribuido_para` ou slug extraído de `dados_site.landing_url`/`pagina_url` (`^/c/([^/]+)`) em `profiles.slug_ref`, checando ativo; inserir `corretor_id`, `distribuido_em=now()`, `aceite_status='aceito'`, `origem_ref='link_corretor'`; registrar em `distribuicao_historico` como atribuição manual.
- Uma migration (dentro do limite diário).
