# Financeiro + Vendas — validação final

## Fluxo ao vivo com a conta do Lucas
- Intermediação vinculada ao cliente fictício e negócio: NF escolhida explicitamente, R$ 1.000 bruto / R$ 900 líquido. Documento baixado e inspecionado: construtora CYRELA, desconto de 10% e valores por beneficiário.
- Divisões gravadas: corretor R$ 500/50/450; gerente R$ 100/10/90; diretora R$ 100/10/90; diretoria R$ 50/5/45; Uhome R$ 250/25/225.
- Mais ações → Mudar de etapa → Ganho abriu confirmação compartilhada. Data real, intermediação e comprovante anexados; venda apareceu em Vendas com documentos completos.
- Edição via Vendas gravou dados e observação; mudança de unidade criou exatamente um novo evento de auditoria após 0038. Escrita direta na venda e inserção direta de auditoria foram recusadas.
- Receber exigiu comprovante; recebimento apareceu em Recebido. Repasse NF de R$ 90 ao gerente foi registrado separadamente, lido de volta na tabela e com comprovante próprio. Receber não presumiu repasses ao restante do time.
- Custo fictício de R$ 100 entrou em Custos/resultado e no histórico.
- Distrato cancelou pendências, preservou o recebido e tirou o negócio de `v_fato_venda` e da tabela Vendas. Resultado é de caixa: recebido real preservado, comissão gerada/previsões só ativas.
- Filtro Gerente + cliente fictício trouxe só o ganho/repasse do gerente, não o restante do time. Busca é aplicada antes de agregar vendas por pessoa.
- Conferência final autenticada, somente leitura: 20 pessoas com ganhos de vendas de 2026 renderizadas; filtro Gerente trouxe três linhas. Excel baixado e lido confirmou somente as mesmas três linhas de gerentes e aba Filtros. Seleção de parcelas é compartilhada entre tabela e exportação (Período/Todas/Vencidas), sem parcelas canceladas na seleção ativa.
- Exportações Excel baixadas: Financeiro (Resumo/Filtros/Parcelas/Ganhos/Custos/Mídia), Vendas (Vendas/Filtros).
- Ganhos selecionam vendas pela assinatura e mostram o pago acumulado dessas vendas; filtro de mês não cria saldo falso ao omitir repasse posterior. Somente repasse do beneficiário e de parcela recebida da mesma intermediação/venda conta como pago.
- Após distrato, repasses já registrados continuam visíveis com comprovante; valores sem repasse ficam sinalizados para conferência, sem virar obrigação ativa presumida nem autorizar baixa automática. Caixa realmente recebido permanece, sem estorno inventado.
- Celular 393×852: páginas renderizadas, abas navegáveis, tabela com rolagem interna; largura da página 393, sem rolagem lateral da página. Navegações finais sem erros JavaScript.
- Contrato: reenvio de snapshot antigo de tarefa preservou Em leitura e prazo. Leitura da aba Negócio confirmou contrato e checklist informativo.

## Segurança e testes
- Teste SQL `financeiro-permissoes.sql` executado: corretor e gerente recusados em leitura, recebimento e distrato; diretora autorizada na leitura. Identidades oficiais usadas apenas para checar autorização transacional, sem emitir sessão ou alterar dados delas.
- Escritas diretas em parcelas, beneficiários, repasses e auditoria sem privilégios para authenticated. RLS das tabelas financeiras restrita a admin/diretor.
- 40 testes aprovados em sete arquivos: financeiro, seleções, vendas, jornada, confirmação, pagamento e parsing de valores. Última execução em 23/10 às 16:08 UTC; browser final validou filtros, Excel e páginas no celular sem erros.
- Último sinal do preview após as correções: build OK. Revisão por pares independente das permissões/cálculos concluída; revisão local e diff sem erros de espaços.

## Limpeza confirmada
- Clientes `b07aeaa9-35e4-4acb-b65c-097d63869b73`, `7d3fffc8-8040-4c02-8a1a-b092ac029ae1`, `3d8eaf86-59f9-412d-88d7-c6c3e490cc0e` e três negócios fictícios removidos.
- Três intermediações fictícias, parcelas/repasses, atividades, notificações, eventos financeiros e custo fictício removidos com filtros de IDs e validação de nomes de teste.
- Nove anexos fictícios removidos pela API de arquivos após remover referências; leitura final confirmou zero.
- Antes/depois: **115 vendas ativas; VGV R$ 63.459.987,29**. Nenhuma venda real alterada.

## Limitações e pendências
- Skyline e vínculos históricos incertos aguardam confirmação de Lucas; sem alterações ou recebimentos históricos inferidos.
- Entrega física de push em aparelho não verificada; mídia/ROI seguem provisórios nos dias sem cobertura confirmada.
- Conferência financeira de repasses de vendas distratadas é manual; não há estorno ou quitação presumidos.
- Permissões de corretor/gerente/diretora verificadas no servidor, não com sessões próprias dessas pessoas no navegador.