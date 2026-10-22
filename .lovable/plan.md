# Financeiro + Vendas Realizadas + venda ganha com padrão obrigatório

O desenho já está aprovado. O objetivo é ter páginas simples de usar e fáceis de achar, e só deixar uma venda como Ganho (assinada) quando estiver completa.

## Regra principal: venda ganha completa
Para marcar uma venda como Ganho, estes itens são obrigatórios:
- Empreendimento da lista oficial. A construtora entra sozinha.
- Unidade.
- VGV final.
- Data da assinatura.
- Intermediação ligada à venda. Pode ser gerada na hora ou escolhida entre as que já existem para o cliente.
- Comprovante do pagamento do ato, em PDF ou imagem.

O botão "Confirmar venda" só fica liberado quando todos os itens estiverem preenchidos. O sistema também faz essa conferência por conta própria, então uma venda não entra como ganha por nenhum outro caminho, mesmo que alguém tente. A mesma janela é usada em todos os lugares onde a venda pode virar Ganho: o cartão do Pipeline, os detalhes do cliente e a tela de Negócios.

O aviso "Venda assinada" só sai depois que a venda estiver gravada e completa. Hoje ele pode sair mesmo quando a gravação falha.

Vendas antigas não são bloqueadas. Elas aparecem com o selo "documentos pendentes" e entram numa lista de pendências para completar.

## Jornada do negócio: sugestões
1. **Em Negociação, proposta:** registrar o valor da proposta e a unidade pretendida. Assim, ao virar Ganho, esses dados já vêm preenchidos.
2. **Em Negociação, documentação enviada:** uma lista simples de documentos do cliente (RG/CPF, comprovante de renda, comprovante de residência), com check. É só informativa e não bloqueia.
3. **Contrato:** ao entrar, sugerir "Gerar intermediação". O mais comum é a intermediação ficar pronta antes da assinatura.
4. **Contrato "gerado" ou "em leitura" parado há mais de 7 dias:** aviso ao gerente.
5. **Ganho:** a janela de confirmação acima. Depois da assinatura, as parcelas da comissão entram sozinhas no Financeiro, a partir da intermediação.
6. **Distrato:** depois que a venda está ganha, só o CEO (admin) ou a diretora podem registrar o distrato, e apenas no Financeiro, informando motivo e data. Corretor e gerente não conseguem desfazer uma venda ganha. Com o distrato, a venda sai do VGV e as parcelas ainda não recebidas são canceladas.

## Outras sugestões
- **Nome "Vendas":** a página "Vendas Realizadas" passa a se chamar "Vendas" em todos os lugares (menu, títulos, atalhos e menu Mais do celular). O endereço antigo continua funcionando.
- **Menu "Gestão Financeira":** Vendas e Financeiro ficam lado a lado no menu, junto com Intermediação.
- **Busca única:** em Vendas, um campo para achar a venda pelo nome do cliente, pela unidade ou pelo empreendimento.
- **Exportar:** Vendas e Financeiro ganham um botão para baixar Excel com os filtros aplicados.
- **Aviso de parcela:** CEO e diretora recebem, no sino, um aviso das parcelas que vencem na semana e das atrasadas.
- **Histórico de alterações:** toda mudança de VGV, unidade, recebimento ou distrato fica registrada, com quem fez e quando.

## Fases (uma de cada vez, com validação ao vivo e cliente de teste)

**Fase 1: Guardar tudo certo.** As mudanças no banco são feitas depois das 19h.
- A intermediação passa a guardar a forma de pagamento, o percentual da nota, a venda e o cliente ligados, o bruto e o líquido, as parcelas e a divisão por pessoa (corretor, gerente, diretoria e Uhome).
- A venda passa a guardar o comprovante do ato, num local privado. Os arquivos só abrem por um link temporário.
- Gravar a planilha de conferência: as ligações certas entre intermediações e vendas, as repetidas marcadas (por exemplo, as 10 da Andressa) e a correção do Skyline de R$ 32,7 milhões.
- Importar as 34 intermediações do Drive que estão ligadas a vendas de antes de julho.

**Fase 2: Confirmar venda.**
- A janela única de confirmação, usada nos três lugares onde a venda vira Ganho.
- A trava no servidor.
- O aviso "Venda assinada" passa a sair só depois de gravar.
- A lista de pendências das vendas antigas.

**Fase 3: Jornada do negócio.** Entram as sugestões de 1 a 4, se você aprovar.

**Fase 4: Vendas Realizadas nova.**
- Filtros fixos no topo: período, construtora, empreendimento, corretor e equipe.
- Indicadores: VGV, número de vendas, ticket médio e vendas sem intermediação.
- Abas Vendas, Ranking, Construtoras e Origens.
- Selo de documentos em cada venda e detalhe da venda com os anexos.
- O VGV continua vindo da fonte única de hoje, então os números não mudam.

**Fase 5: Financeiro.**
- Só você e a diretora veem.
- Abas A receber, Recebido, Ganhos por pessoa, Custos e Lucro e ROI.
- "Marcar recebida", com a forma de pagamento e o comprovante.
- Nota fiscal mostra o recebido pela Uhome e o repassado ao time.
- Mídia do Meta automática e custos fixos lançados à mão.

**Fase 6: Validação de ponta a ponta.**
- Usar um cliente de teste: Proposta, Contrato, intermediação com Nota fiscal, Ganho com comprovante, parcelas no Financeiro, marcar recebida, conferir em Vendas Realizadas e no painel, depois distrato.
- Apagar tudo no fim.
- Conferir no computador e no celular.

## Detalhes técnicos
- `intermediacoes` (hoje com payload JSON): novas colunas opcionais `forma_pagamento`, `desconto_nf_pct`, `negocio_id`, `pipeline_lead_id`, `valor_bruto`, `valor_liquido`, `status` ('ativa'|'substituida'|'duplicada'), mais um índice único parcial (`negocio_id` com status ativa). A edge `gerar-intermediacao` passa a gravar essas colunas e a recusar intermediação sem forma de pagamento.
- Tabelas novas, com GRANT e RLS restritos a admin/diretor via `has_role`: `intermediacao_beneficiarios` (pessoa, papel, bruto, desconto, líquido), `negocios_recebimentos` (parcela, vencimento, valor, forma, status, recebido_em, comprovante_path), `custos_fixos` e `custos_midia_manual`.
- `negocios`: novas colunas `comprovante_ato_path` e `intermediacao_id`. Gatilho de validação (sem CHECK): quando `fase` vira 'ganho', exige `empreendimento_canonico_id`, `unidade`, `vgv_final`, `data_assinatura`, `intermediacao_id` e `comprovante_ato_path`. Só vale para mudanças a partir de agora; as vendas existentes ficam de fora pela data de corte.
- Bucket privado `vendas-docs`, com políticas no `storage.objects` (o corretor e o gerente da venda enviam; gestão e diretoria leem) e links assinados.
- Views: `v_financeiro_recebimentos`, `v_ganhos_pessoa` e `v_resultado_mensal`. A mídia vem de `marketing_entries`.
- Front:
  - Novo `ConfirmarVendaDialog`, usado em `PipelineStageTransitionPopup`, `NegociosBoardInline`/`useNegociosBoard` e no drawer do lead.
  - `usePipeline.moveLead` passa a mandar os novos campos e a mostrar o aviso só depois de gravar.
  - `VendasRealizadas.tsx` (1.028 linhas) é dividida em `src/components/vendas/` (filtros, indicadores, abas, detalhe).
  - Nova página `/financeiro` em `src/components/financeiro/` com um controller compartilhado, registrada em `pageRegistry` e restrita a admin/diretor.
  - `IntermediacaoPage.tsx` (1.073 linhas) termina a divisão em componentes.
- Testes: a regra "Ganho exige os 6 itens", o cálculo das parcelas e do NF −10%, e a distribuição por pessoa igual ao líquido.
- No máximo 2 mudanças de banco por dia, sempre depois das 19h. `AGENTS.md` ganha a regra da trava de Ganho, e a memória ganha a regra "venda ganha exige comprovante + intermediação".
