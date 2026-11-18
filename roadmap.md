# Roadmap
## Central — regressão após publicação (18/11/2026)
- [x] Conferir pedidos e notas dos dois testes, dono, avisos e histórico de distribuição, somente leitura
- [x] Aprovar desenho dos pedidos sem cartão e no cartão (Lucas, 18/11 01:53 UTC)
- [ ] Aprovar plano da correção antes de alterar aplicativo e banco
- [ ] Impedir reativação, distribuição e avisos de testes em todas as entradas do site, preservando os dados
- [ ] Arquivar novamente somente os dois testes identificados, sem apagar
- [ ] Validar notas por pedido, reenvio, ausência de avisos/distribuição e exclusão da mídia somente com dados fictícios em transação revertida; não criar lead persistente em produção; revisar diff
- [ ] Conferir leitura autorizada ao vivo no computador/celular e informar publicação

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
