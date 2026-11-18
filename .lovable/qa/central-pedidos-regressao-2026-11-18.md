# Central — diagnóstico somente leitura (18/11/2026 UTC)

> Lucas cancelou o plano de trava às 02:08 UTC: o escopo proposto abaixo foi cancelado, não implementado. Distribuição, gatilhos e pedidos publicados permanecem intactos. A tarefa vigente é excluir apenas os testes identificados e suas dependências, após informar as contagens.

## Exclusão autorizada concluída
- Antes de apagar: um cadastro `leads`, um cartão `pipeline_leads`, uma `pipeline_atividades`; ambos os cadastros sem corretor. Nenhum outro TESTE CENTRAL nas duas tabelas. Duas notas de pedidos estavam embutidas no cadastro, não eram linhas separadas.
- Os demais vínculos de notas/histórico/tarefas/visitas/avisos/distribuição/mídia eram zero; nenhuma referência em JSON/arrays dos testes nas 97 tabelas examinadas.
- `base_leads` `8f0c9956-b167-4e57-98b4-f26f7e5d3662`, nome UHome, tinha vínculo com o cartão de teste, mas três conversões HubSpot de 2020/2024. Foi preservado com suas conversões; retirado apenas pipeline_lead_id do teste. Contagens e decisão foram informadas antes da exclusão.
- Transação com locks e guardas de identidade, nomes, ausência de corretor e contagens removeu apenas os dois cadastros e a atividade `bfa0c39f-9934-41b8-a1f6-5aaa01a9fa68`. Nenhuma função ou gatilho alterado, nenhuma migração ou implantação.
- Leitura final: TESTE CENTRAL em leads=0 e pipeline_leads=0; atividades/anotações/avisos/midia_lead_jornada/v_midia_lead_jornada/v_fato_lead/v_lead_timeline=0 pelos IDs.
- Leitura final de vínculos: 80 tabelas examinadas, zero linhas; leitura de JSON/arrays: 97 tabelas, zero referências. Cadastro antigo=1 e conversões preservadas=3.
- Plano e memória cancelados removidos. Pedidos publicados intactos. Não precisa publicar.

## Evidências
- `leads` `2ee107a6-df07-40d5-9b7e-3015c312b1c4`: TESTE CENTRAL info 2, `is_teste=true`, `status=novo`, sem cartão/vínculo e sem atribuição. Jornada com 15 chaves e duas notas derivadas em `site_pedido_notas` já presentes, com financiamento Sim na visita.
- Pedidos: `a91a488d-d584-44a4-8913-5f2fb67e2d9c` (visita 21/11 manhã), `1addc79a-01bb-4133-ad73-087a5f30165c` (informações, Financiamento). Recebidos 01:44 UTC, apresentados como 17/11 22:44 BRT.
- `pipeline_leads` `922c7a75-75f3-417e-a7f3-59d4baf92960`: TESTE CENTRAL visita, `is_teste=true`, `arquivado=false`, sem corretor, `aceite_status=descartado`; sem pedidos em dados_site. Timestamp distribuido_em não prova entrega: zero histórico e zero roleta_distribuicoes.
- Zero notificações referentes aos dois IDs ou TESTE CENTRAL desde 00:30 UTC; zero distribuição registrada para os IDs. Nenhum dono atual. Zero linhas dos testes em v_midia_lead_jornada, v_fato_lead e midia_lead_jornada.
- Sem cartão: Busca consulta leads somente para admin/gestor, respeitando RLS, e oculta is_teste e arquivados. Em cadastros elegíveis, VeioDoSite → Ver mais → Pedidos no site mostra as notas. Corretores não têm acesso a cadastros sem cartão/atribuição pelas políticas atuais; não ampliar o escopo silenciosamente.
- Cartão: trg_site_pedidos_registrar cria atividade sistema única por pipeline_lead_id+site_pedido_id; LeadHistoricoTab inclui sistema com título/descrição. v_lead_timeline NÃO inclui pipeline_atividades, então consultar essa view não prova ausência no histórico da ficha.
- Falhas: não há trava persistente do arquivamento para is_teste; trg_site_voltou_aviso não filtra testes; distribuir_lead_atomico não tem retorno antecipado para teste. Sync no INSERT pula NEW.is_teste, mas não protege UPDATE nem um lead real que encontre um cartão marcado como teste por telefone.
- crm-webhook também possui caminhos de reativação, notificação direta e upsert status novo sem proteção de testes; site-events consulta arquivado, não is_teste. Essas entradas devem ser verificadas na correção.

## Validações e limites
- 7 testes existentes de leitura de notas e exclusão de cadastros teste passaram.
- Não executar os antigos testes SQL de aviso sem corrigir suas fixtures: eles esperam aviso para is_teste=true, incompatível com a regra agora explicitada.
- Sessão do solicitante indisponível: auth-session lista múltiplos usuários e --self não encontra conta correspondente. Não foram alterados usuários nem leads.
- Não há modificação do app ou banco nesta investigação. Mockup isolado para aprovação; depois apresentar plano e aguardar aprovação antes da correção.

## Escopo proposto para o plano após aprovação visual
- Mostrar uma nota por pedido sem depender da expansão da Jornada e conservar notas/atividade no cartão, sem duplicação.
- Guardar dados de teste mantendo arquivamento; impedir distribuição inclusive forçada e avisos pelas entradas do site. Preservar funcionamento de leads reais.
- Arquivar novamente somente os dois IDs acima via ferramenta de dados, sem apagar e sem migration de dados.
- Testes separados para teste arquivado, zero avisos, zero distribuição, pedidos idempotentes e leads normais; transações sintéticas revertidas e leitura autenticada desktop/mobile.
- Escrita site-only, permissões existentes e distribuição real intactas. Distinguir o que é aplicado no servidor do que exige publicação do CRM.