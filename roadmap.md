# Roadmap
## Central — cancelamento da trava e exclusão autorizada (18/11/2026 02:08 UTC)
- [x] Remover somente o plano da trava e sua memória; manter pedidos publicados e regras do CRM intactos
- [x] Identificar todos os TESTE CENTRAL e dependências, confirmar ausência de corretor e informar contagem por tabela antes de apagar
- [x] Apagar 1 leads, 1 pipeline_leads e 1 atividade em transação protegida; preservar Base Única histórica e suas 3 conversões, retirando só vínculo do teste
- [x] Conferir zero nos cadastros, mídia/views e dependências (80 tabelas por vínculo, 97 por JSON/arrays); nada exige publicação

## Complemento — jornada antes do cartão (mesma aprovação)
- [x] Conferir leads.dados_site já criado e contrato do site, sem alterar o site
- [x] Transferir/mesclar jornada e pedidos por id ao vincular cartão, sem alterar dono ou etapa
- [x] Registrar pedidos nas duas entradas, preservar financiamento e restringir escrita à sincronização
- [x] Validar transferência, reenvio, serviço, dono, outro corretor e visitante em testes transacionais; 23 testes de leitura passaram
- [ ] Validação visual autenticada no computador/celular — mesma pendência de sessão do pedido anterior

## Central Uhome — pedidos do site e limpeza de testes (aprovado)
- [x] Registrar uma nota por pedido único do site, sem alterar dono ou etapa (regressão transacional passou)
- [x] Compartilhar o limite de um aviso por hora com o aviso de retorno ao site (regressão transacional passou)
- [x] Disponibilizar Jornada no site na Busca para cadastro ainda sem cartão, preservando permissões existentes
- [x] Marcar e arquivar os dois TESTE CENTRAL encontrados; nenhum distribuído; mídia zerada e painel CEO filtrado
- [x] Revisar diff e executar 20 testes da leitura; informar publicação
- [ ] Validar ficha e aviso ao vivo no computador e celular — bloqueado: sem sessão; criação de conta temporária indisponível e conta do solicitante não localizada

- [x] Etapa Qualificação → Atendimento (+ sub status Qualificação)
- [x] Cartão: próxima tarefa no lugar de última atividade (saúde separada)
- [x] Pop-up Concluir tarefa compacto (código; falta ver aberto na tela)
- [x] Remover página teste /pipeline-v2
- [x] Auditoria rápida do Pipeline (desktop + mobile)

## Negócios — refinamento visual
- [x] Desenho do computador em tema claro aprovado
- [x] Desenhos do celular e tema escuro aprovados
- [x] Plano da mudança visual aprovado
- [x] Construção por fases — topo, etapas, resumo e cartões de Negócios
- [x] Revisão e validação ao vivo no computador 1494px e celular 360/390/430px; claro/escuro, filtros, ficha e formulários cancelados; 70 testes passaram
